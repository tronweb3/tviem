import { expect, test } from 'vitest'

import { stringToBytes } from '../../../src/utils/encoding/toBytes.js'
import { keccak256 } from '../../../src/utils/hash/keccak256.js'

test('to hex', () => {
  expect(keccak256('0xdeadbeef')).toMatchInlineSnapshot(
    '"0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1"',
  )

  expect(
    keccak256(
      new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]),
    ),
  ).toMatchInlineSnapshot(
    '"0x3ea2f1d0abf3fc66cf29eebb70cbd4e7fe762ef8a09bcc06c8edf641230afec0"',
  )
})

test('to bytes', () => {
  expect(keccak256('0xdeadbeef', 'bytes')).toMatchInlineSnapshot(
    `
    Uint8Array [
      212,
      253,
      78,
      24,
      145,
      50,
      39,
      48,
      54,
      68,
      159,
      201,
      225,
      17,
      152,
      199,
      57,
      22,
      27,
      76,
      1,
      22,
      169,
      162,
      220,
      205,
      250,
      28,
      73,
      32,
      6,
      241,
    ]
  `,
  )

  expect(
    keccak256(
      new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]),
      'bytes',
    ),
  ).toMatchInlineSnapshot(
    `
    Uint8Array [
      62,
      162,
      241,
      208,
      171,
      243,
      252,
      102,
      207,
      41,
      238,
      187,
      112,
      203,
      212,
      231,
      254,
      118,
      46,
      248,
      160,
      155,
      204,
      6,
      200,
      237,
      246,
      65,
      35,
      10,
      254,
      192,
    ]
  `,
  )
})

test('@tronweb3/omni: keccak256 of empty bytes (0x)', () => {
  expect(keccak256('0x')).toBe(
    '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
  )
})

test('@tronweb3/omni: 0x-prefixed non-hex input hashes as utf8, not rejected (pins viem-aligned dispatch)', () => {
  expect(keccak256('0xZZ')).toBe(keccak256(stringToBytes('0xZZ')))
  expect(keccak256('0xdeadbeef')).not.toBe(
    keccak256(stringToBytes('0xdeadbeef')),
  )
})
