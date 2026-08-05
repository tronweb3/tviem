import { expect, test } from 'vitest'
import { privateKeyToAccount } from '../../../src/accounts/privateKeyToAccount.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
const pk2 = '0x0000000000000000000000000000000000000000000000000000000000000002'
const to = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as const

/** Builds an unsigned transfer via the mocked node (TaPoS from the fixture). */
async function buildUnsigned(account: `0x${string}`) {
  const { transport } = createMockTransport({
    responses: { getnowblock: { response: rpc('getnowblock.fixed') } },
  })
  const client = createWalletClient({ account, transport })
  return { client, unsigned: await client.buildSendTrx({ to, amount: 1n }) }
}

test('signs a built transaction identically to account.signTransaction', async () => {
  const { client, unsigned } = await buildUnsigned(pk1)
  const viaClient = await client.signTransaction({ transaction: unsigned })
  const viaAccount = privateKeyToAccount(pk1).signTransaction(unsigned)
  expect(viaClient).toEqual(viaAccount)
  expect(viaClient.signature).toHaveLength(1)
  // The input is not mutated.
  expect(unsigned.signature).toBeUndefined()
})

test('a per-call account overrides the hoisted one', async () => {
  // pk2's address is not the owner, so its guard must reject — proving the
  // per-call account (not the hoisted pk1) is the one doing the signing.
  const { client, unsigned } = await buildUnsigned(pk1)
  await expect(
    client.signTransaction({ transaction: unsigned, account: pk2 }),
  ).rejects.toThrow(/owner_address does not match/)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createWalletClient({ transport })
  await expect(
    client.signTransaction({
      transaction: {
        txID: 'ab',
        raw_data: { contract: [] },
        raw_data_hex: 'ab',
      },
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
