#!/usr/bin/env node
/**
 * Gold-vector generator for `test/fixtures/tx/fuzz.json`.
 *
 * Emits differential gold cases (`rawDataHex` + `txID`) for the v0.1 contract
 * set using TronWeb's official protobuf stack — the google-protobuf generated
 * classes bundled inside the `tronweb` npm package — as the reference encoder.
 * The txID is independently computed as SHA-256 of the serialized `raw_data`.
 *
 * The original 126-case corpus (13 contract types) was produced by an earlier
 * revision of this script and is frozen in the fixture; this revision
 * generates the remaining 21 registered contract types (account, asset,
 * witness/brokerage, stake 1.0, proposal, exchange, and contract-admin
 * messages). Generation is deterministic (seeded PRNG), so re-running
 * reproduces the committed cases byte-for-byte.
 *
 * tviem itself must NOT depend on tronweb — run this from a throwaway
 * directory with tronweb installed and merge the JSON into the fixture:
 *
 *   mkdir /tmp/goldgen && cd /tmp/goldgen
 *   npm install tronweb@6.4.0
 *   node /path/to/tviem/scripts/gen-tx-fuzz.mjs > new-cases.json
 *
 * The script self-checks its envelope conventions against a hardcoded
 * known-answer vector (case #0 of the frozen corpus) before emitting anything.
 */
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

// Resolve tronweb's bundled protobuf classes from the INVOCATION directory
// (deep file paths bypass tronweb's `exports` map, which does not expose them).
const req = createRequire(path.join(process.cwd(), 'noop.js'))
const pb = (file) =>
  req(
    path.join(
      process.cwd(),
      'node_modules/tronweb/lib/commonjs/protocol/core',
      file,
    ),
  )

