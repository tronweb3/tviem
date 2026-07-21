// Live differential: our signing stack vs. the TronWeb 6.4 library EXECUTED
// at test time (offline pure/static APIs only — no network). It complements
// test/accounts/signTransaction.fuzz.test.ts, which diffs against
// pre-generated snapshots: here TronWeb itself runs side by side with us on
// the SAME private key + SAME transaction — its serializer (raw_data ->
// protobuf bytes -> txID, section B) and its ECDSA signer (every section) —
// and bytes, ids and signatures are compared exactly. The stored fixtures
// define the swept corpus and remain the byte anchor; on top of that, both
// stacks' LIVE outputs must agree with each other.
//
// Corpora swept (all deterministic, only trivial keys pk=1..16):
//   - every case of all 13 per-contract-type files (test/fixtures/tx/*.json);
//   - the whole 126-entry hex corpus test/fixtures/tx/fuzz.json;
//   - every message + typed-data case of test/fixtures/sig/fuzz.json.
//
// Known, pinned wire-cosmetic divergence: TronWeb's transaction-level
// signatures render the trailing v byte through an UPPERCASE hex map
// ('…1B'/'…1C'), while ours are all-lowercase ('…1b'/'…1c'). The 65 signature
// bytes are identical; only the hex case of the last byte differs. The
// comparator below asserts the exact case of BOTH sides so any drift in
// either stack (including a case change) fails loudly.
import { readFileSync } from 'node:fs'

import { TronWeb, Trx, utils } from 'tronweb'
import { describe, expect, test } from 'vitest'

import { privateKeyToAddress } from '../../src/accounts/utils/privateKeyToAddress.js'
import { signTransaction } from '../../src/accounts/utils/signTransaction.js'
import type { Address, TronHexAddress } from '../../src/types/address.js'
import type { Hex, SignableMessage } from '../../src/types/misc.js'
import { toBase58 } from '../../src/utils/address/toBase58.js'
import type { HashTypedDataParameters } from '../../src/utils/signature/hashTypedData.js'
import { sign } from '../../src/utils/signature/sign.js'
import { signMessage } from '../../src/utils/signature/signMessage.js'
import { signTypedData } from '../../src/utils/signature/signTypedData.js'
import { decodeRawData } from '../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../src/utils/transaction/getTransactionId.js'
import {
  type RawData,
  toRawDataHex,
} from '../../src/utils/transaction/serializeRawData.js'
import {
  loadSigFuzzFixtures,
  type SigFuzzMessageFixture,
  type SigFuzzTypedDataFixture,
} from '../fixtures/sig/loader.js'
import {
  loadTxFixtureFile,
  type TxFixture,
  txFixtureFiles,
} from '../fixtures/tx/loader.js'

const {
  crypto: twCrypto,
  message: twMessage,
  typedData: twTypedData,
  transaction: twTransaction,
} = utils

type KeyLabel = 'pk1' | 'pk2'
const KEY_LABELS = ['pk1', 'pk2'] as const

// Our stack accepts 0x-prefixed keys; TronWeb's crypto.signTransaction
// REJECTS a 0x prefix, so it gets the bare form of the same trivial scalars.
const PRIVATE_KEY = {
  pk1: '0x0000000000000000000000000000000000000000000000000000000000000001',
  pk2: '0x0000000000000000000000000000000000000000000000000000000000000002',
} as const
const BARE_KEY = {
  pk1: '0000000000000000000000000000000000000000000000000000000000000001',
  pk2: '0000000000000000000000000000000000000000000000000000000000000002',
} as const

// All 23 rich fixture cases across the 13 per-contract-type files.
const allTxFixtures = txFixtureFiles.flatMap((file) => loadTxFixtureFile(file))

// The full contract-type set the corpus must keep covering.
const CONTRACT_TYPES = [1, 2, 4, 13, 30, 31, 46, 54, 55, 56, 57, 58, 59]

// The 126-entry hex-only fuzz corpus (not covered by loadTxFixtures()).
type TxFuzzEntry = {
  name: string
  contractType: number
  typeUrl: string
  rawDataHex: string
  txID: string
}
const txFuzz = JSON.parse(
  readFileSync(new URL('../fixtures/tx/fuzz.json', import.meta.url), 'utf8'),
) as TxFuzzEntry[]

