import { expect, test } from 'vitest'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// The pk=1 address of the base getaccount fixture (41-hex boundary pinned).
const minimalAddress = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
// The fully populated account of the rich fixture.
const richAddress = 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY'

test('reads a minimal account (all absent fields defaulted)', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { getaccount: { response: rpc('getaccount') } },
  })
  const client = createPublicClient({ transport })

  const account = await client.getAccount({ address: minimalAddress })
  expect(account).not.toBeNull()
  if (!account) throw new Error('expected account')

  expect(account.address).toBe(minimalAddress)
  expect(account.type).toBe('Normal')
  expect(account.balance).toBe(1234567890n)
  expect(account.createTime).toBe(1700000000000n)
  expect(account.energyWindowSize).toBe(28800n)
  expect(account.accountName).toBeUndefined()
  expect(account.latestOperationTime).toBe(0n)
  expect(account.allowance).toBe(0n)
  expect(account.latestWithdrawTime).toBe(0n)
  expect(account.isWitness).toBe(false)
  expect(account.netUsage).toBe(0n)
  expect(account.latestConsumeTime).toBe(0n)
  expect(account.latestConsumeFreeTime).toBe(0n)
  expect(account.freeAssetNetUsageV2).toEqual([])
  expect(account.frozenV2).toEqual([])
  expect(account.unfrozenV2).toEqual([])
  expect(account.frozenV1).toEqual([])
  expect(account.frozenForEnergyV1).toBeUndefined()
  expect(account.tronPowerV1).toBeUndefined()
  expect(account.oldTronPower).toBe(0n)
  expect(account.delegatedFrozenBalanceForBandwidth).toBe(0n)
  expect(account.acquiredDelegatedFrozenBalanceForEnergy).toBe(0n)
  expect(account.votes).toEqual([])
  expect(account.assetV2).toEqual([])
  expect(account.ownerPermission).toBeUndefined()
  expect(account.activePermission).toEqual([])
  expect(account.witnessPermission).toBeUndefined()

  // sent-right (gold request of the base fixture): SolidityNode, 41-hex body.
  expect(calls[0]?.node).toBe('solidity')
  expect(calls[0]?.path).toBe('getaccount')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('getaccount')).toEqual({
    address: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
  })
})

test('maps a fully populated account (stake 2.0, votes, assets, permissions)', async () => {
  const { transport } = createMockTransport({
    responses: { getaccount: { response: rpc('getaccount.rich') } },
  })
  const client = createPublicClient({ transport })

  const account = await client.getAccount({ address: richAddress })
  if (!account) throw new Error('expected account')

  expect(account.address).toBe(richAddress)
  expect(account.accountName).toBe('746573742d6163636f756e74')
  expect(account.type).toBe('Contract')
  expect(account.balance).toBe(5000000000n)
  expect(account.createTime).toBe(1690000000000n)
  // Node key is `latest_opration_time` (sic).
  expect(account.latestOperationTime).toBe(1700000001000n)
  expect(account.allowance).toBe(12500000n)
  expect(account.latestWithdrawTime).toBe(1699913600000n)
  expect(account.isWitness).toBe(true)
  expect(account.netUsage).toBe(120n)
  expect(account.freeNetUsage).toBe(300n)
  expect(account.latestConsumeTime).toBe(1700000000500n)
  expect(account.latestConsumeFreeTime).toBe(1700000000600n)
  expect(account.netWindowSize).toBe(28800000n)

  // frozenV2: absent type = BANDWIDTH; absent amount = 0n.
  expect(account.frozenV2).toEqual([
    { type: 'BANDWIDTH', amount: 2000000n },
    { type: 'ENERGY', amount: 3000000n },
    { type: 'TRON_POWER', amount: 0n },
  ])
  expect(account.unfrozenV2).toEqual([
    {
      type: 'ENERGY',
      unfreezeAmount: 1000000n,
      unfreezeExpireTime: 1701209600000n,
    },
  ])
  expect(account.delegatedFrozenV2BalanceForBandwidth).toBe(7000000n)
  expect(account.acquiredDelegatedFrozenV2BalanceForBandwidth).toBe(8000000n)

  // Legacy Stake 1.0 positions (pre-2023 accounts still carry these).
  expect(account.frozenV1).toEqual([
    { frozenBalance: 734686656n, expireTime: 1638390999000n },
  ])
  expect(account.frozenForEnergyV1).toEqual({
    frozenBalance: 3500000n,
    expireTime: 1638391000000n,
  })
  expect(account.tronPowerV1).toEqual({
    frozenBalance: 1000000n,
    expireTime: 1638390999000n,
  })
  expect(account.oldTronPower).toBe(-1n)
  expect(account.delegatedFrozenBalanceForBandwidth).toBe(1500000n)
  expect(account.acquiredDelegatedFrozenBalanceForBandwidth).toBe(2500000n)
  expect(account.delegatedFrozenBalanceForEnergy).toBe(4500000n)
  expect(account.acquiredDelegatedFrozenBalanceForEnergy).toBe(5500000n)

  // account_resource flattening.
  expect(account.energyUsage).toBe(5432n)
  expect(account.latestConsumeTimeForEnergy).toBe(1700000002000n)
  expect(account.energyWindowSize).toBe(28800000n)
  expect(account.delegatedFrozenV2BalanceForEnergy).toBe(9000000n)
  expect(account.acquiredDelegatedFrozenV2BalanceForEnergy).toBe(10000000n)

  // votes: vote_address 41-hex -> Base58.
  expect(account.votes).toEqual([
    { voteAddress: minimalAddress, voteCount: 25n },
  ])
  expect(account.assetV2).toEqual([
    { key: '1000001', value: 42n },
    { key: '1004031', value: 500000000n },
  ])
  expect(account.freeAssetNetUsageV2).toEqual([{ key: '1000001', value: 150n }])

  // Permissions: keys -> Base58, threshold bigint, operations 0x-prefixed.
  // An absent permission type is the proto3 default: Owner (0).
  expect(account.ownerPermission).toEqual({
    type: 0,
    id: undefined,
    permissionName: 'owner',
    threshold: 1n,
    keys: [{ address: richAddress, weight: 1n }],
  })
  expect(account.witnessPermission?.type).toBe(1)
  expect(account.witnessPermission?.id).toBe(1)
  const active = account.activePermission[0]
  expect(active).toBeDefined()
  if (!active) throw new Error('expected active permission')
  expect(active.type).toBe(2)
  expect(active.id).toBe(2)
  expect(active.threshold).toBe(2n)
  expect(active.operations).toBe(
    '0x7fff1fc0033e0300000000000000000000000000000000000000000000000000',
  )
  expect(active.keys).toEqual([
    { address: minimalAddress, weight: 1n },
    { address: richAddress, weight: 1n },
  ])
})

