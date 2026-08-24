// Every pinned digest is byte-for-byte from TronWeb's `utils.typedData`
// (`TypedDataEncoder.hash` / `.hashDomain`), an ethers-fork oracle. Oracle
// `address` values are 0x EVM form; tviem additionally accepts base58 / 41-hex
// and must collapse them to the same 20-byte word (address-form invariance —
// the one genuinely TRON-specific behavior of the digest).
import { describe, expect, test } from 'vitest'

import { BytesSizeMismatchError } from '../../../src/errors/abi.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import type { AddressInput, EvmAddress } from '../../../src/types/address.js'
import { concat } from '../../../src/utils/data/concat.js'
import { keccak256 } from '../../../src/utils/hash/keccak256.js'
import {
  hashDomain,
  hashTypedData,
} from '../../../src/utils/signature/hashTypedData.js'

// 0x EVM address forms for pk=1 / pk=2 (the form the oracle requires).
const PK1: EvmAddress = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'
const PK2: EvmAddress = '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'

const domain = {
  name: 'Example TIP-712',
  version: '1',
  chainId: 728126428n, // TRON mainnet chainId (0x2b6653dc)
  verifyingContract: PK2,
}

// ---- Case 1: canonical Mail (nested Person structs, string, address) --------
const mailTypes = {
  Person: [
    { name: 'name', type: 'string' },
    { name: 'wallet', type: 'address' },
  ],
  Mail: [
    { name: 'from', type: 'Person' },
    { name: 'to', type: 'Person' },
    { name: 'contents', type: 'string' },
  ],
} as const
const mail = {
  from: { name: 'Alice', wallet: PK1 },
  to: { name: 'Bob', wallet: PK2 },
  contents: 'Hello, Bob!',
}
const mailDomainHash =
  '0x72436b46c555ba306e668db3d2b267531c668c282f370a7bcb37b666e9e19d59'
const mailDigest =
  '0x2d4f768f1cc74a03ba2e13748dcaefdcc11811292ab1abaa8434bb054a9d1ef4'

describe('hashDomain', () => {
  test('matches the oracle EIP712Domain hash', () => {
    expect(hashDomain(domain)).toBe(mailDomainHash)
  })

  test('drops absent fields (name/version/chainId only)', () => {
    // Self-consistency: a domain missing verifyingContract hashes over just
    // its present fields; adding a null field is identical to omitting it.
    const partial = {
      name: 'Example TIP-712',
      version: '1',
      chainId: 728126428n,
    }
    expect(hashDomain(partial)).toBe(
      hashDomain({ ...partial, verifyingContract: undefined }),
    )
  })
})

