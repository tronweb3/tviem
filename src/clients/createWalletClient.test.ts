import { expect, test } from 'vitest'

import { AccountNotFoundError } from '../errors/rpc.js'
import { createWalletClient } from './createWalletClient.js'
import {
  createTransport,
  type Transport,
} from './transports/createTransport.js'

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

test('sendTrx passes the account guard when the client hoists an account', async () => {
  const client = createWalletClient({ account: pk1, transport })
  // The T5 stub throws "not implemented"; reaching it proves the account guard
  // passed (a missing account would have thrown AccountNotFoundError first).
  await expect(client.sendTrx({ to, amount: 1n })).rejects.toThrow(
    /not implemented/,
  )
})

test('a per-call account satisfies the guard on an account-less client', async () => {
  const client = createWalletClient({ transport })
  await expect(
    client.sendTrx({ account: pk1, to, amount: 1n }),
  ).rejects.toThrow(/not implemented/)
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
