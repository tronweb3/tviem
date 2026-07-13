import type { Abi } from 'abitype'
import { expect, test } from 'vitest'

import {
  AbiConstructorNotFoundError,
  AbiConstructorParamsNotFoundError,
} from '../../errors/abi.js'
import { concatHex } from '../data/concat.js'
import { decodeDeployData } from './decodeDeployData.js'
import { encodeAbiParameters } from './encodeAbiParameters.js'
import { encodeDeployData } from './encodeDeployData.js'

const bytecode = '0x60806040' as const

const abiWithConstructor = [
  {
    type: 'constructor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'totalSupply', type: 'uint256' },
      { name: 'owner', type: 'address' },
    ],
  },
] as const satisfies Abi

const args = [1000000n, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'] as const

test('encodeDeployData: no args returns the bytecode unchanged', () => {
  expect(encodeDeployData({ abi: [], bytecode })).toBe(bytecode)
  expect(encodeDeployData({ abi: abiWithConstructor, bytecode })).toBe(bytecode)
})

test('encodeDeployData: appends ABI-encoded constructor args to the bytecode', () => {
  const encoded = encodeDeployData({ abi: abiWithConstructor, bytecode, args })
  expect(encoded).toBe(
    concatHex([
      bytecode,
      encodeAbiParameters(abiWithConstructor[0].inputs, args),
    ]),
  )
  expect(encoded.startsWith(bytecode)).toBe(true)
})

test('encodeDeployData: throws when args are given but the ABI has no constructor', () => {
  expect(() =>
    encodeDeployData({ abi: [] as unknown as Abi, bytecode, args: [1n] }),
  ).toThrowError(AbiConstructorNotFoundError)
})

test('encodeDeployData: throws when args are given but the constructor has no inputs', () => {
  const abi = [
    { type: 'constructor', stateMutability: 'nonpayable', inputs: [] },
  ] as const satisfies Abi
  expect(() => encodeDeployData({ abi, bytecode, args: [1n] })).toThrowError(
    AbiConstructorParamsNotFoundError,
  )
})

test('decodeDeployData: round-trips encodeDeployData', () => {
  const data = encodeDeployData({ abi: abiWithConstructor, bytecode, args })
  expect(decodeDeployData({ abi: abiWithConstructor, bytecode, data })).toEqual(
    {
      args: [1000000n, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'],
      bytecode,
    },
  )
})

test('decodeDeployData: data equal to bytecode yields no args', () => {
  expect(
    decodeDeployData({ abi: abiWithConstructor, bytecode, data: bytecode }),
  ).toEqual({ bytecode })
})

test('decodeDeployData: throws when there is no constructor to decode against', () => {
  expect(() =>
    decodeDeployData({
      abi: [] as unknown as Abi,
      bytecode,
      data: `${bytecode}00`,
    }),
  ).toThrowError(AbiConstructorNotFoundError)
})
