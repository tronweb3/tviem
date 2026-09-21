import { expectTypeOf, test } from 'vitest'
import type {
  AccountKey,
  SignableTransaction,
  TronAccount,
} from '../../../src/accounts/types.js'
import type { MultiSignParameters } from '../../../src/actions/wallet/multiSign.js'

test('permissionId accepts an explicitly undefined value', () => {
  // `exactOptionalPropertyTypes` is on, so `permissionId?: number` — without
  // the `| undefined` every other declaration of this field spells out —
  // rejects the natural forwarding pattern: a wrapper re-exposing its own
  // optional id holds `number | undefined`, not `number`.
  expectTypeOf<{ permissionId: number | undefined }>().toExtend<
    Pick<MultiSignParameters, 'permissionId'>
  >()
})

test('takes an `account` like the sibling sign actions, and needs no privateKey', () => {
  // A client with a hoisted account co-signs with just the transaction.
  expectTypeOf<{
    transaction: SignableTransaction
  }>().toExtend<MultiSignParameters>()
  expectTypeOf<{
    transaction: SignableTransaction
    account: TronAccount | AccountKey | undefined
  }>().toExtend<MultiSignParameters>()
  // The original raw-key calling convention still type-checks.
  expectTypeOf<{
    transaction: SignableTransaction
    privateKey: string
    permissionId: number
  }>().toExtend<MultiSignParameters>()
})
