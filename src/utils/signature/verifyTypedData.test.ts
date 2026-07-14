// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import type { Address, EvmAddress } from '../../types/address.js'
import { signTypedData } from './signTypedData.js'
import { recoverTypedDataAddress, verifyTypedData } from './verifyTypedData.js'

const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const pk1Base58: Address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const pk1Evm: EvmAddress = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'
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
  from: { name: 'Alice', wallet: pk1Evm },
  to: { name: 'Bob', wallet: PK2 },
  contents: 'Hello, Bob!',
}
const typedData = { domain, types, primaryType: 'Mail', message } as const
// pk=1 signature over the Mail digest (from TronWeb's `signTypedData`).
const mailSignature =
  '0x3ef740fd06a1ff032008c23896dab74bbbc3dc0179d980a6257d7cdc24a1bd3c3021ec88ce8abffad57ecb196b048f1ca11d4dc8ce9a5f8d233775074c3374de1c'

describe('recoverTypedDataAddress', () => {
  test('recovers TMVQGm… from the canonical signature', () => {
    expect(
      recoverTypedDataAddress({ ...typedData, signature: mailSignature }),
    ).toBe(pk1Base58)
  })

  test('accepts a bare (no 0x) wire-form signature', () => {
    expect(
      recoverTypedDataAddress({
        ...typedData,
        signature: mailSignature.slice(2),
      }),
    ).toBe(pk1Base58)
  })

  test('round-trips a freshly signed Signature object', () => {
    const signature = signTypedData({ ...typedData, privateKey: pk1 })
    expect(recoverTypedDataAddress({ ...typedData, signature })).toBe(pk1Base58)
  })
})

describe('verifyTypedData', () => {
  test('verifies the canonical signature (base58 address)', () => {
    expect(
      verifyTypedData({
        ...typedData,
        signature: mailSignature,
        address: pk1Base58,
      }),
    ).toBe(true)
  })

  test('accepts other address forms (0x EVM)', () => {
    expect(
      verifyTypedData({
        ...typedData,
        signature: mailSignature,
        address: pk1Evm,
      }),
    ).toBe(true)
  })

  test('rejects a tampered address', () => {
    expect(
      verifyTypedData({
        ...typedData,
        signature: mailSignature,
        address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      }),
    ).toBe(false)
  })

  test('rejects a tampered message field', () => {
    expect(
      verifyTypedData({
        ...typedData,
        message: { ...message, contents: 'Goodbye, Bob!' },
        signature: mailSignature,
        address: pk1Base58,
      }),
    ).toBe(false)
  })

  test('rejects a tampered signature', () => {
    // Flip the first byte of r (3e -> 00); recovery still yields a point, but
    // a different address.
    const tampered = `0x00${mailSignature.slice(4)}`
    expect(
      verifyTypedData({
        ...typedData,
        signature: tampered,
        address: pk1Base58,
      }),
    ).toBe(false)
  })

  test('returns false (never throws) on a malformed signature', () => {
    expect(
      verifyTypedData({
        ...typedData,
        signature: '0xdeadbeef',
        address: pk1Base58,
      }),
    ).toBe(false)
  })
})
