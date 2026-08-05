import { expect, test } from 'vitest'
import { privateKeyToAccount } from '../../../src/accounts/privateKeyToAccount.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import {
  createTransport,
  type Transport,
} from '../../../src/clients/transports/createTransport.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'

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
const pk2 = '0x0000000000000000000000000000000000000000000000000000000000000002'

test('signs a message identically to account.signMessage', async () => {
  const client = createWalletClient({ account: pk1, transport })
  const viaClient = await client.signMessage({ message: 'gm tviem' })
  const viaAccount = privateKeyToAccount(pk1).signMessage({
    message: 'gm tviem',
  })
  expect(viaClient).toEqual(viaAccount)
})

test('a per-call account overrides the hoisted one', async () => {
  const client = createWalletClient({ account: pk1, transport })
  const viaClient = await client.signMessage({ message: 'gm', account: pk2 })
  expect(viaClient).toEqual(
    privateKeyToAccount(pk2).signMessage({ message: 'gm' }),
  )
  expect(viaClient).not.toEqual(
    privateKeyToAccount(pk1).signMessage({ message: 'gm' }),
  )
})

test('throws AccountNotFoundError when no account is available', async () => {
  const client = createWalletClient({ transport })
  await expect(client.signMessage({ message: 'gm' })).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
