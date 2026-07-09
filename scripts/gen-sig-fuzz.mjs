// Deterministic signature FUZZ vector generator (dev-only, never published).
//
// Produces a large, deterministic corpus of differential test vectors that
// pin TronWeb's gold-standard output for both TIP-191 message signing and
// transaction signing. The in-tree signature stack is diffed byte-for-byte
// against these vectors by:
//   src/utils/signature/fuzz.test.ts
//   src/accounts/signTransaction.fuzz.test.ts
//
// Determinism: all inputs come from a fixed-seed mulberry32 PRNG (no
// Math.random, no clock, no network). secp256k1 signing is
// RFC6979-deterministic (low-S, no extra entropy), so a fresh `node` run
// reproduces test/fixtures/sig/fuzz.json byte-for-byte. The only private
// keys used are the trivial scalars pk=1 and pk=2.
//
// Message fuzzing deliberately sweeps the TIP-191 length-prefix decimal
// boundaries (the prefix embeds the message BYTE length as ASCII), so the
// 1->2 digit and 2->3 digit rollovers (9/10, 99/100) and other edges are
// exercised across ascii, multibyte UTF-8 and raw-byte inputs.
//
// Output: test/fixtures/sig/fuzz.json
//   {
//     meta:         { seed, messageCount, transactionCount, boundaries },
//     messages:     [ { name, privateKeyLabel, message|rawHex, byteLength,
//                       digest, signature, address } ],
//     transactions: [ { name, txID, privateKeyLabel, ownerMatches,
//                       signature } ]
//   }
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { utils } from 'tronweb'

const { crypto, message: messageUtils } = utils

// ---------------------------------------------------------------------------
// Fixed constants (never derived from clock / network / randomness).
// ---------------------------------------------------------------------------

/** The only two permitted trivial private keys. */
const KEYS = {
  pk1: '0000000000000000000000000000000000000000000000000000000000000001',
  pk2: '0000000000000000000000000000000000000000000000000000000000000002',
}

/** Byte-verified Base58Check addresses derived from pk=1 / pk=2. */
const ADDRESS = {
  pk1: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  pk2: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
}

/** Byte-verified TRON hex (41-prefixed) addresses for pk=1 / pk=2. */
const HEX_ADDRESS = {
  pk1: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
  pk2: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
}

/** Fixed PRNG seed — reruns are byte-for-byte identical. */
const SEED = 0x6f6d6e69 // "omni"

/**
 * TIP-191 length-prefix decimal boundaries (message BYTE lengths). Covers the
 * empty case, the 1/2/3-digit rollovers and the 1-byte/2-byte code-point-count
 * edges around 255/256.
 */
const BOUNDARIES = [
  0, 1, 9, 10, 11, 99, 100, 101, 127, 128, 255, 256, 257, 300, 512,
]

/** Canonical transfer reference vector (pk=1) — a byte-for-byte tripwire. */
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
  if (!condition) throw new Error(`gen-sig-fuzz: ${message}`)
}

function keyHex(label) {
  const hex = KEYS[label]
  assert(hex !== undefined, `unknown key label ${label}`)
  return hex
}

