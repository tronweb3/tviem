// Live sign+broadcast smoke against the Nile testnet.
//
// This suite is GATED: it only runs when a funded testnet key is provided via
// the `NILE_E2E_PRIVATE_KEY` environment variable (injected from a CI secret,
// never committed). Offline unit runs (`pnpm test`) exclude `*.e2e.test.ts`
// entirely; this file runs only under the dedicated `e2e` vitest project
// (`pnpm test:e2e`).
//
// IMPORTANT: no literal private keys may ever appear in this file — the key is
// read exclusively from the environment.
import { describe, expect, it } from 'vitest'

import { privateKeyToAccount } from '../../accounts/privateKeyToAccount.js'
import { nile } from '../../chains/definitions/nile.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { http } from '../../clients/transports/http.js'
import type { Hex } from '../../types/misc.js'

const privateKey = process.env.NILE_E2E_PRIVATE_KEY as Hex | undefined

// Placeholder end-to-end smoke. Intentionally minimal until a funded Nile key
// is wired through CI secrets; the shape is in place so enabling it is a
// one-line secret change.
describe.skipIf(!privateKey)('sendTrx (Nile testnet, live)', () => {
  it('broadcasts a 1 SUN transfer and resolves a txID', async () => {
    const account = privateKeyToAccount(privateKey as Hex)
    const client = createWalletClient({
      account,
      chain: nile,
      transport: http(),
    })

    const { txID } = await client.sendTrx({
      to: account.address,
      amount: 1n,
    })

    expect(txID).toMatch(/^[0-9a-f]{64}$/)
  })
})
