import { expect, test } from 'vitest'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { privateKeyToAddress } from '../../../src/accounts/utils/privateKeyToAddress.js'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { TransactionTamperedError } from '../../../src/errors/rpc.js'
import { multiSign } from '../../../src/actions/wallet/multiSign.js'

// Two distinct permitted trivial keys → two distinct co-signers.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk2 = `0x${'0'.repeat(63)}2` as const
const addr1 = privateKeyToAddress(pk1)
const addr2 = privateKeyToAddress(pk2)

const [transfer] = loadTxFixtureFile('transfer-contract.json')
const base = { raw_data_hex: transfer!.rawDataHex }

// The exact bytes multiSign will locally serialize/sign under permission id 2 —
// the node's echo must match these to pass the tamper check.
const local = signTransaction({
  transaction: base,
  privateKey: pk1,
  permissionId: 2,
})

/** A getsignweight body echoing the local tx, with the given keys/approved. */
function weightResponse(opts: {
  keys?: { address: string; weight: number }[]
  approved?: string[]
  currentWeight?: number
  result?: { code: string; message: string }
  echo?: { txID?: string; raw_data_hex?: string }
}) {
  return {
    ...(opts.result ? { result: opts.result } : {}),
    permission: {
      type: 'Active',
      id: 2,
      permission_name: 'active0',
      threshold: 2,
      keys: opts.keys ?? [
        { address: addr1, weight: 1 },
        { address: addr2, weight: 1 },
      ],
    },
    approved_list: opts.approved ?? [],
    current_weight: opts.currentWeight ?? 0,
    transaction: {
      transaction: {
        txID: opts.echo?.txID ?? local.txID,
        raw_data_hex: opts.echo?.raw_data_hex ?? local.raw_data_hex,
      },
    },
  }
}

test('first sign: pre-validates via getSignWeight and signs the LOCAL tx', async () => {
  const { transport, bodyOf } = createMockTransport({
    responses: {
      getsignweight: {
        response: {
          result: { code: 'NOT_ENOUGH_PERMISSION', message: 'not enough' },
          ...weightResponse({}),
        },
      },
    },
  })
  const client = createPublicClient({ transport })

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

  // The weight probe was issued with the signatures present BEFORE this one
  // (none), over the local bytes.
  const body = bodyOf('getsignweight') as {
    raw_data_hex: string
    signature: string[]
  }
  expect(body.raw_data_hex).toBe(local.raw_data_hex)
  expect(body.signature).toEqual([])
})

test('throws when the signer is absent from the permission keys', async () => {
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        response: weightResponse({ keys: [{ address: addr2, weight: 1 }] }),
      },
    },
  })
  const client = createPublicClient({ transport })
  await expect(
    multiSign(client, { transaction: base, privateKey: pk1, permissionId: 2 }),
  ).rejects.toBeInstanceOf(BaseError)
})

test('throws when the signer has already signed (in approved_list)', async () => {
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        response: weightResponse({ approved: [addr1], currentWeight: 1 }),
      },
    },
  })
  const client = createPublicClient({ transport })
  await expect(
    multiSign(client, { transaction: base, privateKey: pk1, permissionId: 2 }),
  ).rejects.toBeInstanceOf(BaseError)
})

test('throws when the node reports PERMISSION_ERROR', async () => {
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        response: weightResponse({
          result: { code: 'PERMISSION_ERROR', message: 'Permission denied' },
        }),
      },
    },
  })
  const client = createPublicClient({ transport })
  await expect(
    multiSign(client, { transaction: base, privateKey: pk1, permissionId: 2 }),
  ).rejects.toBeInstanceOf(BaseError)
})

test('propagates TransactionTamperedError when the node echoes different bytes', async () => {
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        response: weightResponse({
          echo: { raw_data_hex: '0a02deadbeefcafe' },
        }),
      },
    },
  })
  const client = createPublicClient({ transport })
  await expect(
    multiSign(client, { transaction: base, privateKey: pk1, permissionId: 2 }),
  ).rejects.toBeInstanceOf(TransactionTamperedError)
})

test('later co-signer: skips the node round-trip and signs locally (offline)', async () => {
  // A transaction already carrying the permission id (signed by pk1).
  const first = signTransaction({
    transaction: base,
    privateKey: pk1,
    permissionId: 2,
  })
  const { transport, bodyOf } = createMockTransport({
    responses: { getsignweight: { response: weightResponse({}) } },
  })
  const client = createPublicClient({ transport })

  const second = await multiSign(client, {
    transaction: first,
    privateKey: pk2,
    permissionId: 2,
  })

  expect(second.signature).toHaveLength(2)
  expect(second.signature?.[0]).toBe(first.signature?.[0]) // pk1's sig preserved
  expect(second.txID).toBe(first.txID)
  // No node contact for an already-established permission id.
  expect(bodyOf('getsignweight')).toBeUndefined()
})

test('permission id 0 signs locally with no node contact', async () => {
  const { transport, bodyOf } = createMockTransport({
    responses: { getsignweight: { response: weightResponse({}) } },
  })
  const client = createPublicClient({ transport })

  const signed = await multiSign(client, {
    transaction: base,
    privateKey: pk1,
    permissionId: 0,
  })

  expect(signed.signature).toHaveLength(1)
  expect(bodyOf('getsignweight')).toBeUndefined()
})

test('rejects an invalid permission id', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
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
