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
import { entropyToMnemonic } from '@scure/bip39'
import { wordlist as bip39English } from '@scure/bip39/wordlists/english'
import { TronWeb, utils } from 'tronweb'

const { crypto, message: messageUtils, typedData } = utils
const { TypedDataEncoder } = typedData

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
const SEED = 0x6f6d6e69 // fixed seed for a reproducible corpus

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
// TIP-712 typed-data fuzz vectors (differential vs TronWeb `utils.typedData`).
// Each case pins the oracle digest, `0x||r||s||v` signature and recovered
// signer. Covers nested structs, fixed/dynamic arrays, arrays of structs,
// every scalar width, bytes/bytesN, bool and the TRON-native `trcToken`.
// Addresses are stored in 0x EVM form (`value`/`domain`, what the oracle saw)
// AND base58 form (`valueAlt`/`domainAlt`) so the diff test proves the in-tree implementation's
// TRON address-form invariance yields the same digest.
// ---------------------------------------------------------------------------

/** Address pool (data values, not signer keys) with all TRON forms. */
const ADDR_POOL = [
  { evm: `0x${HEX_ADDRESS.pk1.slice(2)}`, base58: ADDRESS.pk1 },
  { evm: `0x${HEX_ADDRESS.pk2.slice(2)}`, base58: ADDRESS.pk2 },
]
const EVM_TO_BASE58 = new Map(ADDR_POOL.map((a) => [a.evm, a.base58]))

/** A deterministic 0x-hex byte string of exactly `nBytes` bytes. */
function randHex(nBytes) {
  const b = new Uint8Array(nBytes)
  for (let i = 0; i < nBytes; i++) b[i] = randInt(0, 256)
  return bytesToHex(b)
}
/** A deterministic unsigned integer of `bits` bits, as a decimal string. */
function randUintStr(bits) {
  let v = 0n
  for (let i = 0; i < bits / 8; i++) v = (v << 8n) | BigInt(randInt(0, 256))
  return v.toString()
}
/** A deterministic signed integer of `bits` bits, as a decimal string. */
function randIntStr(bits) {
  const u = BigInt(randUintStr(bits))
  const mod = 1n << BigInt(bits)
  const half = 1n << BigInt(bits - 1)
  return (u >= half ? u - mod : u).toString()
}
/** Picks a pool address (0x EVM form). */
function randAddr() {
  return ADDR_POOL[randInt(0, ADDR_POOL.length)].evm
}
/** Deep-rewrites known 0x EVM pool addresses to their base58 form. */
function toAltForm(x) {
  if (typeof x === 'string') return EVM_TO_BASE58.get(x) ?? x
  if (Array.isArray(x)) return x.map(toAltForm)
  if (x && typeof x === 'object') {
    const o = {}
    for (const k of Object.keys(x)) o[k] = toAltForm(x[k])
    return o
  }
  return x
}

/** Domain templates cycled across cases (±verifyingContract, ±salt, chainId). */
const TD_DOMAINS = [
  {
    name: 'Example TIP-712',
    version: '1',
    chainId: 728126428,
    verifyingContract: ADDR_POOL[0].evm,
  },
  {
    name: 'Example',
    version: '2',
    chainId: 1,
    verifyingContract: ADDR_POOL[1].evm,
    salt: randHex(32),
  },
  { name: 'NoContract', version: '1', chainId: 3448148188 },
  {
    name: 'Zero',
    version: '1',
    chainId: 0,
    verifyingContract: ADDR_POOL[0].evm,
  },
]

const typedDataCases = []
const seenTdNames = new Set()

