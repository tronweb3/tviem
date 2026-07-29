// Signatures are pinned byte-for-byte from TronWeb's `utils.typedData
// .signTypedData(domain, types, value, pk)` (pk=1). tviem's `sign()` already
// emits the same `0x||r||s||v` (v=1b/1c) wire form.
import { describe, expect, test } from 'vitest'

import type { EvmAddress } from '../../../src/types/address.js'
import { hashTypedData } from '../../../src/utils/signature/hashTypedData.js'
import { sign } from '../../../src/utils/signature/sign.js'
import { signTypedData } from '../../../src/utils/signature/signTypedData.js'

const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const PK1: EvmAddress = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'
const PK2: EvmAddress = '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'

const domain = {
  name: 'Example TIP-712',
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
  '0xce53aef3eebbfa840eb3ee50189c18510c2513d98aa5d7fd0c55820625d029e20221dd87c74326d0490b9591aa76fcb1dac3bd3cff693b97b827525939696f1b1c'

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
      '0x408903aa47c943d02cf6e2cea736a8946c24e0b2300b88f570ebf7b6b7afb4ee748f776a70fa6b3956ca9284a38faa45d98543ed68b32863ef97bb12491fa0111c',
    )
  })
})
