import { describe, expect, test } from 'vitest'

import { privateKeyToAccount } from '../../src/accounts/privateKeyToAccount.js'
import { toAccount } from '../../src/accounts/toAccount.js'
import type { TronCustomSource } from '../../src/accounts/types.js'
import { decodeRawData } from '../../src/utils/transaction/decodeRawData.js'
import { loadTxFixtures } from '../fixtures/tx/loader.js'

// Only pk=1 is a permitted trivial private key.
const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
const pk1Address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
// §2.3 canonical transaction id and its pk=1 signature.
const txID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const canonicalSig =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'
// TronWeb-verified TIP-191 signature of 'hello world' under pk=1.
const helloWorldSig =
  '0x0dc0b53d525e0103a6013061cf18e60cf158809149f2b8994a545af65a7004cb1eeaff560e801ab51b28df5d42549aa024c2aa7e9d34de1e01294b9afb5e6c7e1c'

const canonicalTransaction = () => {
  const fixture = loadTxFixtures().find((f) => f.txID === txID)
  if (!fixture) throw new Error('canonical fixture missing')
  return {
    txID: fixture.txID,
    raw_data: decodeRawData(fixture.rawDataHex),
    raw_data_hex: fixture.rawDataHex,
  }
}

describe('toAccount', () => {
  test('from a 0x hex private key: delegates to privateKeyToAccount', () => {
    const account = toAccount(pk1)
    expect(account.address).toBe(pk1Address)
    expect(account.source).toBe('privateKey')
    expect(account.type).toBe('local')
    expect(account.signMessage({ message: 'hello world' }).serialized).toBe(
      helloWorldSig,
    )
    // No raw-digest signer: blind signing is not part of the account surface.
    expect('sign' in account).toBe(false)
  })

  test('from a bare (non-0x) hex private key', () => {
    expect(toAccount('1').address).toBe(pk1Address)
    expect(toAccount(pk1.slice(2)).address).toBe(pk1Address)
  })

  test('from a custom source: completes to a custom local account', () => {
    const base = privateKeyToAccount(pk1)
    const source: TronCustomSource = {
      address: base.address,
      publicKey: base.publicKey,
      signMessage: base.signMessage,
      signTypedData: base.signTypedData,
      signTransaction: base.signTransaction,
    }
    const account = toAccount(source)
    expect(account.source).toBe('custom')
    expect(account.type).toBe('local')
    expect(account.address).toBe(pk1Address)
    expect(account.publicKey).toBe(base.publicKey)
  })

  test('a custom account delegates signing to the supplied functions', () => {
    const base = privateKeyToAccount(pk1)
    const account = toAccount({
      address: base.address,
      publicKey: base.publicKey,
      signMessage: base.signMessage,
      signTypedData: base.signTypedData,
      signTransaction: base.signTransaction,
    })
    expect(account.signMessage({ message: 'hello world' }).serialized).toBe(
      helloWorldSig,
    )
    const signed = account.signTransaction(canonicalTransaction())
    expect(signed.txID).toBe(txID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('throws on an invalid source (no address)', () => {
    expect(() => toAccount({} as never)).toThrow()
  })
})