describe('hashTypedData', () => {
  test('matches the oracle digest for the canonical Mail', () => {
    expect(
      hashTypedData({
        domain,
        types: mailTypes,
        primaryType: 'Mail',
        message: mail,
      }),
    ).toBe(mailDigest)
  })

  test('address-form invariance: base58 / 41-hex / 0x yield the same digest', () => {
    const forms: { wallet: AddressInput; contract: AddressInput }[] = [
      { wallet: PK2, contract: PK2 }, // 0x EVM
      {
        wallet: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
        contract: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      }, // base58
      {
        wallet: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
        contract: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
      }, // 41-hex
    ]
    for (const { wallet, contract } of forms)
      expect(
        hashTypedData({
          domain: { ...domain, verifyingContract: contract },
          types: mailTypes,
          primaryType: 'Mail',
          message: { ...mail, to: { name: 'Bob', wallet } },
        }),
      ).toBe(mailDigest)
  })

  test('domain-only (primaryType EIP712Domain) hashes just the domain', () => {
    expect(
      hashTypedData({ domain, types: {}, primaryType: 'EIP712Domain' }),
    ).toBe(keccak256(concat(['0x1901', hashDomain(domain)])))
  })

  // ---- Case 2: kitchen-sink scalar / array / bytes struct -------------------
  test('matches the oracle digest across every scalar / array / bytes width', () => {
    const sinkTypes = {
      Sink: [
        { name: 'u256', type: 'uint256' },
        { name: 'i256', type: 'int256' },
        { name: 'u8', type: 'uint8' },
        { name: 'i8', type: 'int8' },
        { name: 'flag', type: 'bool' },
        { name: 'raw', type: 'bytes' },
        { name: 'word', type: 'bytes32' },
        { name: 'who', type: 'address' },
        { name: 'note', type: 'string' },
        { name: 'nums', type: 'uint256[]' },
        { name: 'triple', type: 'uint8[3]' },
      ],
    } as const
    const sink = {
      u256: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      i256: '-170141183460469231731687303715884105728',
      u8: 255,
      i8: -128,
      flag: true,
      raw: '0xdeadbeefcafe',
      word: '0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      who: PK1,
      note: 'sink',
      nums: ['0', '1', '340282366920938463463374607431768211455'],
      triple: [1, 2, 3],
    }
    expect(
      hashTypedData({
        domain,
        types: sinkTypes,
        primaryType: 'Sink',
        message: sink,
      }),
    ).toBe('0x323068fb563c40983e7966ebbe74ad221a0b090a483e143ad682d2e764934a03')
  })

  // ---- Case 3: trcToken (TRON-native type; oracle keeps it in encodeType) ---
  test('matches the oracle digest for a trcToken field', () => {
    const payTypes = {
      Pay: [
        { name: 'token', type: 'trcToken' },
        { name: 'amount', type: 'uint256' },
      ],
    } as const
    const pay = { token: '1000001', amount: '42' }
    const trcDigest =
      '0xb5ff276c84bcfd3261c31b46a76ce3f0151ffca89bab23ccdb41da608f737fab'
    expect(
      hashTypedData({
        domain,
        types: payTypes,
        primaryType: 'Pay',
        message: pay,
      }),
    ).toBe(trcDigest)

    // trcToken is a distinct type string from uint256 (`trcToken token` vs
    // `uint256 token`), so the digest differs even though both encode to a
    // uint256 word — the type hash includes the field type name.
    const u256Types = {
      Pay: [
        { name: 'token', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
      ],
    } as const
    expect(
      hashTypedData({
        domain,
        types: u256Types,
        primaryType: 'Pay',
        message: pay,
      }),
    ).not.toBe(trcDigest)
  })

  test('throws on an unsupported field type', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'f', type: 'function' }] },
        primaryType: 'X',
        message: { f: '0x00' },
      }),
    ).toThrow()
  })
})

// A `string` field value must be hashed as UTF-8, never re-read as hex — the
// bug hashed the 4 bytes of `"0xdeadbeef"` instead of its 10 characters, so a
// signature could not interoperate with any standard implementation. Digests
// pinned from viem's `hashTypedData` (offline; the repo does not depend on
// viem), which UTF-8-encodes strings via `toHex`.
describe('hashTypedData string fields are UTF-8, not hex', () => {
  const stringDomain = { name: 'TIP712', version: '1' }
  const stringTypes = { Doc: [{ name: 'ref', type: 'string' }] } as const
  const digestOf = (ref: string) =>
    hashTypedData({
      domain: stringDomain,
      types: stringTypes,
      primaryType: 'Doc',
      message: { ref },
    })

  test.each([
    [
      'a hex-looking string',
      '0xdeadbeef',
      '0x04faca7a3ead59f1191fd44764e4a7ffca543fc1f4e7d7961ae7cc35d6c5cf1c',
    ],
    [
      'a bare "0x"',
      '0x',
      '0xcd1890c8b746545f7ab2c444d35e3decde558a202d19ed600666ea18924cfe58',
    ],
    [
      'plain ASCII',
      'Hello, Bob!',
      '0xa7e01d6a31b086ddd5674422b31e3f603b795173f5be5780d3a74bbdbbcc3a89',
    ],
    [
      'emoji',
      '🚀 send',
      '0x36b600a21013ec6b82e81f5d218b55b65e4837a0cdc5f8b493f982ac4d7cb23e',
    ],
    [
      'the empty string',
      '',
      '0xd85716680b8d1c9d8f6c9b7fa870272f310288f91e3c37df764d2e1e5861109b',
    ],
  ])('%s matches the viem oracle digest', (_label, ref, expected) => {
    expect(digestOf(ref)).toBe(expected)
  })
})

