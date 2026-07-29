// Deterministic ABI fuzz differential generator (dev-only, never imported
// from src).
//
// Regenerates `test/fixtures/abi/fuzz.json`: a large, pseudo-random batch of
// ABI type trees + values whose expected bytes are computed by an independent
// reference implementation (ethers v6 `AbiCoder` / `solidityPacked`). The
// runtime in `src/utils/abi` is then differentially checked against these
// gold bytes by `src/utils/abi/fuzz.test.ts`.
//
// Conventions (identical to `gen-abi-fixtures.mjs` / `test/fixtures/abi/
// loader.ts`, so the same `reviveValue` revives these values):
// - bigint values → decimal strings, bytes → lowercase `0x…` hex, booleans →
//   booleans, arrays/tuples → nested positional JSON arrays.
// - `address` values are stored in TRON Base58 form (`T…`) — both as encode
//   input and as decode expectation — while the reference bytes are computed
//   from the EVM `0x` form.
// - `trcToken` keeps its own type string but encodes exactly like `uint256`.
//
// Deterministic: a fixed-seed mulberry32 PRNG drives every choice; there is
// no `Math.random`, no clock. Re-running `node scripts/gen-abi-fuzz.mjs`
// reproduces byte-identical output.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AbiCoder, solidityPacked } from 'ethers'
import { TronWeb } from 'tronweb'

const root = resolve(import.meta.dirname, '..')
const outDir = resolve(root, 'test/fixtures/abi')
const coder = AbiCoder.defaultAbiCoder()

function assert(condition, message) {
  if (!condition) throw new Error(`gen-abi-fuzz: ${message}`)
}

// ------------------------------------------------------------- PRNG (fixed)

/** mulberry32 — small, fast, fully deterministic 32-bit PRNG. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(0x6f6d6e69) // fixed seed for a reproducible corpus

/** Uniform integer in [lo, hi] inclusive. */
function randInt(lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1))
}

function randChoice(arr) {
  return arr[randInt(0, arr.length - 1)]
}

/** Unsigned 32-bit word. */
function randU32() {
  return Math.floor(rand() * 0x100000000) >>> 0
}

/** Uniform unsigned bigint in [0, 2^bits). */
function randBits(bits) {
  let value = 0n
  let remaining = bits
  while (remaining > 0) {
    const take = Math.min(32, remaining)
    const chunk = BigInt(randU32() >>> (32 - take))
    value = (value << BigInt(take)) | chunk
    remaining -= take
  }
  return value
}

// ------------------------------------------------------------------ addresses

// Byte-verified vector addresses (docs §2.1): V1 = pk=1, V2 = pk=2,
// V3 = USDT mainnet contract.
const V1 = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const V2 = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'
const V3 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

/** Converts a TRON Base58 address to its 20-byte EVM `0x` form. */
function evm(address) {
  const hex41 = TronWeb.address.toHex(address).toLowerCase()
  assert(
    hex41.length === 42 && hex41.startsWith('41'),
    `unexpected hex form for ${address}: ${hex41}`,
  )
  return `0x${hex41.slice(2)}`
}

assert(evm(V1) === '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf', 'V1 mismatch')
assert(evm(V2) === '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf', 'V2 mismatch')
assert(evm(V3) === '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c', 'V3 mismatch')

/** A random valid TRON address: 20 random EVM bytes → `41…` hex → Base58. */
function randomTronAddress() {
  let hex = ''
  for (let i = 0; i < 20; i++)
    hex += randInt(0, 255).toString(16).padStart(2, '0')
  const base58 = TronWeb.address.fromHex(`41${hex}`)
  // Round-trip guard: Base58 → EVM must recover the exact 20 bytes.
  assert(evm(base58) === `0x${hex}`, `address round-trip failed for ${hex}`)
  return base58
}

/** Picks a vector address one-third of the time, otherwise a random one. */
function genAddress() {
  const r = randInt(0, 3)
  if (r === 0) return V1
  if (r === 1) return V2
  if (r === 2) return V3
  return randomTronAddress()
}

// ------------------------------------------------------------- value helpers

const UINT_BITS = [8, 16, 32, 64, 128, 256]
const INT_BITS = [8, 16, 32, 64, 128, 256]