/** Deterministic 32-bit PRNG (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(SEED)

/** Integer in [min, maxExclusive). */
function randInt(min, maxExclusive) {
  return min + Math.floor(rng() * (maxExclusive - min))
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

/** Uint8Array -> 0x-hex string. */
function bytesToHex(bytes) {
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** A deterministic printable-ASCII string of exactly `len` bytes. */
function asciiString(len) {
  let out = ''
  for (let i = 0; i < len; i++) out += String.fromCharCode(randInt(0x20, 0x7f))
  return out
}

/** Code-point ranges used to synthesize multibyte UTF-8 (no controls). */
const UTF8_RANGES = [
  [0x21, 0x7e], // ascii
  [0x00a1, 0x017f], // latin-1 supplement / extended-A (2-byte)
  [0x0391, 0x03c9], // greek (2-byte)
  [0x0400, 0x04ff], // cyrillic (2-byte)
  [0x4e00, 0x9fff], // CJK unified (3-byte)
  [0x1f300, 0x1f5ff], // misc symbols / pictographs (4-byte)
  [0x1f600, 0x1f64f], // emoticons (4-byte)
]

/** A deterministic multibyte UTF-8 string of `codePoints` code points. */
function utf8String(codePoints) {
  let out = ''
  for (let i = 0; i < codePoints; i++) {
    const [lo, hi] = UTF8_RANGES[randInt(0, UTF8_RANGES.length)]
    out += String.fromCodePoint(randInt(lo, hi + 1))
  }
  return out
}

/** A deterministic raw-byte 0x-hex string of exactly `len` bytes. */
function rawHexOfLen(len) {
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = randInt(0, 256)
  return bytesToHex(bytes)
}

// ---------------------------------------------------------------------------
// Golden entry builders (TronWeb is authoritative).
// ---------------------------------------------------------------------------

const messages = []
const seenMsgNames = new Set()

/** Builds + records a TIP-191 fixture for a UTF-8 string input. */
function pushMessage(name, label, message) {
  assert(!seenMsgNames.has(name), `duplicate message case name: ${name}`)
  seenMsgNames.add(name)
  const key = keyHex(label)
  const digest = messageUtils.hashMessage(message)
  const signature = messageUtils.signMessage(message, key)
  const address = messageUtils.verifyMessage(message, signature)
  assert(
    address === ADDRESS[label],
    `${name}: recovered ${address}, expected ${ADDRESS[label]}`,
  )
  assert(
    signature.endsWith('1b') || signature.endsWith('1c'),
    `${name}: unexpected recovery byte`,
  )
  messages.push({
    name,
    privateKeyLabel: label,
    message,
    byteLength: Buffer.byteLength(message, 'utf8'),
    digest,
    signature,
    address,
  })
}

/** Builds + records a TIP-191 fixture for a raw {raw} byte input. */
function pushRaw(name, label, rawHex) {
  assert(!seenMsgNames.has(name), `duplicate message case name: ${name}`)
  seenMsgNames.add(name)
  const key = keyHex(label)
  const bytes = hexToBytes(rawHex)
  const digest = messageUtils.hashMessage(bytes)
  const signature = messageUtils.signMessage(bytes, key)
  const address = messageUtils.verifyMessage(bytes, signature)
  assert(
    address === ADDRESS[label],
    `${name}: recovered ${address}, expected ${ADDRESS[label]}`,
  )
  assert(
    signature.endsWith('1b') || signature.endsWith('1c'),
    `${name}: unexpected recovery byte`,
  )
  messages.push({
    name,
    privateKeyLabel: label,
    rawHex,
    byteLength: bytes.length,
    digest,
    signature,
    address,
  })
}

// --- 1. Boundary sweep: exact byte lengths, ascii + raw, both keys. --------
for (const len of BOUNDARIES) {
  pushMessage(`ascii len ${len} (pk1)`, 'pk1', asciiString(len))
  pushMessage(`ascii len ${len} (pk2)`, 'pk2', asciiString(len))
  pushRaw(`raw len ${len} (pk1)`, 'pk1', rawHexOfLen(len))
  pushRaw(`raw len ${len} (pk2)`, 'pk2', rawHexOfLen(len))
}

// --- 2. Multibyte UTF-8 diversity. -----------------------------------------
for (let i = 0; i < 30; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushMessage(`utf8 #${i} (${label})`, label, utf8String(randInt(1, 41)))
}

// --- 3. Random-length ascii. -----------------------------------------------
for (let i = 0; i < 30; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushMessage(
    `ascii-rand #${i} (${label})`,
    label,
    asciiString(randInt(0, 301)),
  )
}

// --- 4. Random-length raw bytes. -------------------------------------------
for (let i = 0; i < 40; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushRaw(`raw-rand #${i} (${label})`, label, rawHexOfLen(randInt(0, 401)))
}

// ---------------------------------------------------------------------------
// Transaction fuzz vectors (each fixture txID signed with pk=1 and pk=2).
// ---------------------------------------------------------------------------

/** Signs a txID with `label`, returning the bare lowercase r||s||v hex. */
function signTxId(txID, label) {
  const signed = crypto.signTransaction(keyHex(label), { txID, signature: [] })
  return signed.signature[0].toLowerCase()
}

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
    const ownerHex = String(
      c.rawData?.contract?.[0]?.parameter?.value?.owner_address ?? '',
    ).toLowerCase()
    for (const label of ['pk1', 'pk2']) {
      const name = `${c.name} (${label})`
      assert(!seenTxNames.has(name), `duplicate transaction case name: ${name}`)
      seenTxNames.add(name)
      transactions.push({
        name,
        txID: c.txID,
        privateKeyLabel: label,
        ownerMatches: ownerHex === HEX_ADDRESS[label],
        signature: signTxId(c.txID, label),
      })
    }
  }
}

// Byte-for-byte tripwire on the canonical transfer vector (pk=1).
{
  const canonical = transactions.find(
    (t) => t.txID === CANONICAL_TX_ID && t.privateKeyLabel === 'pk1',
  )
  assert(canonical !== undefined, 'canonical transfer txID not found')
  assert(
    canonical.signature === CANONICAL_TX_SIGNATURE,
    `canonical tx signature mismatch:\n  got      ${canonical.signature}\n  expected ${CANONICAL_TX_SIGNATURE}`,
  )
  assert(
    canonical.ownerMatches === true,
    'canonical transfer owner must match pk=1',
  )
}

assert(
  messages.length >= 150,
  `need >=150 message cases, got ${messages.length}`,
)
assert(
  transactions.length >= 40,
  `need >=40 transaction cases, got ${transactions.length}`,
)

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const out = {
  meta: {
    seed: SEED,
    messageCount: messages.length,
    transactionCount: transactions.length,
    boundaries: BOUNDARIES,
  },
  messages,
  transactions,
}

const outDir = resolve(import.meta.dirname, '../test/fixtures/sig')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'fuzz.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(
  `fuzz.json: ${messages.length} message + ${transactions.length} tx case(s)`,
)