/** Builds + records a differential typed-data fixture. */
function pushTyped(name, label, types, value) {
  assert(!seenTdNames.has(name), `duplicate typed-data case name: ${name}`)
  seenTdNames.add(name)
  const domain = TD_DOMAINS[typedDataCases.length % TD_DOMAINS.length]
  const primaryType = TypedDataEncoder.getPrimaryType(types)
  const key = keyHex(label)
  const digest = TypedDataEncoder.hash(domain, types, value)
  const signature = typedData.signTypedData(domain, types, value, key)
  const recovered = typedData.verifyTypedData(domain, types, value, signature)
  const expectedEvm = `0x${HEX_ADDRESS[label].slice(2)}`
  assert(
    recovered.toLowerCase() === expectedEvm,
    `${name}: recovered ${recovered}, expected ${expectedEvm}`,
  )
  assert(
    signature.endsWith('1b') || signature.endsWith('1c'),
    `${name}: unexpected recovery byte`,
  )
  typedDataCases.push({
    name,
    privateKeyLabel: label,
    domain,
    domainAlt: toAltForm(domain),
    types,
    primaryType,
    value,
    valueAlt: toAltForm(value),
    digest,
    signature,
    address: ADDRESS[label],
  })
}

// --- A. Nested Mail (Person structs, string, address). ---------------------
const mailTypes = {
  Person: [
    { name: 'name', type: 'string' },
    { name: 'wallet', type: 'address' },
  ],
  Mail: [
    { name: 'from', type: 'Person' },
    { name: 'to', type: 'Person' },
    { name: 'contents', type: 'string' },
  ],
}
for (let i = 0; i < 10; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushTyped(`mail #${i} (${label})`, label, mailTypes, {
    from: { name: asciiString(randInt(1, 10)), wallet: randAddr() },
    to: { name: asciiString(randInt(1, 10)), wallet: randAddr() },
    contents: asciiString(randInt(0, 20)),
  })
}

// --- B. Kitchen sink: every scalar width, bytes/bytesN, bool. --------------
const sinkTypes = {
  Sink: [
    { name: 'u8', type: 'uint8' },
    { name: 'u16', type: 'uint16' },
    { name: 'u32', type: 'uint32' },
    { name: 'u64', type: 'uint64' },
    { name: 'u128', type: 'uint128' },
    { name: 'u256', type: 'uint256' },
    { name: 'i8', type: 'int8' },
    { name: 'i128', type: 'int128' },
    { name: 'i256', type: 'int256' },
    { name: 'flag', type: 'bool' },
    { name: 'raw', type: 'bytes' },
    { name: 'b1', type: 'bytes1' },
    { name: 'b4', type: 'bytes4' },
    { name: 'b32', type: 'bytes32' },
    { name: 'who', type: 'address' },
    { name: 'note', type: 'string' },
  ],
}
for (let i = 0; i < 10; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushTyped(`sink #${i} (${label})`, label, sinkTypes, {
    u8: randUintStr(8),
    u16: randUintStr(16),
    u32: randUintStr(32),
    u64: randUintStr(64),
    u128: randUintStr(128),
    u256: randUintStr(256),
    i8: randIntStr(8),
    i128: randIntStr(128),
    i256: randIntStr(256),
    flag: randInt(0, 2) === 1,
    raw: randHex(randInt(0, 33)),
    b1: randHex(1),
    b4: randHex(4),
    b32: randHex(32),
    who: randAddr(),
    note: asciiString(randInt(0, 16)),
  })
}

// --- C. Batch: dynamic/fixed arrays, arrays of structs, bytesN. ------------
const batchTypes = {
  Item: [
    { name: 'id', type: 'uint256' },
    { name: 'tag', type: 'bytes4' },
  ],
  Batch: [
    { name: 'items', type: 'Item[]' },
    { name: 'amounts', type: 'uint256[]' },
    { name: 'addrs', type: 'address[2]' },
    { name: 'blobs', type: 'bytes[]' },
  ],
}
for (let i = 0; i < 10; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushTyped(`batch #${i} (${label})`, label, batchTypes, {
    items: Array.from({ length: randInt(1, 4) }, () => ({
      id: randUintStr(64),
      tag: randHex(4),
    })),
    amounts: Array.from({ length: randInt(0, 4) }, () => randUintStr(128)),
    addrs: [randAddr(), randAddr()],
    blobs: Array.from({ length: randInt(0, 3) }, () => randHex(randInt(0, 19))),
  })
}

// --- D. Pay: TRON-native trcToken. -----------------------------------------
const payTypes = {
  Pay: [
    { name: 'token', type: 'trcToken' },
    { name: 'amount', type: 'uint256' },
    { name: 'to', type: 'address' },
  ],
}
for (let i = 0; i < 8; i++) {
  const label = i % 2 === 0 ? 'pk1' : 'pk2'
  pushTyped(`pay #${i} (${label})`, label, payTypes, {
    token: randUintStr(32),
    amount: randUintStr(96),
    to: randAddr(),
  })
}

