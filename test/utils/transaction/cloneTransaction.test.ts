import { describe, expect, test } from 'vitest'
import { cloneTransaction } from '../../../src/utils/transaction/cloneTransaction.js'

/** A realistic signable-transaction literal (values are stand-ins). */
function sample() {
  return {
    visible: false,
    txID: 'aa'.repeat(32),
    raw_data: {
      ref_block_bytes: 'b089',
      ref_block_hash: 'd6e2fef4b0f36a24',
      expiration: 1734350000000,
      fee_limit: 1000000000n,
      contract: [
        {
          type: 'TransferContract',
          parameter: {
            type_url: 'type.googleapis.com/protocol.TransferContract',
            value: {
              owner_address: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
              to_address: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
              amount: 1,
            },
          },
        },
      ],
    },
    raw_data_hex: '0a02b089'.repeat(4),
    signature: ['de'.repeat(65)],
  }
}

describe('cloneTransaction', () => {
  test('deep-clones: equal values, no shared references at any level', () => {
    const input = sample()
    const clone = cloneTransaction(input)
    expect(clone).toEqual(input)
    expect(clone).not.toBe(input)
    expect(clone.raw_data).not.toBe(input.raw_data)
    expect(clone.raw_data.contract).not.toBe(input.raw_data.contract)
    expect(clone.raw_data.contract[0]).not.toBe(input.raw_data.contract[0])
    expect(clone.raw_data.contract[0]!.parameter.value).not.toBe(
      input.raw_data.contract[0]!.parameter.value,
    )
    expect(clone.signature).not.toBe(input.signature)
    expect(Array.isArray(clone.raw_data.contract)).toBe(true)
    expect(Array.isArray(clone.signature)).toBe(true)
  })

  test('preserves primitives: string, number, bigint, boolean, null', () => {
    const clone = cloneTransaction({
      s: 'x',
      n: 1,
      big: 2n ** 63n,
      b: false,
      nothing: null,
    })
    expect(clone).toEqual({
      s: 'x',
      n: 1,
      big: 2n ** 63n,
      b: false,
      nothing: null,
    })
  })

  test('reads a getter exactly once and pins its snapshot', () => {
    let reads = 0
    const input = {
      ...sample(),
      get txID() {
        reads++
        return reads === 1 ? 'honest' : 'evil'
      },
    }
    const clone = cloneTransaction(input)
    expect(reads).toBe(1)
    expect(clone.txID).toBe('honest')
    expect(clone.txID).toBe('honest')
    // The accessor is gone — the clone carries a plain data property.
    const descriptor = Object.getOwnPropertyDescriptor(clone, 'txID')
    expect(descriptor?.get).toBeUndefined()
    expect(descriptor?.value).toBe('honest')
  })

  test('defuses a nested getter deep inside raw_data', () => {
    let reads = 0
    const input = sample()
    const value = Object.defineProperty(
      { ...input.raw_data.contract[0]!.parameter.value },
      'amount',
      {
        enumerable: true,
        get() {
          reads++
          return reads === 1 ? 1 : 999
        },
      },
    )
    input.raw_data.contract[0]!.parameter.value = value as never
    const clone = cloneTransaction(input)
    expect(reads).toBe(1)
    expect(clone.raw_data.contract[0]!.parameter.value.amount).toBe(1)
    expect(clone.raw_data.contract[0]!.parameter.value.amount).toBe(1)
  })

  test('an own __proto__ key cannot poison the clone', () => {
    const input = Object.defineProperty(sample(), '__proto__', {
      enumerable: true,
      configurable: true,
      value: { polluted: true },
    })
    const clone = cloneTransaction(input) as Record<string, unknown>
    expect(Object.getPrototypeOf(clone)).toBe(Object.prototype)
    expect(clone.polluted).toBeUndefined()
    // The key survives as an ordinary own data property.
    expect(Object.getOwnPropertyDescriptor(clone, '__proto__')?.value).toEqual({
      polluted: true,
    })
  })

  test('duplicates a shared (diamond) reference instead of rejecting it', () => {
    const shared = { amount: 1 }
    const clone = cloneTransaction({ a: shared, b: shared })
    expect(clone.a).toEqual(shared)
    expect(clone.b).toEqual(shared)
    expect(clone.a).not.toBe(clone.b)
  })

  test('throws on a circular reference', () => {
    const input = sample() as Record<string, unknown>
    input.self = input
    expect(() => cloneTransaction(input)).toThrow(/circular reference/)
  })

  test('throws on a function value — a transaction is data only', () => {
    const input = { ...sample(), toJSON: () => 'lies' }
    expect(() => cloneTransaction(input)).toThrow(/function/)
  })

  test('throws past the nesting-depth limit instead of overflowing', () => {
    // A getter can mint a fresh object on every read, so cycle detection
    // alone cannot bound recursion — the depth cap does.
    let deep: Record<string, unknown> = { leaf: 1 }
    for (let i = 0; i < 100; i++) deep = { deep }
    expect(() => cloneTransaction(deep)).toThrow(/nest/)
  })
})
