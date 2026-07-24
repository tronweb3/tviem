import { describe, expect, test } from 'vitest'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import type { RawData } from '../../../src/utils/transaction/serializeRawData.js'
import {
  loadSigTransactionFixtures,
  type SigTransactionFixture,
} from '../../fixtures/sig/loader.js'
import { loadTxFixtures } from '../../fixtures/tx/loader.js'

// Only pk=1 / pk=2 are permitted trivial private keys.
const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'

// §2.1: pk=1 address, and pk=2's TRON hex address (a public derivation).
const pk1Address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const pk2HexAddress = '412b5ad5c4795c026514f8317c7a215e218dccd6cf'

// §2.3 canonical reference vector.
const canonicalTxID =
  '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const canonicalSig =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

const txFixtures = loadTxFixtures()
const sigFixtures = loadSigTransactionFixtures()

function rawDataFor(txID: string): RawData {
  const fixture = txFixtures.find((f) => f.txID === txID)
  if (!fixture) throw new Error(`no tx fixture for ${txID}`)
  return decodeRawData(fixture.rawDataHex)
}

const canonicalRawData = rawDataFor(canonicalTxID)

/** Clones a raw data with the first contract's owner replaced. */
function withOwner(rawData: RawData, owner: string): RawData {
  const [first] = rawData.contract
  return {
    ...rawData,
    contract: [
      {
        ...first!,
        parameter: {
          ...first!.parameter,
          value: { ...first!.parameter.value, ownerAddress: owner } as never,
        },
      },
      ...rawData.contract.slice(1),
    ],
  }
}

describe('signTransaction', () => {
  test('§2.3: signs the canonical transfer to the reference signature', () => {
    const signed = signTransaction({
      transaction: { raw_data: canonicalRawData },
      privateKey: pk1,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
    expect(signed.raw_data_hex).toBe(
      txFixtures.find((f) => f.txID === canonicalTxID)!.rawDataHex,
    )
  })

  test('recomputes txID locally and ignores a bogus node-supplied txID', () => {
    const signed = signTransaction({
      transaction: { txID: 'deadbeef'.repeat(8), raw_data: canonicalRawData },
      privateKey: pk1,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('reproduces every gold-standard transaction signature (pk=1)', () => {
    for (const fixture of sigFixtures as SigTransactionFixture[]) {
      const signed = signTransaction({
        transaction: { raw_data: rawDataFor(fixture.txID) },
        privateKey: pk1,
      })
      expect(signed.txID, fixture.name).toBe(fixture.txID)
      expect(signed.signature, fixture.name).toEqual([fixture.signature])
    }
  })

  test('throws when owner_address does not match the signing account', () => {
    expect(() =>
      signTransaction({
        transaction: { raw_data: withOwner(canonicalRawData, pk2HexAddress) },
        privateKey: pk1,
      }),
    ).toThrow(/owner_address/)
  })

  test('accepts a matching owner across address forms', () => {
    const signed = signTransaction({
      transaction: { raw_data: withOwner(canonicalRawData, pk1Address) },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('permissionId is written before the id is derived (guard ①)', () => {
    // Canonical raw data + Permission_id=2 must reproduce that fixture.
    const permissioned = sigFixtures.find(
      (f) =>
        f.txID ===
        '2e8b73373f830f8a100b11291c5e169a079552c212eb94b6c722247320adb698',
    )!
    const signed = signTransaction({
      transaction: { raw_data: canonicalRawData },
      privateKey: pk1,
      permissionId: 2,
    })
    expect(signed.txID).toBe(permissioned.txID)
    expect(signed.signature).toEqual([permissioned.signature])
  })

  test('permissionId skips the owner_address guard (multi-sig)', () => {
    // Foreign owner would normally throw, but a permission signing is allowed.
    const signed = signTransaction({
      transaction: { raw_data: withOwner(canonicalRawData, pk2HexAddress) },
      privateKey: pk1,
      permissionId: 2,
    })
    expect(signed.signature).toHaveLength(1)
  })

  test('an equal, already-baked permissionId is idempotent (guard ①)', () => {
    const first = signTransaction({
      transaction: { raw_data: canonicalRawData },
      privateKey: pk1,
      permissionId: 2,
    })
    const again = signTransaction({
      transaction: first,
      privateKey: pk1,
      permissionId: 2,
    })
    expect(again.txID).toBe(first.txID)
    expect(again.raw_data_hex).toBe(first.raw_data_hex)
    expect(again.signature).toEqual(first.signature)
  })

  test('de-duplicates a repeated signature by the same key (guard ⑤)', () => {
    const once = signTransaction({
      transaction: { raw_data: canonicalRawData },
      privateKey: pk1,
    })
    const twice = signTransaction({ transaction: once, privateKey: pk1 })
    expect(twice.signature).toEqual([canonicalSig])
  })

  test('de-duplicates the same signature bytes across hex case (Day 5 fix)', () => {
    // TronWeb renders the trailing recovery byte uppercase ('…1B'/'…1C');
    // the 65 signature bytes are identical, so re-signing must not append a
    // duplicate (the node rejects duplicate-key signatures at broadcast).
    const foreignCased =
      canonicalSig.slice(0, 128) + canonicalSig.slice(128).toUpperCase()
    const signed = signTransaction({
      transaction: { raw_data: canonicalRawData, signature: [foreignCased] },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual([foreignCased])
  })

  test('appends to an existing foreign signature without dropping it', () => {
    const signed = signTransaction({
      transaction: { raw_data: canonicalRawData, signature: ['deadbeef'] },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual(['deadbeef', canonicalSig])
  })

  test('does not mutate its input', () => {
    const transaction = {
      raw_data: canonicalRawData,
      signature: [] as string[],
    }
    signTransaction({ transaction, privateKey: pk1 })
    expect(transaction.signature).toEqual([])
  })

  test('signs a supplied txID when no raw_data is present', () => {
    const signed = signTransaction({
      transaction: { txID: canonicalTxID },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual([canonicalSig])
    expect(signed.raw_data).toBeUndefined()
  })

  test('decodes raw_data_hex when it is the only body supplied', () => {
    const rawDataHex = txFixtures.find(
      (f) => f.txID === canonicalTxID,
    )!.rawDataHex
    const signed = signTransaction({
      transaction: { raw_data_hex: rawDataHex },
      privateKey: pk1,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('throws without a txID or raw_data', () => {
    expect(() =>
      signTransaction({ transaction: {}, privateKey: pk1 }),
    ).toThrow()
  })

  test('the signed id stays consistent with getTransactionId', () => {
    const signed = signTransaction({
      transaction: { raw_data: canonicalRawData },
      privateKey: pk1,
    })
    expect(signed.txID).toBe(getTransactionId(canonicalRawData))
  })
})