/** Decimal string for a random `uintN` (with boundary bias to 0 / max). */
function genUint(bits) {
  const r = randInt(0, 9)
  if (r === 0) return '0'
  if (r === 1) return ((1n << BigInt(bits)) - 1n).toString()
  return randBits(bits).toString()
}

/** Decimal string for a random `intN` (full two's-complement range). */
function genIntSigned(bits) {
  const r = randInt(0, 11)
  if (r === 0) return '0'
  if (r === 1) return '-1'
  if (r === 2) return (-(1n << (BigInt(bits) - 1n))).toString()
  if (r === 3) return ((1n << (BigInt(bits) - 1n)) - 1n).toString()
  const unsigned = randBits(bits)
  const signed =
    unsigned >= 1n << (BigInt(bits) - 1n)
      ? unsigned - (1n << BigInt(bits))
      : unsigned
  return signed.toString()
}

/** Lowercase `0x…` hex of `length` random bytes. */
function genBytes(length) {
  let hex = '0x'
  for (let i = 0; i < length; i++)
    hex += randInt(0, 255).toString(16).padStart(2, '0')
  return hex
}

// UTF-8-safe alphabet, one full code point per entry (ASCII + multibyte).
const ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyz0123456789 _-.',
  'é',
  'ü',
  'λ',
  'Ω',
  '你',
  '好',
  '波',
  '场',
  '🚀',
  '🔥',
]

function genString() {
  const length = randInt(0, 12)
  let out = ''
  for (let i = 0; i < length; i++) out += randChoice(ALPHABET)
  return out
}

// --------------------------------------------------------- type generation

/** A random scalar ABI parameter. */
function genScalar() {
  switch (randInt(0, 10)) {
    case 0:
    case 1:
    case 9:
      return { type: `uint${randChoice(UINT_BITS)}` }
    case 2:
    case 10:
      return { type: `int${randChoice(INT_BITS)}` }
    case 3:
      return { type: 'bool' }
    case 4:
      return { type: 'address' }
    case 5:
      return { type: `bytes${randInt(1, 32)}` }
    case 6:
      return { type: 'bytes' }
    case 7:
      return { type: 'string' }
    default:
      return { type: 'trcToken' }
  }
}

/** Appends an array suffix to a parameter, preserving tuple components. */
function arrayOf(inner, suffix) {
  return { ...inner, type: `${inner.type}${suffix}` }
}

/**
 * A random ABI parameter tree bounded by `depth`. At depth 0 (or by chance)
 * a scalar; otherwise a fixed/dynamic array or a 1–4-component tuple whose
 * children are one level shallower.
 */
function genType(depth) {
  if (depth <= 0 || randInt(0, 2) === 0) return genScalar()
  switch (randInt(0, 2)) {
    case 0:
      return arrayOf(genType(depth - 1), `[${randInt(1, 4)}]`)
    case 1:
      return arrayOf(genType(depth - 1), '[]')
    default: {
      const components = []
      const n = randInt(1, 4)
      for (let i = 0; i < n; i++) components.push(genType(depth - 1))
      return { type: 'tuple', components }
    }
  }
}

/** JSON-safe value for a parameter tree (matches loader `reviveValue`). */
function genValue(param) {
  const array = param.type.match(/^(.*)\[(\d*)\]$/)
  if (array) {
    const inner = { ...param, type: array[1] }
    const length = array[2] === '' ? randInt(0, 3) : Number(array[2])
    const out = []
    for (let i = 0; i < length; i++) out.push(genValue(inner))
    return out
  }
  if (param.type === 'tuple')
    return param.components.map((component) => genValue(component))
  if (param.type === 'bool') return randInt(0, 1) === 1
  if (param.type === 'address') return genAddress()
  if (param.type === 'string') return genString()
  if (param.type === 'bytes') return genBytes(randInt(0, 70))
  const fixedBytes = param.type.match(/^bytes(\d+)$/)
  if (fixedBytes) return genBytes(Number(fixedBytes[1]))
  if (param.type === 'trcToken') return genUint(256)
  const uint = param.type.match(/^uint(\d+)$/)
  if (uint) return genUint(Number(uint[1]))
  const int = param.type.match(/^int(\d+)$/)
  if (int) return genIntSigned(Number(int[1]))
  throw new Error(`gen-abi-fuzz: unhandled type ${param.type}`)
}

