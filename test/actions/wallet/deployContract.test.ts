import type { Abi } from 'abitype'
import { expect, test } from 'vitest'
import { rpc } from '../../fixtures/rpc/loader.js'
import {
  loadTxFixtureFile,
  type TxFixture,
} from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Hex } from '../../../src/types/misc.js'
import { toHex } from '../../../src/utils/address/toHex.js'
import { deployContract } from '../../../src/actions/wallet/deployContract.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const now = 1700000000000n

const [basic, withToken] = loadTxFixtureFile('create-smart-contract.json')

type DeployValue = {
  abi: Abi
  bytecode: string
  name: string
  consume_user_resource_percent: string
  origin_energy_limit: string
  call_token_value?: string
  token_id?: string
}

function deployValueOf(fixture: TxFixture): DeployValue {
  return (fixture.params as { value: DeployValue }).value
}

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('deploys byte-for-byte against the gold vector + backfills the address', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })
  const value = deployValueOf(basic!)

  const { txID, contractAddress } = await deployContract(client, {
    abi: value.abi,
    bytecode: `0x${value.bytecode}` as Hex,
    name: value.name,
    consumeUserResourcePercent: BigInt(value.consume_user_resource_percent),
    originEnergyLimit: BigInt(value.origin_energy_limit),
    feeLimit: 1000000000n,
    now,
  })

  expect(txID).toBe(basic?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.raw_data_hex).toBe(basic?.rawDataHex)
  expect(body.txID).toBe(basic?.txID)
  expect(body.signature).toHaveLength(1)

  // The deployed address is derived deterministically from txID + owner and
  // returned as Base58Check; converting it back to TRON hex matches the pin.
  expect(toHex(contractAddress)).toBe(basic?.contractAddress)
})

test('carries call_token_value + token_id byte-for-byte', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })
  const value = deployValueOf(withToken!)

  const { txID, contractAddress } = await deployContract(client, {
    abi: value.abi,
    bytecode: `0x${value.bytecode}` as Hex,
    name: value.name,
    consumeUserResourcePercent: BigInt(value.consume_user_resource_percent),
    originEnergyLimit: BigInt(value.origin_energy_limit),
    callTokenValue: BigInt(value.call_token_value ?? '0'),
    tokenId: BigInt(value.token_id ?? '0'),
    feeLimit: 1000000000n,
    now,
  })

  expect(txID).toBe(withToken?.txID)
  expect(
    (parseBroadcast(bodyOf('broadcasthex')) as { raw_data_hex: string })
      .raw_data_hex,
  ).toBe(withToken?.rawDataHex)
  expect(toHex(contractAddress)).toBe(withToken?.contractAddress)
})

test('resolves the per-call account when the client hoists none', async () => {
  const { transport } = writeMock()
  const client = createWalletClient({ transport })
  const value = deployValueOf(basic!)

  const { txID } = await deployContract(client, {
    account: pk1,
    abi: value.abi,
    bytecode: `0x${value.bytecode}` as Hex,
    name: value.name,
    consumeUserResourcePercent: BigInt(value.consume_user_resource_percent),
    originEnergyLimit: BigInt(value.origin_energy_limit),
    feeLimit: 1000000000n,
    now,
  })
  expect(txID).toBe(basic?.txID)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    deployContract(client, { abi: [], bytecode: '0x60', now }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
