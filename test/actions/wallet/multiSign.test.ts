import { expect, test } from 'vitest'
import { mnemonicToAccount } from '../../../src/accounts/mnemonicToAccount.js'
import { privateKeyToAccount } from '../../../src/accounts/privateKeyToAccount.js'
import { toAccount } from '../../../src/accounts/toAccount.js'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { multiSign } from '../../../src/actions/wallet/multiSign.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import { toRawDataHex } from '../../../src/utils/transaction/serializeRawData.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// Two distinct permitted trivial keys: pk1 derives the fixture's
// owner_address (41 7e5f...bdf); pk2 is a non-owner co-signer.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk2 = `0x${'0'.repeat(63)}2` as const

// Case 0: the canonical unbound transfer. Case 1: the SAME transfer with
// Permission_id=2 baked in — the gold vector a fresh bind must reproduce.
const [transfer, transferBound] = loadTxFixtureFile('transfer-contract.json')

/** The fixture's full consistent triple (unbound bytes). */
function unboundTriple(): SignableTransaction {
  return {
    txID: transfer!.txID,
    raw_data: decodeRawData(transfer!.rawDataHex),
    raw_data_hex: transfer!.rawDataHex,
  }
}

/** The Permission_id=2 gold vector's full consistent triple. */
function boundTriple(): SignableTransaction {
  return {
    txID: transferBound!.txID,
    raw_data: decodeRawData(transferBound!.rawDataHex),
    raw_data_hex: transferBound!.rawDataHex,
  }
}

// The signature multiSign must reproduce when it binds id 2 locally:
// signing the bound bytes directly (deterministic — same bytes, same sig).
const local = signTransaction({ transaction: boundTriple(), privateKey: pk1 })

/** A client whose transport records requests — multiSign must issue none. */
function silentClient() {
  const { transport, calls } = createMockTransport({ responses: {} })
  return { client: createPublicClient({ transport }), calls }
}

test('fresh bind is fully local and recomputes txID from the bound model', async () => {
  const { client, calls } = silentClient()

  const signed = await multiSign(client, {
    transaction: unboundTriple(),
    privateKey: pk1,
    permissionId: 2,
  })

  // The id was written into the contract and the triple recomputed from the
  // bound model — byte-identical to the Permission_id=2 gold vector.
  expect(signed.raw_data.contract[0]?.Permission_id).toBe(2)
  expect(signed.raw_data.contract[0]?.type).toBe('TransferContract')
  expect(signed.raw_data_hex).toBe(transferBound!.rawDataHex)
  expect(signed.raw_data_hex).toBe(toRawDataHex(signed.raw_data))
  expect(signed.txID).toBe(transferBound!.txID)
  expect(signed.txID).toBe(getTransactionId(signed.raw_data))
  // Identical bytes → identical deterministic signature.
  expect(signed.signature).toHaveLength(1)
  expect(signed.signature?.[0]).toBe(local.signature?.[0])
  expect(calls).toHaveLength(0)
})

test('later co-signer appends offline, inheriting the baked id', async () => {
  const { client, calls } = silentClient()

  // No permissionId given: it defaults to contract[0].Permission_id (2). pk2
  // is NOT the owner — membership is the node's business, signing is local.
  const second = await multiSign(client, {
    transaction: local,
    privateKey: pk2,
  })

  expect(second.signature).toHaveLength(2)
  expect(second.signature?.[0]).toBe(local.signature?.[0]) // pk1's sig preserved
  expect(second.txID).toBe(local.txID)
  expect(second.raw_data_hex).toBe(local.raw_data_hex)
  expect(calls).toHaveLength(0)
})

test('an explicit id equal to the baked one is idempotent', async () => {
  const { client, calls } = silentClient()

  const second = await multiSign(client, {
    transaction: local,
    privateKey: pk2,
    permissionId: 2,
  })

  expect(second.signature).toHaveLength(2)
  expect(second.txID).toBe(local.txID)
  expect(second.raw_data_hex).toBe(local.raw_data_hex)
  expect(calls).toHaveLength(0)
})

test('permission id 0 (owner permission) signs the unbound bytes locally', async () => {
  const { client, calls } = silentClient()

  const signed = await multiSign(client, {
    transaction: unboundTriple(),
    privateKey: pk1,
    permissionId: 0,
  })

  expect(signed.signature).toHaveLength(1)
  // id 0 encodes to nothing — bytes and id stay the unbound fixture values.
  expect(signed.raw_data_hex).toBe(transfer!.rawDataHex)
  expect(signed.txID).toBe(transfer!.txID)
  expect(calls).toHaveLength(0)
})

