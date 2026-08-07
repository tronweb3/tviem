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

// An unambiguous tuple parameter must not mask ambiguity in the parameters
// after it. The tuple branch in `getAmbiguousTypes` returned the recursion's
// result unconditionally, so an identical tuple in first position made the
// whole comparison "unambiguous" — foo((uint256),address) vs
// foo((uint256),string) silently resolved instead of throwing.
const tupleThenAmbiguousAbi = [
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
      { name: 'to', type: 'address' },
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
        components: [{ name: 'x', type: 'uint256' }],
      },
      { name: 'to', type: 'string' },
    ],
  },
]

test('an unambiguous tuple does not mask ambiguity in later parameters', () => {
  expect(
    getAmbiguousTypes(
      tupleThenAmbiguousAbi[0]!.inputs as never,
      tupleThenAmbiguousAbi[1]!.inputs as never,
      [[1n], 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
    ),
  ).toEqual(['address', 'string'])
  expect(() =>
    getAbiItem({
      abi: tupleThenAmbiguousAbi as unknown as Abi,
      name: 'foo',
      args: [[1n], 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
    }),
  ).toThrowError(AbiItemAmbiguityError)
})

// getAmbiguousTypes compared array types as opaque strings: `['address[]',
// 'string[]']` matches no pair rule, so foo(address[]) vs foo(string[]) with
// address-like elements silently resolved instead of throwing — the rules
// never saw the element types. Arrays must recurse element-wise, like tuples
// recurse component-wise.
const arrayAmbiguityAbi = [
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'nonpayable',
    outputs: [],
    inputs: [{ name: 'xs', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'nonpayable',
    outputs: [],
    inputs: [{ name: 'xs', type: 'string[]' }],
  },
]

test('throws on an ambiguous address[]/string[] overload for address-like elements', () => {
  expect(() =>
    getAbiItem({
      abi: arrayAmbiguityAbi as unknown as Abi,
      name: 'foo',
      args: [['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC']],
    }),
  ).toThrowError(AbiItemAmbiguityError)
  // A non-address string only matches string[], so the set stays resolvable.
  expect(() =>
    getAbiItem({
      abi: arrayAmbiguityAbi as unknown as Abi,
      name: 'foo',
      args: [['just a string']],
    }),
  ).not.toThrow()
})

test('getAmbiguousTypes recurses into array element types', () => {
  const addr = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'address[]' }],
      [{ name: 'xs', type: 'string[]' }],
      [[addr]],
    ),
  ).toEqual(['address', 'string'])
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'address[]' }],
      [{ name: 'xs', type: 'string[]' }],
      [['just a string']],
    ),
  ).toBeUndefined()
  // TRON: trcToken[] elements encode identically to uint256[] ones.
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'uint256[]' }],
      [{ name: 'xs', type: 'trcToken[]' }] as never,
      [[5n]],
    ),
  ).toEqual(['uint256', 'trcToken'])
  // Fixed-size arrays recurse the same way.
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'address[2]' }],
      [{ name: 'xs', type: 'bytes20[2]' }] as never,
      [[addr, addr]],
    ),
  ).toEqual(['address', 'bytes20'])
  // Nested arrays strip one level per recursion, so T[][] reaches T — an
  // implementation stripping a single level would stop at 'address[]' vs
  // 'string[]' and miss this.
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'address[][]' }],
      [{ name: 'xs', type: 'string[][]' }],
      [[[addr]]],
    ),
  ).toEqual(['address', 'string'])
  // An unambiguous array must not mask ambiguity in later parameters.
  expect(
    getAmbiguousTypes(
      [
        { name: 'xs', type: 'uint256[]' },
        { name: 'to', type: 'address' },
      ],
      [
        { name: 'xs', type: 'uint256[]' },
        { name: 'to', type: 'bytes20' },
      ] as never,
      [[1n], addr],
    ),
  ).toEqual(['address', 'bytes20'])
})

test('an empty array still flags arg-independent element ambiguity', () => {
  // address/bytes20 is ambiguous regardless of the argument, so an empty
  // array (which matches both overloads and carries no signal) stays
  // ambiguous too…
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'address[]' }],
      [{ name: 'xs', type: 'bytes20[]' }] as never,
      [[]],
    ),
  ).toEqual(['address', 'bytes20'])
  // …while arg-dependent pairs have no element to justify ambiguity.
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'address[]' }],
      [{ name: 'xs', type: 'string[]' }],
      [[]],
    ),
  ).toBeUndefined()
  expect(
    getAmbiguousTypes(
      [{ name: 'xs', type: 'uint256[]' }],
      [{ name: 'xs', type: 'trcToken[]' }] as never,
      [[]],
    ),
  ).toBeUndefined()
})

