// Byte-level differential ("fuzz") harness proving the v0.1b write pipeline
// (sendTrx / writeContract → local build → sign → broadcast) produces bytes
// that are BIT-IDENTICAL to the v0.1a gold vectors, with zero drift across the
// two layers.
//
// Unlike sendTrx.test.ts / writeContract.test.ts, the expected `raw_data_hex`,
// `txID` and `signature` are NOT hard-coded here: they are loaded straight from
// the v0.1a gold fixtures (`test/fixtures/tx/*.json` + `test/fixtures/sig/
// transaction.json`). Each case drives the real write action against the fixed
// reference block (whose own timestamp drives timing), then asserts the broadcast body the
// action assembled equals the gold vector byte-for-byte and the appended
// signature equals the pk=1 gold signature (looked up by txID). A drift in any
// underlying primitive (serialize / getTransactionId / sign / fillBlockHeader)
// would break these assertions.
import { expect, test } from 'vitest'
import { privateKeyToAccount } from '../../../src/accounts/privateKeyToAccount.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadSigTransactionFixtures } from '../../fixtures/sig/loader.js'
import { loadTxFixtureFile, type TxFixture } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'

// pk = 1 (the only permitted trivial key besides pk=2). Its canonical address
// is TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (41-hex 417e5f45…395bdf), which is the
// `owner_address` of every reproducible gold vector below.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk1Account = privateKeyToAccount(pk1)

// The single reference block used by every gold vector. Timing is derived from
// the block's own timestamp (no injected clock).
// getnowblock.fixed pins block 4660 / a blockID whose bytes 8..16 are
// 0102030405060708 → ref_block_bytes=1234, ref_block_hash=0102030405060708,
// and its timestamp=1700000000000 → expiration=1700000060000, all matching the fixtures.

// TRC20 `transfer(address,uint256)` — matches the calldata pinned in the
// trigger-smart-contract gold vectors (selector a9059cbb).
const trc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Contract + recipient resolve to the same Base58 the gold data encodes
// (410123456789…01234567 → its 20-byte body 0123456789…01234567 inside the
// calldata).
const trc20Contract = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address
const trc20Recipient = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address

const transferCases = loadTxFixtureFile('transfer-contract.json')
const triggerCases = loadTxFixtureFile('trigger-smart-contract.json')

// txID → pk=1 gold signature (r||s||v, bare hex).
const sigByTxId = new Map(
  loadSigTransactionFixtures().map((s) => [s.txID, s.signature] as const),
)

/** The mock the write pipeline needs: fixed block + a broadcast ack. */
function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

type BroadcastBody = {
  txID: string
  raw_data: { fee_limit?: number; data?: string }
  raw_data_hex: string
  signature: string[]
}

// Sanity anchor: pk=1's derived address is the owner of the gold vectors, so
// the sign owner-guard (guard 3) is exercised on the happy path, not skipped.
test('pk=1 is the owner_address of the reproduced gold vectors', () => {
  expect(pk1Account.address).toBe('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')
})