test('omitted id on an unbound transaction means the owner permission', async () => {
  const { client, calls } = silentClient()

  const signed = await multiSign(client, {
    transaction: unboundTriple(),
    privateKey: pk1,
  })

  expect(signed.signature).toHaveLength(1)
  expect(signed.raw_data_hex).toBe(transfer!.rawDataHex)
  expect(signed.txID).toBe(transfer!.txID)
  expect(calls).toHaveLength(0)
})

test('rejects an invalid permission id', async () => {
  const { client } = silentClient()
  await expect(
    multiSign(client, {
      transaction: unboundTriple(),
      privateKey: pk1,
      permissionId: -1,
    }),
  ).rejects.toThrow(/^Invalid multi-sig permission id:/)
  await expect(
    multiSign(client, {
      transaction: unboundTriple(),
      privateKey: pk1,
      permissionId: 1.5,
    }),
  ).rejects.toThrow(/^Invalid multi-sig permission id:/)
  await expect(
    multiSign(client, {
      transaction: unboundTriple(),
      privateKey: pk1,
      permissionId: -1,
    }),
  ).rejects.toBeInstanceOf(BaseError)
})

test('throws on a permission id that mismatches the baked one', async () => {
  const { client } = silentClient()
  // Bound to 2 — co-signing under 3 (or un-binding via 0) must refuse, not
  // silently re-bake (which would orphan pk1's signature).
  await expect(
    multiSign(client, { transaction: local, privateKey: pk2, permissionId: 3 }),
  ).rejects.toThrow(/^Permission id mismatch:/)
  await expect(
    multiSign(client, { transaction: local, privateKey: pk2, permissionId: 0 }),
  ).rejects.toThrow(/^Permission id mismatch:/)
})

test('throws when binding a fresh id over existing signatures', async () => {
  const { client } = silentClient()
  // Unbound bytes that already carry a signature: binding 2 now would change
  // the txID and invalidate it.
  const preSigned = { ...unboundTriple(), signature: ['ab'.repeat(65)] }
  await expect(
    multiSign(client, {
      transaction: preSigned,
      privateKey: pk2,
      permissionId: 2,
    }),
  ).rejects.toThrow(/^Cannot bind permission id/)
  // id 0 encodes to nothing — the bytes are unchanged, so an owner-permission
  // co-sign of already-signed bytes stays allowed.
  const signed = await multiSign(client, {
    transaction: preSigned,
    privateKey: pk2,
    permissionId: 0,
  })
  expect(signed.signature).toHaveLength(2)
})

test('refuses a handoff whose txID lies about the bytes', async () => {
  const { client } = silentClient()
  // A consistent (raw_data, raw_data_hex) pair whose txID belongs to OTHER
  // bytes: the collected signatures were made over a different digest. The
  // lying id is the co-signer's only local tamper evidence — refuse, never
  // silently recompute and co-sign.
  await expect(
    multiSign(client, {
      transaction: { ...local, txID: 'ab'.repeat(32) },
      privateKey: pk2,
      permissionId: 2,
    }),
  ).rejects.toThrow('The transaction failed its integrity check (txCheck).')
})

test('refuses partial forms — a bare txID with no raw_data does not sign', async () => {
  const { client } = silentClient()
  await expect(
    multiSign(client, {
      transaction: { txID: local.txID } as unknown as SignableTransaction,
      privateKey: pk1,
      permissionId: 2,
    }),
  ).rejects.toThrow('The transaction failed its integrity check (txCheck).')
})

test('a contract-less shell is refused with a clean integrity error', async () => {
  // `contract: []` with a ref-block field serializes to non-empty bytes, so a
  // correctly-derived txID/hex would slip past the zero-bytes guard — multiSign
  // must reject it via txCheck before the owner_address read on contract[0].
  const shell = { ref_block_bytes: '1234', contract: [] }
  const { client } = silentClient()
  await expect(
    multiSign(client, {
      transaction: {
        raw_data: shell,
        raw_data_hex: toRawDataHex(shell as never),
        txID: getTransactionId(shell as never),
      } as unknown as SignableTransaction,
      privateKey: pk1,
      permissionId: 2,
    }),
  ).rejects.toThrow('The transaction failed its integrity check (txCheck).')
})

// ---- The `account` calling convention --------------------------------------
// The sibling sign actions (`signTransaction` / `signMessage` /
// `signTypedData`) take an `account` that falls back to the Client's hoisted
// one. `multiSign` took only a raw key, so a client with an account could not
// co-sign through it, and an HD or custom (key-less) account had no path
// through the action at all.

