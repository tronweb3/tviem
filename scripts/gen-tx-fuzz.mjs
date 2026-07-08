// Differential transaction fuzz generator (dev-only, never published).
//
// Sweeps randomized parameters across all 13 v0.1 contract types and, for
// every case, produces the gold-standard `raw_data_hex` / `txID` straight
// from TronWeb's official google-protobuf stack — fully OFFLINE. A fixed
// TaPoS block header and fixed timestamps are pinned on every build, a
// deterministic mulberry32 PRNG (hard-coded seed) drives all parameter
// choices, and the wall clock / network / `Math.random` are never touched.
// Reruns are therefore byte-identical.
//
// Output: test/fixtures/tx/fuzz.json — a flat array of
//   { name, contractType, typeUrl, rawDataHex, txID }
// consumed by src/utils/transaction/fuzz.test.ts, which re-derives each
// entry through our own codec and asserts byte-for-byte agreement.
//
// The generator self-checks every entry with TronWeb's `txCheck` and, for
// the "flex" (visible true/false) address forms, asserts both inputs
// serialize to identical bytes, before writing anything.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TronWeb, utils } from 'tronweb'

const { txCheck, txJsonToPb, txPbToRawDataHex, txPbToTxID } = utils.transaction

// ---------------------------------------------------------------------------
// Fixed constants (never derived from clock / network / randomness).
// ---------------------------------------------------------------------------

/** Fixed TaPoS + lifetime, identical for every case. */
const BLOCK_HEADER = {
  ref_block_bytes: '1234',
  ref_block_hash: '0102030405060708',
  expiration: 1700000060000,
  timestamp: 1700000000000,
}

// §2.1 addresses V1/V2/V3 and §2.3 recipient TO (public derivations of the
// trivial keys pk=1/pk=2 plus well-known public constants — no secrets).
const V1 = {
  base58: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  hex: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
}
const V2 = {
  base58: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
  hex: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
}
const V3 = {
  base58: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  hex: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
}
const TO = {
  base58: 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY',
  hex: '41928c9af0651632157ef27a2cf17ca72c575a4d21',
}
const ADDRESSES = [V1, V2, V3, TO]

/** Standard full-permission operations bitmap (32 bytes). */
const OPERATIONS =
  '7fff1fc0033e0300000000000000000000000000000000000000000000000000'

