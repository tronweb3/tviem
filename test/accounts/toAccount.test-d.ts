import { expectTypeOf, test } from 'vitest'
import { toAccount } from '../../src/accounts/toAccount.js'
import type {
  TronCustomAccount,
  TronCustomSource,
  TronLocalAccount,
} from '../../src/accounts/types.js'
import type { Hex } from '../../src/types/misc.js'

// pk=1, in both accepted input forms.
const pk0x =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const pkBare =
  '0000000000000000000000000000000000000000000000000000000000000001'

test('toAccount: hex private-key branch → TronLocalAccount', () => {
  // Overload 1: `toAccount(source: Hex | string): TronLocalAccount`
  expectTypeOf(toAccount(pk0x)).toEqualTypeOf<TronLocalAccount>()
  expectTypeOf(toAccount(pkBare)).toEqualTypeOf<TronLocalAccount>()

  // a `Hex`-branded literal also selects the private-key overload
  const hex: Hex = pk0x
  expectTypeOf(toAccount(hex)).toEqualTypeOf<TronLocalAccount>()

  // the private-key branch is NOT the custom branch
  expectTypeOf(toAccount(pk0x)).not.toEqualTypeOf<TronCustomAccount>()
})

test('toAccount: custom-source branch → TronCustomAccount', () => {
  // Overload 2: `toAccount(source: TronCustomSource): TronCustomAccount`
  const source = {} as TronCustomSource
  expectTypeOf(toAccount(source)).toEqualTypeOf<TronCustomAccount>()

  // the custom branch is NOT the private-key branch
  expectTypeOf(toAccount(source)).not.toEqualTypeOf<TronLocalAccount>()
})

test('toAccount: the two branches carry distinct `source` discriminants', () => {
  expectTypeOf<TronLocalAccount['source']>().toEqualTypeOf<'privateKey'>()
  expectTypeOf<TronCustomAccount['source']>().toEqualTypeOf<'custom'>()

  // both share the `type: 'local'` discriminant
  expectTypeOf<TronLocalAccount['type']>().toEqualTypeOf<'local'>()
  expectTypeOf<TronCustomAccount['type']>().toEqualTypeOf<'local'>()
})

test('toAccount: both returns retain the shared signing surface', () => {
  const local = toAccount(pk0x)
  const custom = toAccount({} as TronCustomSource)

  // both expose the TronCustomSource surface
  expectTypeOf(local).toExtend<TronCustomSource>()
  expectTypeOf(custom).toExtend<TronCustomSource>()
})