const { messages, typedData: typedDataFixtures } = loadSigFuzzFixtures()

// The canonical transfer reference vector and the baked-Permission_id case.
const canonical = allTxFixtures.find((f) =>
  f.name.includes('canonical'),
) as TxFixture
const pid2Fixture = allTxFixtures.find((f) =>
  f.name.includes('Permission_id=2'),
) as TxFixture

/** Live TronWeb oracle: signs a bare txID stub (fresh object, never shared). */
function tronwebSignTxId(txID: string, label: KeyLabel): string {
  const signed = twCrypto.signTransaction(BARE_KEY[label], {
    txID,
    signature: [],
  })
  return (signed.signature as string[])[0] as string
}

/** The node-format owner_address of a fixture's first contract, as Base58. */
function fixtureOwner(fixture: TxFixture): Address {
  const rawData = fixture.rawData as {
    contract: { parameter: { value: { owner_address: string } } }[]
  }
  const owner = rawData.contract[0]?.parameter.value.owner_address
  if (!owner) throw new Error(`fixture ${fixture.name} has no owner_address`)
  return toBase58(owner as TronHexAddress)
}

/**
 * Asserts our signature and TronWeb's are the same 65 bytes, pinning the
 * exact hex case of BOTH sides: r||s (128 chars) must match case-exactly;
 * TronWeb's trailing v byte is UPPERCASE hex ('1B'/'1C') where ours is
 * lowercase — a wire-identical, pinned cosmetic divergence (see header).
 */
function expectSameWireSignature(
  ours: string,
  tronwebs: string,
  context?: string,
): void {
  expect(ours, context).toHaveLength(130)
  expect(tronwebs, context).toHaveLength(130)
  // Ours is fully lowercase, ending in the recovery byte 1b/1c.
  expect(ours, context).toBe(ours.toLowerCase())
  expect(['1b', '1c'], context).toContain(ours.slice(128))
  // r||s: byte-for-byte AND case-exact on both sides (both lowercase).
  expect(tronwebs.slice(0, 128), context).toBe(ours.slice(0, 128))
  // v byte: same byte, TronWeb's rendered uppercase ('1B'/'1C').
  expect(tronwebs.slice(128), context).toBe(ours.slice(128).toUpperCase())
}

describe('A. corpus sanity', () => {
  test('all 13 contract types are covered by the fixture files', () => {
    expect(txFixtureFiles).toHaveLength(13)
    for (const file of txFixtureFiles)
      expect(loadTxFixtureFile(file).length).toBeGreaterThanOrEqual(1)
    const types = [...new Set(allTxFixtures.map((f) => f.contractType))]
    types.sort((a, b) => a - b)
    expect(types).toEqual(CONTRACT_TYPES)
    expect(allTxFixtures).toHaveLength(23)
    // The two anchor cases exist.
    expect(canonical.name).toContain('canonical')
    expect(pid2Fixture).toBeDefined()
  })
})

