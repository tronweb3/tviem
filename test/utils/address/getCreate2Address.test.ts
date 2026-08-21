import { expect, test } from 'vitest'
import { BaseError } from '../../../src/errors/base.js'
import { SizeExceedsPaddingSizeError } from '../../../src/errors/data.js'
import type { Hex } from '../../../src/types/misc.js'
import { getCreate2Address } from '../../../src/utils/address/getCreate2Address.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { keccak256 } from '../../../src/utils/hash/keccak256.js'

// Gold vectors per TIP-26: `41` ++ keccak256(creator21 ‖ salt32 ‖
// keccak256(initCode))[12:], an 85-byte preimage. Derived with composition
// machinery validated against the official EIP-1014 vectors, which share the
// exact byte layout with `ff` in place of TRON's `41`.
const vectors = [
  {
    creator: '410000000000000000000000000000000000000000',
    salt: '0000000000000000000000000000000000000000000000000000000000000000',
    bytecode: '00',
    expected: '4165a4f4773d93d98362d0dc131dd51ada88c34f7f',
  },
  {
    creator: '41deadbeef00000000000000000000000000000000',
    salt: '0000000000000000000000000000000000000000000000000000000000000000',
    bytecode: '00',
    expected: '4129a2574c282a56ab6d8e12c922a0d63625a243ef',
  },
  {
    creator: '41deadbeef00000000000000000000000000000000',
    salt: '000000000000000000000000feed000000000000000000000000000000000000',
    bytecode: '00',
    expected: '413f2abacf9524762d484ceb3dfb79cb6735388075',
  },
  {
    creator: '4100000000000000000000000000000000deadbeef',
    salt: '00000000000000000000000000000000000000000000000000000000cafebabe',
    bytecode: 'deadbeef',
    expected: '41ece484536af6315b7af4b9f5ad31eb684e1b3aa4',
  },
  {
    creator: '410000000000000000000000000000000000000000',
    salt: '0000000000000000000000000000000000000000000000000000000000000000',
    bytecode: '',
    expected: '41fb3a2d661eb5d8b080361a50803c425352242465',
  },
  {
    creator: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
    salt: '01',
    bytecode: '608060405260008055',
    expected: '4154cd0eaa908ff9b07b4608dac1090c4373960158',
  },
] as const

test.each(
  vectors,
)('getCreate2Address matches gold vector: creator $creator salt $salt', ({
  creator,
  salt,
  bytecode,
  expected,
}) => {
  expect(getCreate2Address({ creatorAddress: creator, salt, bytecode })).toBe(
    expected,
  )
})

test.each(
  vectors,
)('getCreate2Address accepts bytecodeHash: creator $creator salt $salt', ({
  creator,
  salt,
  bytecode,
  expected,
}) => {
  const bytecodeHash = keccak256(`0x${bytecode}` as Hex, 'hex')
  expect(
    getCreate2Address({ creatorAddress: creator, salt, bytecodeHash }),
  ).toBe(expected)
})

test('getCreate2Address accepts 0x-prefixed inputs', () => {
  const { creator, salt, bytecode, expected } = vectors[3]
  expect(
    getCreate2Address({
      creatorAddress: `0x${creator}`,
      salt: `0x${salt}`,
      bytecode: `0x${bytecode}`,
    }),
  ).toBe(expected)
})

test('getCreate2Address accepts a bare bytecodeHash', () => {
  const { creator, salt, bytecode, expected } = vectors[3]
  const bytecodeHash = keccak256(`0x${bytecode}` as Hex, 'hex').slice(2)
  expect(
    getCreate2Address({ creatorAddress: creator, salt, bytecodeHash }),
  ).toBe(expected)
})

test('getCreate2Address accepts ByteArray inputs', () => {
  const { creator, salt, bytecode, expected } = vectors[3]
  expect(
    getCreate2Address({
      creatorAddress: hexToBytes(`0x${creator}`),
      salt: hexToBytes(`0x${salt}`),
      bytecode: hexToBytes(`0x${bytecode}`),
    }),
  ).toBe(expected)
})

test('getCreate2Address accepts a ByteArray bytecodeHash', () => {
  const { creator, salt, bytecode, expected } = vectors[3]
  const bytecodeHash = keccak256(`0x${bytecode}` as Hex, 'bytes')
  expect(
    getCreate2Address({ creatorAddress: creator, salt, bytecodeHash }),
  ).toBe(expected)
})

test('getCreate2Address accepts mixed ByteArray and hex inputs', () => {
  const { creator, salt, bytecode, expected } = vectors[3]
  expect(
    getCreate2Address({
      creatorAddress: hexToBytes(`0x${creator}`),
      salt: `0x${salt}`,
      bytecode,
    }),
  ).toBe(expected)
})

