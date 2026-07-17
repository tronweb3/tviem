// Dev-only: bring up a local TronBox TRE node (a real java-tron) and fund pk=1,
// so the gated live e2e (test/actions/wallet/sendTrx.e2e.test.ts) can prove the
// broadcasthex write path against a real node. Never published.
//
//   pnpm tre:up      # start TRE on :9090 and fund pk=1
//   pnpm test:e2e    # run the live e2e against it
//   pnpm tre:down    # docker rm -f omni-tre
//
// pk=1 (address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC) is the canonical trivial
// test key. The funder is a TRE genesis account read at runtime from
// /admin/accounts-json (or TRE_FUNDER_PRIVATE_KEY) — no non-trivial key is
// written to the repo.
import { execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { TronWeb } from 'tronweb'

const TRE_HTTP = process.env.TRE_HTTP ?? 'http://127.0.0.1:9090'
const CONTAINER = 'omni-tre'
const IMAGE = 'tronbox/tre'
const PK1_ADDRESS = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const FUND_SUN = 100_000_000_000n // 100,000 TRX

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()
}

function ensureContainer() {
  const running = sh(
    `docker ps --filter name=^/${CONTAINER}$ --format '{{.Names}}'`,
  )
  if (running === CONTAINER) {
    console.log(`• ${CONTAINER} already running`)
    return
  }
  // Remove a stopped container of the same name, then start fresh.
  try {
    sh(`docker rm -f ${CONTAINER}`)
  } catch {}
  console.log(`• starting ${IMAGE} as ${CONTAINER} on :9090 …`)
  execSync(`docker run -d --name ${CONTAINER} -p 9090:9090 ${IMAGE}`, {
    stdio: 'inherit',
  })
}

async function waitReady(timeoutMs = 90_000) {
  const start = Date.now()
  process.stdout.write('• waiting for TRE to produce blocks ')
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${TRE_HTTP}/wallet/getnowblock`, {
        method: 'POST',
      })
      const body = await res.json()
      if (typeof body?.block_header?.raw_data?.number === 'number') {
        console.log(
          `\n• TRE ready (block ${body.block_header.raw_data.number})`,
        )
        return
      }
    } catch {}
    process.stdout.write('.')
    await sleep(2000)
  }
  throw new Error(`TRE did not become ready within ${timeoutMs}ms`)
}

async function funderPrivateKey() {
  if (process.env.TRE_FUNDER_PRIVATE_KEY)
    return process.env.TRE_FUNDER_PRIVATE_KEY.replace(/^0x/, '')
  const res = await fetch(`${TRE_HTTP}/admin/accounts-json`)
  const body = await res.json()
  const keys = body?.privateKeys ?? body?.private_keys ?? []
  if (!Array.isArray(keys) || keys.length === 0)
    throw new Error(
      'Could not read a funded key from /admin/accounts-json; set TRE_FUNDER_PRIVATE_KEY.',
    )
  return String(keys[0]).replace(/^0x/, '')
}

async function fundPk1() {
  const tron = new TronWeb({ fullHost: TRE_HTTP })
  const balance = BigInt(await tron.trx.getBalance(PK1_ADDRESS))
  if (balance >= FUND_SUN) {
    console.log(`• pk=1 already funded (${balance} SUN)`)
    return
  }
  const privateKey = await funderPrivateKey()
  const funder = new TronWeb({ fullHost: TRE_HTTP, privateKey })
  console.log(`• funding pk=1 (${PK1_ADDRESS}) with ${FUND_SUN} SUN …`)
  const tx = await funder.trx.sendTransaction(PK1_ADDRESS, Number(FUND_SUN))
  if (!tx?.result)
    throw new Error(`funding transfer rejected: ${JSON.stringify(tx)}`)
  // Give the node a couple of blocks to settle the transfer.
  for (let i = 0; i < 15; i++) {
    await sleep(2000)
    const bal = BigInt(await tron.trx.getBalance(PK1_ADDRESS))
    if (bal >= FUND_SUN) {
      console.log(`• pk=1 funded (${bal} SUN)`)
      return
    }
  }
  throw new Error('funding transfer did not settle in time')
}

ensureContainer()
await waitReady()
await fundPk1()
console.log('\n✓ TRE is up and pk=1 is funded. Run `pnpm test:e2e`.')
