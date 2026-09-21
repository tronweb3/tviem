import { expect, test } from 'vitest'

import { buildSetAccountId } from '../../../src/actions/wallet/setAccountId.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { InvalidHexValueError } from '../../../src/errors/encoding.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

// An 8-byte account id — java-tron's `MIN_ACCOUNT_ID_LEN`. Given in hex here;
// `'omniaaaa'` is the same id in the text form the action also accepts.
const accountId = '0x6f6d6e6961616161'

/** The `account_id` hex the action wrote into the built contract. */
function accountIdOf(tx: { raw_data: { contract: unknown[] } }): string {
  const contracts = tx.raw_data.contract as {
    parameter: { value: { account_id: string } }
  }[]
  return contracts[0]!.parameter.value.account_id
}

/** A text account id of exactly `bytes` printable-ASCII bytes. */
const textOfLength = (bytes: number) => 'a'.repeat(bytes)

test('builds SetAccountIdContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildSetAccountId({
    accountId,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildSetAccountId({
    accountId,
    permissionId: 2,
    blockHeader: tviemHeader,
  })

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
})

test('accepts the id as text or hex, encoding both to the same bytes', async () => {
  const client = makeTviemClient()

  // Dual-form ("flex"): plain text is UTF-8 encoded, a `0x`-prefixed value is
  // hex. `'omniaaaa'` and its hex form are the same eight bytes, so the two
  // must produce a byte-identical transaction.
  const fromText = await client.buildSetAccountId({
    accountId: 'omniaaaa',
    blockHeader: tviemHeader,
  })
  const fromHex = await client.buildSetAccountId({
    accountId,
    blockHeader: tviemHeader,
  })

  expect(accountIdOf(fromText)).toBe('6f6d6e6961616161')
  expect(accountIdOf(fromHex)).toBe('6f6d6e6961616161')
  expect(fromText.txID).toBe(fromHex.txID)
})

test('bounds the id to the 8..32 bytes java-tron accepts', async () => {
  const client = makeTviemClient()
  const build = (accountId: string) =>
    client.buildSetAccountId({ accountId, blockHeader: tviemHeader })

  // The bounds are inclusive on both ends.
  expect(accountIdOf(await build(textOfLength(8)))).toHaveLength(16)
  expect(accountIdOf(await build(textOfLength(32)))).toHaveLength(64)

  await expect(build(textOfLength(7))).rejects.toThrow(
    'Invalid account id: 7 bytes. Expected 8 to 32 bytes',
  )
  await expect(build(textOfLength(33))).rejects.toThrow(
    'Invalid account id: 33 bytes. Expected 8 to 32 bytes',
  )
})

test('measures the bound in bytes, not in input characters', async () => {
  const client = makeTviemClient()
  const build = (accountId: string) =>
    client.buildSetAccountId({ accountId, blockHeader: tviemHeader })

  // A hex id is twice as long as the bytes it denotes — the trap TronWeb falls
  // into, whose `gte: 8 / lte: 32` measures the hex string and so admits
  // 4-byte ids while refusing legal 17..32-byte ones.
  await expect(build('0x61616161')).rejects.toThrow(
    'Invalid account id: 4 bytes', // 8 hex characters, only 4 bytes
  )
  expect(accountIdOf(await build(`0x${'61'.repeat(17)}`))).toHaveLength(34)
})

test('refuses an odd-nibble hex id instead of padding it into a different id', async () => {
  const client = makeTviemClient()

  // The 8-byte id above with its last nibble lost. Left-padded it is still
  // 8 bytes — `06 f6 d6 e6 96 16 16 16`, every byte shifted — so it would pass
  // the length bound and be signed, and the id is write-once.
  await expect(
    client.buildSetAccountId({
      accountId: accountId.slice(0, -1),
      blockHeader: tviemHeader,
    }),
  ).rejects.toThrow(InvalidHexValueError)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildSetAccountId(client, { accountId, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