describe('hashTypedData validation', () => {
  test('rejects an integer beyond its declared width', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'n', type: 'uint8' }] },
        primaryType: 'X',
        message: { n: 256 },
      }),
    ).toThrow(IntegerOutOfRangeError)
  })

  test('rejects a signed integer below its declared width', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'n', type: 'int8' }] },
        primaryType: 'X',
        message: { n: -129 },
      }),
    ).toThrow(IntegerOutOfRangeError)
  })

  test('rejects a negative value for an unsigned integer given as a string', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'n', type: 'uint16' }] },
        primaryType: 'X',
        message: { n: '65536' },
      }),
    ).toThrow(IntegerOutOfRangeError)
  })

  test('validates integers inside array elements', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'nums', type: 'uint8[3]' }] },
        primaryType: 'X',
        message: { nums: [1, 256, 3] },
      }),
    ).toThrow(IntegerOutOfRangeError)
  })

  test('validates fields of nested structs', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: {
          Inner: [{ name: 'n', type: 'uint8' }],
          X: [{ name: 'inner', type: 'Inner' }],
        },
        primaryType: 'X',
        message: { inner: { n: 300 } },
      }),
    ).toThrow(IntegerOutOfRangeError)
  })

  test('rejects a bytesN value of the wrong size', () => {
    // Undersized: 31 bytes for bytes32 (currently right-padded silently).
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type: 'bytes32' }] },
        primaryType: 'X',
        message: {
          b: '0x00112233445566778899aabbccddeeff00112233445566778899aabbccddee',
        },
      }),
    ).toThrow(BytesSizeMismatchError)
    // Oversized (but under a word): 5 bytes for bytes4.
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type: 'bytes4' }] },
        primaryType: 'X',
        message: { b: '0x1122334455' },
      }),
    ).toThrow(BytesSizeMismatchError)
  })

  test('rejects a primaryType missing from types', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: mailTypes,
        primaryType: 'Missing',
        message: mail,
      }),
    ).toThrow('Invalid primary type')
  })

  test('rejects a struct type that shadows a primitive type', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: {
          uint256: [{ name: 'value', type: 'string' }],
          X: [{ name: 'n', type: 'uint256' }],
        },
        primaryType: 'X',
        message: { n: { value: 'hijacked' } },
      }),
    ).toThrow('Struct type "uint256" is invalid')
  })

  test('rejects a primaryType that shadows a primitive type', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { uint256: [{ name: 'value', type: 'string' }] },
        primaryType: 'uint256',
        message: { value: 'hijacked' },
      }),
    ).toThrow('Struct type "uint256" is invalid')
  })

  test('rejects a struct type that shadows trcToken', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: {
          trcToken: [{ name: 'value', type: 'string' }],
          X: [{ name: 't', type: 'trcToken' }],
        },
        primaryType: 'X',
        message: { t: { value: 'hijacked' } },
      }),
    ).toThrow('Struct type "trcToken" is invalid')
  })

  test('rejects a non-object domain', () => {
    expect(() =>
      hashTypedData({
        domain: 'not a domain' as never,
        types: mailTypes,
        primaryType: 'Mail',
        message: mail,
      }),
    ).toThrow('Invalid domain')
  })

  test('rejects a domain salt of the wrong size', () => {
    expect(() =>
      hashTypedData({
        domain: { ...domain, salt: '0x1234' },
        types: mailTypes,
        primaryType: 'Mail',
        message: mail,
      }),
    ).toThrow(BytesSizeMismatchError)
  })

  test('rejects a domain chainId beyond uint256', () => {
    expect(() =>
      hashTypedData({
        domain: { ...domain, chainId: 2n ** 256n },
        types: mailTypes,
        primaryType: 'Mail',
        message: mail,
      }),
    ).toThrow(IntegerOutOfRangeError)
  })
})
