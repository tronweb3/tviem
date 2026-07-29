import type { Abi } from 'abitype'
import { describe, expect, test } from 'vitest'
import { AbiEventNotFoundError } from '../../../src/errors/abi.js'
import { FilterTypeNotSupportedError } from '../../../src/errors/log.js'
import { encodeEventTopics } from '../../../src/utils/abi/encodeEventTopics.js'
import { loadEventFixtures, reviveValue } from '../../fixtures/abi/loader.js'

const fixtures = loadEventFixtures()

/** Builds a name-keyed args object from a fixture's positional args. */
function namedArgs(
  fixture: (typeof fixtures)[number],
): Record<string, unknown> {
  const inputs = fixture.abi[0]!.inputs
  return Object.fromEntries(
    inputs.map((input, i) => [
      input.name!,
      reviveValue(input, fixture.args[i]!),
    ]),
  )
}

describe('encodeEventTopics (gold fixtures)', () => {
  test.each(
    fixtures.map((fixture) => [fixture.name, fixture] as const),
  )('%s builds byte-exact topics', (_name, fixture) => {
    const topics = encodeEventTopics({
      abi: fixture.abi as unknown as Abi,
      eventName: fixture.eventName,
      args: namedArgs(fixture),
    })
    expect(topics).toEqual(fixture.topics)
  })

  test('covers all 7 gold vectors', () => {
    expect(fixtures.length).toBe(7)
  })
})

describe('encodeEventTopics (units)', () => {
  const transfer = fixtures.find((f) => f.name === 'transfer')!

  test('Transfer selector is the §2.4 topic0', () => {
    const topics = encodeEventTopics({
      abi: transfer.abi as unknown as Abi,
      eventName: 'Transfer',
      args: namedArgs(transfer),
    })
    expect(topics[0]).toBe(
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    )
  })

  test('emits only the selector when no args are given', () => {
    const topics = encodeEventTopics({
      abi: transfer.abi as unknown as Abi,
      eventName: 'Transfer',
    })
    expect(topics).toEqual([
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ])
  })

  test('null / partial args leave topic wildcards', () => {
    const topics = encodeEventTopics({
      abi: transfer.abi as unknown as Abi,
      eventName: 'Transfer',
      args: { to: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' },
    })
    expect(topics).toEqual([
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      null,
      '0x0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf',
    ])
  })

  test('hashes an indexed string over its raw bytes', () => {
    const memo = fixtures.find((f) => f.name === 'indexed-string')!
    const topics = encodeEventTopics({
      abi: memo.abi as unknown as Abi,
      eventName: 'Memo',
      args: { tag: 'hello test' },
    })
    expect(topics[1]).toBe(
      '0xaa73c1da4a1ef9448c89bb344bc368ba7eb1912a01eb6f4e4df9d940b1cf2caa',
    )
  })

  test('anonymous events have no selector topic', () => {
    const anon = fixtures.find((f) => f.name === 'anonymous')!
    const topics = encodeEventTopics({
      abi: anon.abi as unknown as Abi,
      eventName: 'Ping',
      args: namedArgs(anon),
    })
    expect(topics).toEqual(anon.topics)
    expect(topics[0]).not.toBe(
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    )
  })

  test('throws when the event is not on the ABI', () => {
    expect(() =>
      encodeEventTopics({
        abi: transfer.abi as unknown as Abi,
        eventName: 'Nope',
      }),
    ).toThrow(AbiEventNotFoundError)
  })
})

describe('OR-list filter values (a topic alternative list per viem LogTopic)', () => {
  const A1 = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
  const A2 = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'
  const A1_TOPIC =
    '0x0000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf'
  const A2_TOPIC =
    '0x0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf'
  const transferAbi = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
  ]

  test('multiple addresses become a topic alternative list', () => {
    const topics = encodeEventTopics({
      abi: transferAbi as unknown as Abi,
      eventName: 'Transfer',
      args: { from: [A1, A2] },
    })
    expect(topics).toEqual([
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      [A1_TOPIC, A2_TOPIC],
      null,
    ])
  })

  test('uint OR-lists encode each alternative to its own word', () => {
    const abi = [
      {
        type: 'event',
        name: 'Val',
        inputs: [{ name: 'v', type: 'uint256', indexed: true }],
      },
    ]
    const topics = encodeEventTopics({
      abi: abi as unknown as Abi,
      eventName: 'Val',
      args: { v: [1n, 2n] },
    })
    expect(topics[1]).toEqual([
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    ])
  })

  test('string OR-lists hash per element', () => {
    const abi = [
      {
        type: 'event',
        name: 'Memo',
        inputs: [{ name: 'tag', type: 'string', indexed: true }],
      },
    ]
    const topics = encodeEventTopics({
      abi: abi as unknown as Abi,
      eventName: 'Memo',
      args: { tag: ['a', 'b'] },
    })
    const list = topics[1] as string[]
    expect(list).toHaveLength(2)
    for (const topic of list) expect(topic).toMatch(/^0x[0-9a-f]{64}$/)
    expect(list[0]).not.toBe(list[1])
  })
})

describe('indexed array/tuple parameters are not filterable', () => {
  // Solidity hashes indexed reference types over a NON-standard in-place
  // encoding, so a topic cannot be derived from the standard ABI encoding —
  // refuse (viem parity) rather than compute a hash that never matches.
  test.each([
    ['uint256[]', [1n, 2n]],
    ['address[2]', ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC']],
  ])('indexed %s throws FilterTypeNotSupportedError', (type, value) => {
    const abi = [
      {
        type: 'event',
        name: 'Arr',
        inputs: [{ name: 'xs', type, indexed: true }],
      },
    ]
    expect(() =>
      encodeEventTopics({
        abi: abi as unknown as Abi,
        eventName: 'Arr',
        args: { xs: value },
      }),
    ).toThrow(FilterTypeNotSupportedError)
  })

  test('indexed tuple throws FilterTypeNotSupportedError', () => {
    const abi = [
      {
        type: 'event',
        name: 'Tup',
        inputs: [
          {
            name: 's',
            type: 'tuple',
            indexed: true,
            components: [
              { name: 'a', type: 'string' },
              { name: 'b', type: 'uint256' },
            ],
          },
        ],
      },
    ]
    expect(() =>
      encodeEventTopics({
        abi: abi as unknown as Abi,
        eventName: 'Tup',
        args: { s: { a: 'hi', b: 5n } },
      }),
    ).toThrow(FilterTypeNotSupportedError)
  })

  test('a wildcard (no value) for an array-typed indexed param is fine', () => {
    const abi = [
      {
        type: 'event',
        name: 'Arr',
        inputs: [{ name: 'xs', type: 'uint256[]', indexed: true }],
      },
    ]
    expect(
      encodeEventTopics({ abi: abi as unknown as Abi, eventName: 'Arr' }),
    ).toHaveLength(1)
  })
})
