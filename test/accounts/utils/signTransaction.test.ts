import { describe, expect, test } from 'vitest'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import {
  type RawData,
  toRawDataHex,
} from '../../../src/utils/transaction/serializeRawData.js'
import {
  loadSigTransactionFixtures,
  type SigTransactionFixture,
} from '../../fixtures/sig/loader.js'
import { loadTxFixtures } from '../../fixtures/tx/loader.js'

// Only pk=1 / pk=2 are permitted trivial private keys.
const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'

// §2.1: pk=1 / pk=2 addresses (public derivations).
const pk1Address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const pk2Address = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'
const pk2HexAddress = '412b5ad5c4795c026514f8317c7a215e218dccd6cf'

// §2.3 canonical reference vector.
const canonicalTxID =
  '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const canonicalSig =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

const integrityError = 'The transaction failed its integrity check (txCheck).'

const txFixtures = loadTxFixtures()
const sigFixtures = loadSigTransactionFixtures()

function rawDataFor(txID: string): RawData {
  const fixture = txFixtures.find((f) => f.txID === txID)
  if (!fixture) throw new Error(`no tx fixture for ${txID}`)
  return decodeRawData(fixture.rawDataHex)
}

/** Builds the consistent `txID` + `raw_data` + `raw_data_hex` triple. */
function triple(raw_data: RawData): SignableTransaction {
  return {
    txID: getTransactionId(raw_data),
    raw_data,
    raw_data_hex: toRawDataHex(raw_data),
  }
}

const canonicalRawData = rawDataFor(canonicalTxID)

/** Clones a raw data with `Permission_id` baked into every contract. */
function withPermission(rawData: RawData, permissionId: number): RawData {
  return {
    ...rawData,
    contract: rawData.contract.map((contract) => ({
      ...contract,
      Permission_id: permissionId,
    })),
  }
}

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
          value: {
            ...(first!.parameter.value as Record<string, unknown>),
            owner_address: owner,
          } as never,
        },
      },
      ...rawData.contract.slice(1),
    ],
  }
}

