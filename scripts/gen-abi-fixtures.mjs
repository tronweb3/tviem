// Gold-standard ABI fixture generator (dev-only, never imported from src).
//
// Regenerates `test/fixtures/abi/{params,function,packed,events}.json` from
// fixed literal inputs. The expected bytes are computed with independent
// reference implementations — ethers v6 (`AbiCoder` / `solidityPacked` /
// `keccak256`) for ABI encoding and tronweb for Base58 ↔ hex address
// conversion — so the fixtures act as a cross-implementation oracle for the
// ABI runtime in `src/utils/abi`.
//
// Conventions (mirrored by `test/fixtures/abi/loader.ts`):
// - bigint values are stored as decimal strings, bytes as `0x…` hex strings,
//   booleans as booleans; arrays/tuples nest as JSON arrays (positional).
// - `address` values are stored in TRON Base58 form (`T…`) — both as encode
//   input and as decode expectation — while the expected bytes are computed
//   from the EVM `0x` form.
// - `trcToken` keeps its own type string in `params`/`abi`/signatures, but is
//   encoded exactly like `uint256`.
//
// Deterministic: fixed literals only (no randomness, no clock). Re-running
// `node scripts/gen-abi-fixtures.mjs` must reproduce byte-identical files.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AbiCoder,
  Interface,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
} from 'ethers'
import { TronWeb } from 'tronweb'

const root = resolve(import.meta.dirname, '..')
const outDir = resolve(root, 'test/fixtures/abi')

const coder = AbiCoder.defaultAbiCoder()

function assert(condition, message) {
  if (!condition) throw new Error(`gen-abi-fixtures: ${message}`)
}

// ---------------------------------------------------------------- addresses

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

// ------------------------------------------------------------------ helpers

/** Deterministic byte pattern `0x0102…` of `length` bytes. */
function bytesOf(length) {
  let hex = '0x'
  for (let i = 1; i <= length; i++)
    hex += (i & 0xff).toString(16).padStart(2, '0')
  return hex
}

const UINT32_MAX = ((1n << 32n) - 1n).toString()
const UINT128_MAX = ((1n << 128n) - 1n).toString()
const UINT256_MAX = ((1n << 256n) - 1n).toString()
const INT256_MIN = (-(1n << 255n)).toString()
const INT256_MAX = ((1n << 255n) - 1n).toString()

/**
 * Canonical type string for the reference coder. `trcToken` maps to
 * `uint256`; tuples expand their components.
 */
function refType(param) {
  const match = param.type.match(/^([a-zA-Z0-9]+)((?:\[\d*\])*)$/)
  assert(match, `malformed type: ${param.type}`)
  const [, base, suffix] = match
  if (base === 'tuple')
    return `tuple(${param.components.map(refType).join(',')})${suffix}`
  if (base === 'trcToken') return `uint256${suffix}`
  return param.type
}

/**
 * Revives a JSON-safe fixture value into the runtime value the reference
 * coder expects (decimal string → bigint, `T…` address → EVM `0x` form).
 */