// ---------------------------------------------- reference (ethers) encoding

/** Canonical ethers type string (`trcToken` → `uint256`, tuples expand). */
function refType(param) {
  const match = param.type.match(/^([a-zA-Z0-9]+)((?:\[\d*\])*)$/)
  assert(match, `malformed type: ${param.type}`)
  const [, base, suffix] = match
  if (base === 'tuple')
    return `tuple(${param.components.map(refType).join(',')})${suffix}`
  if (base === 'trcToken') return `uint256${suffix}`
  return param.type
}

/** Revives a stored value into the runtime value the ethers coder expects. */
function refValue(param, value) {
  const array = param.type.match(/^(.*)\[(\d*)\]$/)
  if (array)
    return value.map((element) =>
      refValue({ ...param, type: array[1] }, element),
    )
  if (param.type === 'tuple')
    return param.components.map((component, i) => refValue(component, value[i]))
  if (param.type === 'address') return evm(value)
  if (param.type === 'trcToken' || /^u?int\d+$/.test(param.type))
    return BigInt(value)
  return value
}

function encodeParams(params, values) {
  return coder.encode(
    params.map(refType),
    params.map((param, i) => refValue(param, values[i])),
  )
}

// ------------------------------------------------------ encode (ABI) cases

const PARAM_CASES = 260

const params = []
for (let i = 0; i < PARAM_CASES; i++) {
  const arity = randInt(1, 4)
  const caseParams = []
  for (let j = 0; j < arity; j++) caseParams.push(genType(3))
  const values = caseParams.map((param) => genValue(param))
  params.push({
    name: `enc-${i}`,
    params: caseParams,
    values,
    encoded: encodeParams(caseParams, values),
  })
}

// ------------------------------------------------------- encodePacked cases

// Packed (non-standard) encoding only supports static scalars, top-level
// dynamic `bytes`/`string`, and one level of array-of-static-scalar.
function genStaticScalar() {
  switch (randInt(0, 4)) {
    case 0:
      return { type: `uint${randChoice(UINT_BITS)}` }
    case 1:
      return { type: `int${randChoice(INT_BITS)}` }
    case 2:
      return { type: 'bool' }
    case 3:
      return { type: 'address' }
    default:
      return { type: `bytes${randInt(1, 32)}` }
  }
}

function genPackedType() {
  const r = randInt(0, 9)
  if (r < 5) return genStaticScalar()
  if (r === 5) return { type: 'bytes' }
  if (r === 6) return { type: 'string' }
  const scalar = genStaticScalar()
  const suffix = randInt(0, 1) === 0 ? '[]' : `[${randInt(1, 4)}]`
  return { type: `${scalar.type}${suffix}` }
}

const PACKED_CASES = 70

const packed = []
for (let i = 0; i < PACKED_CASES; i++) {
  const arity = randInt(1, 5)
  const typeParams = []
  for (let j = 0; j < arity; j++) typeParams.push(genPackedType())
  const values = typeParams.map((param) => genValue(param))
  const types = typeParams.map((param) => param.type)
  packed.push({
    name: `pk-${i}`,
    types,
    values,
    encoded: solidityPacked(
      types,
      typeParams.map((param, j) => refValue(param, values[j])),
    ),
  })
}

// -------------------------------------------------------------------- write

assert(params.length >= 250, `need >=250 encode cases, got ${params.length}`)
assert(packed.length >= 60, `need >=60 packed cases, got ${packed.length}`)

const fuzz = { params, packed }
mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, 'fuzz.json'),
  `${JSON.stringify(fuzz, null, 2)}\n`,
)

// Normalize with the repo's pinned formatter so `pnpm check` is a no-op and
// re-running this script stays byte-identical.
execFileSync(resolve(root, 'node_modules/.bin/biome'), [
  'format',
  '--write',
  resolve(outDir, 'fuzz.json'),
])

console.log(
  `wrote fuzz.json (${params.length} encode + ${packed.length} packed cases)`,
)
