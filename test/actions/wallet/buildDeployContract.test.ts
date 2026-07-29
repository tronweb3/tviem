import type { Abi } from 'abitype'
import { expect, test } from 'vitest'
import { buildDeployContract } from '../../../src/actions/wallet/deployContract.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Hex } from '../../../src/types/misc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile, type TxFixture } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const

// The build half must produce the identical bytes / id that `deployContract`
// signs — the same gold vector the full action is pinned against.
const [basic] = loadTxFixtureFile('create-smart-contract.json')

type DeployValue = {
  abi: Abi
  bytecode: string
  name: string
  consume_user_resource_percent: string
  origin_energy_limit: string
}

function deployValueOf(fixture: TxFixture): DeployValue {
  return (fixture.params as { value: DeployValue }).value
}

function paramsOf(value: DeployValue) {
  return {
    abi: value.abi,
    bytecode: `0x${value.bytecode}` as Hex,
    name: value.name,
    consumeUserResourcePercent: BigInt(value.consume_user_resource_percent),
    originEnergyLimit: BigInt(value.origin_energy_limit),
    feeLimit: 1000000000n,
  }
}

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical deploy in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDeployContract(client, paramsOf(deployValueOf(basic!)))

  // Byte-identical to what deployContract builds + signs + broadcasts.
  expect(tx.txID).toBe(basic?.txID)
  expect(tx.raw_data_hex).toBe(basic?.rawDataHex)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDeployContract(client, {
    ...paramsOf(deployValueOf(basic!)),
    blockHeader: {
      refBlockBytes: '1234',
      refBlockHash: '0102030405060708',
      timestamp: 1700000000000n,
      expiration: 1700000000000n + 60000n,
    },
  })

  expect(tx.txID).toBe(basic?.txID)
  expect(tx.raw_data_hex).toBe(basic?.rawDataHex)
  expect(calls).toEqual([])
})

test('raw_data.contract[0] is the CreateSmartContract node type', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDeployContract(client, paramsOf(deployValueOf(basic!)))
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string }
  }

  expect(contract.type).toBe('CreateSmartContract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.CreateSmartContract',
  )
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDeployContract(client, {
    ...paramsOf(deployValueOf(basic!)),
    permissionId: 2,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(basic?.txID)
  expect(tx.raw_data_hex).not.toBe(basic?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(
    buildDeployContract(client, paramsOf(deployValueOf(basic!))),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})

// A contract deployment needs an energy budget — fee_limit defaults like
// writeContract (150 TRX) rather than being omitted (fee_limit 0, which
// java-tron rejects for a CreateSmartContract). An explicit 0n is honored.
test('defaults feeLimit when omitted; honors an explicit 0n', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })
  const value = deployValueOf(basic!)
  const noFee = {
    abi: value.abi,
    bytecode: `0x${value.bytecode}` as Hex,
    name: value.name,
    consumeUserResourcePercent: BigInt(value.consume_user_resource_percent),
    originEnergyLimit: BigInt(value.origin_energy_limit),
  }

  const tx = await buildDeployContract(client, noFee)
  expect((tx.raw_data as { fee_limit?: number }).fee_limit).toBe(150_000_000)

  const zero = await buildDeployContract(client, { ...noFee, feeLimit: 0n })
  expect((zero.raw_data as { fee_limit?: number }).fee_limit).toBeUndefined()
})
