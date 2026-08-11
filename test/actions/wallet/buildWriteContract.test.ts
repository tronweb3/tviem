import { expect, test } from 'vitest'
import { buildWriteContract } from '../../../src/actions/wallet/writeContract.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

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

// Same canonical "with fee_limit" gold vectors as writeContract — the build half
// must produce the identical bytes / id (it is exactly what writeContract signs).
const FEE_LIMIT = 100000000n
const TX_ID_FEELIMIT =
  '3efcd4d8554ed772ee4310511611b348a3a8f79fe3fab6b839a383b8525bff16'
const RAW_FEELIMIT =
  '0a0212342208010203040506070840e0a499ffbc315aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a15417e5f4552091a69125d5dfcb7b8c2659029395bdf1215410123456789abcdef0123456789abcdef012345672244a9059cbb0000000000000000000000000123456789abcdef0123456789abcdef0123456700000000000000000000000000000000000000000000000000000000000f42407080d095ffbc31900180c2d72f'

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical TRC20 transfer in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWriteContract(client, {
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
  })

  // Byte-identical to what writeContract builds and signs.
  expect(tx.txID).toBe(TX_ID_FEELIMIT)
  expect(tx.raw_data_hex).toBe(RAW_FEELIMIT)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWriteContract(client, {
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: 1700000000000n,
      expiration: 1700000000000n + 60000n,
    },
  })

  expect(tx.txID).toBe(TX_ID_FEELIMIT)
  expect(tx.raw_data_hex).toBe(RAW_FEELIMIT)
  expect(calls).toEqual([])
})

test('raw_data.contract[0] is a node-JSON TriggerSmartContract', async () => {
  const { transport } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWriteContract(client, {
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
  })
  const entry = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string }
  }

  expect(entry.type).toBe('TriggerSmartContract')
  expect(entry.parameter.type_url).toBe(
    'type.googleapis.com/protocol.TriggerSmartContract',
  )
})

test('carries callTokenValue + tokenId into raw_data byte-for-byte', async () => {
  const { transport } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWriteContract(client, {
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
    callTokenValue: 5n,
    tokenId: 1002000n,
  })

  // Same gold vector writeContract signs (trigger-smart-contract[3]).
  expect(tx.txID).toBe(
    '55e2d00be74b4fe3121fd231ec1f0f0d6500379382ea7ff93d3c187cf5653d04',
  )
  const entry = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    parameter: { value: { call_token_value?: number; token_id?: number } }
  }
  // Canonical node-JSON shape after the encode∘decode roundtrip.
  expect(entry.parameter.value.call_token_value).toBe(5)
  expect(entry.parameter.value.token_id).toBe(1002000)
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWriteContract(client, {
    address: contract,
    abi: trc20Abi,
    functionName: 'transfer',
    args: [recipient, 1000000n],
    feeLimit: FEE_LIMIT,
    permissionId: 2,
  })
  const entry = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(entry.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(TX_ID_FEELIMIT)
  expect(tx.raw_data_hex).not.toBe(RAW_FEELIMIT)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    buildWriteContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [recipient, 1000000n],
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
