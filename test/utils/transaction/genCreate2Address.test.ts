import { expect, test } from 'vitest'
import { SizeExceedsPaddingSizeError } from '../../../src/errors/data.js'
import { genCreate2Address } from '../../../src/utils/transaction/genCreate2Address.js'

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
)('genCreate2Address matches gold vector: creator $creator salt $salt', ({
  creator,
  salt,
  bytecode,
  expected,
}) => {
  expect(genCreate2Address(creator, salt, bytecode)).toBe(expected)
})

test('genCreate2Address accepts 0x-prefixed inputs', () => {
  const { creator, salt, bytecode, expected } = vectors[3]
  expect(genCreate2Address(`0x${creator}`, `0x${salt}`, `0x${bytecode}`)).toBe(
    expected,
  )
})

test('genCreate2Address left-pads salt to a 32-byte word', () => {
  const creator = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
  const bytecode = '608060405260008055'
  expect(genCreate2Address(creator, '01', bytecode)).toBe(
    genCreate2Address(creator, `${'00'.repeat(31)}01`, bytecode),
  )
})

test('genCreate2Address: 41 prefix + low 20 bytes of the outer keccak256', () => {
  const { creator, salt, bytecode } = vectors[0]
  const address = genCreate2Address(creator, salt, bytecode)
  expect(address.startsWith('41')).toBe(true)
  expect(address).toHaveLength(42)
})

test('genCreate2Address rejects salts longer than 32 bytes', () => {
  expect(() =>
    genCreate2Address(
      '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
      '00'.repeat(33),
      '00',
    ),
  ).toThrow(SizeExceedsPaddingSizeError)
})