assert(
  typedDataCases.length >= 30,
  `need >=30 typed-data cases, got ${typedDataCases.length}`,
)

// ---------------------------------------------------------------------------
// HD (BIP-39/BIP-32) derivation vectors — differential vs TronWeb.fromMnemonic.
// Sweeps trivial-entropy mnemonics across TRON paths (coin type 195), pinning
// the derived Base58 address + uncompressed public key. No secret is embedded:
// the phrase is derived from OBVIOUSLY-trivial entropy (all-zero, all-one,
// all-ones), and only public address/pubkey are stored — never a private key.
// ---------------------------------------------------------------------------

/** Obviously-trivial BIP-39 entropies (bare hex): 16-byte and 32-byte. */
const HD_ENTROPIES = [
  '00000000000000000000000000000000', // 16B zero → "abandon…about"
  '00000000000000000000000000000001', // 16B one
  'ffffffffffffffffffffffffffffffff', // 16B all-ones
  '0000000000000000000000000000000000000000000000000000000000000000', // 32B zero (24 words)
]

/** TRON derivation paths swept per entropy. */
const HD_PATHS = [
  "m/44'/195'/0'/0/0",
  "m/44'/195'/0'/0/1",
  "m/44'/195'/0'/0/2",
  "m/44'/195'/1'/0/0",
  "m/44'/195'/2'/0/0",
  "m/44'/195'/0'/1/0",
  "m/44'/195'/0'/1/1",
  "m/44'/195'/5'/0/9",
]

const hdCases = []
const seenHdNames = new Set()

/** Builds + records an HD derivation fixture (TronWeb is authoritative). */
function pushHd(entropyHex, path, passphrase) {
  const name = `${entropyHex.length / 2}B/${entropyHex.slice(
    0,
    4,
  )}${entropyHex.slice(-4)} ${path}${
    passphrase !== undefined ? ` +pp:${passphrase.slice(0, 6)}` : ''
  }`
  assert(!seenHdNames.has(name), `duplicate HD case name: ${name}`)
  seenHdNames.add(name)
  const mnemonic = entropyToMnemonic(hexToBytes(entropyHex), bip39English)
  const acct =
    passphrase !== undefined
      ? TronWeb.fromMnemonic(mnemonic, path, passphrase)
      : TronWeb.fromMnemonic(mnemonic, path)
  assert(
    typeof acct.address === 'string' && acct.address.startsWith('T'),
    `${name}: unexpected address ${acct.address}`,
  )
  assert(
    /^0x04[0-9a-f]{128}$/.test(acct.publicKey),
    `${name}: unexpected public key ${acct.publicKey}`,
  )
  hdCases.push({
    name,
    entropyHex,
    ...(passphrase !== undefined ? { passphrase } : {}),
    path,
    address: acct.address,
    publicKey: acct.publicKey,
  })
}

for (const entropyHex of HD_ENTROPIES)
  for (const path of HD_PATHS) pushHd(entropyHex, path)
// Passphrase (BIP-39 "25th word") variants on the default path.
pushHd(HD_ENTROPIES[0], "m/44'/195'/0'/0/0", 'passphrase-\u{1f680}')
pushHd(HD_ENTROPIES[0], "m/44'/195'/0'/0/0", 'correct horse battery staple')

assert(hdCases.length >= 30, `need >=30 HD cases, got ${hdCases.length}`)

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const out = {
  meta: {
    seed: SEED,
    messageCount: messages.length,
    transactionCount: transactions.length,
    typedDataCount: typedDataCases.length,
    hdCount: hdCases.length,
    boundaries: BOUNDARIES,
  },
  messages,
  transactions,
  typedData: typedDataCases,
  hd: hdCases,
}

const outDir = resolve(import.meta.dirname, '../test/fixtures/sig')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'fuzz.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(
  `fuzz.json: ${messages.length} message + ${transactions.length} tx + ${typedDataCases.length} typed-data + ${hdCases.length} HD case(s)`,
)
