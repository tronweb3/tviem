import { expect, test } from 'vitest'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { multiSign } from '../../../src/actions/wallet/multiSign.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// Two distinct permitted trivial keys → two distinct co-signers.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk2 = `0x${'0'.repeat(63)}2` as const

const [transfer] = loadTxFixtureFile('transfer-contract.json')
const base = { raw_data_hex: transfer!.rawDataHex }

// The exact bytes multiSign will locally serialize/sign under permission id 2.
const local = signTransaction({
  transaction: base,
  privateKey: pk1,
  permissionId: 2,
})

/** A client whose transport records requests — multiSign must issue none. */
function silentClient() {
  const { transport, calls } = createMockTransport({ responses: {} })
  return { client: createPublicClient({ transport }), calls }
}

test('first sign is fully local — no node contact', async () => {
  const { client, calls } = silentClient()

  const signed = await multiSign(client, {
    transaction: base,
    privateKey: pk1,
    permissionId: 2,
  })

  // Signed the local bytes (permission id committed into the recomputed id).
  expect(signed.signature).toHaveLength(1)
  expect(signed.txID).toBe(local.txID)
  expect(signed.raw_data_hex).toBe(local.raw_data_hex)
  expect(signed.raw_data?.contract[0]?.permissionId).toBe(2)
  expect(calls).toHaveLength(0)
})

test('later co-signer appends offline; equal baked id is idempotent', async () => {
  const { client, calls } = silentClient()

  const second = await multiSign(client, {
    transaction: local,
    privateKey: pk2,
    permissionId: 2,
  })

  expect(second.signature).toHaveLength(2)
  expect(second.signature?.[0]).toBe(local.signature?.[0]) // pk1's sig preserved
  expect(second.txID).toBe(local.txID)
  expect(second.raw_data_hex).toBe(local.raw_data_hex)
  expect(calls).toHaveLength(0)
})

test('permission id 0 (owner permission) signs locally', async () => {
  const { client, calls } = silentClient()

  const signed = await multiSign(client, {
    transaction: base,
    privateKey: pk1,
    permissionId: 0,
  })

  expect(signed.signature).toHaveLength(1)
  // id 0 encodes to nothing — the bytes stay the unbound bytes.
  expect(signed.raw_data_hex).toBe(base.raw_data_hex)
  expect(calls).toHaveLength(0)
})

test('rejects an invalid permission id', async () => {
  const { client } = silentClient()
  await expect(
    multiSign(client, { transaction: base, privateKey: pk1, permissionId: -1 }),
  ).rejects.toBeInstanceOf(BaseError)
  await expect(
    multiSign(client, {
      transaction: base,
      privateKey: pk1,
      permissionId: 1.5,
    }),
  ).rejects.toBeInstanceOf(BaseError)
})

test('throws on a permission id that mismatches the baked one', async () => {
  const { client } = silentClient()
  // Bound to 2 — co-signing under 3 (or un-binding via 0) must refuse, not
  // silently re-bake (which would orphan pk1's signature).
  await expect(
    multiSign(client, { transaction: local, privateKey: pk2, permissionId: 3 }),
  ).rejects.toThrow(/mismatch/)
  await expect(
    multiSign(client, { transaction: local, privateKey: pk2, permissionId: 0 }),
  ).rejects.toThrow(/mismatch/)
})

test('throws when binding a fresh id over existing signatures', async () => {
  const { client } = silentClient()
  // Unbound bytes that already carry a signature: binding 2 now would change
  // the txID and invalidate it.
  const preSigned = { ...base, signature: ['ab'.repeat(65)] }
  await expect(
    multiSign(client, {
      transaction: preSigned,
      privateKey: pk2,
      permissionId: 2,
    }),
  ).rejects.toThrow(/invalidate/)
  // id 0 encodes to nothing — the bytes are unchanged, so an owner-permission
  // co-sign of already-signed bytes stays allowed.
  const signed = await multiSign(client, {
    transaction: preSigned,
    privateKey: pk2,
    permissionId: 0,
  })
  expect(signed.signature).toHaveLength(2)
})

test('throws when there is no raw_data to bind the id into', async () => {
  const { client } = silentClient()
  await expect(
    multiSign(client, {
      transaction: { txID: local.txID },
      privateKey: pk1,
      permissionId: 2,
    }),
  ).rejects.toThrow(/raw_data/)
})