test('getCreate2Address left-pads a ByteArray salt to a 32-byte word', () => {
  const creator = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
  const bytecode = '608060405260008055'
  expect(
    getCreate2Address({
      creatorAddress: creator,
      salt: Uint8Array.of(1),
      bytecode,
    }),
  ).toBe(getCreate2Address({ creatorAddress: creator, salt: '01', bytecode }))
})

test('getCreate2Address rejects a ByteArray bytecodeHash that is not 32 bytes', () => {
  expect(() =>
    getCreate2Address({
      creatorAddress: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
      salt: '01',
      bytecodeHash: Uint8Array.of(0xde, 0xad, 0xbe, 0xef),
    }),
  ).toThrow(BaseError)
})

test('getCreate2Address left-pads salt to a 32-byte word', () => {
  const creator = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
  const bytecode = '608060405260008055'
  expect(
    getCreate2Address({ creatorAddress: creator, salt: '01', bytecode }),
  ).toBe(
    getCreate2Address({
      creatorAddress: creator,
      salt: `${'00'.repeat(31)}01`,
      bytecode,
    }),
  )
})

test('getCreate2Address: 41 prefix + low 20 bytes of the outer keccak256', () => {
  const { creator, salt, bytecode } = vectors[0]
  const address = getCreate2Address({ creatorAddress: creator, salt, bytecode })
  expect(address.startsWith('41')).toBe(true)
  expect(address).toHaveLength(42)
})

test('getCreate2Address rejects salts longer than 32 bytes', () => {
  expect(() =>
    getCreate2Address({
      creatorAddress: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
      salt: '00'.repeat(33),
      bytecode: '00',
    }),
  ).toThrow(SizeExceedsPaddingSizeError)
})

test('getCreate2Address rejects a bytecodeHash that is not 32 bytes', () => {
  expect(() =>
    getCreate2Address({
      creatorAddress: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
      salt: '01',
      bytecodeHash: 'deadbeef',
    }),
  ).toThrow(BaseError)
})

test('getCreate2Address rejects bytecode and bytecodeHash together', () => {
  expect(() =>
    // @ts-expect-error exactly one of bytecode/bytecodeHash is allowed
    getCreate2Address({
      creatorAddress: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
      salt: '01',
      bytecode: '00',
      bytecodeHash: keccak256('0x00', 'hex'),
    }),
  ).toThrow(BaseError)
})

test('getCreate2Address rejects neither bytecode nor bytecodeHash', () => {
  expect(() =>
    // @ts-expect-error exactly one of bytecode/bytecodeHash is required
    getCreate2Address({
      creatorAddress: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
      salt: '01',
    }),
  ).toThrow(BaseError)
})

// The creator is the first component of the 85-byte preimage: a wrong-size or
// wrong-prefix creator shifts every byte after it and still hashes to a
// plausible-looking address — the exact hazard the bytecodeHash size check
// already guards. It now goes through the SDK's address normalization.
test('creator must be a valid TRON address', () => {
  const good = {
    creatorAddress: '41a7d8a35b260395c14aa456297662092ba3b76f08',
    salt: '0x01',
    bytecode: '0x00',
  } as const
  const reference = getCreate2Address(good)

  // Every SDK address form of the same creator predicts the same address.
  expect(
    getCreate2Address({
      ...good,
      creatorAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    }),
  ).toBe(
    getCreate2Address({
      ...good,
      creatorAddress: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
    }),
  )
  expect(
    getCreate2Address({
      ...good,
      creatorAddress: '0xa7d8a35b260395c14aa456297662092ba3b76f08',
    }),
  ).toBe(reference)

  // 20 bytes without the 41 prefix, a truncated 21-byte form, and an odd
  // nibble count are all refused instead of silently mis-hashed.
  expect(() =>
    getCreate2Address({
      ...good,
      creatorAddress: 'a7d8a35b260395c14aa456297662092ba3b76f08' as never,
    }),
  ).toThrow()
  expect(() =>
    getCreate2Address({
      ...good,
      creatorAddress: '41a7d8a35b260395c14aa456297662092ba3b76f' as never,
    }),
  ).toThrow()
  expect(() =>
    getCreate2Address({
      ...good,
      creatorAddress: '41a7d8a35b260395c14aa456297662092ba3b76f0' as never,
    }),
  ).toThrow()
})

test('bytecode must be whole-byte hex', () => {
  expect(() =>
    getCreate2Address({
      creatorAddress: '41a7d8a35b260395c14aa456297662092ba3b76f08',
      salt: '0x01',
      bytecode: '0x0',
    }),
  ).toThrow('odd length')
})
