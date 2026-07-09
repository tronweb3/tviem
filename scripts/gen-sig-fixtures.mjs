// Golden signature fixture generator (dev-only, never published).
//
// Produces byte-identical reference vectors for TRON message signing
// (TIP-191) and transaction signing, entirely OFFLINE and with no
// randomness: every case pins a fixed literal input and the only private
// keys used are the two trivial secp256k1 scalars pk=1 (0x…01) and
// pk=2 (0x…02). secp256k1 signing here is RFC6979-deterministic, so reruns
// are byte-for-byte stable.
//
// Output:
//   test/fixtures/sig/message.json     — one entry per (message, key)
//   test/fixtures/sig/transaction.json — one entry per (tx fixture txID, pk=1)
//
// message.json entry shape:
//   { name, privateKeyLabel, message | rawHex, digest, signature, address }
//     - `message`  — UTF-8 string input (present for text cases).
//     - `rawHex`   — 0x-prefixed raw byte input (present for {raw} cases).
//     - `digest`   — TIP-191 keccak digest (0x hex).
//     - `signature`— r(32)||s(32)||v signature (0x hex, v ∈ {0x1b,0x1c}).
//     - `address`  — Base58Check address recovered from the signature.
//
// transaction.json entry shape:
//   { name, txID, privateKeyLabel, signature }
//     - `signature`— r(32)||s(32)||v over the txID digest (bare lowercase hex).
//
// The generator hard-asserts the canonical message case (pk=1,
// "hello @tronweb3/omni") and the canonical transfer transaction case
// (pk=1) against their byte-verified reference vectors before writing.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { utils } from 'tronweb'

const { crypto, message: messageUtils } = utils

// ---------------------------------------------------------------------------
// Fixed constants (never derived from clock/network/randomness).
// ---------------------------------------------------------------------------

/** The only two permitted trivial private keys. */
const KEYS = {
  pk1: '0000000000000000000000000000000000000000000000000000000000000001',
  pk2: '0000000000000000000000000000000000000000000000000000000000000002',
}

/** Byte-verified addresses derived from pk=1 / pk=2. */
const ADDRESS = {
  pk1: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  pk2: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
}

// Canonical TIP-191 message reference vector (pk=1) for the current package
// name. NOTE: the pre-rename spec constants (digest 0xdd7bd740…, signature
// …7c7a1b) are STALE — they were computed for the package's former name and
// were never recomputed after the rename, so they do not correspond to the
// message below. The values pinned here are the true golden, produced
// identically by TronWeb (`hashMessage`/`signMessageV2`) and by the in-tree
// implementation, and are byte-asserted against TronWeb's live output above.
const CANONICAL_MESSAGE = 'hello @tronweb3/omni'
const CANONICAL_MESSAGE_DIGEST =
  '0x068a2c93df26c5f19fb1d6b74abe50efc69cbff8b70a9cc9b915058e0ed9a18e'
const CANONICAL_MESSAGE_SIGNATURE =
  '0x855e95dd49d937f13c6cbc5293db9b6fdfab8780d7c27c6eff9b12f8f3d3d56d792f34efe0adb183778c8e6f4c8f1cf66e19bd06be967bc7874613f4ee135dea1b'

/** Canonical transaction reference vector (pk=1). */
const CANONICAL_TX_ID =
  '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const CANONICAL_TX_SIGNATURE =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

/** Transaction fixture files to sign (contract-type order, excludes fuzz). */
const TX_FIXTURE_FILES = [
  'transfer-contract.json',
  'transfer-asset-contract.json',
  'vote-witness-contract.json',
  'withdraw-balance-contract.json',
  'create-smart-contract.json',
  'trigger-smart-contract.json',
  'account-permission-update-contract.json',
  'freeze-balance-v2-contract.json',
  'unfreeze-balance-v2-contract.json',
  'withdraw-expire-unfreeze-contract.json',
  'delegate-resource-contract.json',
  'un-delegate-resource-contract.json',
  'cancel-all-unfreeze-v2-contract.json',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`gen-sig-fixtures: ${message}`)
}

/** Guard: only pk=1 / pk=2 are ever used. */
function keyHex(label) {
  const hex = KEYS[label]
  assert(hex !== undefined, `unknown key label ${label}`)
  return hex
}

/** 0x-hex string -> Uint8Array of raw bytes. */
function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '')
  assert(clean.length % 2 === 0, `odd-length hex ${hex}`)
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Builds a TIP-191 message fixture entry for a UTF-8 string input. */
function messageEntry(name, label, message) {
  const key = keyHex(label)
  const digest = messageUtils.hashMessage(message)
  const signature = messageUtils.signMessage(message, key)
  const address = messageUtils.verifyMessage(message, signature)
  assert(
    address === ADDRESS[label],
    `${name}: recovered ${address}, expected ${ADDRESS[label]}`,
  )
  return { name, privateKeyLabel: label, message, digest, signature, address }
}