describe('B. per-type live pipeline diff', () => {
  test.each(
    allTxFixtures.map((f) => [f.name, f] as const),
  )('transaction %s', (_name, fixture: TxFixture) => {
    const rawData = decodeRawData(fixture.rawDataHex)
    const owner = fixtureOwner(fixture)

    // Live TronWeb serializer oracle: its own raw_data -> protobuf pass over
    // the node-shape fixture reproduces the exact bytes and id we pin (its
    // hex rendered UPPERCASE, its id 0x-prefixed — asserted case-exactly).
    const pb = twTransaction.txJsonToPb({
      raw_data: fixture.rawData,
    } as Parameters<typeof twTransaction.txJsonToPb>[0])
    expect(twTransaction.txPbToRawDataHex(pb)).toBe(
      fixture.rawDataHex.toUpperCase(),
    )
    expect(twTransaction.txPbToTxID(pb)).toBe(`0x${fixture.txID}`)

    for (const label of KEY_LABELS) {
      // Live TronWeb signs the fixture's txID digest.
      const theirs = tronwebSignTxId(fixture.txID, label)
      // Our full pipeline: recompute the id from raw_data, then sign.
      // `address` = the tx owner (external-signer form) so the owner guard
      // passes for keys that do not own the fixture (pk2).
      const signed = signTransaction({
        transaction: { raw_data: rawData },
        privateKey: PRIVATE_KEY[label],
        address: owner,
      })
      expect(signed.txID, label).toBe(fixture.txID)
      expect(signed.raw_data_hex, label).toBe(fixture.rawDataHex)
      expect(signed.signature, label).toHaveLength(1)
      expectSameWireSignature(
        (signed.signature as string[])[0]!,
        theirs,
        `${fixture.name}/${label}`,
      )
    }
  })

  test('signature-array semantics: same-key dedup, two-key append order', () => {
    // TronWeb: signing twice with pk1 dedups (Array.includes), pk2 appends.
    const twTx = { txID: canonical.txID, signature: [] as string[] }
    twCrypto.signTransaction(BARE_KEY.pk1, twTx)
    twCrypto.signTransaction(BARE_KEY.pk1, twTx)
    expect(twTx.signature).toHaveLength(1)
    twCrypto.signTransaction(BARE_KEY.pk2, twTx)
    expect(twTx.signature).toHaveLength(2)

    // Ours: same dedup + same append order.
    const rawData = decodeRawData(canonical.rawDataHex)
    const owner = fixtureOwner(canonical)
    const once = signTransaction({
      transaction: { raw_data: rawData },
      privateKey: PRIVATE_KEY.pk1,
    })
    const twice = signTransaction({
      transaction: once,
      privateKey: PRIVATE_KEY.pk1,
    })
    expect(twice.signature).toHaveLength(1)
    const both = signTransaction({
      transaction: twice,
      privateKey: PRIVATE_KEY.pk2,
      address: owner,
    })
    expect(both.signature).toHaveLength(2)
    for (const [i, ours] of (both.signature as string[]).entries())
      expectSameWireSignature(ours, twTx.signature[i] as string, `sig[${i}]`)
  })

  test('cross-stack dedup: a TronWeb-cased copy of the same bytes is deduped', () => {
    // TronWeb's uppercase v byte renders the same 65 signature bytes with a
    // different hex case. Our dedup guard compares case-insensitively (Day 5
    // fix), so re-signing a TronWeb-signed transaction with the SAME key
    // appends nothing and leaves the existing entry untouched — a duplicate
    // would make the node reject the broadcast.
    const rawData = decodeRawData(canonical.rawDataHex)
    const theirs = tronwebSignTxId(canonical.txID, 'pk1')
    const resigned = signTransaction({
      transaction: { raw_data: rawData, signature: [theirs] },
      privateKey: PRIVATE_KEY.pk1,
    })
    expect(resigned.signature).toEqual([theirs])
  })
})

describe('C. fuzz-corpus ECDSA sweep', () => {
  test('the whole 126-entry corpus is swept — no sampling', () => {
    expect(txFuzz).toHaveLength(126)
    const types = [...new Set(txFuzz.map((e) => e.contractType))]
    types.sort((a, b) => a - b)
    expect(types).toEqual(CONTRACT_TYPES)
    for (const entry of txFuzz) expect(entry.txID).toMatch(/^[0-9a-f]{64}$/)
  })

  test.each(
    txFuzz.map((e) => [e.name, e] as const),
  )('fuzz %s', (_name, entry: TxFuzzEntry) => {
    // The corpus txID really is the digest of the corpus bytes.
    expect(getTransactionId(decodeRawData(entry.rawDataHex))).toBe(entry.txID)
    // Both stacks sign the same digest with both trivial keys.
    for (const label of KEY_LABELS) {
      const ours = sign({
        hash: `0x${entry.txID}`,
        privateKey: PRIVATE_KEY[label],
      }).hex
      expectSameWireSignature(
        ours,
        tronwebSignTxId(entry.txID, label),
        `${entry.name}/${label}`,
      )
    }
  })
})

