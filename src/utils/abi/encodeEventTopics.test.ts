import type { Abi } from 'abitype'
import { describe, expect, test } from 'vitest'

import {
  loadEventFixtures,
  reviveValue,
} from '../../../test/fixtures/abi/loader.js'
import { AbiEventNotFoundError } from '../../errors/abi.js'
import { encodeEventTopics } from './encodeEventTopics.js'

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
      args: { tag: 'hello omni' },
    })
    expect(topics[1]).toBe(
      '0xf8f25ebd5cf5b7fb3f96c413240e193a33c56f3abaf481da6bff7bfb5364c132',
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
