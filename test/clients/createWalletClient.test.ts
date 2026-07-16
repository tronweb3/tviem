import { expect, test } from 'vitest'

import { rpc } from '../fixtures/rpc/loader.js'
import { createMockTransport } from '../mock/createMockTransport.js'
import { AccountNotFoundError } from '../../src/errors/rpc.js'
import { createWalletClient } from '../../src/clients/createWalletClient.js'
import {
  createTransport,
  type Transport,
} from '../../src/clients/transports/createTransport.js'

const transport: Transport = () =>
  createTransport(
    {
      key: 'mock',
      name: 'Mock Transport',
      type: 'mock',
      request: async () => ({}) as any,
    },
    {},
  )

const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
const to = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as const

test('defaults to the wallet key/name and hoists the account', () => {
  const client = createWalletClient({ account: pk1, transport })
  expect(client.key).toBe('wallet')
  expect(client.name).toBe('Wallet Client')
  expect(client.type).toBe('walletClient')
  expect(client.account?.type).toBe('local')
  expect(client.account?.address).toBe('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')
})

test('exposes the wallet action set', () => {
  const client = createWalletClient({ account: pk1, transport })
  for (const name of [
    'sendTrx',
    'writeContract',
    'broadcastTransaction',
  ] as const)
    expect(typeof client[name]).toBe('function')
})

test('sendTrx throws AccountNotFoundError when no account is available', async () => {
  const client = createWalletClient({ transport })
  await expect(client.sendTrx({ to, amount: 1n })).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})

test('sendTrx runs the full pipeline when the client hoists an account', async () => {
  // A hoisted account passes the guard and the local build → sign → broadcast
  // pipeline completes, returning a locally computed txID.
  const { transport: mock } = createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
  const client = createWalletClient({ account: pk1, transport: mock })
  const { txID } = await client.sendTrx({ to, amount: 1n, now: 1700000000000n })
  expect(txID).toMatch(/^[0-9a-f]{64}$/)
})

test('a per-call account satisfies the guard on an account-less client', async () => {
  const { transport: mock } = createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
  const client = createWalletClient({ transport: mock })
  const { txID } = await client.sendTrx({
    account: pk1,
    to,
    amount: 1n,
    now: 1700000000000n,
  })
  expect(txID).toMatch(/^[0-9a-f]{64}$/)
})

test('writeContract throws AccountNotFoundError when no account is available', async () => {
  const client = createWalletClient({ transport })
  await expect(
    client.writeContract({
      address: to,
      abi: [],
      functionName: 'transfer',
      args: [to, 1n],
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