/** Builds a TIP-191 message fixture entry for raw {raw} byte input. */
function rawEntry(name, label, rawHex) {
  const key = keyHex(label)
  const bytes = hexToBytes(rawHex)
  const digest = messageUtils.hashMessage(bytes)
  const signature = messageUtils.signMessage(bytes, key)
  const address = messageUtils.verifyMessage(bytes, signature)
  assert(
    address === ADDRESS[label],
    `${name}: recovered ${address}, expected ${ADDRESS[label]}`,
  )
  return { name, privateKeyLabel: label, rawHex, digest, signature, address }
}

/** Signs a transaction id with pk=1, returning bare lowercase hex. */
function signTxId(txID, label) {
  const key = keyHex(label)
  const signed = crypto.signTransaction(key, { txID, signature: [] })
  return signed.signature[0].toLowerCase()
}

// ---------------------------------------------------------------------------
// Message fixtures
// ---------------------------------------------------------------------------

const messages = [
  messageEntry('canonical (pk=1)', 'pk1', CANONICAL_MESSAGE),
  messageEntry('canonical message with pk=2', 'pk2', CANONICAL_MESSAGE),
  messageEntry('empty string', 'pk1', ''),
  messageEntry(
    'ascii pangram',
    'pk2',
    'The quick brown fox jumps over the lazy dog',
  ),
  messageEntry('multibyte UTF-8 (CJK)', 'pk1', 'TRON 波场 测试消息'),
  messageEntry('multibyte UTF-8 (emoji)', 'pk2', 'gm to the moon 🚀🌕'),
  rawEntry('raw bytes (short)', 'pk1', '0xdeadbeef'),
  rawEntry(
    'raw bytes (32-byte digest-like)',
    'pk2',
    '0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20',
  ),
]

// Byte-for-byte lock on the canonical message reference vector.
assert(
  messages[0].digest === CANONICAL_MESSAGE_DIGEST,
  `canonical digest mismatch:\n  got      ${messages[0].digest}\n  expected ${CANONICAL_MESSAGE_DIGEST}`,
)
assert(
  messages[0].signature === CANONICAL_MESSAGE_SIGNATURE,
  `canonical signature mismatch:\n  got      ${messages[0].signature}\n  expected ${CANONICAL_MESSAGE_SIGNATURE}`,
)
assert(
  messages[0].signature.endsWith('1b'),
  'canonical message signature must end with v=0x1b',
)

// No duplicate case names.
{
  const seen = new Set()
  for (const m of messages) {
    assert(!seen.has(m.name), `duplicate message case name: ${m.name}`)
    seen.add(m.name)
  }
}

// ---------------------------------------------------------------------------
// Transaction fixtures
// ---------------------------------------------------------------------------

const txDir = resolve(import.meta.dirname, '../test/fixtures/tx')
const transactions = []
const seenTxNames = new Set()
for (const file of TX_FIXTURE_FILES) {
  const cases = JSON.parse(readFileSync(resolve(txDir, file), 'utf8'))
  for (const c of cases) {
    assert(
      typeof c.txID === 'string' && /^[0-9a-f]{64}$/.test(c.txID),
      `${file}: case "${c.name}" has an invalid txID`,
    )
    assert(
      !seenTxNames.has(c.name),
      `duplicate transaction case name: ${c.name}`,
    )
    seenTxNames.add(c.name)
    transactions.push({
      name: c.name,
      txID: c.txID,
      privateKeyLabel: 'pk1',
      signature: signTxId(c.txID, 'pk1'),
    })
  }
}

// Byte-for-byte lock on the canonical transfer reference vector.
{
  const canonical = transactions.find((t) => t.txID === CANONICAL_TX_ID)
  assert(
    canonical !== undefined,
    'canonical transfer txID not found in fixtures',
  )
  assert(
    canonical.signature === CANONICAL_TX_SIGNATURE,
    `canonical tx signature mismatch:\n  got      ${canonical.signature}\n  expected ${CANONICAL_TX_SIGNATURE}`,
  )
  assert(
    canonical.signature.endsWith('1c'),
    'canonical transfer signature must end with v=0x1c',
  )
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const outDir = resolve(import.meta.dirname, '../test/fixtures/sig')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, 'message.json'),
  `${JSON.stringify(messages, null, 2)}\n`,
)
writeFileSync(
  resolve(outDir, 'transaction.json'),
  `${JSON.stringify(transactions, null, 2)}\n`,
)
console.log(`message.json: ${messages.length} case(s)`)
console.log(`transaction.json: ${transactions.length} case(s)`)
