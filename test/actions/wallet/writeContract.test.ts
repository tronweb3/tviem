import { expect, test } from 'vitest'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { defaultFeeLimit } from '../../../src/constants/address.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { writeContract } from '../../../src/actions/wallet/writeContract.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const
const now = 1700000000000n

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

const contract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address
// The gold vectors encode transfer(41a614f803…, 1000000) which resolves to the
// same Base58 address as the contract here.
const recipient = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address

// trigger-smart-contract[0] "with fee_limit" + sig/transaction "…with fee_limit".
const FEE_LIMIT = 100000000n
const TX_ID_FEELIMIT =
  'ddd5febbb5ef788933fc151fc1cf89246a35d89cc6607141c4ebf54499a3a5e6'
const RAW_FEELIMIT =
  '0a0212342208010203040506070840e0a499ffbc315aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541a614f803b6fd780986a42c78ec9c7f77e6ded13c2244a9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f42407080d095ffbc31900180c2d72f'
const SIG_FEELIMIT =
  'a3d238b761eeca2cf73b7378a187bac8466141096bcae7b5a9f21eca35977ff626c39f79edadf8d25f55f3301cfd9f07f17becf5683bbe64fdebee2eef27a38c1c'

// trigger-smart-contract[2] "with call_value" + sig/transaction "…with call_value".
const TX_ID_CALLVALUE =
  '6dfae8ce7bc8165531da925bfb159506f22a8df1b0d9f536e747b21e20943a7c'
const RAW_CALLVALUE =
  '0a0212342208010203040506070840e0a499ffbc315ab201081f12ad010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412780a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541a614f803b6fd780986a42c78ec9c7f77e6ded13c18c0843d2244a9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f42407080d095ffbc31900180c2d72f'
const SIG_CALLVALUE =
  'ef7213f81ace06f18e43ae1b0fbd3cbf433d58d507cc773144c14209f92682692e37df2ad9c19c65bfd883005605d8a2bcbfee8bbd83b1adc897b342e043f3481c'

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
    now,
  })

  expect(txID).toBe(TX_ID_FEELIMIT)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data: { feeLimit?: bigint }
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(TX_ID_FEELIMIT)
  expect(body.raw_data_hex).toBe(RAW_FEELIMIT)
  expect(body.signature).toEqual([SIG_FEELIMIT])
  expect(body.raw_data.feeLimit).toBe(FEE_LIMIT)
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
    now,
  })

  expect(txID).toBe(TX_ID_CALLVALUE)
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
    signature: string[]
  }
  expect(body.raw_data_hex).toBe(RAW_CALLVALUE)
  expect(body.signature).toEqual([SIG_CALLVALUE])
})

test('defaults feeLimit to defaultFeeLimit when omitted', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  await client.writeContract({
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    now,
  })

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data: { feeLimit?: bigint }
  }
  expect(body.raw_data.feeLimit).toBe(defaultFeeLimit)
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
      now,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