/** Small deploy ABI reused across CreateSmartContract cases. */
const DEPLOY_ABI = [
  { inputs: [], stateMutability: 'payable', type: 'constructor' },
  {
    constant: true,
    inputs: [{ name: 'who', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
]

/** ContractType integers, asserted against the runtime protobuf enum. */
const CONTRACT_TYPE = {
  TransferContract: 1,
  TransferAssetContract: 2,
  VoteWitnessContract: 4,
  WithdrawBalanceContract: 13,
  CreateSmartContract: 30,
  TriggerSmartContract: 31,
  AccountPermissionUpdateContract: 46,
  FreezeBalanceV2Contract: 54,
  UnfreezeBalanceV2Contract: 55,
  WithdrawExpireUnfreezeContract: 56,
  DelegateResourceContract: 57,
  UnDelegateResourceContract: 58,
  CancelAllUnfreezeV2Contract: 59,
}

// ---------------------------------------------------------------------------
// Deterministic PRNG + helpers
// ---------------------------------------------------------------------------

/** mulberry32 — tiny deterministic PRNG; hard-coded seed, never reseeded. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(0x6f6d6e69)

/** Uniform integer in [min, max]. */
const int = (min, max) => min + Math.floor(rng() * (max - min + 1))
/** Uniform element of an array. */
const pick = (arr) => arr[int(0, arr.length - 1)]
/** Fair coin. */
const bool = () => rng() < 0.5

/**
 * A positive `int64`-safe amount whose magnitude is itself sampled, so the
 * sweep spans 1-digit through ~15-digit values (varint length 1..8 bytes).
 */
function amount() {
  const buckets = [1e3, 1e6, 1e9, 1e12, 4e15]
  const max = pick(buckets)
  return int(1, Math.min(max, Number.MAX_SAFE_INTEGER))
}

/** Bare lowercase hex of `len` random bytes. */
function hexBytes(len) {
  let out = ''
  for (let i = 0; i < len; i++) out += int(0, 255).toString(16).padStart(2, '0')
  return out
}

/** A random decimal digit string of `len` digits (TRC10 token-id shaped). */
function digits(len) {
  let out = String(int(1, 9))
  for (let i = 1; i < len; i++) out += String(int(0, 9))
  return out
}

/** ASCII-hex of a string (the visible=false form of a flex text field). */
function asciiHex(str) {
  let out = ''
  for (const ch of str) out += ch.charCodeAt(0).toString(16).padStart(2, '0')
  return out
}

/** Address in the form the current `visible` flag requires. */
const addr = (a, visible) => (visible ? a.base58 : a.hex)

function assert(condition, message) {
  if (!condition) throw new Error(`gen-tx-fuzz: ${message}`)
}

// Unroutable host: constructing TronWeb never dials out, and every build
// carries a full block header, short-circuiting all RPC lookups.
const tronWeb = new TronWeb({ fullHost: 'http://127.0.0.1:9' })
const builder = tronWeb.transactionBuilder
const withBlockHeader = (options = {}) => ({
  ...options,
  blockHeader: BLOCK_HEADER,
})

/**
 * Assembles a transaction JSON by hand and serializes it through TronWeb's
 * protobuf stack (`txJsonToPb`) — the direct, validation-free path used for
 * every manual case (visible flex forms, missing/added optional fields).
 */
function buildManualTx(typeName, value, options = {}) {
  const contract = {
    parameter: { value, type_url: `type.googleapis.com/protocol.${typeName}` },
    type: typeName,
  }
  if (options.permissionId) contract.Permission_id = options.permissionId
  const tx = {
    visible: options.visible === true,
    txID: '',
    raw_data_hex: '',
    raw_data: {
      contract: [contract],
      ref_block_bytes: BLOCK_HEADER.ref_block_bytes,
      ref_block_hash: BLOCK_HEADER.ref_block_hash,
      expiration: BLOCK_HEADER.expiration,
      ...(options.data ? { data: options.data } : {}),
      timestamp: BLOCK_HEADER.timestamp,
      ...(options.feeLimit ? { fee_limit: options.feeLimit } : {}),
    },
  }
  const pb = txJsonToPb(tx)
  tx.raw_data_hex = txPbToRawDataHex(pb).toLowerCase()
  tx.txID = txPbToTxID(pb).replace(/^0x/, '')
  return tx
}

const entries = []
const seenNames = new Set()

/** Validates a TronWeb-built tx and appends its gold vector as an entry. */
function record(name, typeName, tx) {
  assert(!seenNames.has(name), `duplicate case name: ${name}`)
  seenNames.add(name)
  assert(
    tx.raw_data.contract[0].parameter.type_url ===
      `type.googleapis.com/protocol.${typeName}`,
    `${name}: unexpected type_url`,
  )
  assert(txCheck(tx), `${name}: TronWeb txCheck failed`)
  entries.push({
    name,
    contractType: CONTRACT_TYPE[typeName],
    typeUrl: tx.raw_data.contract[0].parameter.type_url,
    rawDataHex: tx.raw_data_hex,
    txID: tx.txID,
  })
}

/**
 * Records a manual case, additionally asserting that the visible=true
 * (Base58) and visible=false (hex) input forms serialize to identical bytes
 * — proving the flex/dual-form address parsing on the generator side.
 */
function recordFlex(name, typeName, makeValue, options = {}) {
  const hexTx = buildManualTx(typeName, makeValue(false), {
    ...options,
    visible: false,
  })
  const b58Tx = buildManualTx(typeName, makeValue(true), {
    ...options,
    visible: true,
  })
  assert(
    hexTx.raw_data_hex === b58Tx.raw_data_hex && hexTx.txID === b58Tx.txID,
    `${name}: visible true/false forms must be byte-equal`,
  )
  record(name, typeName, hexTx)
}

// ---------------------------------------------------------------------------
// Cases — driven entirely by the deterministic PRNG.
// ---------------------------------------------------------------------------

async function buildFixtures() {
  // --- TransferContract (type 1): amount / permission_id / fee_limit / memo ---
  for (let i = 0; i < 16; i++) {
    const owner = pick(ADDRESSES)
    const to = pick(ADDRESSES.filter((a) => a !== owner))
    const amt = amount()
    const permissionId = pick([0, 0, 1, 2, 3])
    const feeLimit = bool() ? amount() : 0
    const data = bool() ? hexBytes(int(1, 40)) : ''
    const options = {}
    if (permissionId) options.permissionId = permissionId
    if (feeLimit) options.feeLimit = feeLimit
    if (data) options.data = data
    const dims = [
      `pid=${permissionId}`,
      feeLimit ? 'feeLimit' : 'noFeeLimit',
      data ? `data(${data.length / 2}B)` : 'noData',
    ].join(',')
    recordFlex(
      `transfer #${i} amt=${amt} ${dims}`,
      'TransferContract',
      (v) => ({
        owner_address: addr(owner, v),
        to_address: addr(to, v),
        amount: amt,
      }),
      options,
    )
  }

  // --- TransferAssetContract (type 2): asset_name flex + amount ---
  for (let i = 0; i < 12; i++) {
    const owner = pick(ADDRESSES)
    const to = pick(ADDRESSES.filter((a) => a !== owner))
    const amt = amount()
    const token = digits(int(1, 12))
    const permissionId = pick([0, 0, 2])
    const options = {}
    if (permissionId) options.permissionId = permissionId
    recordFlex(
      `transfer-asset #${i} token=${token} amt=${amt} pid=${permissionId}`,
      'TransferAssetContract',
      (v) => ({
        asset_name: v ? token : asciiHex(token),
        owner_address: addr(owner, v),
        to_address: addr(to, v),
        amount: amt,
      }),
      options,
    )
  }

  // --- VoteWitnessContract (type 4): 1..4 votes ---
  for (let i = 0; i < 10; i++) {
    const owner = pick(ADDRESSES)
    const n = int(1, 4)
    const witnesses = [...ADDRESSES].sort(() => (bool() ? 1 : -1)).slice(0, n)
    // Sample the counts once so both flex forms encode identical values.
    const votes = witnesses.map((w) => ({ w, count: int(1, 1_000_000) }))
    const permissionId = pick([0, 0, 1])
    const options = {}
    if (permissionId) options.permissionId = permissionId
    recordFlex(
      `vote #${i} votes=${n} pid=${permissionId}`,
      'VoteWitnessContract',
      (v) => ({
        owner_address: addr(owner, v),
        votes: votes.map(({ w, count }) => ({
          vote_address: addr(w, v),
          vote_count: count,
        })),
      }),
      options,
    )
  }

  // --- Owner-only contracts (13 / 56 / 59): owner + permission_id ---
  const ownerOnly = [
    ['WithdrawBalanceContract', 6],
    ['WithdrawExpireUnfreezeContract', 6],
    ['CancelAllUnfreezeV2Contract', 6],
  ]
  for (const [typeName, count] of ownerOnly) {
    for (let i = 0; i < count; i++) {
      const owner = pick(ADDRESSES)
      const permissionId = pick([0, 0, 1, 2, 3])
      const options = {}
      if (permissionId) options.permissionId = permissionId
      recordFlex(
        `${typeName} #${i} owner=${owner.base58.slice(0, 6)} pid=${permissionId}`,
        typeName,
        (v) => ({ owner_address: addr(owner, v) }),
        options,
      )
    }
  }

  // --- TriggerSmartContract (type 31): data / call_value / token / fee_limit ---
  for (let i = 0; i < 14; i++) {
    const owner = pick(ADDRESSES)
    const contract = pick(ADDRESSES.filter((a) => a !== owner))
    const data = hexBytes(int(4, 100))
    const callValue = bool() ? amount() : 0
    const withToken = bool()
    const tokenValue = withToken ? amount() : 0
    const tokenId = withToken ? Number(digits(int(4, 7))) : 0
    const feeLimit = bool() ? amount() : 0
    const options = {}
    if (feeLimit) options.feeLimit = feeLimit
    const dims = [
      callValue ? 'callValue' : 'noCallValue',
      withToken ? `token(${tokenId})` : 'noToken',
      feeLimit ? 'feeLimit' : 'noFeeLimit',
      `data(${data.length / 2}B)`,
    ].join(',')
    recordFlex(
      `trigger #${i} ${dims}`,
      'TriggerSmartContract',
      (v) => {
        const value = {
          owner_address: addr(owner, v),
          contract_address: addr(contract, v),
          data,
        }
        if (callValue) value.call_value = callValue
        if (withToken) {
          value.call_token_value = tokenValue
          value.token_id = tokenId
        }
        return value
      },
      options,
    )
  }

  // --- FreezeBalanceV2Contract (type 54): resource + amount ---
  for (let i = 0; i < 10; i++) {
    const owner = pick(ADDRESSES)
    const resource = pick(['BANDWIDTH', 'ENERGY'])
    const amt = amount()
    record(
      `freeze-v2 #${i} ${resource} amt=${amt}`,
      'FreezeBalanceV2Contract',
      await builder.freezeBalanceV2(
        amt,
        resource,
        owner.base58,
        withBlockHeader(),
      ),
    )
  }

  // --- UnfreezeBalanceV2Contract (type 55): resource + amount ---
  for (let i = 0; i < 10; i++) {
    const owner = pick(ADDRESSES)
    const resource = pick(['BANDWIDTH', 'ENERGY'])
    const amt = amount()
    record(
      `unfreeze-v2 #${i} ${resource} amt=${amt}`,
      'UnfreezeBalanceV2Contract',
      await builder.unfreezeBalanceV2(
        amt,
        resource,
        owner.base58,
        withBlockHeader(),
      ),
    )
  }

  // --- DelegateResourceContract (type 57): resource / lock / lock_period ---
  for (let i = 0; i < 12; i++) {
    const owner = pick(ADDRESSES)
    const receiver = pick(ADDRESSES.filter((a) => a !== owner))
    const resource = pick(['BANDWIDTH', 'ENERGY'])
    const amt = amount()
    const lock = bool()
    const lockPeriod = lock ? int(1, 1_000_000) : undefined
    record(
      `delegate #${i} ${resource} amt=${amt} lock=${lock}${lock ? ` period=${lockPeriod}` : ''}`,
      'DelegateResourceContract',
      await builder.delegateResource(
        amt,
        receiver.base58,
        resource,
        owner.base58,
        lock,
        lockPeriod,
        withBlockHeader(),
      ),
    )
  }

  // --- UnDelegateResourceContract (type 58): resource + amount ---
  for (let i = 0; i < 10; i++) {
    const owner = pick(ADDRESSES)
    const receiver = pick(ADDRESSES.filter((a) => a !== owner))
    const resource = pick(['BANDWIDTH', 'ENERGY'])
    const amt = amount()
    record(
      `undelegate #${i} ${resource} amt=${amt}`,
      'UnDelegateResourceContract',
      await builder.undelegateResource(
        amt,
        receiver.base58,
        resource,
        owner.base58,
        withBlockHeader(),
      ),
    )
  }

  // --- CreateSmartContract (type 30): name / bytecode / fees / value ---
  for (let i = 0; i < 8; i++) {
    const owner = pick(ADDRESSES)
    const options = {
      abi: DEPLOY_ABI,
      bytecode: hexBytes(int(4, 32)),
      name: `Omni${digits(int(1, 6))}`,
      userFeePercentage: int(0, 100),
      originEnergyLimit: int(1, 10_000_000),
      feeLimit: int(1_000_000, 1_000_000_000),
    }
    if (bool()) options.callValue = amount()
    const withToken = bool()
    if (withToken) {
      options.tokenValue = amount()
      options.tokenId = Number(digits(int(4, 7)))
    }
    record(
      `create #${i} pct=${options.userFeePercentage} token=${withToken}`,
      'CreateSmartContract',
      await builder.createSmartContract(withBlockHeader(options), owner.base58),
    )
  }

  // --- AccountPermissionUpdateContract (type 46): threshold / keys / actives ---
  for (let i = 0; i < 6; i++) {
    const owner = pick(ADDRESSES)
    const ownerKeyN = int(1, 3)
    const ownerKeys = ADDRESSES.slice(0, ownerKeyN).map((a) => ({
      address: a.base58,
      weight: int(1, 3),
    }))
    const ownerPermission = {
      type: 0,
      permission_name: 'owner',
      threshold: int(1, ownerKeyN),
      keys: ownerKeys,
    }
    const activeN = int(1, 2)
    const actives = []
    for (let j = 0; j < activeN; j++)
      actives.push({
        type: 2,
        id: 2 + j,
        permission_name: `active${j}`,
        threshold: 1,
        operations: OPERATIONS,
        keys: [{ address: pick(ADDRESSES).base58, weight: 1 }],
      })
    record(
      `permission-update #${i} ownerKeys=${ownerKeyN} actives=${activeN}`,
      'AccountPermissionUpdateContract',
      await builder.updateAccountPermissions(
        owner.base58,
        ownerPermission,
        null,
        actives,
        withBlockHeader(),
      ),
    )
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Guard: hardcoded ContractType integers must match the runtime protobuf enum.
const runtimeEnum = globalThis.TronWebProto.Transaction.Contract.ContractType
for (const [typeName, value] of Object.entries(CONTRACT_TYPE))
  assert(
    runtimeEnum[typeName.toUpperCase()] === value,
    `ContractType.${typeName} expected ${value}`,
  )

await buildFixtures()

// Coverage guard: every one of the 13 contract types must be represented.
const covered = new Set(entries.map((e) => e.contractType))
assert(
  covered.size === Object.keys(CONTRACT_TYPE).length,
  `expected all 13 contract types, got ${covered.size}`,
)
assert(entries.length >= 120, `expected >=120 cases, got ${entries.length}`)

const outDir = resolve(import.meta.dirname, '../test/fixtures/tx')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, 'fuzz.json'),
  `${JSON.stringify(entries, null, 2)}\n`,
)
console.log(
  `fuzz.json: ${entries.length} case(s) across ${covered.size} contract type(s)`,
)
