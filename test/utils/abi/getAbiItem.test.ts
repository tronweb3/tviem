import type { Abi } from 'abitype'
import { expect, test } from 'vitest'

import { AbiItemAmbiguityError } from '../../../src/errors/abi.js'
import { decodeFunctionResult } from '../../../src/utils/abi/decodeFunctionResult.js'
import { encodeFunctionData } from '../../../src/utils/abi/encodeFunctionData.js'
import {
  getAbiItem,
  getAmbiguousTypes,
  isArgOfType,
} from '../../../src/utils/abi/getAbiItem.js'
import { prepareEncodeFunctionData } from '../../../src/utils/abi/prepareEncodeFunctionData.js'

const abi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi

test('finds a function by name', () => {
  const item = getAbiItem({ abi, name: 'balanceOf' })
  expect(item?.type).toBe('function')
  expect((item as unknown as { name: string }).name).toBe('balanceOf')
})

test('returns undefined for an unknown name', () => {
  expect(getAbiItem({ abi, name: 'missing' as never })).toBeUndefined()
})

test('finds a function by 4-byte selector', () => {
  // transfer(address,uint256) -> 0xa9059cbb
  const item = getAbiItem({ abi, name: '0xa9059cbb' })
  expect((item as unknown as { name: string }).name).toBe('transfer')
})

test('finds an event by 32-byte selector', () => {
  // Transfer(address,address,uint256)
  const item = getAbiItem({
    abi,
    name: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  })
  expect((item as unknown as { name: string; type: string }).type).toBe('event')
  expect((item as unknown as { name: string }).name).toBe('Transfer')
})

