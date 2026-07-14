import { describe, expect, test } from 'vitest'

import { privateKeyToAccount } from './privateKeyToAccount.js'
import { toAccount } from './toAccount.js'
import type { TronCustomSource } from './types.js'

// Only pk=1 is a permitted trivial private key.
const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
const pk1Address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
// §2.3 canonical transaction id and its pk=1 signature.
const txID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const canonicalSig =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

describe('toAccount', () => {
  test('from a 0x hex private key: delegates to privateKeyToAccount', () => {
    const account = toAccount(pk1)
    expect(account.address).toBe(pk1Address)
    expect(account.source).toBe('privateKey')
    expect(account.type).toBe('local')
    expect(account.sign({ hash: `0x${txID}` }).hex).toBe(canonicalSig)
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
      sign: base.sign,
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
      sign: base.sign,
      signMessage: base.signMessage,
      signTypedData: base.signTypedData,
      signTransaction: base.signTransaction,
    })
    expect(account.sign({ hash: `0x${txID}` }).hex).toBe(canonicalSig)
    const signed = account.signTransaction({ txID })
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('throws on an invalid source (no address)', () => {
    expect(() => toAccount({} as never)).toThrow()
  })
})
