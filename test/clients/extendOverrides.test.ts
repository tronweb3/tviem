// The override-visibility contract getAction documents: composed actions see
// an override only when it was installed before the decorator that composes
// them. `.extend()` returns a new object and decorator closures keep the one
// they received, so overrides added after the decorators — including any
// `.extend()` on a factory-made client — apply to direct calls only.
//
// Both directions are pinned. The second half freezes behaviour inherited
// verbatim from the upstream extend implementation; if that ever changes,
// this test is the prompt to revisit the documented contract.
import { expect, test } from 'vitest'
import { createClient } from '../../src/clients/createClient.js'
import { createWalletClient } from '../../src/clients/createWalletClient.js'
import { publicActions } from '../../src/clients/decorators/public.js'
import { createMockTransport } from '../mock/createMockTransport.js'

const pk1 = `0x${'0'.repeat(63)}1` as const

const fixedBlock = {
  blockID: '00000000000012340102030405060708090a0b0c0d0e0f101112131415161718',
  block_header: {
    raw_data: {
      number: 4660,
      txTrieRoot: '00'.repeat(32),
      witness_address: '41928c9af0651632157ef27a2cf17ca72c575a4d21',
      parentHash: '00'.repeat(32),
      version: 28,
      timestamp: 1700000000000,
    },
    witness_signature: '00',
  },
}

test('an override installed before the decorator is used by composed actions', async () => {
  // No scripted responses: any transport traffic fails the test.
  const { transport, calls } = createMockTransport({ responses: {} })

  let overrideCalls = 0
  const client = createClient({ transport })
    .extend(() => ({
      getNowBlock: async () => {
        overrideCalls += 1
        // An override replaces the whole action, formatting included: what it
        // returns is what callers receive.
        return { ...fixedBlock, number: 4660n }
      },
    }))
    .extend(publicActions)

  // The decorator's own binding resolves through getAction against the client
  // it received — which carries the override.
  const block = await client.getNowBlock({ confirmed: false })
  expect(block.number).toBe(4660n)
  expect(overrideCalls).toBe(1)
  expect(calls).toHaveLength(0)
})

test('an override added after the factory applies to direct calls only', async () => {
  const { transport, calls } = createMockTransport({
    responses: {
      getnowblock: { response: fixedBlock },
      broadcasttransaction: { response: { result: true } },
    },
  })

  let overrideCalls = 0
  const client = createWalletClient({ account: pk1, transport }).extend(() => ({
    broadcastTransaction: async () => {
      overrideCalls += 1
      return { txid: 'ff'.repeat(32) }
    },
  }))

  // Direct call: the override answers, the transport is not asked.
  await client.broadcastTransaction({
    signedTransaction: {} as never,
  })
  expect(overrideCalls).toBe(1)

  // Composed call: sendTrx was composed with the pre-extend client, so it
  // uses the built-in broadcast and the transport IS asked.
  await client.sendTrx({
    to: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
    amount: 1n,
  })
  expect(overrideCalls).toBe(1)
  expect(calls.filter((c) => c.path === 'broadcasttransaction')).toHaveLength(1)
})
