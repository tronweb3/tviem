// Type-surface tests for `decodeEventLog` (Track C).
//
// IMPORTANT: `decodeEventLog` is intentionally NON-generic — it takes a plain
// `DecodeEventLogParameters` and returns a fixed `DecodeEventLogReturnType`
// (`args: Record<string, unknown> | readonly unknown[] | undefined`). There is
// therefore NO compile-time inference of the decoded `args` from the abi /
// eventName (unlike the function-data codecs). This file pins that reality and
// then documents — against the real TRON decode-target machinery — what the
// per-parameter primitive types actually are at runtime (address → Base58
// `Address`, integers → bigint, bool → boolean), which is what `args` would be
// were the return type ever made generic. See the returned notes for the gap.
import type { Abi } from 'abitype'
import { expectTypeOf, test } from 'vitest'

import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import {
  type DecodeEventLogParameters,
  type DecodeEventLogReturnType,
  decodeEventLog,
} from './decodeEventLog.js'
import type { TronAbiParameterToPrimitiveType } from './encodeAbiParameters.js'

const trc20Abi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
] as const

test('decodeEventLog return type is the fixed (non-generic) shape', () => {
  const decoded = decodeEventLog({
    abi: trc20Abi,
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ],
    data: '0x',
  })
  expectTypeOf(decoded).toEqualTypeOf<DecodeEventLogReturnType>()
  expectTypeOf(decoded.eventName).toEqualTypeOf<string>()
  expectTypeOf(decoded.args).toEqualTypeOf<
    Record<string, unknown> | readonly unknown[] | undefined
  >()
})

test('decodeEventLog parameter shape', () => {
  // `data` and `eventName` are optional; `abi` and `topics` are required.
  expectTypeOf<DecodeEventLogParameters['abi']>().toEqualTypeOf<
    Abi | readonly unknown[]
  >()
  expectTypeOf<DecodeEventLogParameters['topics']>().toEqualTypeOf<
    readonly Hex[]
  >()
  expectTypeOf<DecodeEventLogParameters['data']>().toEqualTypeOf<
    Hex | undefined
  >()
  expectTypeOf<DecodeEventLogParameters['eventName']>().toEqualTypeOf<
    string | undefined
  >()

  // eventName is required to decode `anonymous` events, but always optional
  // at the type level.
  decodeEventLog({ abi: trc20Abi, topics: [], eventName: 'Transfer' })
  decodeEventLog({ abi: trc20Abi, topics: ['0x'] })
})

test('runtime decode targets: address → Address, indexed/non-indexed', () => {
  // Both indexed (non-hashed) and non-indexed parameters decode through the
  // TRON `outputs` machinery, so `address` → canonical Base58 `Address`.
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'address' }, 'outputs'>
  >().toEqualTypeOf<Address>()
  // non-indexed value: uint256 → bigint
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'uint256' }, 'outputs'>
  >().toEqualTypeOf<bigint>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'bool' }, 'outputs'>
  >().toEqualTypeOf<boolean>()
})
