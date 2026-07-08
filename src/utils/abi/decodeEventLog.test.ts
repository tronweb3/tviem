import type { Abi } from 'abitype'
import { describe, expect, test } from 'vitest'

import {
  type FixtureParameter,
  loadEventFixtures,
  reviveValue,
} from '../../../test/fixtures/abi/loader.js'
import { DecodeLogDataMismatch } from '../../errors/abi.js'
import { decodeEventLog } from './decodeEventLog.js'

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
      '0xf8f25ebd5cf5b7fb3f96c413240e193a33c56f3abaf481da6bff7bfb5364c132',
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