let Tron, account, asset, balance, exchange, proposal, smart, storage, witness
let Any
try {
  Tron = pb('Tron_pb.cjs')
  account = pb('contract/account_contract_pb.cjs')
  asset = pb('contract/asset_issue_contract_pb.cjs')
  balance = pb('contract/balance_contract_pb.cjs')
  exchange = pb('contract/exchange_contract_pb.cjs')
  proposal = pb('contract/proposal_contract_pb.cjs')
  smart = pb('contract/smart_contract_pb.cjs')
  storage = pb('contract/storage_contract_pb.cjs')
  witness = pb('contract/witness_contract_pb.cjs')
  // Anchor inside the tronweb package (realpath, so pnpm's symlinked layout
  // resolves into its isolated store) so tronweb's own google-protobuf
  // dependency is found under both npm and pnpm layouts.
  Any = createRequire(
    path.join(
      realpathSync(path.join(process.cwd(), 'node_modules/tronweb')),
      'package.json',
    ),
  )('google-protobuf/google/protobuf/any_pb.js').Any
} catch {
  process.stderr.write(
    'tronweb protobuf classes not found — run from a directory with tronweb@6.4.0 installed (npm install tronweb@6.4.0).\n',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — fixed seed so output is reproducible.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(0x74726f6e) // 'tron'

const rint = (maxExclusive) => Math.floor(rng() * maxExclusive)
/** Random int64 in [1, 10^digits), capped inside Number.MAX_SAFE_INTEGER. */
const ramount = (digits) => {
  const max = Math.min(10 ** digits, 9_000_000_000_000_000)
  return 1 + rint(max - 1)
}
const rbytes = (n) => {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = rint(256)
  return out
}
/** Random 21-byte TRON address (0x41 prefix). */
const raddr = () => {
  const out = new Uint8Array(21)
  out[0] = 0x41
  out.set(rbytes(20), 1)
  return out
}
const ascii = (s) => new TextEncoder().encode(s)
const hex = (u8) => Buffer.from(u8).toString('hex')

// ---------------------------------------------------------------------------
// Envelope — identical conventions to the frozen 126-case corpus.
// ---------------------------------------------------------------------------
const REF_BLOCK_BYTES = new Uint8Array([0x12, 0x34])
const REF_BLOCK_HASH = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
const EXPIRATION = 1_700_000_060_000
const TIMESTAMP = 1_700_000_000_000

function buildCase({ name, type, msgName, msg, pid = 0, data, feeLimit = 0 }) {
  const any = new Any()
  any.pack(msg.serializeBinary(), `protocol.${msgName}`)
  const contract = new Tron.Transaction.Contract()
  contract.setType(type)
  contract.setParameter(any)
  if (pid) contract.setPermissionId(pid)
  const raw = new Tron.Transaction.raw()
  raw.setRefBlockBytes(REF_BLOCK_BYTES)
  raw.setRefBlockHash(REF_BLOCK_HASH)
  raw.setExpiration(EXPIRATION)
  if (data) raw.setData(data)
  raw.setContractList([contract])
  raw.setTimestamp(TIMESTAMP)
  if (feeLimit) raw.setFeeLimit(feeLimit)
  const bytes = raw.serializeBinary()
  return {
    name,
    contractType: type,
    typeUrl: `type.googleapis.com/protocol.${msgName}`,
    rawDataHex: hex(bytes),
    txID: createHash('sha256').update(bytes).digest('hex'),
  }
}

// ---------------------------------------------------------------------------
// Known-answer self-check: rebuild case #0 of the frozen corpus and require a
// byte-exact match, proving the envelope conventions above are unchanged.
// ---------------------------------------------------------------------------
{
  const t = new balance.TransferContract()
  t.setOwnerAddress(
    Buffer.from('41928c9af0651632157ef27a2cf17ca72c575a4d21', 'hex'),
  )
  t.setToAddress(
    Buffer.from('412b5ad5c4795c026514f8317c7a215e218dccd6cf', 'hex'),
  )
  t.setAmount(969)
  const kat = buildCase({
    name: 'kat',
    type: 1,
    msgName: 'TransferContract',
    msg: t,
    pid: 3,
    data: Buffer.from(
      '20bdf029ec7fb5471fed3354644672852b1d8254b9af7b43176e326fc21e8daa790dd9',
      'hex',
    ),
  })
  const wantHex =
    '0a0212342208010203040506070840e0a499ffbc31522320bdf029ec7fb5471fed3354644672852b1d8254b9af7b43176e326fc21e8daa790dd95a68080112620a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412310a1541928c9af0651632157ef27a2cf17ca72c575a4d211215412b5ad5c4795c026514f8317c7a215e218dccd6cf18c90728037080d095ffbc31'
  const wantTxID =
    '4cc3b889438ba1cbf9f997a1dd72faa9db1c10b977c910a82cc18160eb7dae11'
  if (kat.rawDataHex !== wantHex || kat.txID !== wantTxID) {
    process.stderr.write(
      'known-answer self-check FAILED — envelope conventions drifted\n',
    )
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Per-type case builders. Each returns [slug, msgName, buildMsg()] where
// buildMsg returns { msg, detail } — detail feeds the human-readable name.
// Envelope variety (permission_id / data) cycles per case index.
// ---------------------------------------------------------------------------
const PIDS = [3, 0, 2, 0, 5, 0, 0, 4]
const envelope = (i) => ({
  pid: PIDS[i % PIDS.length],
  data: i % 3 === 0 ? rbytes(8 + rint(64)) : undefined,
})
const envelopeDetail = (env) =>
  `pid=${env.pid}${env.data ? `,data(${env.data.length}B)` : ',noData'}`

const cases = []
function emit(slug, type, msgName, variants) {
  variants.forEach((build, i) => {
    const env = envelope(i)
    const { msg, detail } = build()
    cases.push(
      buildCase({
        name: `${slug} #${i} ${detail} ${envelopeDetail(env)}`,
        type,
        msgName,
        msg,
        ...env,
      }),
    )
  })
}

// --- AccountCreateContract (0) ---------------------------------------------
emit(
  'accountCreate',
  0,
  'AccountCreateContract',
  [0, 1, 2, 0, 2, 1].map((accountType) => () => {
    const m = new account.AccountCreateContract()
    m.setOwnerAddress(raddr())
    m.setAccountAddress(raddr())
    if (accountType) m.setType(accountType)
    return {
      msg: m,
      detail: `type=${['Normal', 'AssetIssue', 'Contract'][accountType]}`,
    }
  }),
)

// --- AccountUpdateContract (10) --------------------------------------------
emit(
  'accountUpdate',
  10,
  'AccountUpdateContract',
  [1, 8, 32, 64, 128, 200].map((len) => () => {
    const m = new account.AccountUpdateContract()
    m.setAccountName(rbytes(len))
    m.setOwnerAddress(raddr())
    return { msg: m, detail: `name(${len}B)` }
  }),
)

// --- SetAccountIdContract (19) ---------------------------------------------
emit(
  'setAccountId',
  19,
  'SetAccountIdContract',
  [8, 12, 16, 24, 32, 10].map((len) => () => {
    const m = new account.SetAccountIdContract()
    const id = `acct.${'x'.repeat(Math.max(0, len - 5))}`.slice(0, len)
    m.setAccountId(ascii(id))
    m.setOwnerAddress(raddr())
    return { msg: m, detail: `id(${len}B)` }
  }),
)

// --- WitnessCreateContract (5) ---------------------------------------------
emit(
  'witnessCreate',
  5,
  'WitnessCreateContract',
  [1, 16, 32, 64, 128, 256].map((len) => () => {
    const m = new witness.WitnessCreateContract()
    m.setOwnerAddress(raddr())
    m.setUrl(
      ascii(
        `https://sr.example/${'w'.repeat(Math.max(0, len - 19))}`.slice(0, len),
      ),
    )
    return { msg: m, detail: `url(${len}B)` }
  }),
)

// --- WitnessUpdateContract (8) — update_url is field 12 --------------------
emit(
  'witnessUpdate',
  8,
  'WitnessUpdateContract',
  [1, 24, 48, 96, 160, 256].map((len) => () => {
    const m = new witness.WitnessUpdateContract()
    m.setOwnerAddress(raddr())
    m.setUpdateUrl(
      ascii(
        `https://sr2.example/${'u'.repeat(Math.max(0, len - 20))}`.slice(
          0,
          len,
        ),
      ),
    )
    return { msg: m, detail: `updateUrl(${len}B)` }
  }),
)

// --- UpdateBrokerageContract (49) ------------------------------------------
emit(
  'updateBrokerage',
  49,
  'UpdateBrokerageContract',
  [0, 1, 20, 50, 99, 100].map((pct) => () => {
    const m = new storage.UpdateBrokerageContract()
    m.setOwnerAddress(raddr())
    if (pct) m.setBrokerage(pct)
    return { msg: m, detail: `brokerage=${pct}` }
  }),
)

// --- AssetIssueContract (6) ------------------------------------------------
emit('assetIssue', 6, 'AssetIssueContract', [
  // minimal issuance (the fields every issuance carries)
  () => {
    const m = new asset.AssetIssueContract()
    m.setOwnerAddress(raddr())
    m.setName(ascii('MinToken'))
    m.setAbbr(ascii('MIN'))
    m.setTotalSupply(ramount(9))
    m.setTrxNum(1)
    m.setNum(1)
    m.setStartTime(TIMESTAMP + 3_600_000)
    m.setEndTime(TIMESTAMP + 86_400_000)
    m.setUrl(ascii('https://min.example'))
    return { msg: m, detail: 'minimal' }
  },
  // full-field issuance with 3 frozen tranches
  () => {
    const m = new asset.AssetIssueContract()
    m.setOwnerAddress(raddr())
    m.setName(ascii('FullFeatureToken'))
    m.setAbbr(ascii('FFT'))
    m.setTotalSupply(ramount(15))
    m.setFrozenSupplyList(
      [1, 2, 3].map((k) => {
        const f = new asset.AssetIssueContract.FrozenSupply()
        f.setFrozenAmount(ramount(9))
        f.setFrozenDays(k * 30)
        return f
      }),
    )
    m.setTrxNum(1_000_000)
    m.setPrecision(6)
    m.setNum(1_000)
    m.setStartTime(TIMESTAMP + 3_600_000)
    m.setEndTime(TIMESTAMP + 30 * 86_400_000)
    m.setVoteScore(5)
    m.setDescription(ascii('A token exercising every builder-side field.'))
    m.setUrl(ascii('https://fft.example/token'))
    m.setFreeAssetNetLimit(10_000)
    m.setPublicFreeAssetNetLimit(1_000_000)
    return { msg: m, detail: 'full,frozen=3,precision=6' }
  },
  // single frozen tranche
  () => {
    const m = new asset.AssetIssueContract()
    m.setOwnerAddress(raddr())
    m.setName(ascii('OneFreeze'))
    m.setAbbr(ascii('OFZ'))
    m.setTotalSupply(ramount(12))
    const f = new asset.AssetIssueContract.FrozenSupply()
    f.setFrozenAmount(ramount(6))
    f.setFrozenDays(365)
    m.setFrozenSupplyList([f])
    m.setTrxNum(10)
    m.setNum(1)
    m.setStartTime(TIMESTAMP + 60_000)
    m.setEndTime(TIMESTAMP + 7 * 86_400_000)
    m.setUrl(ascii('https://ofz.example'))
    return { msg: m, detail: 'frozen=1' }
  },
  // precision 0, utf8 description
  () => {
    const m = new asset.AssetIssueContract()
    m.setOwnerAddress(raddr())
    m.setName(ascii('ZeroPrec'))
    m.setAbbr(ascii('ZP'))
    m.setTotalSupply(ramount(7))
    m.setTrxNum(2)
    m.setNum(7)
    m.setStartTime(TIMESTAMP + 120_000)
    m.setEndTime(TIMESTAMP + 2 * 86_400_000)
    m.setDescription(new TextEncoder().encode('零精度代币 — utf8 描述'))
    m.setUrl(ascii('https://zp.example'))
    return { msg: m, detail: 'precision=0,utf8Desc' }
  },
  // max-safe supply boundary
  () => {
    const m = new asset.AssetIssueContract()
    m.setOwnerAddress(raddr())
    m.setName(ascii('MaxSupply'))
    m.setAbbr(ascii('MAX'))
    m.setTotalSupply(9_000_000_000_000_000)
    m.setTrxNum(1)
    m.setNum(1)
    m.setStartTime(TIMESTAMP + 3_600_000)
    m.setEndTime(TIMESTAMP + 86_400_000)
    m.setVoteScore(100)
    m.setUrl(ascii('https://max.example'))
    m.setFreeAssetNetLimit(9_000_000_000_000_000)
    m.setPublicFreeAssetNetLimit(9_000_000_000_000_000)
    return { msg: m, detail: 'supply=9e15' }
  },
  // free-net limits without frozen supply
  () => {
    const m = new asset.AssetIssueContract()
    m.setOwnerAddress(raddr())
    m.setName(ascii('NetLimits'))
    m.setAbbr(ascii('NET'))
    m.setTotalSupply(ramount(10))
    m.setTrxNum(5)
    m.setPrecision(3)
    m.setNum(50)
    m.setStartTime(TIMESTAMP + 600_000)
    m.setEndTime(TIMESTAMP + 14 * 86_400_000)
    m.setDescription(ascii('net-limit variant'))
    m.setUrl(ascii('https://net.example'))
    m.setFreeAssetNetLimit(ramount(6))
    m.setPublicFreeAssetNetLimit(ramount(8))
    return { msg: m, detail: 'netLimits,precision=3' }
  },
])

// --- ParticipateAssetIssueContract (9) -------------------------------------
emit(
  'participateAsset',
  9,
  'ParticipateAssetIssueContract',
  [1, 1_000_000, 9_000_000_000_000_000, 42, 77_777_777, 1_000].map(
    (amount, i) => () => {
      const m = new asset.ParticipateAssetIssueContract()
      m.setOwnerAddress(raddr())
      m.setToAddress(raddr())
      m.setAssetName(ascii(String(1_000_001 + i * 7)))
      m.setAmount(amount)
      return { msg: m, detail: `amt=${amount}` }
    },
  ),
)

// --- UpdateAssetContract (15) ----------------------------------------------
emit('updateAsset', 15, 'UpdateAssetContract', [
  () => {
    const m = new asset.UpdateAssetContract()
    m.setOwnerAddress(raddr())
    m.setDescription(ascii('new description'))
    m.setUrl(ascii('https://updated.example'))
    m.setNewLimit(ramount(6))
    m.setNewPublicLimit(ramount(8))
    return { msg: m, detail: 'allFields' }
  },
  () => {
    const m = new asset.UpdateAssetContract()
    m.setOwnerAddress(raddr())
    m.setDescription(ascii('description only'))
    return { msg: m, detail: 'descOnly' }
  },
  () => {
    const m = new asset.UpdateAssetContract()
    m.setOwnerAddress(raddr())
    m.setUrl(ascii('https://url-only.example'))
    return { msg: m, detail: 'urlOnly' }
  },
  () => {
    const m = new asset.UpdateAssetContract()
    m.setOwnerAddress(raddr())
    m.setNewLimit(1)
    m.setNewPublicLimit(9_000_000_000_000_000)
    return { msg: m, detail: 'limitsOnly' }
  },
  () => {
    const m = new asset.UpdateAssetContract()
    m.setOwnerAddress(raddr())
    m.setDescription(new TextEncoder().encode('更新后的描述'))
    m.setUrl(ascii('https://cn.example/更新'.normalize()))
    m.setNewLimit(ramount(4))
    return { msg: m, detail: 'utf8' }
  },
  () => {
    const m = new asset.UpdateAssetContract()
    m.setOwnerAddress(raddr())
    m.setDescription(rbytes(180))
    m.setUrl(ascii(`https://long.example/${'p'.repeat(120)}`))
    m.setNewPublicLimit(ramount(10))
    return { msg: m, detail: 'longFields' }
  },
])

// --- FreezeBalanceContract (11, Stake 1.0) ---------------------------------
emit(
  'freezeBalance',
  11,
  'FreezeBalanceContract',
  [
    { resource: 0, receiver: false },
    { resource: 1, receiver: false },
    { resource: 0, receiver: true },
    { resource: 1, receiver: true },
    { resource: 0, receiver: false },
    { resource: 1, receiver: true },
    { resource: 0, receiver: true },
    { resource: 1, receiver: false },
  ].map(({ resource, receiver }) => () => {
    const m = new balance.FreezeBalanceContract()
    m.setOwnerAddress(raddr())
    m.setFrozenBalance(ramount(12))
    m.setFrozenDuration(3)
    if (resource) m.setResource(resource)
    if (receiver) m.setReceiverAddress(raddr())
    return {
      msg: m,
      detail: `res=${resource ? 'ENERGY' : 'BANDWIDTH'}${receiver ? ',receiver' : ''}`,
    }
  }),
)

// --- UnfreezeBalanceContract (12, Stake 1.0) -------------------------------
emit(
  'unfreezeBalance',
  12,
  'UnfreezeBalanceContract',
  [
    { resource: 0, receiver: false },
    { resource: 1, receiver: false },
    { resource: 0, receiver: true },
    { resource: 1, receiver: true },
    { resource: 2, receiver: false },
    { resource: 1, receiver: false },
  ].map(({ resource, receiver }) => () => {
    const m = new balance.UnfreezeBalanceContract()
    m.setOwnerAddress(raddr())
    if (resource) m.setResource(resource)
    if (receiver) m.setReceiverAddress(raddr())
    return {
      msg: m,
      detail: `res=${['BANDWIDTH', 'ENERGY', 'TRON_POWER'][resource]}${receiver ? ',receiver' : ''}`,
    }
  }),
)

// --- ProposalCreateContract (16) — map<int64,int64> ------------------------
emit(
  'proposalCreate',
  16,
  'ProposalCreateContract',
  [
    { params: [], detail: 'emptyMap' },
    { params: [[0, 1]], detail: 'key0' },
    { params: [[1, 1_000_000]], detail: 'single' },
    // insertion 2,10,9 → canonical wire order is STRING-sorted: 10,2,9
    {
      params: [
        [2, 55],
        [10, 77],
        [9, 66],
      ],
      detail: 'stringSortKeys(2,10,9)',
    },
    { params: [[70, 0]], detail: 'zeroValue' },
    {
      params: [
        [1, 9_000_000_000_000_000],
        [26, 1],
        [47, 10_000_000_000],
      ],
      detail: 'bigValues',
    },
    {
      params: [
        [3, 27],
        [11, 1],
        [24, 1],
        [31, 160],
        [44, 100],
        [59, 1_000_000],
      ],
      detail: 'sixEntries',
    },
    {
      params: [
        [100, 5],
        [20, 6],
        [9, 7],
      ],
      detail: 'stringSortKeys(100,20,9)',
    },
  ].map(({ params, detail }) => () => {
    const m = new proposal.ProposalCreateContract()
    m.setOwnerAddress(raddr())
    const map = m.getParametersMap()
    for (const [k, v] of params) map.set(k, v)
    return { msg: m, detail }
  }),
)

// --- ProposalApproveContract (17) ------------------------------------------
emit(
  'proposalApprove',
  17,
  'ProposalApproveContract',
  [
    { id: 1, add: true },
    { id: 42, add: false },
    { id: 0, add: true },
    { id: 9_000_000_000_000_000, add: true },
    { id: 77, add: false },
    { id: 12_345, add: true },
  ].map(({ id, add }) => () => {
    const m = new proposal.ProposalApproveContract()
    m.setOwnerAddress(raddr())
    if (id) m.setProposalId(id)
    if (add) m.setIsAddApproval(true)
    return { msg: m, detail: `id=${id},add=${add}` }
  }),
)

// --- ProposalDeleteContract (18) -------------------------------------------
emit(
  'proposalDelete',
  18,
  'ProposalDeleteContract',
  [1, 0, 88, 4_096, 9_000_000_000_000_000, 655_360].map((id) => () => {
    const m = new proposal.ProposalDeleteContract()
    m.setOwnerAddress(raddr())
    if (id) m.setProposalId(id)
    return { msg: m, detail: `id=${id}` }
  }),
)

// --- ExchangeCreateContract (41) -------------------------------------------
emit(
  'exchangeCreate',
  41,
  'ExchangeCreateContract',
  [
    ['_', '1000018'],
    ['1000001', '1000002'],
    ['_', '1000524'],
    ['1004031', '_'],
    ['1000018', '1004095'],
    ['_', '1000001'],
  ].map(([first, second]) => () => {
    const m = new exchange.ExchangeCreateContract()
    m.setOwnerAddress(raddr())
    m.setFirstTokenId(ascii(first))
    m.setFirstTokenBalance(ramount(13))
    m.setSecondTokenId(ascii(second))
    m.setSecondTokenBalance(ramount(13))
    return { msg: m, detail: `${first}/${second}` }
  }),
)

// --- ExchangeInjectContract (42) -------------------------------------------
emit(
  'exchangeInject',
  42,
  'ExchangeInjectContract',
  ['_', '1000018', '1000001', '_', '1002000', '1000524'].map(
    (token, i) => () => {
      const m = new exchange.ExchangeInjectContract()
      m.setOwnerAddress(raddr())
      m.setExchangeId(1 + i * 7)
      m.setTokenId(ascii(token))
      m.setQuant(ramount(12))
      return { msg: m, detail: `ex=${1 + i * 7},token=${token}` }
    },
  ),
)

// --- ExchangeWithdrawContract (43) -----------------------------------------
emit(
  'exchangeWithdraw',
  43,
  'ExchangeWithdrawContract',
  ['1000018', '_', '1000001', '1004095', '_', '1000002'].map(
    (token, i) => () => {
      const m = new exchange.ExchangeWithdrawContract()
      m.setOwnerAddress(raddr())
      m.setExchangeId(2 + i * 11)
      m.setTokenId(ascii(token))
      m.setQuant(ramount(11))
      return { msg: m, detail: `ex=${2 + i * 11},token=${token}` }
    },
  ),
)

// --- ExchangeTransactionContract (44) --------------------------------------
emit(
  'exchangeTransaction',
  44,
  'ExchangeTransactionContract',
  ['_', '1000018', '1000001', '_', '1000524', '1002000'].map(
    (token, i) => () => {
      const m = new exchange.ExchangeTransactionContract()
      m.setOwnerAddress(raddr())
      m.setExchangeId(3 + i * 5)
      m.setTokenId(ascii(token))
      m.setQuant(ramount(10))
      m.setExpected(ramount(9))
      return { msg: m, detail: `ex=${3 + i * 5},token=${token}` }
    },
  ),
)

// --- UpdateSettingContract (33) --------------------------------------------
emit(
  'updateSetting',
  33,
  'UpdateSettingContract',
  [0, 1, 25, 50, 99, 100].map((pct) => () => {
    const m = new smart.UpdateSettingContract()
    m.setOwnerAddress(raddr())
    m.setContractAddress(raddr())
    if (pct) m.setConsumeUserResourcePercent(pct)
    return { msg: m, detail: `percent=${pct}` }
  }),
)

// --- UpdateEnergyLimitContract (45) ----------------------------------------
emit(
  'updateEnergyLimit',
  45,
  'UpdateEnergyLimitContract',
  [1, 10_000_000, 10_000_000_000, 1_000, 9_000_000_000_000_000, 500].map(
    (limit) => () => {
      const m = new smart.UpdateEnergyLimitContract()
      m.setOwnerAddress(raddr())
      m.setContractAddress(raddr())
      m.setOriginEnergyLimit(limit)
      return { msg: m, detail: `limit=${limit}` }
    },
  ),
)

// --- ClearABIContract (48) -------------------------------------------------
emit(
  'clearAbi',
  48,
  'ClearABIContract',
  Array.from({ length: 6 }, () => () => {
    const m = new smart.ClearABIContract()
    m.setOwnerAddress(raddr())
    m.setContractAddress(raddr())
    return { msg: m, detail: 'ownerAndContract' }
  }),
)

// ---------------------------------------------------------------------------
process.stdout.write(`${JSON.stringify(cases, null, 2)}\n`)
