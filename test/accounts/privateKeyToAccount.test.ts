import { describe, expect, test } from 'vitest'
import { privateKeyToAccount } from '../../src/accounts/privateKeyToAccount.js'
import type { SignableTransaction } from '../../src/accounts/types.js'
import { decodeRawData } from '../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../src/utils/transaction/getTransactionId.js'
import { toRawDataHex } from '../../src/utils/transaction/serializeRawData.js'
import { loadTxFixtures } from '../fixtures/tx/loader.js'

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

const txCheckError = 'The transaction failed its integrity check (txCheck).'

const canonicalRawData = decodeRawData(
  loadTxFixtures().find(
    (f) => f.name === 'transfer canonical (reference vector)',
  )!.rawDataHex,
)

/** The full consistent `txID`/`raw_data`/`raw_data_hex` triple for §2.3. */
function canonicalTransaction(): SignableTransaction {
  return {
    txID: getTransactionId(canonicalRawData),
    raw_data: canonicalRawData,
    raw_data_hex: toRawDataHex(canonicalRawData),
  }
}

describe('privateKeyToAccount', () => {
  test('§2.1: derives address and uncompressed public key (pk=1)', () => {
    const account = privateKeyToAccount(pk1)
    expect(account.address).toBe(address)
    expect(account.publicKey).toBe(publicKey)
    expect(account.source).toBe('privateKey')
    expect(account.type).toBe('local')
  })

  test('accepts a bare (non-0x) hex private key', () => {
    expect(privateKeyToAccount(pk1.slice(2)).address).toBe(address)
  })

  test('rejects a short (< 32 byte) key instead of zero-padding it', () => {
    expect(() => privateKeyToAccount('1')).toThrow()
  })

  test('exposes NO raw-digest sign (blind signing unsupported)', () => {
    const account = privateKeyToAccount(pk1)
    expect('sign' in account).toBe(false)
  })

  test('§2.2: signMessage reproduces the TronWeb-verified vector', () => {
    const account = privateKeyToAccount(pk1)
    // TronWeb-verified vectors for "sign this message" (pk=1). The §2.2
    // vector in the task spec is stale (pre-rename); see the SIG-3/4/5 notes.
    const signature = account.signMessage({ message: 'sign this message' })
    expect(signature.serialized).toBe(
      '0x9db3012a68317a97618479e218f3ca6849714071c2a8f07c160f1a804b114a8e166364cb124269a0edea614f50ae2acd0fd3a2c97ae89f45b4811427fb6136b71b',
    )
    expect(signature.v).toBe(27)
  })

  test('signTransaction signs the full triple and appends the signature', () => {
    const account = privateKeyToAccount(pk1)
    const signed = account.signTransaction(canonicalTransaction())
    expect(signed.txID).toBe(txID)
    expect(signed.signature).toEqual([txSignature])
  })

  test('signTransaction passes txID/raw_data/raw_data_hex through unchanged', () => {
    const account = privateKeyToAccount(pk1)
    const transaction = canonicalTransaction()
    const signed = account.signTransaction(transaction)
    expect(signed.txID).toBe(transaction.txID)
    expect(signed.raw_data).toEqual(transaction.raw_data)
    expect(signed.raw_data_hex).toBe(transaction.raw_data_hex)
  })

  test('signTransaction appends to existing signatures', () => {
    const account = privateKeyToAccount(pk1)
    const signed = account.signTransaction({
      ...canonicalTransaction(),
      signature: ['deadbeef'],
    })
    expect(signed.signature).toEqual(['deadbeef', txSignature])
  })

  test('signTransaction refuses a bare txID (blind signing)', () => {
    const account = privateKeyToAccount(pk1)
    expect(() =>
      account.signTransaction({ txID } as unknown as SignableTransaction),
    ).toThrow(txCheckError)
  })

  test('signTransaction refuses a bare raw_data (no verified bytes/id)', () => {
    const account = privateKeyToAccount(pk1)
    expect(() =>
      account.signTransaction({
        raw_data: canonicalRawData,
      } as unknown as SignableTransaction),
    ).toThrow(txCheckError)
  })

  test('signTransaction does not mutate its input', () => {
    const account = privateKeyToAccount(pk1)
    const transaction = {
      ...canonicalTransaction(),
      signature: [] as string[],
    }
    account.signTransaction(transaction)
    expect(transaction.signature).toEqual([])
  })

  test('signTransaction throws without a txID or raw_data', () => {
    const account = privateKeyToAccount(pk1)
    expect(() =>
      account.signTransaction({} as unknown as SignableTransaction),
    ).toThrow(txCheckError)
  })

  test('a signed transaction id is self-consistent with getTransactionId', () => {
    const account = privateKeyToAccount(pk1)
    const signed = account.signTransaction(canonicalTransaction())
    expect(signed.txID).toBe(getTransactionId(canonicalRawData))
  })
})