test('co-signs with an `account`, byte-identical to the raw-key path', async () => {
  const { client, calls } = silentClient()
  const viaKey = await multiSign(client, {
    transaction: unboundTriple(),
    privateKey: pk2,
    permissionId: 2,
  })

  // An account object, and the key string every `account` parameter accepts.
  for (const account of [privateKeyToAccount(pk2), pk2])
    expect(
      await multiSign(client, {
        transaction: unboundTriple(),
        account,
        permissionId: 2,
      }),
    ).toEqual(viaKey)
  expect(calls).toHaveLength(0)
})

test('falls back to the account hoisted on the Client', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createWalletClient({ account: pk2, transport })
  const viaKey = await multiSign(client, {
    transaction: unboundTriple(),
    privateKey: pk2,
    permissionId: 2,
  })

  expect(
    await multiSign(client, { transaction: unboundTriple(), permissionId: 2 }),
  ).toEqual(viaKey)
  // …and through the decorator, which is how a wallet client is used.
  expect(
    await client.multiSign({ transaction: unboundTriple(), permissionId: 2 }),
  ).toEqual(viaKey)
})

test('an explicit privateKey still wins over the hoisted account', async () => {
  // The original calling convention: a wallet client (its own account
  // hoisted) co-signing with ANOTHER party's key. The hoisted account is only
  // a fallback — it must not displace a signer the caller named.
  const { transport } = createMockTransport({ responses: {} })
  const client = createWalletClient({ account: pk1, transport })
  const pk2Signed = await multiSign(silentClient().client, {
    transaction: unboundTriple(),
    privateKey: pk2,
    permissionId: 2,
  })

  expect(
    await client.multiSign({
      transaction: unboundTriple(),
      privateKey: pk2,
      permissionId: 2,
    }),
  ).toEqual(pk2Signed)
})

test('co-signs with an HD account without extracting its key', async () => {
  const { client } = silentClient()
  const account = mnemonicToAccount(
    'test test test test test test test test test test test junk',
  )

  const signed = await multiSign(client, {
    transaction: unboundTriple(),
    account,
    permissionId: 2,
  })

  expect(signed).toEqual(
    await account.multiSign(unboundTriple(), { permissionId: 2 }),
  )
  expect(signed.signature).toHaveLength(1)
})

test("delegates to a custom account's own multiSign", async () => {
  // A key-less account (a remote / hardware signer) that implements
  // `multiSign` itself: the action must consult it rather than need a key.
  const { client } = silentClient()
  const inner = privateKeyToAccount(pk2)
  const seen: unknown[] = []
  const account = toAccount({
    address: inner.address,
    publicKey: inner.publicKey,
    signMessage: inner.signMessage,
    signTypedData: inner.signTypedData,
    signTransaction: inner.signTransaction,
    multiSign: (transaction, options) => {
      seen.push(options)
      return inner.multiSign(transaction, options)
    },
  })

  const signed = await multiSign(client, {
    transaction: unboundTriple(),
    account,
    permissionId: 2,
  })

  expect(seen).toEqual([{ permissionId: 2 }])
  expect(signed.txID).toBe(transferBound!.txID)
  expect(signed.signature).toHaveLength(1)
})

test('refuses a custom account that does not implement multiSign', async () => {
  const { client } = silentClient()
  const inner = privateKeyToAccount(pk2)
  const account = toAccount({
    address: inner.address,
    publicKey: inner.publicKey,
    signMessage: inner.signMessage,
    signTypedData: inner.signTypedData,
    signTransaction: inner.signTransaction,
  })

  const err = (await multiSign(client, {
    transaction: unboundTriple(),
    account,
    permissionId: 2,
  }).catch((e) => e)) as BaseError
  expect(err).toBeInstanceOf(BaseError)
  expect(err.message).toContain('does not implement `multiSign`')
})

test('refuses an `account` and a `privateKey` together — two named signers', async () => {
  const { client } = silentClient()

  const err = (await multiSign(client, {
    transaction: unboundTriple(),
    account: pk1,
    privateKey: pk2,
    permissionId: 2,
  }).catch((e) => e)) as BaseError
  expect(err).toBeInstanceOf(BaseError)
  expect(err.message).toContain('either `account` or `privateKey`, not both')
})

test('throws AccountNotFoundError when no signer is available', async () => {
  const { client } = silentClient()
  await expect(
    multiSign(client, { transaction: unboundTriple(), permissionId: 2 }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
