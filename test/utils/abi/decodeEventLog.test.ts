import type { Abi } from 'abitype'
import { describe, expect, test } from 'vitest'
import {
  AbiEventSignatureNotFoundError,
  DecodeLogDataMismatch,
} from '../../../src/errors/abi.js'
import { decodeEventLog } from '../../../src/utils/abi/decodeEventLog.js'
import { toEventSelector } from '../../../src/utils/hash/toEventSelector.js'
import {
  type FixtureParameter,
  loadEventFixtures,
  reviveValue,
} from '../../fixtures/abi/loader.js'

const fixtures = loadEventFixtures()

/** Builds the expected name-keyed args from a fixture's `decoded` block. */
function expectedArgs(
  fixture: (typeof fixtures)[number],
): Record<string, unknown> {
  const byName = new Map<string, FixtureParameter>(
    fixture.abi[0]!.inputs.map((input) => [input.name!, input]),
  )
  return Object.fromEntries(
    Object.entries(fixture.decoded).map(([name, value]) => [
      name,
      reviveValue(byName.get(name)!, value),
    ]),
  )
}

describe('decodeEventLog (gold fixtures)', () => {
  test.each(
    fixtures.map((fixture) => [fixture.name, fixture] as const),
  )('%s decodes deep-equal', (_name, fixture) => {
    const { eventName, args } = decodeEventLog({
      abi: fixture.abi as unknown as Abi,
      topics: fixture.topics,
      data: fixture.data,
      eventName: fixture.eventName,
    })
    expect(eventName).toBe(fixture.eventName)
    expect(args).toEqual(expectedArgs(fixture))
  })

  test('covers all 7 gold vectors', () => {
    expect(fixtures.length).toBe(7)
  })
})

describe('decodeEventLog (units)', () => {
  const transfer = fixtures.find((f) => f.name === 'transfer')!

  test('resolves the event from topic0 without an eventName', () => {
    const { eventName, args } = decodeEventLog({
      abi: transfer.abi as unknown as Abi,
      topics: transfer.topics,
      data: transfer.data,
    })
    expect(eventName).toBe('Transfer')
    // Indexed addresses decode to canonical Base58Check (`T…`).
    expect((args as Record<string, unknown>).from).toBe(
      'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
    )
    expect((args as Record<string, unknown>).to).toBe(
      'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
    )
    expect((args as Record<string, unknown>).value).toBe(1000000n)
  })

  test('indexed dynamic parameters decode to their keccak256 hash hex', () => {
    const memo = fixtures.find((f) => f.name === 'indexed-string')!
    const { args } = decodeEventLog({
      abi: memo.abi as unknown as Abi,
      topics: memo.topics,
      data: memo.data,
      eventName: 'Memo',
    })
    expect((args as Record<string, unknown>).tag).toBe(
      '0xaa73c1da4a1ef9448c89bb344bc368ba7eb1912a01eb6f4e4df9d940b1cf2caa',
    )
  })

  test('throws when non-indexed data is missing', () => {
    expect(() =>
      decodeEventLog({
        abi: transfer.abi as unknown as Abi,
        topics: transfer.topics,
        data: '0x',
        eventName: 'Transfer',
      }),
    ).toThrow(DecodeLogDataMismatch)
  })

  test('throws when non-indexed data is truncated', () => {
    expect(() =>
      decodeEventLog({
        abi: transfer.abi as unknown as Abi,
        topics: transfer.topics,
        data: '0x0001',
        eventName: 'Transfer',
      }),
    ).toThrow()
  })
})

describe('eventName is validated against topic0 (the log identity)', () => {
  const bothAbi = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
    {
      type: 'event',
      name: 'Approval',
      inputs: [
        { name: 'owner', type: 'address', indexed: true },
        { name: 'spender', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
      ],
    },
  ]
  const A1_TOPIC =
    '0x0000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf'
  const A2_TOPIC =
    '0x0000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf'
  const TRANSFER_SELECTOR =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  const APPROVAL_SELECTOR =
    '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
  const data =
    '0x000000000000000000000000000000000000000000000000000000000000007b'

  test('a log of a DIFFERENT event never decodes under the given name', () => {
    // topic0 is an Approval selector; naming it 'Transfer' must throw, not
    // silently relabel the log.
    expect(() =>
      decodeEventLog({
        abi: bothAbi as unknown as Abi,
        eventName: 'Transfer',
        topics: [APPROVAL_SELECTOR, A1_TOPIC, A2_TOPIC],
        data,
      }),
    ).toThrow(AbiEventSignatureNotFoundError)
  })

  test('the matching selector decodes under its name', () => {
    const decoded = decodeEventLog({
      abi: bothAbi as unknown as Abi,
      eventName: 'Transfer',
      topics: [TRANSFER_SELECTOR, A1_TOPIC, A2_TOPIC],
      data,
    })
    expect(decoded.eventName).toBe('Transfer')
    expect((decoded.args as { value: bigint }).value).toBe(123n)
  })
})

// The non-indexed write-back must map by POSITION. `nonIndexedInputs` comes
// from `inputs.filter(...)`, so when one AbiParameter object is reused at two
// positions — legal, and natural when an ABI is built from shared parameter
// constants — an identity lookup resolves both occurrences to the first slot.
describe('non-indexed parameters map by position, not object identity', () => {
  const amount = { type: 'uint256' } as const
  const word = (n: number) => n.toString(16).padStart(64, '0')

  test('a reused parameter object still decodes each slot', () => {
    const abi = [
      { type: 'event', name: 'Pair', inputs: [amount, amount] },
    ] as unknown as Abi
    const { args } = decodeEventLog({
      abi,
      topics: [toEventSelector('Pair(uint256,uint256)')],
      data: `0x${word(11)}${word(22)}`,
    })
    // Identity mapping returned [11n, 11n]: the second slot was never read.
    expect(args).toStrictEqual([11n, 22n])
  })

  test('a reused parameter object interleaved with an indexed one', () => {
    const abi = [
      {
        type: 'event',
        name: 'Mixed',
        inputs: [amount, { type: 'address', indexed: true }, amount],
      },
    ] as unknown as Abi
    const holder = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
    const { args } = decodeEventLog({
      abi,
      topics: [
        toEventSelector('Mixed(uint256,address,uint256)'),
        `0x${'00'.repeat(12)}${holder.slice(2)}`,
      ],
      data: `0x${word(11)}${word(22)}`,
    })
    expect((args as unknown[])[0]).toBe(11n)
    expect((args as unknown[])[2]).toBe(22n)
  })
})