describe('D. v-parity sweep', () => {
  test('keys 1..16 over one digest: byte-identical, both parities occur', () => {
    const txID = canonical.txID
    const parities = new Set<string>()
    for (let i = 1; i <= 16; i++) {
      const bare = i.toString(16).padStart(64, '0')
      const ours = sign({ hash: `0x${txID}`, privateKey: `0x${bare}` }).hex
      const theirs = (
        twCrypto.signTransaction(bare, { txID, signature: [] })
          .signature as string[]
      )[0] as string
      expectSameWireSignature(ours, theirs, `pk=${i}`)
      parities.add(ours.slice(128))
    }
    // Both recovery parities are actually exercised by the sweep.
    expect(parities).toEqual(new Set(['1b', '1c']))
  })
})

describe('E. permission (multi-sig) baking equivalence', () => {
  test('our permissionId injection == independent baking == live TronWeb multiSign', async () => {
    // Start from the baked Permission_id=2 fixture and strip the permission
    // id to reconstruct the unbaked model.
    const bakedModel = decodeRawData(pid2Fixture.rawDataHex)
    const unbaked: RawData = {
      ...bakedModel,
      contract: bakedModel.contract.map(
        ({ permissionId: _pid, ...rest }) => rest,
      ),
    }
    expect(toRawDataHex(unbaked)).not.toBe(pid2Fixture.rawDataHex)

    // In-test re-baking reproduces the fixture bytes and id exactly. (The
    // rebake shares our serializer with the code path under test — the
    // non-circularity of this section comes from the gold fixture byte
    // anchor and from TronWeb's own txCheck re-serialization inside
    // multiSign below, not from this step.)
    const rebaked: RawData = {
      ...unbaked,
      contract: unbaked.contract.map((c) => ({ ...c, permissionId: 2 })),
    }
    expect(toRawDataHex(rebaked)).toBe(pid2Fixture.rawDataHex)
    expect(getTransactionId(rebaked)).toBe(pid2Fixture.txID)

    // Our pipeline signs the UNBAKED transaction with permissionId: 2 —
    // the internal injection must produce exactly the baked bytes.
    const signed = signTransaction({
      transaction: { raw_data: unbaked },
      privateKey: PRIVATE_KEY.pk1,
      permissionId: 2,
    })
    expect(signed.txID).toBe(pid2Fixture.txID)
    expect(signed.raw_data_hex).toBe(pid2Fixture.rawDataHex)

    // Live TronWeb multiSign on the full node-shape baked transaction. The
    // Permission_id is already baked, so multiSign takes its offline path
    // (txCheck + local sign, zero network); nothing listens on this
    // localhost port, so any accidental request fails fast instead.
    const tronWeb = new TronWeb({ fullHost: 'http://127.0.0.1:9' })
    const nodeTx = structuredClone({
      visible: false,
      txID: pid2Fixture.txID,
      raw_data: pid2Fixture.rawData,
      raw_data_hex: pid2Fixture.rawDataHex,
    })
    const twSigned = await tronWeb.trx.multiSign(
      nodeTx as unknown as Parameters<typeof tronWeb.trx.multiSign>[0],
      BARE_KEY.pk1,
      2,
    )
    expectSameWireSignature(
      (signed.signature as string[])[0]!,
      (twSigned.signature as string[])[0] as string,
    )
  })
})

describe('F. tamper divergence (deliberate hardening difference)', () => {
  test('TronWeb signs a tampered txID blindly; we recompute the honest id', () => {
    // This is an INTENTIONAL security divergence, not a compatibility bug:
    // TronWeb's crypto-level signTransaction trusts whatever txID it is
    // handed; our signTransaction never trusts a supplied txID when raw_data
    // is present — it recomputes the id from the bytes and signs that.
    const rawData = decodeRawData(canonical.rawDataHex)
    const tamperedTxID =
      (canonical.txID[0] === '0' ? '1' : '0') + canonical.txID.slice(1)
    expect(tamperedTxID).not.toBe(canonical.txID)

    const honest = sign({
      hash: `0x${canonical.txID}`,
      privateKey: PRIVATE_KEY.pk1,
    }).hex

    // TronWeb: signs the tampered digest as-is (== a direct sign of it).
    const theirs = tronwebSignTxId(tamperedTxID, 'pk1')
    const tampered = sign({
      hash: `0x${tamperedTxID}`,
      privateKey: PRIVATE_KEY.pk1,
    }).hex
    expectSameWireSignature(tampered, theirs)
    expect(theirs.toLowerCase()).not.toBe(honest)

    // Ours: the tampered txID is ignored; the honest id and signature win.
    const signed = signTransaction({
      transaction: { txID: tamperedTxID, raw_data: rawData },
      privateKey: PRIVATE_KEY.pk1,
    })
    expect(signed.txID).toBe(canonical.txID)
    expect(signed.signature).toEqual([honest])
  })
})

