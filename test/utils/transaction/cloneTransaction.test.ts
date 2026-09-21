import { describe, expect, test } from 'vitest'
import { cloneTransaction } from '../../../src/utils/transaction/cloneTransaction.js'

const LEVELS = 60

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

  test('fails loudly on a DAG whose duplicated expansion is exponential', () => {
    // Shared references are duplicated by design (see the diamond test), so
    // a chain of levels that each point at the next one TWICE — 60 objects in
    // all, no cycle, well inside the depth cap — expands to 2^60 copies. It
    // must be refused like the other hostile shapes, not cloned until the
    // process runs out of memory.
    let node: Record<string, unknown> = { leaf: 1 }
    for (let i = 0; i < LEVELS; i++) node = { a: node, b: node }
    expect(() => cloneTransaction(node)).toThrow(/too large/)
  })

  test('the size cap leaves a large but plausible transaction alone', () => {
    // A deployment carrying a 3000-entry ABI — far past any real contract —
    // is ~51k values. The cap exists for exponential shapes, not big inputs.
    const abi = Array.from({ length: 3000 }, (_, i) => ({
      type: 'Function',
      name: `f${i}`,
      stateMutability: 'Nonpayable',
      inputs: [
        { name: 'a', type: 'address' },
        { name: 'b', type: 'uint256' },
        { name: 'c', type: 'bytes32' },
      ],
      outputs: [{ type: 'bool' }],
    }))
    expect(cloneTransaction({ abi })).toEqual({ abi })
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

  test('recognizes a Uint8Array from another realm', async () => {
    // `instanceof Uint8Array` is false for bytes created in another realm
    // (iframe, `node:vm`), which used to drop them into the plain-object
    // branch — the same `{0:…}` mangling as an unrecognized Uint8Array.
    const vm = await import('node:vm')
    const foreign = vm.runInNewContext(
      'new Uint8Array([0xde, 0xad, 0xbe, 0xef])',
    ) as Uint8Array
    expect(foreign instanceof Uint8Array).toBe(false) // the trap being tested
    const clone = cloneTransaction({ account_name: foreign })
    expect(clone.account_name).toBeInstanceOf(Uint8Array)
    expect([...clone.account_name]).toEqual([0xde, 0xad, 0xbe, 0xef])
  })

  test('refuses non-Uint8Array binary views instead of mangling them', () => {
    // An Int8Array or DataView is not transaction data; snapshotting it into
    // a plain object would hand the serializer a shape it misreads.
    expect(() => cloneTransaction({ x: new Int8Array([1]) })).toThrow(
      'binary data must be a Uint8Array',
    )
    expect(() =>
      cloneTransaction({ x: new DataView(new ArrayBuffer(2)) }),
    ).toThrow('binary data must be a Uint8Array')
  })

  test('copies a Uint8Array as a Uint8Array, not as a plain object', () => {
    // Contract `bytes` fields accept raw bytes on the encode side. A
    // plain-object copy (`{0:…,1:…}`) reaches the serializer as something it
    // cannot encode, so the snapshot would serialize to different bytes than
    // the caller supplied — or fail outright.
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const clone = cloneTransaction({ account_name: bytes })
    expect(clone.account_name).toBeInstanceOf(Uint8Array)
    expect(clone.account_name).toEqual(bytes)
    expect(clone.account_name).not.toBe(bytes)
  })

  test('throws past the nesting-depth limit instead of overflowing', () => {
    // A getter can mint a fresh object on every read, so cycle detection
    // alone cannot bound recursion — the depth cap does.
    let deep: Record<string, unknown> = { leaf: 1 }
    for (let i = 0; i < 100; i++) deep = { deep }
    expect(() => cloneTransaction(deep)).toThrow(/nest/)
  })
})
