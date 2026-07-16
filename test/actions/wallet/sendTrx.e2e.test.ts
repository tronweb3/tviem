// Live sign+broadcast smoke against a local TronBox TRE node (a real
// java-tron), proving a locally-built transaction actually reaches the chain
// via `broadcasthex`.
//
// GATED: it runs only when a TRE node is reachable at `TRE_HTTP`
// (default http://127.0.0.1:9090). Bring one up + fund pk=1 with
// `pnpm tre:up`; offline unit runs (`pnpm test`) exclude `*.e2e.test.ts`
// entirely — this file runs only under the `e2e` vitest project
// (`pnpm test:e2e`). Tear down with `pnpm tre:down`.
//
// Only trivial keys appear here: the signer is pk=1 (the canonical test key,
// which `pnpm tre:up` funds on TRE). No non-trivial private key is committed.
import { beforeAll, describe, expect, it } from 'vitest'

import { privateKeyToAccount } from '../../../src/accounts/privateKeyToAccount.js'
import { defineChain } from '../../../src/chains/defineChain.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { http } from '../../../src/clients/transports/http.js'

const TRE_HTTP = process.env.TRE_HTTP ?? 'http://127.0.0.1:9090'

/** pk=1 (a permitted trivial key) → TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC. */
const pk1 = `0x${'0'.repeat(63)}1` as const
/** pk=2's address — the transfer recipient (an address, not a key). */
const pk2Address = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'

/** A local TRE chain. chainId is unused by the local build/broadcast path. */
const tre = defineChain({
  id: 0,
  name: 'TronBox TRE (local)',
  nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
  rpcUrls: {
    default: {
      full: { http: [TRE_HTTP] },
      solidity: { http: [TRE_HTTP] },
      event: { http: [TRE_HTTP] },
    },
  },
  testnet: true,
})

/** True when a TRE node is producing blocks at `TRE_HTTP`. */
async function treReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${TRE_HTTP}/wallet/getnowblock`, {
      method: 'POST',
    })
    if (!res.ok) return false
    const body = (await res.json()) as {
      block_header?: { raw_data?: { number?: number } }
    }
    return typeof body?.block_header?.raw_data?.number === 'number'
  } catch {
    return false
  }
}

const reachable = await treReachable()

describe.skipIf(!reachable)('sendTrx (TronBox TRE, live)', () => {
  const account = privateKeyToAccount(pk1)
  const wallet = createWalletClient({
    account,
    chain: tre,
    transport: http(TRE_HTTP),
  })
  const pub = createPublicClient({ chain: tre, transport: http(TRE_HTTP) })

  beforeAll(async () => {
    const balance = await pub.getBalance({ address: account.address })
    if (balance < 2_000_000n)
      throw new Error(
        `pk=1 (${account.address}) is not funded on TRE (${balance} SUN). ` +
          'Run `pnpm tre:up` to start + fund the node first.',
      )
  })

  it('broadcasts a pk=1 transfer via broadcasthex and it lands on-chain', async () => {
    const before = await pub.getBalance({ address: pk2Address })

    const { txID } = await wallet.sendTrx({
      to: pk2Address,
      amount: 1_000_000n,
    })
    expect(txID).toMatch(/^[0-9a-f]{64}$/)

    // The transaction is packed into a block and executed successfully — the
    // decisive proof that the broadcasthex wire form is accepted by a real node.
    const receipt = await pub.waitForTransactionReceipt({
      hash: txID,
      timeout: 30_000,
      pollingInterval: 1_500,
      throwOnRevert: true,
    })
    expect(receipt.status).toBe('success')
    expect(Number(receipt.blockNumber)).toBeGreaterThan(0)

    // Recipient balance moved by exactly the transferred amount.
    const after = await pub.getBalance({ address: pk2Address })
    expect(after - before).toBe(1_000_000n)
  })
})