describe('signTransaction', () => {
  test('§2.3: signs the canonical transfer to the reference signature', () => {
    const signed = signTransaction({
      transaction: triple(canonicalRawData),
      privateKey: pk1,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
    expect(signed.raw_data_hex).toBe(
      txFixtures.find((f) => f.txID === canonicalTxID)!.rawDataHex,
    )
  })

  test('refuses a triple whose txID lies about the bytes', () => {
    // A node-supplied txID is never trusted (and never silently recomputed):
    // the digest is what gets signed, so a lying id must refuse, not sign.
    expect(() =>
      signTransaction({
        transaction: {
          ...triple(canonicalRawData),
          txID: 'deadbeef'.repeat(8),
        },
        privateKey: pk1,
      }),
    ).toThrow(integrityError)
  })

  test('reproduces every gold-standard transaction signature (pk=1)', () => {
    for (const fixture of sigFixtures as SigTransactionFixture[]) {
      const signed = signTransaction({
        transaction: triple(rawDataFor(fixture.txID)),
        privateKey: pk1,
      })
      expect(signed.txID, fixture.name).toBe(fixture.txID)
      expect(signed.signature, fixture.name).toEqual([fixture.signature])
    }
  })

  test('throws when owner_address does not match the signing account', () => {
    expect(() =>
      signTransaction({
        transaction: triple(withOwner(canonicalRawData, pk2HexAddress)),
        privateKey: pk1,
      }),
    ).toThrow(
      `The transaction's owner_address does not match the signing account (${pk1Address}).`,
    )
  })

  test('accepts a matching owner across address forms', () => {
    // A Base58 owner_address serializes to the same 21 payload bytes, so the
    // triple stays byte-identical to the canonical one — and the owner guard
    // compares across forms too.
    const signed = signTransaction({
      transaction: triple(withOwner(canonicalRawData, pk1Address)),
      privateKey: pk1,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('a baked Permission_id signs to the bound gold vector', () => {
    // Canonical raw data bound to permission 2 reproduces that fixture — no
    // parameter involved: the id lives in the bytes (multiSign bakes it).
    const permissioned = sigFixtures.find(
      (f) =>
        f.txID ===
        '2e8b73373f830f8a100b11291c5e169a079552c212eb94b6c722247320adb698',
    )!
    const signed = signTransaction({
      transaction: triple(withPermission(canonicalRawData, 2)),
      privateKey: pk1,
    })
    expect(signed.txID).toBe(permissioned.txID)
    expect(signed.signature).toEqual([permissioned.signature])
  })

  test('has no permissionId parameter — binding is multiSign business', () => {
    // The parameter is gone from the signature; a stray one is a type error
    // and never binds: the unbound bytes sign to the unbound id/signature.
    const signed = signTransaction({
      transaction: triple(canonicalRawData),
      privateKey: pk1,
      // @ts-expect-error — permissionId no longer exists on the parameters.
      permissionId: 2,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('an explicit address relaxes the owner guard (non-owner co-sign)', () => {
    // A foreign owner would normally throw; passing the transaction's own
    // owner_address as `address` (what multiSign does after its permission
    // validations) lets any key co-sign.
    const foreignOwned = triple(
      withPermission(withOwner(canonicalRawData, pk2HexAddress), 2),
    )
    expect(() =>
      signTransaction({ transaction: foreignOwned, privateKey: pk1 }),
    ).toThrow(/owner_address/)
    const signed = signTransaction({
      transaction: foreignOwned,
      privateKey: pk1,
      address: pk2Address,
    })
    expect(signed.signature).toHaveLength(1)
    expect(signed.txID).toBe(foreignOwned.txID)
  })

  test('re-signing a bound transaction with the same key is idempotent', () => {
    const first = signTransaction({
      transaction: triple(withPermission(canonicalRawData, 2)),
      privateKey: pk1,
    })
    const again = signTransaction({ transaction: first, privateKey: pk1 })
    expect(again.txID).toBe(first.txID)
    expect(again.raw_data_hex).toBe(first.raw_data_hex)
    expect(again.signature).toEqual(first.signature)
  })

  test('a broken raw_data in a full triple fails the integrity check', () => {
    // An unknown key means the model cannot be proven to serialize to the
    // claimed bytes — txCheck refuses it (no partial trust).
    const fixture = txFixtures.find((f) => f.txID === canonicalTxID)!
    expect(() =>
      signTransaction({
        transaction: {
          txID: fixture.txID,
          raw_data: { ...(fixture.rawData as RawData), bogus: 1 },
          raw_data_hex: fixture.rawDataHex,
        } as unknown as SignableTransaction,
        privateKey: pk1,
      }),
    ).toThrow(integrityError)
  })

  test('an empty-string txID carries no claim and is refused', () => {
    // Proto3-default renderers emit txID: "" for unsigned templates; a falsy
    // field is a missing field, and the full triple is required to sign.
    const fixture = txFixtures.find((f) => f.txID === canonicalTxID)!
    expect(() =>
      signTransaction({
        transaction: {
          txID: '',
          raw_data: fixture.rawData,
          raw_data_hex: fixture.rawDataHex,
        } as unknown as SignableTransaction,
        privateKey: pk1,
      }),
    ).toThrow(integrityError)
  })

  test('accepts a chain-built node-JSON transaction verbatim', () => {
    // The exact shape wallet/createtransaction (and TronWeb) hand over:
    // snake_case raw_data + raw_data_hex + txID. Signing it must equal the
    // decoded-fixture path bit for bit.
    const fixture = txFixtures.find((f) => f.txID === canonicalTxID)!
    const signed = signTransaction({
      transaction: {
        visible: false,
        txID: fixture.txID,
        raw_data: fixture.rawData as RawData,
        raw_data_hex: fixture.rawDataHex,
      } as SignableTransaction,
      privateKey: pk1,
    })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
    expect(signed.raw_data_hex).toBe(fixture.rawDataHex)
    // The signed result stays in the node dialect.
    const contract = (
      signed.raw_data as { contract: Record<string, unknown>[] }
    ).contract[0]!
    expect(contract.type).toBe('TransferContract')
    expect((contract.parameter as { type_url: string }).type_url).toBe(
      'type.googleapis.com/protocol.TransferContract',
    )
  })

  test('node-JSON raw_data that misdescribes the bytes is refused', () => {
    // The human-readable JSON says amount=1, the bytes say otherwise — the
    // bytes are what gets signed, so this must throw, never sign.
    const fixture = txFixtures.find((f) => f.txID === canonicalTxID)!
    const tampered = structuredClone(fixture.rawData) as {
      contract: { parameter: { value: { amount: number } } }[]
    }
    tampered.contract[0]!.parameter.value.amount = 1
    expect(() =>
      signTransaction({
        transaction: {
          txID: fixture.txID,
          raw_data: tampered,
          raw_data_hex: fixture.rawDataHex,
        } as unknown as SignableTransaction,
        privateKey: pk1,
      }),
    ).toThrow(integrityError)
  })

  test('passes txID, raw_data and raw_data_hex through unchanged', () => {
    // No recompute, no re-dialecting: the verified triple's values come back
    // untouched — but as a defensive deep copy, so the result never shares
    // references with (or re-reads getters on) the caller's object.
    const transaction = triple(canonicalRawData)
    const signed = signTransaction({ transaction, privateKey: pk1 })
    expect(signed.txID).toBe(transaction.txID)
    expect(signed.raw_data).not.toBe(transaction.raw_data)
    expect(signed.raw_data).toEqual(transaction.raw_data)
    expect(signed.raw_data_hex).toBe(transaction.raw_data_hex)
    const rawData = signed.raw_data as unknown as Record<string, unknown>
    expect(rawData.ref_block_bytes).toBeDefined()
    expect(
      (rawData as { contract: { type: string }[] }).contract[0]!.type,
    ).toBe('TransferContract')
  })

  test('defuses a getter that swaps txID between check and sign (TOCTOU)', () => {
    // A malicious transaction can pass txCheck with an honest txID and then
    // hand a different digest to the actual signing read — unless the
    // transaction is snapshotted (cloned) before any check. The signature
    // must cover the checked digest, never the swapped one.
    const honest = triple(canonicalRawData)
    let reads = 0
    const evil = {
      raw_data: honest.raw_data,
      raw_data_hex: honest.raw_data_hex,
      get txID() {
        reads++
        return reads === 1 ? honest.txID : 'deadbeef'.repeat(8)
      },
    } as unknown as SignableTransaction
    const signed = signTransaction({ transaction: evil, privateKey: pk1 })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('signs a contract carrying a Uint8Array bytes field', () => {
    // The pre-check snapshot must not change what the bytes fields ARE:
    // `bytes` accepts raw bytes on the encode side, and a snapshot that
    // turned a Uint8Array into a plain object would serialize to something
    // else entirely — the transaction would fail its own integrity check.
    const raw_data: RawData = {
      ...canonicalRawData,
      contract: [
        {
          type: 'AccountUpdateContract',
          parameter: {
            type_url: 'type.googleapis.com/protocol.AccountUpdateContract',
            value: {
              owner_address: (
                canonicalRawData.contract[0]!.parameter.value as Record<
                  string,
                  unknown
                >
              ).owner_address,
              account_name: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
            },
          },
        },
      ],
    } as RawData
    const signed = signTransaction({
      transaction: triple(raw_data),
      privateKey: pk1,
    })
    expect(signed.signature).toHaveLength(1)
    expect(decodeRawData(signed.raw_data_hex!)).toEqual(
      decodeRawData(toRawDataHex(raw_data)),
    )
  })

  test('defuses a getter that swaps owner_address after the owner guard', () => {
    // The owner guard and the serializer must see the same owner_address; a
    // getter returning the honest owner only on its first read would
    // otherwise split the two. With the pre-check snapshot, whichever value
    // the single read captures is the one both checked and signed.
    const honest = triple(canonicalRawData)
    const value = honest.raw_data.contract[0]!.parameter.value as Record<
      string,
      unknown
    >
    const honestOwner = value.owner_address
    let reads = 0
    const evilValue = Object.defineProperty({ ...value }, 'owner_address', {
      enumerable: true,
      get() {
        reads++
        return reads === 1 ? honestOwner : pk2HexAddress
      },
    })
    const evil = {
      ...honest,
      raw_data: {
        ...honest.raw_data,
        contract: [
          {
            ...honest.raw_data.contract[0]!,
            parameter: {
              ...honest.raw_data.contract[0]!.parameter,
              value: evilValue as never,
            },
          },
        ],
      },
    }
    const signed = signTransaction({ transaction: evil, privateKey: pk1 })
    expect(signed.txID).toBe(canonicalTxID)
    expect(signed.signature).toEqual([canonicalSig])
  })

  test('de-duplicates a repeated signature by the same key (guard ③)', () => {
    const once = signTransaction({
      transaction: triple(canonicalRawData),
      privateKey: pk1,
    })
    const twice = signTransaction({ transaction: once, privateKey: pk1 })
    expect(twice.signature).toEqual([canonicalSig])
  })

  test('de-duplicates the same signature bytes across hex case', () => {
    // TronWeb renders the trailing recovery byte uppercase ('…1B'/'…1C');
    // the 65 signature bytes are identical, so re-signing must not append a
    // duplicate (the node rejects duplicate-key signatures at broadcast).
    const foreignCased =
      canonicalSig.slice(0, 128) + canonicalSig.slice(128).toUpperCase()
    const signed = signTransaction({
      transaction: { ...triple(canonicalRawData), signature: [foreignCased] },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual([foreignCased])
  })

  test('de-duplicates the same signature bytes across the 0x prefix', () => {
    // A caller-injected `0x`-prefixed entry carries the identical 65 bytes as
    // the SDK's bare-hex signature — comparing by bytes must recognize it and
    // not append a duplicate (a duplicate signer fails broadcast).
    const prefixed = `0x${canonicalSig}`
    const signed = signTransaction({
      transaction: { ...triple(canonicalRawData), signature: [prefixed] },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual([prefixed])
  })

  test('appends to an existing foreign signature without dropping it', () => {
    const signed = signTransaction({
      transaction: { ...triple(canonicalRawData), signature: ['deadbeef'] },
      privateKey: pk1,
    })
    expect(signed.signature).toEqual(['deadbeef', canonicalSig])
  })

  test('does not mutate its input', () => {
    const transaction = {
      ...triple(canonicalRawData),
      signature: [] as string[],
    }
    signTransaction({ transaction, privateKey: pk1 })
    expect(transaction.signature).toEqual([])
  })

  test('refuses a bare txID with no raw_data (blind signing)', () => {
    expect(() =>
      signTransaction({
        transaction: { txID: canonicalTxID } as unknown as SignableTransaction,
        privateKey: pk1,
      }),
    ).toThrow(integrityError)
  })

  test('refuses every partial form — the full triple is required', () => {
    // raw_data alone, raw_data_hex alone, a pair missing its third leg, or
    // nothing at all: none of them is verifiably consistent, none signs.
    const { txID, raw_data, raw_data_hex } = triple(canonicalRawData)
    const partials = [
      {},
      { raw_data },
      { raw_data_hex },
      { txID, raw_data },
      { raw_data, raw_data_hex },
    ]
    for (const partial of partials)
      expect(() =>
        signTransaction({
          transaction: partial as unknown as SignableTransaction,
          privateKey: pk1,
        }),
      ).toThrow(integrityError)
  })

  test('the signed id stays consistent with getTransactionId', () => {
    const signed = signTransaction({
      transaction: triple(canonicalRawData),
      privateKey: pk1,
    })
    expect(signed.txID).toBe(getTransactionId(canonicalRawData))
  })

  test('a contract-less shell is refused with a clean integrity error', () => {
    // `contract: []` plus a ref-block field serializes to non-empty bytes, so
    // a correctly-derived txID/hex slips past the zero-bytes guard — the shell
    // must still fail txCheck cleanly, never reaching the owner_address read
    // (which would throw a raw TypeError on the empty contract list).
    const shell = {
      ref_block_bytes: '1234',
      contract: [],
    } as unknown as RawData
    const transaction: SignableTransaction = {
      raw_data: shell,
      raw_data_hex: toRawDataHex(shell),
      txID: getTransactionId(shell),
    }
    expect(() => signTransaction({ transaction, privateKey: pk1 })).toThrow(
      integrityError,
    )
  })
})