test('tuple arrays recurse into components per element', () => {
  const sourceInputs = [
    {
      name: 'ts',
      type: 'tuple[]',
      components: [{ name: 'a', type: 'address' }],
    },
  ]
  const targetInputs = [
    {
      name: 'ts',
      type: 'tuple[]',
      components: [{ name: 'a', type: 'string' }],
    },
  ]
  expect(
    getAmbiguousTypes(sourceInputs as never, targetInputs as never, [
      [['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC']],
    ]),
  ).toEqual(['address', 'string'])
  // An empty tuple[] arg must not crash the component recursion.
  expect(
    getAmbiguousTypes(sourceInputs as never, targetInputs as never, [[]]),
  ).toBeUndefined()
})

// isArgOfType's array detection regex ([a-z]+[1-9]{0,3}) rejected element
// widths containing a 0 digit — uint160[], bytes20[] — so such args never
// structurally matched and getAbiItem fell back to the first overload. And a
// fixed-size array never checked its length, so two values "matched"
// address[3].
test('isArgOfType accepts widths containing 0 and enforces fixed array length', () => {
  expect(isArgOfType([1n], { type: 'uint160[]' })).toBe(true)
  expect(
    isArgOfType(['0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'], {
      type: 'bytes20[]',
    }),
  ).toBe(true)
  expect(isArgOfType([1n, 2n], { type: 'uint256[3]' })).toBe(false)
  expect(isArgOfType([1n, 2n, 3n], { type: 'uint256[3]' })).toBe(true)
  // Multi-dimensional: every level enforces its own length.
  expect(
    isArgOfType(
      [
        [1n, 2n],
        [3n, 4n],
        [5n, 6n],
      ],
      { type: 'uint256[2][3]' },
    ),
  ).toBe(true)
  expect(
    isArgOfType([[1n], [3n, 4n], [5n, 6n]], { type: 'uint256[2][3]' }),
  ).toBe(false)
})

test('a uint160[] arg resolves its overload instead of falling back', () => {
  const abi = [
    {
      type: 'function',
      name: 'foo',
      stateMutability: 'nonpayable',
      outputs: [],
      inputs: [{ name: 'x', type: 'bool' }],
    },
    {
      type: 'function',
      name: 'foo',
      stateMutability: 'nonpayable',
      outputs: [],
      inputs: [{ name: 'xs', type: 'uint160[]' }],
    },
  ]
  const item = getAbiItem({
    abi: abi as unknown as Abi,
    name: 'foo',
    args: [[1n]],
  })
  expect(
    (item as unknown as { inputs: readonly { type: string }[] }).inputs[0]!
      .type,
  ).toBe('uint160[]')
})

test('fixed-size array overloads resolve by length, in either ABI order', () => {
  const two = {
    type: 'function',
    name: 'foo',
    stateMutability: 'nonpayable',
    outputs: [],
    inputs: [{ name: 'xs', type: 'address[2]' }],
  }
  const three = {
    ...two,
    inputs: [{ name: 'xs', type: 'address[3]' }],
  }
  const addr = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
  for (const abi of [
    [two, three],
    [three, two],
  ]) {
    const item = getAbiItem({
      abi: abi as unknown as Abi,
      name: 'foo',
      args: [[addr, addr, addr]],
    })
    expect(
      (item as unknown as { inputs: readonly { type: string }[] }).inputs[0]!
        .type,
    ).toBe('address[3]')
  }
})

// With bytes20[] matchable, the address[]/bytes20[] pair is reachable
// end-to-end — and like its scalar counterpart it must throw.
test('throws on an ambiguous address[]/bytes20[] overload', () => {
  const abi = [
    {
      type: 'function',
      name: 'foo',
      stateMutability: 'nonpayable',
      outputs: [],
      inputs: [{ name: 'xs', type: 'address[]' }],
    },
    {
      type: 'function',
      name: 'foo',
      stateMutability: 'nonpayable',
      outputs: [],
      inputs: [{ name: 'xs', type: 'bytes20[]' }],
    },
  ]
  expect(() =>
    getAbiItem({
      abi: abi as unknown as Abi,
      name: 'foo',
      args: [['0x2b5ad5c4795c026514f8317c7a215e218dccd6cf']],
    }),
  ).toThrowError(AbiItemAmbiguityError)
})

test('a tuple whose own components are ambiguous still reports the inner pair', () => {
  expect(
    getAmbiguousTypes(
      [
        {
          name: 't',
          type: 'tuple',
          components: [{ name: 'a', type: 'address' }],
        },
      ] as never,
      [
        {
          name: 't',
          type: 'tuple',
          components: [{ name: 'a', type: 'string' }],
        },
      ] as never,
      [['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC']],
    ),
  ).toEqual(['address', 'string'])
})