// Verified against a live TRE devnet account populated via setAccountId /
// createToken: the node emits these six keys; they must map, not drop.
test('maps account_id, asset_issued_* and the window/asset optimized flags', async () => {
  const { transport } = createMockTransport({
    responses: {
      getaccount: {
        fn: () => ({
          address: '41c3b754325913154c3ec8e2126c1c5545dbf7c19e',
          account_id: '70726f62652d69642d303031',
          // The node emits the issued id as plain digits, the name as hex.
          asset_issued_ID: '1000001',
          asset_issued_name: '46756c6c486f757365',
          asset_optimized: true,
          net_window_optimized: true,
          account_resource: { energy_window_optimized: true },
        }),
      },
    },
  })
  const client = createPublicClient({ transport })

  const account = await client.getAccount({ address: minimalAddress })
  if (!account) throw new Error('expected account')
  expect(account.accountId).toBe('70726f62652d69642d303031')
  expect(account.assetIssuedId).toBe('1000001')
  expect(account.assetIssuedName).toBe('46756c6c486f757365')
  expect(account.assetOptimized).toBe(true)
  expect(account.netWindowOptimized).toBe(true)
  expect(account.energyWindowOptimized).toBe(true)
})

// The optional trio stays absent (not fabricated) when the node omits it; the
// boolean flags default to false like `isWitness`.
test('omits accountId/assetIssued* and defaults the optimized flags', async () => {
  const { transport } = createMockTransport({
    responses: {
      getaccount: { fn: () => ({ balance: 1 }) },
    },
  })
  const client = createPublicClient({ transport })

  const account = await client.getAccount({ address: minimalAddress })
  if (!account) throw new Error('expected account')
  expect('accountId' in account).toBe(false)
  expect('assetIssuedId' in account).toBe(false)
  expect('assetIssuedName' in account).toBe(false)
  expect(account.assetOptimized).toBe(false)
  expect(account.netWindowOptimized).toBe(false)
  expect(account.energyWindowOptimized).toBe(false)
})

test('a non-existent account (empty body) resolves to null', async () => {
  const { transport } = createMockTransport({
    responses: { getaccount: { fn: () => ({}) } },
  })
  const client = createPublicClient({ transport })

  expect(await client.getAccount({ address: minimalAddress })).toBeNull()
})

test('an unsafe plain-number balance fails closed with IntegerOutOfRangeError', async () => {
  // On engines without JSON.parse reviver-source support an unsafe integer has
  // already lost precision; refuse to return it as if exact (getBalance rule).
  // MAX_SAFE_INTEGER + 3 floats to 2^53 + 2 — representable but not safe.
  const unsafeBalance = Number.MAX_SAFE_INTEGER + 3
  const { transport } = createMockTransport({
    responses: { getaccount: { fn: () => ({ balance: unsafeBalance }) } },
  })
  const client = createPublicClient({ transport })

  await expect(client.getAccount({ address: minimalAddress })).rejects.toThrow(
    IntegerOutOfRangeError,
  )
})

// The account reads confirmed (SolidityNode) state by default; confirmed: false
// reads the FullNode's latest (unconfirmed) state instead.
test('confirmed: false reads the account from the FullNode', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getaccount: { response: rpc('getaccount') } },
  })
  const client = createPublicClient({ transport })

  await client.getAccount({ address: minimalAddress, confirmed: false })
  expect(calls[0]?.node).toBe('full')
})