test('sendTrx reproduces the canonical TransferContract gold vector byte-for-byte', async () => {
  // §2.3 canonical reference vector (transfer-contract[0]).
  const gold = transferCases[0]
  if (!gold) throw new Error('missing transfer-contract fixture')
  const goldSig = sigByTxId.get(gold.txID)
  expect(goldSig).toBeDefined()

  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  // to = TPL66VK2… (41-hex 41928c9af0…4d21) / amount 1_000_000 SUN, per params.
  const { txID } = await client.sendTrx({
    to: 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY' as Address,
    amount: 1000000n,
  })

  // Returned id is the LOCAL txID and equals the gold vector.
  expect(txID).toBe(gold.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as BroadcastBody
  // Zero-drift: locally built bytes === v0.1a tx gold; sig === v0.1a sig gold.
  expect(body.raw_data_hex).toBe(gold.rawDataHex)
  expect(body.txID).toBe(gold.txID)
  expect(body.signature).toEqual([goldSig])
})

// Every trigger gold vector the local writeContract can reproduce: writeContract
// always writes a feeLimit, so only the "without fee_limit" vector is not
// reproducible. Params are declared per case; the OUTPUT is asserted against
// the loaded fixture.
const writeContractCases = [
  {
    fixtureName: 'trigger TRC20 transfer with fee_limit',
    feeLimit: 100000000n,
    callValue: undefined as bigint | undefined,
    callTokenValue: undefined as bigint | undefined,
    tokenId: undefined as bigint | undefined,
  },
  {
    fixtureName: 'trigger TRC20 transfer with call_value',
    feeLimit: 100000000n,
    callValue: 1000000n,
    callTokenValue: undefined as bigint | undefined,
    tokenId: undefined as bigint | undefined,
  },
  {
    fixtureName: 'trigger TRC20 transfer with call_token_value + token_id',
    feeLimit: 100000000n,
    callValue: undefined as bigint | undefined,
    callTokenValue: 5n as bigint | undefined,
    tokenId: 1002000n as bigint | undefined,
  },
] as const

test.each(
  writeContractCases,
)('writeContract reproduces "$fixtureName" byte-for-byte', async ({
  fixtureName,
  feeLimit,
  callValue,
  callTokenValue,
  tokenId,
}) => {
  const gold = triggerCases.find((c) => c.name === fixtureName)
  if (!gold) throw new Error(`missing trigger fixture: ${fixtureName}`)
  const goldSig = sigByTxId.get(gold.txID)
  expect(goldSig).toBeDefined()

  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await client.writeContract({
    address: trc20Contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [trc20Recipient, 1000000n],
    feeLimit,
    ...(callValue !== undefined ? { callValue } : {}),
    ...(callTokenValue !== undefined ? { callTokenValue } : {}),
    ...(tokenId !== undefined ? { tokenId } : {}),
  })

  expect(txID).toBe(gold.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as BroadcastBody
  // Zero-drift across the writeContract build path: calldata + feeLimit (in
  // the signed hash) + TaPoS + txID + signature all match the v0.1a gold.
  expect(body.raw_data_hex).toBe(gold.rawDataHex)
  expect(body.txID).toBe(gold.txID)
  expect(body.signature).toEqual([goldSig])
  expect(body.raw_data.fee_limit).toBe(Number(feeLimit))
})

// ---------------------------------------------------------------------------
// v0.1b-② native staking / resource / governance / TRC10 write actions.
//
// Each of the nine actions (freeze / unfreeze / cancelAll / withdrawExpire /
// delegate / undelegate / vote / withdraw / sendTrc10) builds the SAME shape of
// transaction as sendTrx — only the wrapped contract differs — through the
// shared buildAndBroadcast pipeline. Every reproducible gold vector's
// `owner_address` is pk=1, so for each we assert the locally built
// raw_data_hex / txID AND the appended pk=1 signature equal the v0.1a gold
// byte-for-byte: proof the v0.1b write actions have zero drift from the Track D
// codecs / signer they sit on top of.
// ---------------------------------------------------------------------------

// Non-owner addresses the gold vectors encode (41-hex bodies verified against
// the fixtures): receiver 412b5ad5…d6cf, witness2 41a614f8…d13c.
const receiver = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address
const witness2 = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address

const freezeCases = loadTxFixtureFile('freeze-balance-v2-contract.json')
const unfreezeCases = loadTxFixtureFile('unfreeze-balance-v2-contract.json')
const cancelAllCases = loadTxFixtureFile('cancel-all-unfreeze-v2-contract.json')
const withdrawExpireCases = loadTxFixtureFile(
  'withdraw-expire-unfreeze-contract.json',
)
const delegateCases = loadTxFixtureFile('delegate-resource-contract.json')
const undelegateCases = loadTxFixtureFile('un-delegate-resource-contract.json')
const voteCases = loadTxFixtureFile('vote-witness-contract.json')
const withdrawBalanceCases = loadTxFixtureFile('withdraw-balance-contract.json')
const transferAssetCases = loadTxFixtureFile('transfer-asset-contract.json')

/** Resolves a fixture case by its `name`, failing loudly if renamed/removed. */
function goldByName(cases: TxFixture[], name: string): TxFixture {
  const gold = cases.find((c) => c.name === name)
  if (!gold) throw new Error(`missing fixture case: ${name}`)
  return gold
}

/** A pk=1 wallet client over the fixed-block / broadcast-ack mock. */
function makeClient(transport: ReturnType<typeof writeMock>['transport']) {
  return createWalletClient({ account: pk1, transport })
}
type WriteClient = ReturnType<typeof makeClient>

/**
 * Drives one write action against a fresh mock and asserts the broadcast body
 * (bytes + txID + pk=1 signature) equals the loaded gold vector byte-for-byte,
 * and that the pipeline hit exactly getnowblock → broadcasthex.
 */
async function driveAndAssertGold(
  gold: TxFixture,
  invoke: (client: WriteClient) => Promise<{ txID: string }>,
) {
  const goldSig = sigByTxId.get(gold.txID)
  expect(goldSig, `sig fixture for "${gold.name}"`).toBeDefined()

  const { transport, calls, bodyOf } = writeMock()
  const client = makeClient(transport)

  const { txID } = await invoke(client)

  // Returned id is the LOCAL txID and equals the gold vector.
  expect(txID).toBe(gold.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as BroadcastBody
  // Zero-drift: locally built bytes === v0.1a tx gold; sig === v0.1a sig gold.
  expect(body.raw_data_hex).toBe(gold.rawDataHex)
  expect(body.txID).toBe(gold.txID)
  expect(body.signature).toEqual([goldSig])
}

// One row per reproducible native-action gold vector. `invoke` declares the
// action's PARAMS; `gold` is the vector its output must reproduce. All nine
// v0.1b-② actions are exercised (freeze/unfreeze/delegate each carry two rows).
const nativeCases: {
  label: string
  gold: TxFixture
  invoke: (client: WriteClient) => Promise<{ txID: string }>
}[] = [
  {
    label: 'freezeBalanceV2 BANDWIDTH',
    gold: goldByName(freezeCases, 'freeze v2 BANDWIDTH'),
    invoke: (c) =>
      c.freezeBalanceV2({
        frozenBalance: 1000000n,
        resource: 'BANDWIDTH',
      }),
  },
  {
    label: 'freezeBalanceV2 ENERGY',
    gold: goldByName(freezeCases, 'freeze v2 ENERGY'),
    invoke: (c) =>
      c.freezeBalanceV2({ frozenBalance: 2000000n, resource: 'ENERGY' }),
  },
  {
    label: 'unfreezeBalanceV2 BANDWIDTH',
    gold: goldByName(unfreezeCases, 'unfreeze v2 BANDWIDTH'),
    invoke: (c) =>
      c.unfreezeBalanceV2({
        unfreezeBalance: 500000n,
        resource: 'BANDWIDTH',
      }),
  },
  {
    label: 'unfreezeBalanceV2 ENERGY',
    gold: goldByName(unfreezeCases, 'unfreeze v2 ENERGY'),
    invoke: (c) =>
      c.unfreezeBalanceV2({
        unfreezeBalance: 250000n,
        resource: 'ENERGY',
      }),
  },
  {
    label: 'cancelAllUnfreezeV2',
    gold: goldByName(cancelAllCases, 'cancel all unfreeze v2'),
    invoke: (c) => c.cancelAllUnfreezeV2({}),
  },
  {
    label: 'withdrawExpireUnfreeze',
    gold: goldByName(withdrawExpireCases, 'withdraw expired unfrozen balance'),
    invoke: (c) => c.withdrawExpireUnfreeze({}),
  },
  {
    label: 'delegateResource BANDWIDTH lock=false',
    gold: goldByName(delegateCases, 'delegate BANDWIDTH lock=false'),
    invoke: (c) =>
      c.delegateResource({
        receiverAddress: receiver,
        balance: 1000000n,
        resource: 'BANDWIDTH',
        lock: false,
      }),
  },
  {
    label: 'delegateResource ENERGY lock=true lock_period=86400',
    gold: goldByName(
      delegateCases,
      'delegate ENERGY lock=true lock_period=86400',
    ),
    invoke: (c) =>
      c.delegateResource({
        receiverAddress: receiver,
        balance: 2000000n,
        resource: 'ENERGY',
        lock: true,
        lockPeriod: 86400n,
      }),
  },
  {
    label: 'undelegateResource ENERGY',
    gold: goldByName(undelegateCases, 'undelegate ENERGY'),
    invoke: (c) =>
      c.undelegateResource({
        receiverAddress: receiver,
        balance: 1000000n,
        resource: 'ENERGY',
      }),
  },
  {
    label: 'voteWitness (two witnesses)',
    gold: goldByName(voteCases, 'vote for two witnesses'),
    invoke: (c) =>
      c.voteWitness({
        votes: [
          { voteAddress: receiver, voteCount: 5n },
          { voteAddress: witness2, voteCount: 10n },
        ],
      }),
  },
  {
    label: 'withdrawBalance',
    gold: goldByName(withdrawBalanceCases, 'withdraw block rewards'),
    invoke: (c) => c.withdrawBalance({}),
  },
  {
    label: 'sendTrc10 (asset_name UTF-8 id)',
    gold: goldByName(
      transferAssetCases,
      'transfer-asset visible=true (asset_name UTF-8, Base58 addresses)',
    ),
    invoke: (c) =>
      c.sendTrc10({ to: receiver, assetName: '1002000', amount: 1000n }),
  },
]

test.each(
  nativeCases,
)('$label reproduces its gold vector byte-for-byte (bytes + txID + pk=1 sig)', async ({
  gold,
  invoke,
}) => {
  await driveAndAssertGold(gold, invoke)
})

// Cross-check the flex asset_name path: passing the 0x-hex form of "1002000"
// must normalize to the IDENTICAL wire bytes as the UTF-8 id form above.
test('sendTrc10 asset_name flex: 0x-hex form equals the UTF-8-id gold vector', async () => {
  const gold = goldByName(
    transferAssetCases,
    'transfer-asset visible=false (asset_name ASCII-hex)',
  )
  await driveAndAssertGold(gold, (c) =>
    // 0x31303032303030 === utf8("1002000"); both encode the same asset_name.
    c.sendTrc10({
      to: receiver,
      assetName: '0x31303032303030',
      amount: 1000n,
    }),
  )
})
