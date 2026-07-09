// Byte-level differential ("fuzz") harness proving the v0.1b write pipeline
// (sendTrx / writeContract → local build → sign → broadcast) produces bytes
// that are BIT-IDENTICAL to the v0.1a gold vectors, with zero drift across the
// two layers.
//
// Unlike sendTrx.test.ts / writeContract.test.ts, the expected `raw_data_hex`,
// `txID` and `signature` are NOT hard-coded here: they are loaded straight from
// the v0.1a gold fixtures (`test/fixtures/tx/*.json` + `test/fixtures/sig/
// transaction.json`). Each case drives the real write action with a fixed
// clock and the fixed reference block, then asserts the broadcast body the
// action assembled equals the gold vector byte-for-byte and the appended
// signature equals the pk=1 gold signature (looked up by txID). A drift in any
// underlying primitive (serialize / getTransactionId / sign / fillBlockHeader)
// would break these assertions.
import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { loadSigTransactionFixtures } from '../../../test/fixtures/sig/loader.js'
import { loadTxFixtureFile } from '../../../test/fixtures/tx/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import type { Address } from '../../types/address.js'

// pk = 1 (the only permitted trivial key besides pk=2). Its canonical address
// is TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (41-hex 417e5f45…395bdf), which is the
// `owner_address` of every reproducible gold vector below.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk1Account = privateKeyToAccount(pk1)

// The single wall-clock value + reference block used by every gold vector.
// getnowblock.fixed pins block 4660 / a blockID whose bytes 8..16 are
// 0102030405060708 → ref_block_bytes=1234, ref_block_hash=0102030405060708,
// and now=1700000000000 → expiration=1700000060000, all matching the fixtures.
const now = 1700000000000n

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
// (41a614f803…ded13c → its 20-byte body a614f803…ded13c inside the calldata).
const trc20Contract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address
const trc20Recipient = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address

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
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

type BroadcastBody = {
  txID: string
  raw_data: { feeLimit?: bigint; data?: string }
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
    now,
  })

  // Returned id is the LOCAL txID and equals the gold vector.
  expect(txID).toBe(gold.txID)
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])

  const body = bodyOf('broadcasttransaction') as BroadcastBody
  // Zero-drift: locally built bytes === v0.1a tx gold; sig === v0.1a sig gold.
  expect(body.raw_data_hex).toBe(gold.rawDataHex)
  expect(body.txID).toBe(gold.txID)
  expect(body.signature).toEqual([goldSig])
})

// Every trigger gold vector the local writeContract can reproduce: those whose
// only extra fields are feeLimit / call_value (writeContract does not model
// token_id / call_token_value, and always writes a feeLimit so the
// "without fee_limit" vector is not reproducible). Params are declared per
// case; the OUTPUT is asserted against the loaded fixture.
const writeContractCases = [
  {
    fixtureName: 'trigger TRC20 transfer with fee_limit',
    feeLimit: 100000000n,
    callValue: undefined as bigint | undefined,
  },
  {
    fixtureName: 'trigger TRC20 transfer with call_value',
    feeLimit: 100000000n,
    callValue: 1000000n,
  },
] as const

test.each(
  writeContractCases,
)('writeContract reproduces "$fixtureName" byte-for-byte', async ({
  fixtureName,
  feeLimit,
  callValue,
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
    now,
  })

  expect(txID).toBe(gold.txID)
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])

  const body = bodyOf('broadcasttransaction') as BroadcastBody
  // Zero-drift across the writeContract build path: calldata + feeLimit (in
  // the signed hash) + TaPoS + txID + signature all match the v0.1a gold.
  expect(body.raw_data_hex).toBe(gold.rawDataHex)
  expect(body.txID).toBe(gold.txID)
  expect(body.signature).toEqual([goldSig])
  expect(body.raw_data.feeLimit).toBe(feeLimit)
})
