import { expectTypeOf, test } from 'vitest'
import { generatePrivateKey } from '../../src/accounts/generatePrivateKey.js'
import { privateKeyToAccount } from '../../src/accounts/privateKeyToAccount.js'
import { toAccount } from '../../src/accounts/toAccount.js'
import type {
  SignableTransaction,
  TronAccount,
  TronCustomAccount,
  TronCustomSource,
  TronLocalAccount,
} from '../../src/accounts/types.js'
import type { Address } from '../../src/types/address.js'
import type { Hex } from '../../src/types/misc.js'
import type { Signature } from '../../src/utils/signature/sign.js'
import type { RawData } from '../../src/utils/transaction/serializeRawData.js'

test('privateKeyToAccount returns a TronLocalAccount', () => {
  const account = privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
  expectTypeOf(account).toEqualTypeOf<TronLocalAccount>()
})

test('account fields are branded/narrowed', () => {
  const account = privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
  expectTypeOf(account.address).toEqualTypeOf<Address>()
  expectTypeOf(account.publicKey).toEqualTypeOf<Hex>()
  expectTypeOf(account.source).toEqualTypeOf<'privateKey'>()
  expectTypeOf(account.type).toEqualTypeOf<'local'>()
})

test('signing methods are synchronous and return a TRON-wire Signature', () => {
  const account = privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
  expectTypeOf(
    account.signMessage({ message: 'gm' }),
  ).toEqualTypeOf<Signature>()
  const transaction: SignableTransaction = {
    txID: 'ab',
    raw_data: {} as RawData,
    raw_data_hex: 'ab',
  }
  expectTypeOf(
    account.signTransaction(transaction),
  ).toEqualTypeOf<SignableTransaction>()
})

test('SignableTransaction requires the full triple — partial forms are a type error', () => {
  const account = privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
  // @ts-expect-error a bare txID (blind signing) is no longer assignable
  account.signTransaction({ txID: 'ab' })
  // @ts-expect-error raw_data alone is not assignable
  account.signTransaction({ raw_data: {} as RawData })
  // @ts-expect-error txID + raw_data without raw_data_hex is not assignable
  account.signTransaction({ txID: 'ab', raw_data: {} as RawData })
})

test('signMessage accepts both string and { raw } messages', () => {
  const account = privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
  account.signMessage({ message: 'gm' })
  account.signMessage({ message: { raw: '0xdead' } })
  account.signMessage({ message: { raw: new Uint8Array([1]) } })
})

test('a local account is assignable to the account union', () => {
  const account = privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
  expectTypeOf(account).toMatchTypeOf<TronAccount>()
})

test('generatePrivateKey returns a Hex', () => {
  expectTypeOf(generatePrivateKey()).toEqualTypeOf<Hex>()
})

test('toAccount overloads: private key → local, source → custom', () => {
  expectTypeOf(toAccount('0x01')).toEqualTypeOf<TronLocalAccount>()
  const source = {} as TronCustomSource
  expectTypeOf(toAccount(source)).toEqualTypeOf<TronCustomAccount>()
  expectTypeOf(toAccount(source)).toMatchTypeOf<TronAccount>()
})
