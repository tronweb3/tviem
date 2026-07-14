// TRON-specific, clean-room tests for @tronweb3/omni.
// Signatures are pinned byte-for-byte from TronWeb's `utils.typedData
// .signTypedData(domain, types, value, pk)` (pk=1). omni's `sign()` already
// emits the same `0x||r||s||v` (v=1b/1c) wire form.
import { describe, expect, test } from 'vitest'

import type { EvmAddress } from '../../types/address.js'
import { hashTypedData } from './hashTypedData.js'
import { sign } from './sign.js'
import { signTypedData } from './signTypedData.js'

const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const PK1: EvmAddress = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'
const PK2: EvmAddress = '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'

const domain = {
  name: 'Omni TIP-712',
  version: '1',
  chainId: 728126428n,
  verifyingContract: PK2,
}
const types = {
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
const message = {
  from: { name: 'Alice', wallet: PK1 },
  to: { name: 'Bob', wallet: PK2 },
  contents: 'Hello, Bob!',
}
const mailSignature =
  '0x3ef740fd06a1ff032008c23896dab74bbbc3dc0179d980a6257d7cdc24a1bd3c3021ec88ce8abffad57ecb196b048f1ca11d4dc8ce9a5f8d233775074c3374de1c'

const typedData = { domain, types, primaryType: 'Mail', message } as const

describe('signTypedData', () => {
  test('signs to the TronWeb-verified signature (v = 28)', () => {
    const signature = signTypedData({ ...typedData, privateKey: pk1 })
    expect(signature.serialized).toBe(mailSignature)
    expect(signature.hex).toBe(mailSignature.slice(2))
    expect(signature.v).toBe(28)
  })

  test('equals sign({ hash: hashTypedData(...) })', () => {
    expect(signTypedData({ ...typedData, privateKey: pk1 }).serialized).toBe(
      sign({ hash: hashTypedData(typedData), privateKey: pk1 }).serialized,
    )
  })

  test('accepts a bare (no 0x) private key', () => {
    expect(
      signTypedData({ ...typedData, privateKey: pk1.slice(2) }).serialized,
    ).toBe(mailSignature)
  })

  test('is deterministic (RFC 6979) by default', () => {
    expect(signTypedData({ ...typedData, privateKey: pk1 }).hex).toBe(
      signTypedData({ ...typedData, privateKey: pk1 }).hex,
    )
  })

  test('extraEntropy randomizes the signature', () => {
    const randomized = signTypedData({
      ...typedData,
      privateKey: pk1,
      extraEntropy: true,
    })
    expect(randomized.serialized).not.toBe(mailSignature)
    expect([27, 28]).toContain(randomized.v)
  })

  test('signs a kitchen-sink struct to the TronWeb-verified signature', () => {
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
      signTypedData({
        domain,
        types: sinkTypes,
        primaryType: 'Sink',
        message: sink,
        privateKey: pk1,
      }).serialized,
    ).toBe(
      '0x893c3d82aa91846fb6ac5af691d1a6318e5d4f4d5c585dffad01c1aeb0075cbe0450f31da2e3e3d2707662ff5c21acdb156689d07cd3dfa4673aec92c3464c7e1c',
    )
  })
})
