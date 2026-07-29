// TRON-specific, clean-room tests for @tronweb3/tviem.
// Every pinned digest is byte-for-byte from TronWeb's `utils.typedData`
// (`TypedDataEncoder.hash` / `.hashDomain`), an ethers-fork oracle. Oracle
// `address` values are 0x EVM form; omni additionally accepts base58 / 41-hex
// and must collapse them to the same 20-byte word (address-form invariance —
// the one genuinely TRON-specific behavior of the digest).
import { describe, expect, test } from 'vitest'

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
  name: 'Omni TIP-712',
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
  '0xc06892a7fa8ece3ba29b12601a06b95d32b3d5faee1926952ca012621a87c9b0'
const mailDigest =
  '0xd80e28b4e265af88bf97816618e50cc1e3f75ad013ffaa1820a21557661c6c90'

describe('hashDomain', () => {
  test('matches the oracle EIP712Domain hash', () => {
    expect(hashDomain(domain)).toBe(mailDomainHash)
  })

  test('drops absent fields (name/version/chainId only)', () => {
    // Self-consistency: a domain missing verifyingContract hashes over just
    // its present fields; adding a null field is identical to omitting it.
    const partial = { name: 'Omni TIP-712', version: '1', chainId: 728126428n }
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
    ).toBe('0x4c174e3f0fa8bf4bd14eb5a73e4c952931a80bcace44201cd8e2bf1a5eb86d78')
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
      '0x25d9ee3ac3b42bfdb3c2c618c59c2ad088be78bd58680df18f36a59f62e9cd17'
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
