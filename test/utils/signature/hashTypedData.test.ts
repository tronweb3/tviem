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
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
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

  test('a derived domain is hashed as bare primitives, never against `types`', () => {
    // Without a `types.EIP712Domain` declaration the domain struct is the
    // canonical one, so its `string` / `address` fields are primitives by
    // definition. Structs that merely share those names must not capture them:
    // an empty `string()` struct hashes to a constant, which would drop the
    // domain's `name` — and `address()` its `verifyingContract` — out of the
    // hash entirely, making every domain hash alike.
    expect(hashDomain(domain, { string: [], address: [] })).toBe(mailDomainHash)
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

  // `validateField` accepts a `Uint8Array` for `bytesN` (it size-checks it),
  // so `encodeField` must encode it too — to the same word as its hex form.
  test('bytesN form invariance: Uint8Array and hex yield the same digest', () => {
    const wordHex =
      '0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
    const types = { X: [{ name: 'word', type: 'bytes32' }] } as const
    const fromHex = hashTypedData({
      domain,
      types,
      primaryType: 'X',
      message: { word: wordHex },
    })
    expect(
      hashTypedData({
        domain,
        types,
        primaryType: 'X',
        message: { word: hexToBytes(wordHex) },
      }),
    ).toBe(fromHex)
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

// ---- Case 4: caller-supplied `types.EIP712Domain` ---------------------------
// A declared `EIP712Domain` overrides the canonical derivation: its fields are
// hashed in DECLARED order with their DECLARED types, so a protocol whose
// domain differs from the canonical five is expressible. Digests pinned from
// viem's `hashTypedData` / `hashDomain` (offline; the repo does not depend on
// viem), which honor the declaration the same way.
describe('caller-supplied EIP712Domain types', () => {
  // Non-canonical field order plus a custom `app` field — neither is
  // expressible through the canonical derivation.
  const customDomain = {
    verifyingContract: PK2,
    name: 'Example TIP-712',
    app: 'tviem',
  }
  const customDomainType = [
    { name: 'verifyingContract', type: 'address' },
    { name: 'name', type: 'string' },
    { name: 'app', type: 'string' },
  ] as const

  test('an explicit canonical declaration matches the derived digest', () => {
    expect(
      hashTypedData({
        domain,
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ...mailTypes,
        },
        primaryType: 'Mail',
        message: mail,
      }),
    ).toBe(mailDigest)
  })

  test('hashDomain hashes the declared fields in declared order', () => {
    expect(hashDomain(customDomain, { EIP712Domain: customDomainType })).toBe(
      '0xf1f80082a6dc4d1d48a0a2b53f22892fba7972a57ed2bbc21ef511a7c1ed0e9f',
    )
  })

  test('matches the viem oracle digest for a custom domain (domain-only)', () => {
    expect(
      hashTypedData({
        domain: customDomain,
        types: { EIP712Domain: customDomainType },
        primaryType: 'EIP712Domain',
      }),
    ).toBe('0x8c9a8ec5c5664129be0769ee24fff2f5f8f6d5315c7e0e483f3cdb352912e023')
  })

  test('matches the viem oracle digest for a custom domain (Mail)', () => {
    expect(
      hashTypedData({
        domain: customDomain,
        types: { EIP712Domain: customDomainType, ...mailTypes },
        primaryType: 'Mail',
        message: mail,
      }),
    ).toBe('0x3d9133e3e38d2c8adf6b71897c757d94dda203d6635c59f34710bce8bc3bb8c2')
  })

  test('a declared domain field must be present', () => {
    expect(() =>
      hashTypedData({
        domain: { verifyingContract: PK2, name: 'Example TIP-712' },
        types: { EIP712Domain: customDomainType },
        primaryType: 'EIP712Domain',
      }),
    ).toThrow(/Missing EIP712Domain\.app value/)
  })

  test('rejects a domain field outside the declared type', () => {
    // `version` is canonical but NOT declared — hashing would drop it.
    expect(() =>
      hashTypedData({
        domain: { ...customDomain, version: '1' },
        types: { EIP712Domain: customDomainType },
        primaryType: 'EIP712Domain',
      }),
    ).toThrow(/Unknown domain field "version"/)
  })

  test('validates declared domain values against their declared types', () => {
    expect(() =>
      hashTypedData({
        domain: { ...customDomain, app: 300 },
        types: {
          EIP712Domain: [
            ...customDomainType.slice(0, 2),
            { name: 'app', type: 'uint8' },
          ],
        },
        primaryType: 'EIP712Domain',
      }),
    ).toThrow(IntegerOutOfRangeError)
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
  // A `bool` field encodes by truthiness, so a non-boolean value would sign
  // the opposite of what it spells (`"false"` is truthy). Only a real boolean
  // is accepted (mirrors the codec's bool guard and viem's encodeBool).
  test.each([
    ['the string "false"', 'false', /Invalid bool value/],
    ['the string "true"', 'true', /Invalid bool value/],
    ['the number 0', 0, /Invalid bool value/],
    ['the number 1', 1, /Invalid bool value/],
    ['null', null, /Invalid bool value/],
    // An undefined field is caught by the missing-field check before the
    // bool guard sees it.
    ['undefined', undefined, /Missing X.flag value/],
  ])('rejects %s for a bool field', (_label, flag, error) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'flag', type: 'bool' }] },
        primaryType: 'X',
        message: { flag },
      }),
    ).toThrow(error)
  })

  test('accepts real booleans for a bool field', () => {
    for (const flag of [true, false])
      expect(() =>
        hashTypedData({
          domain,
          types: { X: [{ name: 'flag', type: 'bool' }] },
          primaryType: 'X',
          message: { flag },
        }),
      ).not.toThrow()
  })

  // A `string` field is hashed through `TextEncoder`, which ToString-coerces
  // anything: `null` → "null", `['a','b']` → "a,b" (the same digest as the
  // string "a,b"), `{}` → "[object Object]". ethers and viem throw on these,
  // so a signature over the coerced digest cannot be cross-verified. Only a
  // real string is accepted.
  test.each([
    ['null', null],
    ['a number', 42],
    ['an array', ['a', 'b']],
    ['an object', {}],
    ['a Uint8Array', new Uint8Array([1, 2])],
  ])('rejects %s for a string field', (_label, memo) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'memo', type: 'string' }] },
        primaryType: 'X',
        message: { memo },
      }),
    ).toThrow(/Invalid string value/)
  })

  test('accepts the empty string for a string field', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'memo', type: 'string' }] },
        primaryType: 'X',
        message: { memo: '' },
      }),
    ).not.toThrow()
  })

  // A `number` past 2^53 arrives already rounded, so encoding it would sign a
  // value the caller never wrote; a fraction/NaN would otherwise leak a raw
  // RangeError. Only safe-integer numbers (or bigint / decimal string) pass.
  test.each([
    ['an unsafe integer past 2^53', Number.MAX_SAFE_INTEGER + 2],
    ['a fraction', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects %s given as a number for a uint256 field', (_label, n) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'n', type: 'uint256' }] },
        primaryType: 'X',
        message: { n },
      }),
    ).toThrow(/not a safe integer/)
  })

  test('accepts a large value past 2^53 as a bigint or decimal string', () => {
    for (const n of [9007199254740993n, '9007199254740993'])
      expect(() =>
        hashTypedData({
          domain,
          types: { X: [{ name: 'n', type: 'uint256' }] },
          primaryType: 'X',
          message: { n },
        }),
      ).not.toThrow()
  })

  // A string integer must be a plain decimal. `BigInt()` coerces far more
  // than that — `BigInt('')` and `BigInt('   ')` are 0n, and it reads hex,
  // binary, octal and padded strings — so the width check ran on the coerced
  // value and passed. An integer field arriving as `''` (an unfilled form
  // input, `String(x ?? '')`) was signed as a valid 0: harmless for an amount,
  // but for `minAmountOut` / `deadline` / `nonce` zero switches off the very
  // limit the signer believes they set.
  test.each([
    ['the empty string', ''],
    ['whitespace', '   '],
    ['a padded decimal', ' 42 '],
    ['hex', '0x2a'],
    ['binary', '0b101010'],
    ['octal', '0o52'],
    ['an explicit plus sign', '+42'],
    ['a fraction', '4.2'],
    ['exponent notation', '1e3'],
    ['a non-numeric string', 'abc'],
  ])('rejects %s as an integer value', (_, n) => {
    for (const type of ['uint256', 'uint8', 'int256', 'trcToken'])
      expect(() =>
        hashTypedData({
          domain,
          types: { X: [{ name: 'n', type }] },
          primaryType: 'X',
          message: { n },
        }),
      ).toThrow(
        `Invalid ${type} value: "${n}" is not a decimal integer string.`,
      )
  })

  test('a decimal string still signs the value it spells', () => {
    const hash = (type: string, n: unknown) =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'n', type }] },
        primaryType: 'X',
        message: { n },
      } as never)

    expect(hash('uint256', '42')).toBe(hash('uint256', 42n))
    expect(hash('uint256', '0')).toBe(hash('uint256', 0n))
    expect(hash('uint256', '007')).toBe(hash('uint256', 7n))
    expect(hash('int256', '-42')).toBe(hash('int256', -42n))
    expect(hash('trcToken', '1000001')).toBe(hash('trcToken', 1000001n))
    // A well-formed decimal is still held to the declared width.
    expect(() => hash('uint8', '256')).toThrow(IntegerOutOfRangeError)
    expect(() => hash('uint8', '-1')).toThrow(IntegerOutOfRangeError)
  })

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

  // A fixed-size `T[N]` must carry exactly N elements, else the digest is for a
  // different value than the type declares.
  test.each([
    ['too few', [1, 2]],
    ['too many', [1, 2, 3, 4]],
    ['a non-array', 5],
  ])('rejects a uint8[3] with %s', (_label, triple) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 't', type: 'uint8[3]' }] },
        primaryType: 'X',
        message: { t: triple },
      }),
    ).toThrow(/expected an array of length 3/)
  })

  test('accepts a uint8[3] of exactly three elements', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 't', type: 'uint8[3]' }] },
        primaryType: 'X',
        message: { t: [1, 2, 3] },
      }),
    ).not.toThrow()
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

  // EIP-712 has no optional fields: every declared field must be present. A
  // missing `string` field would otherwise hash as "" (TextEncoder coerces
  // undefined to the empty string) — a plausible digest for a value the caller
  // never wrote.
  test.each([
    ['an absent', {}],
    ['an explicitly undefined', { a: undefined }],
  ])('rejects %s value for a declared struct field', (_label, message) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'a', type: 'string' }] },
        primaryType: 'X',
        message,
      }),
    ).toThrow(/Missing X.a value/)
  })

  test.each([
    ['a number', 5],
    ['a string', 'nope'],
    ['null', null],
    ['an object', {}],
  ])('rejects %s for a dynamic uint8[] field', (_label, t) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 't', type: 'uint8[]' }] },
        primaryType: 'X',
        message: { t },
      }),
    ).toThrow(/Invalid uint8\[\] value: expected an array/)
  })

  test.each([
    ['a string', 'nope'],
    ['a number', 7],
    ['null', null],
    ['an array', [1, 2]],
  ])('rejects %s for a nested struct field', (_label, inner) => {
    expect(() =>
      hashTypedData({
        domain,
        types: {
          Inner: [{ name: 'n', type: 'uint8' }],
          X: [{ name: 'inner', type: 'Inner' }],
        },
        primaryType: 'X',
        message: { inner },
      }),
    ).toThrow(/Invalid Inner value: expected an object/)
  })

  // Hex bytes values must denote whole bytes and carry the 0x prefix: an odd
  // nibble count gets a nibble invented by padding (and slips past the bytesN
  // size check, which rounds UP), while an unprefixed string loses its leading
  // byte to `slice(2)` — either way the digest is over bytes the caller never
  // wrote.
  test.each([
    ['an odd nibble count', '0x123'],
    ['a missing 0x prefix', 'deadbeef'],
  ])('rejects a dynamic bytes value with %s', (_label, b) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type: 'bytes' }] },
        primaryType: 'X',
        message: { b },
      }),
    ).toThrow(/Invalid bytes value/)
  })

  test('rejects a bytesN value with an odd nibble count (size rounds up)', () => {
    // 63 nibbles: size() rounds up to 32, so only the whole-byte check can
    // catch it.
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type: 'bytes32' }] },
        primaryType: 'X',
        message: { b: `0x${'1'.repeat(63)}` },
      }),
    ).toThrow(/Invalid bytes32 value/)
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type: 'bytes4' }] },
        primaryType: 'X',
        message: { b: '0x1122334' },
      }),
    ).toThrow(/Invalid bytes4 value/)
  })

  test('rejects a bytesN value without the 0x prefix', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type: 'bytes4' }] },
        primaryType: 'X',
        message: { b: '11223344' },
      }),
    ).toThrow(/Invalid bytes4 value/)
  })

  test('rejects a domain salt with an odd nibble count', () => {
    expect(() =>
      hashTypedData({
        domain: { ...domain, salt: `0x${'a'.repeat(63)}` },
        types: {},
        primaryType: 'EIP712Domain',
      }),
    ).toThrow(/Invalid bytes32 value/)
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

  // Only `bytes` and `bytes1`..`bytes32` exist. A misspelt or out-of-range
  // width used to be encoded anyway — right-padded into one 32-byte word — so
  // it skipped every bytes check, and a `bytes33` could never hold 33 bytes:
  // distinct short values folded into the same word, hence the same digest.
  test.each([
    'bytes0',
    'bytes33',
    'bytes100',
    'bytes032',
    'bytesfoo',
  ])('rejects the non-existent bytes type %s', (type) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type }] },
        primaryType: 'X',
        message: { b: '0x1234' },
      }),
    ).toThrow(`Unsupported TIP-712 field type: "${type}".`)
  })

  // The integer branch dispatched by prefix the same way.
  test.each([
    'uint7',
    'int300',
    'uint0',
    'uintfoo',
    'integer',
  ])('rejects the non-existent integer type %s', (type) => {
    expect(() =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'n', type }] },
        primaryType: 'X',
        message: { n: 5 },
      }),
    ).toThrow(`Unsupported TIP-712 field type: "${type}".`)
  })

  test('hashDomain rejects a non-existent type in a declared EIP712Domain', () => {
    // `hashDomain` is public and hashes without the validation pass, so the
    // encoder itself must refuse the type.
    expect(() =>
      hashDomain(
        { name: 'x', salt: '0x1234' },
        {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'salt', type: 'bytes33' },
          ],
        },
      ),
    ).toThrow('Unsupported TIP-712 field type: "bytes33".')
  })

  // A bytes value is a hex string or a `Uint8Array`, nothing else. The hex
  // checks were gated on `typeof value === 'string'`, so any other kind passed
  // validation untouched. As an array element it was then swallowed by byte
  // padding (`length` undefined skips the overflow check, every index reads
  // `undefined` → 0) and hashed as 32 zero bytes — `[1234]`, `[5678]` and
  // `[true]` all signing the digest of `[0x00…00]`.
  test.each([
    ['a number', 1234],
    ['a bigint', 1234n],
    ['a boolean', true],
    ['null', null],
    ['an object', {}],
    ['an array', [1, 2]],
  ])('rejects %s as a bytes value, in every position', (_, value) => {
    const hash = (type: string, b: unknown) =>
      hashTypedData({
        domain,
        types: { X: [{ name: 'b', type }] },
        primaryType: 'X',
        message: { b },
      } as never)

    expect(() => hash('bytes32', value)).toThrow(/Invalid bytes32 value/)
    expect(() => hash('bytes', value)).toThrow(/Invalid bytes value/)
    expect(() => hash('bytes32[]', [value])).toThrow(/Invalid bytes32 value/)
    expect(() => hash('bytes32[1]', [value])).toThrow(/Invalid bytes32 value/)
    expect(() => hash('bytes[]', [value])).toThrow(/Invalid bytes value/)
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

  test('rejects a primitive-shadowing struct that no message field references', () => {
    // Reachability from `primaryType` is not the whole story: the derived
    // domain also has `string` / `address` fields, so a shadowing struct that
    // the message tree never touches is still refused rather than ignored.
    expect(() =>
      hashTypedData({
        domain,
        types: {
          string: [],
          X: [{ name: 'n', type: 'uint256' }],
        },
        primaryType: 'X',
        message: { n: 1n },
      }),
    ).toThrow('Struct type "string" is invalid')
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

  // An unknown domain field has no slot in the `EIP712Domain` struct, so it
  // would vanish from the hash without a trace — the caller signs less than
  // they wrote. (The oracle throws `invalid typed-data domain key` here too.)
  test('rejects an unknown domain field with no EIP712Domain declaration', () => {
    expect(() =>
      hashTypedData({
        domain: { ...domain, app: 'tviem' },
        types: mailTypes,
        primaryType: 'Mail',
        message: mail,
      }),
    ).toThrow(/Unknown domain field "app"/)
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

// ---- Getter/object-value hardening ------------------------------------------

describe('input hardening', () => {
  const mailTypes = {
    Mail: [{ name: 'amount', type: 'uint256' }],
  }

  test('reads each message field once: the validated value is the hashed value', () => {
    // Validation and hashing are two traversals; without the entry snapshot a
    // getter could show the validator one value and hash another — and the
    // digest is what gets signed.
    let reads = 0
    const digest = hashTypedData({
      domain,
      types: mailTypes,
      primaryType: 'Mail',
      message: {
        get amount() {
          reads++
          return reads === 1 ? 1n : 1_000_000_000n
        },
      },
    })
    expect(digest).toBe(
      hashTypedData({
        domain,
        types: mailTypes,
        primaryType: 'Mail',
        message: { amount: 1n },
      }),
    )
  })

  test('rejects a BigNumber-style object as an integer value', () => {
    // Objects convert through toString/valueOf — two different conversions,
    // so they are refused outright (by decision) rather than coerced.
    // Faithful to bignumber.js: own data fields, methods on the prototype
    // (the entry snapshot strips the prototype, so the clear rejection below
    // must come from the field validation, not from the clone).
    class FakeBigNumber {
      s = 1
      e = 0
      c = [1]
      toString() {
        return '1'
      }
      valueOf() {
        return '1'
      }
    }
    expect(() =>
      hashTypedData({
        domain,
        types: mailTypes,
        primaryType: 'Mail',
        message: { amount: new FakeBigNumber() },
      }),
    ).toThrow(
      'Invalid uint256 value: expected a bigint, number or decimal string, got object',
    )
    // An own conversion method is live code and dies even earlier, in the
    // snapshot itself.
    expect(() =>
      hashTypedData({
        domain,
        types: mailTypes,
        primaryType: 'Mail',
        message: { amount: { toString: () => '1', valueOf: () => 2n } },
      }),
    ).toThrow('must be plain data')
  })

  test('rejects an object value for trcToken', () => {
    expect(() =>
      hashTypedData({
        domain,
        types: { Order: [{ name: 'token', type: 'trcToken' }] },
        primaryType: 'Order',
        message: { token: new Number(1002000) },
      }),
    ).toThrow(
      'Invalid trcToken value: expected a bigint, number or decimal string',
    )
  })
})
