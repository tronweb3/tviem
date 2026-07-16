import { describe, expect, test } from 'vitest'

import { loadTxFixtures } from '../fixtures/tx/loader.js'
import { decodeRawData } from '../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../src/utils/transaction/getTransactionId.js'
import { privateKeyToAccount } from '../../src/accounts/privateKeyToAccount.js'

// Only pk=1 is a permitted trivial private key.
const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'

// §2.1 / §2.2 / §2.3 authoritative derivations for pk=1.
const address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const publicKey =
  '0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'
// §2.3 canonical transaction id.
const txID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
// §2.3 signature over that id (bare TRON wire form, ends `ae001c`, v=0x1c=28).
const txSignature =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

const canonicalRawData = decodeRawData(
  loadTxFixtures().find(
    (f) => f.name === 'transfer canonical (reference vector)',
  )!.rawDataHex,
)

describe('privateKeyToAccount', () => {
  test('§2.1: derives address and uncompressed public key (pk=1)', () => {
    const account = privateKeyToAccount(pk1)
    expect(account.address).toBe(address)
    expect(account.publicKey).toBe(publicKey)
    expect(account.source).toBe('privateKey')
    expect(account.type).toBe('local')
  })

  test('accepts a bare (non-0x) hex private key', () => {
    expect(privateKeyToAccount('1').address).toBe(address)
    expect(privateKeyToAccount(pk1.slice(2)).address).toBe(address)
  })

  test('§2.3: sign({ hash: txID }) reproduces the canonical signature', () => {
    const account = privateKeyToAccount(pk1)
    const signature = account.sign({ hash: `0x${txID}` })
    expect(signature.hex).toBe(txSignature)
    expect(signature.v).toBe(28)
    expect(signature.serialized.endsWith('001c')).toBe(true)
  })

  test('§2.2: signMessage reproduces the TronWeb-verified vector', () => {
    const account = privateKeyToAccount(pk1)
    // TronWeb-verified vectors for "hello @tronweb3/omni" (pk=1). The §2.2
    // vector in the task spec is stale (pre-rename); see the SIG-3/4/5 notes.
    const signature = account.signMessage({ message: 'hello @tronweb3/omni' })
    expect(signature.serialized).toBe(
      '0x855e95dd49d937f13c6cbc5293db9b6fdfab8780d7c27c6eff9b12f8f3d3d56d792f34efe0adb183778c8e6f4c8f1cf66e19bd06be967bc7874613f4ee135dea1b',
    )
    expect(signature.v).toBe(27)
  })

  test('signTransaction derives txID from raw_data and appends the signature', () => {
    const account = privateKeyToAccount(pk1)
    const signed = account.signTransaction({ raw_data: canonicalRawData })
    expect(signed.txID).toBe(txID)
    expect(signed.signature).toEqual([txSignature])
  })

  test('signTransaction signs a supplied txID and appends to existing signatures', () => {
    const account = privateKeyToAccount(pk1)
    const signed = account.signTransaction({
      txID,
      signature: ['deadbeef'],
    })
    expect(signed.signature).toEqual(['deadbeef', txSignature])
  })

  test('signTransaction does not mutate its input', () => {
    const account = privateKeyToAccount(pk1)
    const transaction = { txID, signature: [] as string[] }
    account.signTransaction(transaction)
    expect(transaction.signature).toEqual([])
  })

  test('signTransaction throws without a txID or raw_data', () => {
    const account = privateKeyToAccount(pk1)
    expect(() => account.signTransaction({})).toThrow()
  })

  test('a signed transaction id is self-consistent with getTransactionId', () => {
    const account = privateKeyToAccount(pk1)
    const signed = account.signTransaction({ raw_data: canonicalRawData })
    expect(signed.txID).toBe(getTransactionId(canonicalRawData))
  })
})