describe('G. message + typed-data live diff', () => {
  test('the full sig-fuzz corpora are swept', () => {
    expect(messages).toHaveLength(160)
    expect(typedDataFixtures).toHaveLength(38)
  })

  test.each(
    messages.map((m) => [m.name, m] as const),
  )('message %s', (_name, fixture: SigFuzzMessageFixture) => {
    const label = fixture.privateKeyLabel
    // Same input forms the generator used: text cases as a JS string, raw
    // cases as bytes for TronWeb / { raw } for us.
    const isRaw = fixture.rawHex !== undefined
    const tronwebInput = isRaw
      ? bytesFromHex(fixture.rawHex as string)
      : (fixture.message as string)
    const ourInput: SignableMessage = isRaw
      ? { raw: fixture.rawHex as Hex }
      : (fixture.message as string)

    const live = twMessage.signMessage(tronwebInput, BARE_KEY[label])
    const ours = signMessage({
      message: ourInput,
      privateKey: PRIVATE_KEY[label],
    }).serialized
    // Three-way: ours === live TronWeb === stored gold (exact case — both
    // stacks emit 0x-prefixed all-lowercase here).
    expect(ours).toBe(live)
    expect(ours).toBe(fixture.signature)
  })

  test.each(
    typedDataFixtures.map((t) => [t.name, t] as const),
  )('typed-data %s', (_name, fixture: SigFuzzTypedDataFixture) => {
    const label = fixture.privateKeyLabel
    const live = twTypedData.signTypedData(
      fixture.domain as Parameters<typeof twTypedData.signTypedData>[0],
      fixture.types,
      fixture.value,
      BARE_KEY[label],
    )
    const params = {
      domain: fixture.domain,
      types: fixture.types,
      primaryType: fixture.primaryType,
      message: fixture.value,
    } as HashTypedDataParameters
    const ours = signTypedData({
      ...params,
      privateKey: PRIVATE_KEY[label],
    }).serialized
    // Three-way: ours === live TronWeb === stored gold (exact case).
    expect(ours).toBe(live)
    expect(ours).toBe(fixture.signature)
  })
})

describe('H. round-trip identity', () => {
  test('TronWeb Trx.ecRecover recovers the signer from our signatures', () => {
    const rawData = decodeRawData(canonical.rawDataHex)
    const owner = fixtureOwner(canonical)
    for (const label of KEY_LABELS) {
      const signed = signTransaction({
        transaction: { raw_data: rawData },
        privateKey: PRIVATE_KEY[label],
        address: owner,
      })
      // Full node-shape transaction (txCheck runs inside ecRecover).
      const nodeTx = structuredClone({
        visible: false,
        txID: canonical.txID,
        raw_data: canonical.rawData,
        raw_data_hex: canonical.rawDataHex,
        signature: signed.signature,
      })
      const recovered = Trx.ecRecover(
        nodeTx as unknown as Parameters<typeof Trx.ecRecover>[0],
      )
      expect(recovered).toBe(privateKeyToAddress(PRIVATE_KEY[label]))
    }
  })
})

/** Decodes bare or 0x-prefixed hex into bytes (test-local helper). */
function bytesFromHex(hex: string): Uint8Array {
  const bare = hex.replace(/^0x/, '')
  const out = new Uint8Array(bare.length / 2)
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(bare.slice(i * 2, i * 2 + 2), 16)
  return out
}
