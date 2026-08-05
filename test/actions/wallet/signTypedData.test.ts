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

const typedData = {
  domain: { name: 'tviem-test', version: '1' },
  types: {
    Mail: [
      { name: 'contents', type: 'string' },
      { name: 'value', type: 'uint256' },
    ],
  },
  primaryType: 'Mail' as const,
  message: { contents: 'hello', value: 1n },
}

test('signs typed data identically to account.signTypedData', async () => {
  const client = createWalletClient({ account: pk1, transport })
  const viaClient = await client.signTypedData(typedData)
  const viaAccount = privateKeyToAccount(pk1).signTypedData(typedData)
  expect(viaClient).toEqual(viaAccount)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const client = createWalletClient({ transport })
  await expect(client.signTypedData(typedData)).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
