import { expect, test } from 'vitest'
import { writeContract } from '../../../src/actions/wallet/writeContract.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { defaultFeeLimit } from '../../../src/constants/transaction.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const

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

const contract = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address
// The gold vectors encode transfer(410123456789…, 1000000) which resolves to
// the same Base58 address as the contract here.
const recipient = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address

// trigger-smart-contract[0] "with fee_limit" + sig/transaction "…with fee_limit".
const FEE_LIMIT = 100000000n
const TX_ID_FEELIMIT =
  '3efcd4d8554ed772ee4310511611b348a3a8f79fe3fab6b839a383b8525bff16'
const RAW_FEELIMIT =
  '0a0212342208010203040506070840e0a499ffbc315aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a15417e5f4552091a69125d5dfcb7b8c2659029395bdf1215410123456789abcdef0123456789abcdef012345672244a9059cbb0000000000000000000000000123456789abcdef0123456789abcdef0123456700000000000000000000000000000000000000000000000000000000000f42407080d095ffbc31900180c2d72f'
const SIG_FEELIMIT =
  '896177051d2d91e1e2486cf62a42073a3afde0899a9b595eac1401c2d0e5a2e929c6940cf8d04e68301c04d8daf8d0c09f009d8917156d6627bce1627b0a3f271b'

// trigger-smart-contract[2] "with call_value" + sig/transaction "…with call_value".
const TX_ID_CALLVALUE =
  '02291b032452a50f3be211053efeb26e02cfc14baf9dcad58bc201d5a2aab78f'
const RAW_CALLVALUE =
  '0a0212342208010203040506070840e0a499ffbc315ab201081f12ad010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412780a15417e5f4552091a69125d5dfcb7b8c2659029395bdf1215410123456789abcdef0123456789abcdef0123456718c0843d2244a9059cbb0000000000000000000000000123456789abcdef0123456789abcdef0123456700000000000000000000000000000000000000000000000000000000000f42407080d095ffbc31900180c2d72f'
const SIG_CALLVALUE =
  'e4722832b4ea185f2f119ad08a1ec9a533c47d460d871cf8a3320de97fd3d17235195aa0e50b2bcb4713178a7f1479cc822f8ce0d183927525f36997774108611c'

// trigger-smart-contract[3] "with call_token_value + token_id" + sig/transaction
// "…with call_token_value + token_id".
const TX_ID_TOKEN =
  '55e2d00be74b4fe3121fd231ec1f0f0d6500379382ea7ff93d3c187cf5653d04'
const RAW_TOKEN =
  '0a0212342208010203040506070840e0a499ffbc315ab401081f12af010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e7472616374127a0a15417e5f4552091a69125d5dfcb7b8c2659029395bdf1215410123456789abcdef0123456789abcdef012345672244a9059cbb0000000000000000000000000123456789abcdef0123456789abcdef0123456700000000000000000000000000000000000000000000000000000000000f424028053090943d7080d095ffbc31900180c2d72f'
const SIG_TOKEN =
  '8209221db0138836b05029463dc945dbe78de43621aadd4731d3ced1d18f6488362cca89a150dcc21df7390a843c9d34fe04a8dad3b8276eaff495ce786171f81b'

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds, signs and broadcasts a TRC20 transfer byte-for-byte (feeLimit)', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await client.writeContract({
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
  })

  expect(txID).toBe(TX_ID_FEELIMIT)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data: { fee_limit?: number }
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(TX_ID_FEELIMIT)
  expect(body.raw_data_hex).toBe(RAW_FEELIMIT)
  expect(body.signature).toEqual([SIG_FEELIMIT])
  expect(body.raw_data.fee_limit).toBe(Number(FEE_LIMIT))
})

test('attaches callValue to the TriggerSmartContract byte-for-byte', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await client.writeContract({
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
    callValue: 1000000n,
  })

  expect(txID).toBe(TX_ID_CALLVALUE)
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
    signature: string[]
  }
  expect(body.raw_data_hex).toBe(RAW_CALLVALUE)
  expect(body.signature).toEqual([SIG_CALLVALUE])
})

test('attaches callTokenValue + tokenId to the TriggerSmartContract byte-for-byte', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await client.writeContract({
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
    callTokenValue: 5n,
    tokenId: 1002000n,
  })

  expect(txID).toBe(TX_ID_TOKEN)
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
    signature: string[]
  }
  expect(body.raw_data_hex).toBe(RAW_TOKEN)
  expect(body.signature).toEqual([SIG_TOKEN])
})

test('defaults feeLimit to defaultFeeLimit when omitted', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  await client.writeContract({
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
  })

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data: { fee_limit?: number }
  }
  expect(body.raw_data.fee_limit).toBe(Number(defaultFeeLimit))
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    writeContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [recipient, 1000000n],
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