function refValue(param, value) {
  const array = param.type.match(/^(.*)\[\d*\]$/)
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

function writeFixture(fileName, data) {
  writeFileSync(resolve(outDir, fileName), `${JSON.stringify(data, null, 2)}\n`)
  console.log(`wrote ${fileName} (${data.length} cases)`)
}

mkdirSync(outDir, { recursive: true })

// ----------------------------------------------------------- params.json

const paramsCases = [
  // uint boundaries
  { name: 'uint8-zero', params: [{ type: 'uint8' }], values: ['0'] },
  { name: 'uint8-one', params: [{ type: 'uint8' }], values: ['1'] },
  { name: 'uint8-max', params: [{ type: 'uint8' }], values: ['255'] },
  { name: 'uint32-zero', params: [{ type: 'uint32' }], values: ['0'] },
  { name: 'uint32-max', params: [{ type: 'uint32' }], values: [UINT32_MAX] },
  { name: 'uint128-one', params: [{ type: 'uint128' }], values: ['1'] },
  { name: 'uint128-max', params: [{ type: 'uint128' }], values: [UINT128_MAX] },
  { name: 'uint256-zero', params: [{ type: 'uint256' }], values: ['0'] },
  { name: 'uint256-one', params: [{ type: 'uint256' }], values: ['1'] },
  { name: 'uint256-max', params: [{ type: 'uint256' }], values: [UINT256_MAX] },
  // int negatives and limits
  { name: 'int8-minus-one', params: [{ type: 'int8' }], values: ['-1'] },
  { name: 'int8-min', params: [{ type: 'int8' }], values: ['-128'] },
  { name: 'int8-max', params: [{ type: 'int8' }], values: ['127'] },
  { name: 'int256-minus-one', params: [{ type: 'int256' }], values: ['-1'] },
  { name: 'int256-min', params: [{ type: 'int256' }], values: [INT256_MIN] },
  { name: 'int256-max', params: [{ type: 'int256' }], values: [INT256_MAX] },
  // bool
  { name: 'bool-true', params: [{ type: 'bool' }], values: [true] },
  { name: 'bool-false', params: [{ type: 'bool' }], values: [false] },
  // address (TRON Base58 in, 20-byte left-padded word out)
  { name: 'address-v1', params: [{ type: 'address' }], values: [V1] },
  { name: 'address-v2', params: [{ type: 'address' }], values: [V2] },
  { name: 'address-v3-usdt', params: [{ type: 'address' }], values: [V3] },
  // fixed-size bytes
  { name: 'bytes1', params: [{ type: 'bytes1' }], values: ['0xff'] },
  { name: 'bytes16', params: [{ type: 'bytes16' }], values: [bytesOf(16)] },
  { name: 'bytes32', params: [{ type: 'bytes32' }], values: [bytesOf(32)] },
  // dynamic bytes length boundaries (0 / 1 / 31 / 32 / 33 / 64)
  { name: 'bytes-empty', params: [{ type: 'bytes' }], values: ['0x'] },
  { name: 'bytes-len1', params: [{ type: 'bytes' }], values: ['0x2a'] },
  { name: 'bytes-len31', params: [{ type: 'bytes' }], values: [bytesOf(31)] },
  { name: 'bytes-len32', params: [{ type: 'bytes' }], values: [bytesOf(32)] },
  { name: 'bytes-len33', params: [{ type: 'bytes' }], values: [bytesOf(33)] },
  { name: 'bytes-len64', params: [{ type: 'bytes' }], values: [bytesOf(64)] },
  // string
  { name: 'string-empty', params: [{ type: 'string' }], values: [''] },
  {
    name: 'string-ascii',
    params: [{ type: 'string' }],
    values: ['hello test'],
  },
  {
    name: 'string-utf8',
    params: [{ type: 'string' }],
    values: ['你好，波场 🚀'],
  },
  // static arrays
  {
    name: 'uint256-array-fixed3',
    params: [{ type: 'uint256[3]' }],
    values: [['0', '1000000', UINT256_MAX]],
  },
  {
    name: 'address-array-fixed2',
    params: [{ type: 'address[2]' }],
    values: [[V1, V3]],
  },
  // dynamic arrays
  {
    name: 'uint256-array-empty',
    params: [{ type: 'uint256[]' }],
    values: [[]],
  },
  {
    name: 'uint256-array',
    params: [{ type: 'uint256[]' }],
    values: [['1', '1000000', UINT256_MAX]],
  },
  {
    name: 'string-array',
    params: [{ type: 'string[]' }],
    values: [['', 'test', '你好']],
  },
  // nested arrays
  {
    name: 'uint256-array-nested',
    params: [{ type: 'uint256[][]' }],
    values: [[['1', '2'], [], ['1000000']]],
  },
  {
    name: 'bytes-array-fixed2',
    params: [{ type: 'bytes[2]' }],
    values: [['0x', bytesOf(33)]],
  },
  // tuples
  {
    name: 'tuple-static',
    params: [
      {
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'owner', type: 'address' },
        ],
      },
    ],
    values: [['1000000', true, V3]],
  },
  {
    name: 'tuple-dynamic-members',
    params: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'memo', type: 'string' },
          { name: 'payload', type: 'bytes' },
        ],
      },
    ],
    values: [['7', 'hello memo', bytesOf(3)]],
  },
  {
    name: 'tuple-nested-tuple',
    params: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          {
            name: 'inner',
            type: 'tuple',
            components: [
              { name: 'to', type: 'address' },
              { name: 'hash', type: 'bytes32' },
            ],
          },
          { name: 'note', type: 'string' },
        ],
      },
    ],
    values: [['42', [V2, bytesOf(32)], 'nested']],
  },
  {
    name: 'tuple-array',
    params: [
      {
        type: 'tuple[]',
        components: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
    values: [
      [
        [V1, '1'],
        [V3, '1000000'],
      ],
    ],
  },
  // trcToken (encodes as uint256, keeps its own type string)
  {
    name: 'trcToken-scalar',
    params: [{ type: 'trcToken' }],
    values: ['1002000'],
  },
  {
    name: 'trcToken-array',
    params: [{ type: 'trcToken[]' }],
    values: [['0', '1', '1002000']],
  },
  // multi-parameter mixes (static and dynamic interleaved)
  {
    name: 'mixed-static-dynamic',
    params: [
      { name: 'a', type: 'uint8' },
      { name: 'b', type: 'string' },
      { name: 'c', type: 'address' },
      { name: 'd', type: 'bytes' },
      { name: 'e', type: 'uint256' },
    ],
    values: ['7', 'interleaved', V1, bytesOf(5), '1000000'],
  },
  {
    name: 'mixed-dynamic-heavy',
    params: [
      { type: 'bytes' },
      { type: 'bool' },
      { type: 'uint256[]' },
      { type: 'string' },
    ],
    values: [bytesOf(33), true, ['1', '2', '3'], '你好'],
  },
]

assert(
  paramsCases.length >= 45,
  `params.json needs >=45 cases, got ${paramsCases.length}`,
)

const paramsFixtures = paramsCases.map(({ name, params, values }) => ({
  name,
  params,
  values,
  encoded: encodeParams(params, values),
}))

// --------------------------------------------------------- function.json

// §2.4 gold bytes — the generator refuses to emit fixtures if the reference
// implementation disagrees with the byte-verified vectors.
const TRANSFER_CALLDATA =
  '0xa9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240'
const TRANSFER_SELECTOR = '0xa9059cbb'
const BALANCE_OF_SELECTOR = '0x70a08231'

function fn(name, inputs, outputs, stateMutability = 'nonpayable') {
  return { type: 'function', name, inputs, outputs, stateMutability }
}

/**
 * Selector signature type: tuples expand to their component list, but —
 * unlike `refType` — `trcToken` keeps its own name in the signature.
 */
function signatureType(param) {
  const match = param.type.match(/^([a-zA-Z0-9]+)((?:\[\d*\])*)$/)
  assert(match, `malformed type: ${param.type}`)
  const [, base, suffix] = match
  if (base === 'tuple')
    return `(${param.components.map(signatureType).join(',')})${suffix}`
  return param.type
}

function signatureOf(abiFn) {
  return `${abiFn.name}(${abiFn.inputs.map(signatureType).join(',')})`
}

/**
 * Encodes calldata without the reference `Interface` so signatures may keep
 * TRON-only type names (`trcToken`) that the reference parser rejects: the
 * selector hashes the raw signature string, parameters encode by `refType`.
 */
function encodeCalldata(abiFn, args) {
  const selector = keccak256(toUtf8Bytes(signatureOf(abiFn))).slice(0, 10)
  return selector + encodeParams(abiFn.inputs, args).slice(2)
}

function functionCase({ abi, functionName, args, result, name }) {
  const target = abi.find(
    (item) => item.name === functionName && item.inputs.length === args.length,
  )
  assert(target, `no ABI item for ${functionName}/${args.length}`)
  const fixture = {
    name,
    abi,
    functionName,
    args,
    calldata: encodeCalldata(target, args),
  }
  if (result) {
    const decodedValues = result.decoded === null ? [] : [result.decoded].flat()
    assert(
      decodedValues.length === target.outputs.length,
      `output arity mismatch for ${name}`,
    )
    fixture.result = {
      returnData: encodeParams(target.outputs, decodedValues),
      decoded: result.decoded,
    }
  }
  return fixture
}

const trc20TransferAbi = [
  fn(
    'transfer',
    [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    [{ name: '', type: 'bool' }],
  ),
]
const overloadedAbi = [
  fn(
    'safeTransferFrom',
    [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    [],
  ),
  fn(
    'safeTransferFrom',
    [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    [],
  ),
]

const functionFixtures = [
  // §2.4 TRC20 transfer — byte-asserted below.
  functionCase({
    name: 'trc20-transfer',
    abi: trc20TransferAbi,
    functionName: 'transfer',
    args: [V3, '1000000'],
    result: { decoded: true },
  }),
  functionCase({
    name: 'trc20-balanceOf',
    abi: [
      fn(
        'balanceOf',
        [{ name: 'owner', type: 'address' }],
        [{ name: '', type: 'uint256' }],
        'view',
      ),
    ],
    functionName: 'balanceOf',
    args: [V1],
    result: { decoded: '123456789000000000000000000' },
  }),
  // No-argument function.
  functionCase({
    name: 'no-args-totalSupply',
    abi: [fn('totalSupply', [], [{ name: '', type: 'uint256' }], 'view')],
    functionName: 'totalSupply',
    args: [],
    result: { decoded: '1000000000000' },
  }),
  // No-argument function returning an address (decodes to Base58 form).
  functionCase({
    name: 'no-args-owner-returns-address',
    abi: [fn('owner', [], [{ name: '', type: 'address' }], 'view')],
    functionName: 'owner',
    args: [],
    result: { decoded: V2 },
  }),
  // Function without return values.
  functionCase({
    name: 'no-return-burn',
    abi: [fn('burn', [{ name: 'amount', type: 'uint256' }], [])],
    functionName: 'burn',
    args: ['1000000'],
    result: { decoded: null },
  }),
  // Multiple return values decode to a positional array.
  functionCase({
    name: 'multi-return-getReserves',
    abi: [
      fn(
        'getReserves',
        [],
        [
          { name: 'reserve0', type: 'uint112' },
          { name: 'reserve1', type: 'uint112' },
          { name: 'blockTimestampLast', type: 'uint32' },
        ],
        'view',
      ),
    ],
    functionName: 'getReserves',
    args: [],
    result: { decoded: ['1000000', '2000000', '1700000000'] },
  }),
  // Overloads: same name, different parameter lists.
  functionCase({
    name: 'overload-safeTransferFrom-3args',
    abi: overloadedAbi,
    functionName: 'safeTransferFrom',
    args: [V1, V2, '1'],
  }),
  functionCase({
    name: 'overload-safeTransferFrom-4args',
    abi: overloadedAbi,
    functionName: 'safeTransferFrom',
    args: [V1, V2, '1', '0x0102'],
  }),
  // trcToken parameter: the selector signature keeps the `trcToken` name,
  // the parameter itself encodes as uint256.
  functionCase({
    name: 'trcToken-transferToken',
    abi: [
      fn(
        'transferToken',
        [
          { name: 'to', type: 'address' },
          { name: 'tokenId', type: 'trcToken' },
          { name: 'amount', type: 'uint256' },
        ],
        [{ name: '', type: 'bool' }],
        'payable',
      ),
    ],
    functionName: 'transferToken',
    args: [V1, '1002000', '9'],
    result: { decoded: true },
  }),
]

// Cross-check the hand-rolled calldata path against the reference Interface
// for a trcToken-free ABI, then against the §2.4 gold bytes.
{
  const byName = (name) => functionFixtures.find((f) => f.name === name)
  const viaInterface = new Interface(trc20TransferAbi).encodeFunctionData(
    'transfer',
    [evm(V3), 1000000n],
  )
  const generated = byName('trc20-transfer').calldata
  assert(generated === viaInterface, 'transfer calldata != reference Interface')
  assert(
    generated === TRANSFER_CALLDATA,
    'transfer calldata != §2.4 gold bytes',
  )
  assert(generated.startsWith(TRANSFER_SELECTOR), 'transfer selector mismatch')
  assert(
    byName('trc20-balanceOf').calldata.startsWith(BALANCE_OF_SELECTOR),
    'balanceOf selector mismatch',
  )
  assert(
    byName('trcToken-transferToken').calldata.startsWith(
      keccak256(toUtf8Bytes('transferToken(address,trcToken,uint256)')).slice(
        0,
        10,
      ),
    ),
    'transferToken selector mismatch',
  )
}

// ----------------------------------------------------------- packed.json

const packedCases = [
  { name: 'packed-address', types: ['address'], values: [V3] },
  { name: 'packed-uint8', types: ['uint8'], values: ['255'] },
  { name: 'packed-uint16', types: ['uint16'], values: ['65535'] },
  { name: 'packed-uint32', types: ['uint32'], values: ['1000000'] },
  {
    name: 'packed-uint64',
    types: ['uint64'],
    values: ['18446744073709551615'],
  },
  { name: 'packed-uint128', types: ['uint128'], values: [UINT128_MAX] },
  { name: 'packed-uint256', types: ['uint256'], values: [UINT256_MAX] },
  { name: 'packed-bool-true', types: ['bool'], values: [true] },
  { name: 'packed-bool-false', types: ['bool'], values: [false] },
  { name: 'packed-bytes1', types: ['bytes1'], values: ['0xff'] },
  { name: 'packed-bytes16', types: ['bytes16'], values: [bytesOf(16)] },
  { name: 'packed-bytes32', types: ['bytes32'], values: [bytesOf(32)] },
  { name: 'packed-bytes-dynamic', types: ['bytes'], values: [bytesOf(5)] },
  { name: 'packed-bytes-empty', types: ['bytes'], values: ['0x'] },
  { name: 'packed-string', types: ['string'], values: ['hello test'] },
  { name: 'packed-string-utf8', types: ['string'], values: ['你好，波场 🚀'] },
  // In packed mode array elements are padded to 32 bytes.
  {
    name: 'packed-uint256-array',
    types: ['uint256[]'],
    values: [['1', '1000000']],
  },
  {
    name: 'packed-address-array-fixed2',
    types: ['address[2]'],
    values: [[V1, V3]],
  },
  {
    name: 'packed-address-uint256',
    types: ['address', 'uint256'],
    values: [V3, '1000000'],
  },
  {
    name: 'packed-mixed',
    types: ['string', 'bytes', 'uint8', 'address', 'bool'],
    values: ['test', '0x0102', '7', V1, true],
  },
]

const packedFixtures = packedCases.map(({ name, types, values }) => ({
  name,
  types,
  values,
  encoded: solidityPacked(
    types,
    types.map((type, i) => refValue({ type }, values[i])),
  ),
}))

// ----------------------------------------------------------- events.json

const TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

function ev(name, inputs, anonymous = false) {
  return { type: 'event', name, inputs, anonymous }
}

function isDynamicType(type) {
  return (
    type === 'string' ||
    type === 'bytes' ||
    type.includes('[') ||
    type === 'tuple'
  )
}

function eventCase({ name, event, args }) {
  const { topics, data } = new Interface([event]).encodeEventLog(
    event.name,
    event.inputs.map((input, i) => refValue(input, args[i])),
  )
  // Expected decode result: indexed dynamic values are only recoverable as
  // their keccak256 topic; everything else round-trips the fixture value.
  const decoded = {}
  let topicIndex = event.anonymous ? 0 : 1
  for (const [i, input] of event.inputs.entries()) {
    if (input.indexed) {
      decoded[input.name] = isDynamicType(input.type)
        ? topics[topicIndex]
        : args[i]
      topicIndex += 1
    } else decoded[input.name] = args[i]
  }
  return {
    name,
    abi: [event],
    eventName: event.name,
    args,
    topics,
    data,
    decoded,
  }
}

const eventFixtures = [
  // §2.4 Transfer — topic0 byte-asserted below.
  eventCase({
    name: 'transfer',
    event: ev('Transfer', [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ]),
    args: [V1, V2, '1000000'],
  }),
  // All parameters indexed — empty data.
  eventCase({
    name: 'all-indexed-approval',
    event: ev('Approval', [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: true },
    ]),
    args: [V2, V3, '1'],
  }),
  // Indexed dynamic types decode to their keccak256 topic hash.
  eventCase({
    name: 'indexed-string',
    event: ev('Memo', [
      { name: 'tag', type: 'string', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ]),
    args: ['hello test', '7'],
  }),
  eventCase({
    name: 'indexed-bytes',
    event: ev('Payload', [
      { name: 'data', type: 'bytes', indexed: true },
      { name: 'sender', type: 'address', indexed: false },
    ]),
    args: [bytesOf(33), V1],
  }),
  // Anonymous event — no topic0.
  eventCase({
    name: 'anonymous',
    event: ev(
      'Ping',
      [
        { name: 'id', type: 'uint256', indexed: true },
        { name: 'note', type: 'string', indexed: false },
      ],
      true,
    ),
    args: ['7', 'anon'],
  }),
  // No indexed parameters — topic0 only, everything in data.
  eventCase({
    name: 'no-indexed',
    event: ev('Sync', [
      { name: 'reserve0', type: 'uint112', indexed: false },
      { name: 'reserve1', type: 'uint112', indexed: false },
    ]),
    args: ['1000000', '2000000'],
  }),
  // Mixed indexed / non-indexed with a dynamic tail.
  eventCase({
    name: 'mixed-indexed',
    event: ev('Deposit', [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
    ]),
    args: [V3, '1000000', bytesOf(4)],
  }),
]

{
  const byName = (name) => eventFixtures.find((f) => f.name === name)
  assert(
    byName('transfer').topics[0] === TRANSFER_TOPIC0,
    'Transfer topic0 != §2.4 gold bytes',
  )
  assert(
    byName('anonymous').topics.length === 1,
    'anonymous event must omit topic0',
  )
  assert(
    byName('all-indexed-approval').data === '0x',
    'all-indexed event must have empty data',
  )
}

// -------------------------------------------------------------------- write

writeFixture('params.json', paramsFixtures)
writeFixture('function.json', functionFixtures)
writeFixture('packed.json', packedFixtures)
writeFixture('events.json', eventFixtures)

// Normalize the emitted JSON with the repo's pinned formatter so that
// `pnpm check` is a no-op on the output and re-running this script stays
// byte-identical.
execFileSync(resolve(root, 'node_modules/.bin/biome'), [
  'format',
  '--write',
  outDir,
])
console.log('all gold assertions passed')
