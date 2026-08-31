import { expectTypeOf, test } from 'vitest'
import type {
  AccountKey,
  TronAccount,
  TronLocalAccount,
} from '../../src/accounts/types.js'
import { type ParseAccount, parseAccount } from '../../src/types/account.js'
import type { Hex } from '../../src/types/misc.js'

// pk=1, in both accepted input forms.
const pk0x =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const pkBare =
  '0000000000000000000000000000000000000000000000000000000000000001'

test('AccountKey: both private-key string forms are assignable', () => {
  expectTypeOf(pk0x).toExtend<AccountKey>()
  expectTypeOf(pkBare).toExtend<AccountKey>()
  expectTypeOf<Hex>().toExtend<AccountKey>()
  expectTypeOf<string>().toExtend<AccountKey>()
})

test('parseAccount: either private-key form resolves to TronLocalAccount', () => {
  expectTypeOf(parseAccount(pk0x)).toEqualTypeOf<TronLocalAccount>()
  expectTypeOf(parseAccount(pkBare)).toEqualTypeOf<TronLocalAccount>()
})

test('parseAccount: an already-built account passes through unchanged', () => {
  const account = {} as TronLocalAccount
  expectTypeOf(parseAccount(account)).toEqualTypeOf<TronLocalAccount>()
})

test('parseAccount: non-string sources that are not accounts are rejected', () => {
  // @ts-expect-error a number is not an account source
  parseAccount(123)
})

test('ParseAccount: string sources infer TronLocalAccount; the rest pass through', () => {
  expectTypeOf<ParseAccount<typeof pkBare>>().toEqualTypeOf<TronLocalAccount>()
  expectTypeOf<ParseAccount<Hex>>().toEqualTypeOf<TronLocalAccount>()
  expectTypeOf<ParseAccount<AccountKey>>().toEqualTypeOf<TronLocalAccount>()
  expectTypeOf<ParseAccount<TronAccount>>().toEqualTypeOf<TronAccount>()
  expectTypeOf<ParseAccount<undefined>>().toEqualTypeOf<undefined>()
})