const overloaded = [
  {
    type: 'function',
    name: 'foo',
    inputs: [{ name: 'x', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'foo',
    inputs: [{ name: 'x', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const satisfies Abi

test('disambiguates overloads: Base58 address selects the address overload', () => {
  const item = getAbiItem({
    abi: overloaded,
    name: 'foo',
    args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
  })
  expect(
    (item as unknown as { inputs: readonly { type: string }[] }).inputs[0]!
      .type,
  ).toBe('address')
})

test('disambiguates overloads: bigint selects the uint256 overload', () => {
  const item = getAbiItem({ abi: overloaded, name: 'foo', args: [123n] })
  expect(
    (item as unknown as { inputs: readonly { type: string }[] }).inputs[0]!
      .type,
  ).toBe('uint256')
})

test('disambiguates arity-only overloads by argument count', () => {
  const nft = [
    {
      type: 'function',
      name: 'safeTransferFrom',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      type: 'function',
      name: 'safeTransferFrom',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'data', type: 'bytes' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ] as const satisfies Abi
  const item = getAbiItem({
    abi: nft,
    name: 'safeTransferFrom',
    args: [
      'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
      'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      1n,
      '0x0102',
    ],
  })
  expect(
    (item as unknown as { inputs: readonly unknown[] }).inputs.length,
  ).toBe(4)
})

test('throws on an ambiguous address/string overload', () => {
  const ambiguous = [
    {
      type: 'function',
      name: 'bar',
      inputs: [{ name: 'x', type: 'address' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      type: 'function',
      name: 'bar',
      inputs: [{ name: 'x', type: 'string' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ] as const satisfies Abi
  expect(() =>
    getAbiItem({
      abi: ambiguous,
      name: 'bar',
      args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
    }),
  ).toThrowError(AbiItemAmbiguityError)
})

test('isArgOfType matches TRON address forms and trcToken', () => {
  expect(
    isArgOfType('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', { type: 'address' }),
  ).toBe(true)
  expect(
    isArgOfType('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf', {
      type: 'address',
    }),
  ).toBe(true)
  expect(isArgOfType(9n, { type: 'trcToken' })).toBe(true)
  expect(isArgOfType('nope', { type: 'trcToken' })).toBe(false)
  expect(isArgOfType([1n, 2n], { type: 'uint256[]' })).toBe(true)
})

test('getAmbiguousTypes reports address/string only for address args', () => {
  const source = [{ name: 'x', type: 'address' }]
  const target = [{ name: 'x', type: 'string' }]
  expect(
    getAmbiguousTypes(source, target, ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC']),
  ).toEqual(['address', 'string'])
  expect(getAmbiguousTypes(source, target, ['just a string'])).toBeUndefined()
})

// A primitive string must never "match" a tuple parameter: without the
// argType === 'object' guard, Object.values('ab') is ['a','b'] and each
// one-char string satisfies string components — stealing the overload from
// foo(string) and corrupting every downstream selector/decode.
const stringVsTupleAbi = [
  {
    type: 'function',
    name: 'foo',
    inputs: [{ name: 's', type: 'string' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'foo',
    inputs: [
      {
        name: 't',
        type: 'tuple',
        components: [
          { name: 'a', type: 'string' },
          { name: 'b', type: 'string' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'int256' }],
  },
]

test('a primitive string resolves the string overload, not the tuple', () => {
  const item = getAbiItem({
    abi: stringVsTupleAbi as unknown as Abi,
    name: 'foo',
    args: ['ab'],
  }) as unknown as { inputs: { type: string }[] }
  expect(item.inputs[0]!.type).toBe('string')

  expect(isArgOfType('ab', stringVsTupleAbi[1]!.inputs[0] as never)).toBe(false)
})

test('overload resolution flows through to the selector and result decode', () => {
  const prepared = prepareEncodeFunctionData({
    abi: stringVsTupleAbi as unknown as Abi,
    functionName: 'foo',
    args: ['ab'],
  } as never) as { functionName: string }
  // foo(string), not foo((string,string)) (0xdd0b43b6).
  expect(prepared.functionName).toBe('0xf31a6969')

  // uint256 outputs (string overload): the value stays a huge POSITIVE
  // number — the tuple overload's int256 would reinterpret it as negative.
  const data =
    '0x8000000000000000000000000000000000000000000000000000000000000005'
  const value = decodeFunctionResult({
    abi: stringVsTupleAbi as unknown as Abi,
    functionName: 'foo',
    args: ['ab'],
    data,
  } as never)
  expect(value).toBe(BigInt(data))
})

// F-7D2: `typeof null === 'object'`, so the tuple-branch guard must reject
// null explicitly — otherwise Object.values(null) throws a raw TypeError
// instead of the arg cleanly failing to match the tuple overload.
const nullVsTupleAbi = [
  {
    type: 'function',
    name: 'foo',
    inputs: [{ name: 'x', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'foo',
    inputs: [
      {
        name: 't',
        type: 'tuple',
        components: [
          { name: 'a', type: 'uint256' },
          { name: 'b', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]

test('a null arg does not crash the tuple overload branch', () => {
  expect(isArgOfType(null, nullVsTupleAbi[1]!.inputs[0] as never)).toBe(false)
  // null matches no overload, so getAbiItem falls back to the first candidate
  // rather than throwing a raw TypeError from Object.values(null).
  expect(() =>
    getAbiItem({
      abi: nullVsTupleAbi as unknown as Abi,
      name: 'foo',
      args: [null],
    }),
  ).not.toThrow()
})

// F-7D3: `trcToken` encodes to the same 32-byte word as `uint256`, so a
// number/bigint arg cannot pick between foo(uint256) and foo(trcToken) — the
// combination must throw AbiItemAmbiguityError, not silently resolve to the
// last structural match.
const intVsTrcTokenAbi = [
  {
    type: 'function',
    name: 'foo',
    inputs: [{ name: 'x', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'foo',
    inputs: [{ name: 'x', type: 'trcToken' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]

test('throws on an ambiguous uint256/trcToken overload', () => {
  expect(() =>
    getAbiItem({
      abi: intVsTrcTokenAbi as unknown as Abi,
      name: 'foo',
      args: [5n],
    }),
  ).toThrowError(AbiItemAmbiguityError)
  // unit level: the (integer, trcToken) pair is reported for a numeric arg…
  expect(
    getAmbiguousTypes(
      [{ name: 'x', type: 'uint256' }],
      [{ name: 'x', type: 'trcToken' }] as never,
      [5n],
    ),
  ).toEqual(['uint256', 'trcToken'])
  // …but a non-integer overlap (e.g. uint256 vs uint64) stays unambiguous.
  expect(
    getAmbiguousTypes(
      [{ name: 'x', type: 'uint256' }],
      [{ name: 'x', type: 'uint64' }],
      [5n],
    ),
  ).toBeUndefined()
})

// Two overloads whose tuples differ only in component count. `isArgOfType`'s
// tuple branch checked that every declared component had a value but never
// that the counts matched, so a 2-value arg "matched" the 1-component overload
// too. Both then reached `getAmbiguousTypes`, whose tuple recursion compares
// component lists of unequal length.
const tupleArityAbi = [
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'nonpayable',
    outputs: [],
    inputs: [
      {
        name: 't',
        type: 'tuple',
        components: [{ name: 'x', type: 'uint256' }],
      },
    ],
  },
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'nonpayable',
    outputs: [],
    inputs: [
      {
        name: 't',
        type: 'tuple',
        components: [
          { name: 'x', type: 'uint256' },
          { name: 'y', type: 'uint256' },
        ],
      },
    ],
  },
]
const [tupleArity1, tupleArity2] = tupleArityAbi

/** `foo((uint256,uint256))` / `foo((uint256))` calldata for the args below. */
const twoComponentCalldata = `0xe8f26a69${'0'.repeat(63)}1${'0'.repeat(63)}2`

test('an arg with more values than a tuple has components does not match it', () => {
  expect(isArgOfType([1n, 2n], tupleArity1!.inputs[0] as never)).toBe(false)
  expect(isArgOfType([1n, 2n], tupleArity2!.inputs[0] as never)).toBe(true)
  expect(isArgOfType([1n], tupleArity1!.inputs[0] as never)).toBe(true)
})

test('tuple overloads of different arity resolve by arity, in either ABI order', () => {
  for (const abi of [
    [tupleArity1, tupleArity2],
    [tupleArity2, tupleArity1],
  ]) {
    // Previously: the first order threw a raw TypeError from getAmbiguousTypes,
    // and the second silently encoded foo((uint256)), dropping `2n`.
    expect(
      encodeFunctionData({
        abi: abi as unknown as Abi,
        functionName: 'foo',
        args: [[1n, 2n]],
      } as never),
    ).toBe(twoComponentCalldata)
  }
})

test('getAmbiguousTypes treats component lists of different length as unambiguous', () => {
  expect(
    getAmbiguousTypes(
      tupleArity2!.inputs as never,
      tupleArity1!.inputs as never,
      [[1n, 2n]],
    ),
  ).toBeUndefined()
})
