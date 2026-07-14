import { expectTypeOf, test } from 'vitest'

import type { Address } from '../types/address.js'
import type { ByteArray, Hex, SignableMessage } from '../types/misc.js'
import type { Signature } from '../utils/signature/sign.js'
import { privateKeyToAccount } from './privateKeyToAccount.js'
import type {
  AccountSignMessageParameters,
  AccountSignParameters,
  AccountSignTypedDataParameters,
  SignableTransaction,
  TronLocalAccount,
} from './types.js'

// pk=1, in both accepted input forms.
const pk0x =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const pkBare =
  '0000000000000000000000000000000000000000000000000000000000000001'

test('privateKeyToAccount: parameter accepts 0x-prefixed and bare hex', () => {
  // `Hex | string` collapses to `string`, so both forms are assignable.
  expectTypeOf(privateKeyToAccount).parameter(0).toEqualTypeOf<Hex | string>()
  expectTypeOf<Hex>().toExtend<Parameters<typeof privateKeyToAccount>[0]>()
  expectTypeOf<string>().toExtend<Parameters<typeof privateKeyToAccount>[0]>()
})

test('privateKeyToAccount: returns a TronLocalAccount for either input form', () => {
  expectTypeOf(privateKeyToAccount(pk0x)).toEqualTypeOf<TronLocalAccount>()
  expectTypeOf(privateKeyToAccount(pkBare)).toEqualTypeOf<TronLocalAccount>()
  expectTypeOf(privateKeyToAccount).returns.toEqualTypeOf<TronLocalAccount>()
})

test('privateKeyToAccount: address / publicKey field types', () => {
  const account = privateKeyToAccount(pk0x)

  expectTypeOf(account.address).toEqualTypeOf<Address>()
  expectTypeOf(account.publicKey).toEqualTypeOf<Hex>()

  // discriminants
  expectTypeOf(account.source).toEqualTypeOf<'privateKey'>()
  expectTypeOf(account.type).toEqualTypeOf<'local'>()
})

test('privateKeyToAccount: sign method signature', () => {
  const account = privateKeyToAccount(pk0x)

  expectTypeOf(account.sign).toEqualTypeOf<
    (parameters: AccountSignParameters) => Signature
  >()
  expectTypeOf(account.sign).parameter(0).toEqualTypeOf<AccountSignParameters>()
  expectTypeOf(account.sign).returns.toEqualTypeOf<Signature>()

  // the digest input is `Hex | ByteArray`
  expectTypeOf<AccountSignParameters['hash']>().toEqualTypeOf<Hex | ByteArray>()
})

test('privateKeyToAccount: signMessage method signature', () => {
  const account = privateKeyToAccount(pk0x)

  expectTypeOf(account.signMessage).toEqualTypeOf<
    (parameters: AccountSignMessageParameters) => Signature
  >()
  expectTypeOf(account.signMessage)
    .parameter(0)
    .toEqualTypeOf<AccountSignMessageParameters>()
  expectTypeOf(account.signMessage).returns.toEqualTypeOf<Signature>()

  // the message input is the `SignableMessage` union
  expectTypeOf<
    AccountSignMessageParameters['message']
  >().toEqualTypeOf<SignableMessage>()
})

test('privateKeyToAccount: signTypedData method signature', () => {
  const account = privateKeyToAccount(pk0x)

  expectTypeOf(account.signTypedData).toEqualTypeOf<
    (parameters: AccountSignTypedDataParameters) => Signature
  >()
  expectTypeOf(account.signTypedData)
    .parameter(0)
    .toEqualTypeOf<AccountSignTypedDataParameters>()
  expectTypeOf(account.signTypedData).returns.toEqualTypeOf<Signature>()
})

test('privateKeyToAccount: signTransaction method signature', () => {
  const account = privateKeyToAccount(pk0x)

  expectTypeOf(account.signTransaction).toEqualTypeOf<
    (transaction: SignableTransaction) => SignableTransaction
  >()
  expectTypeOf(account.signTransaction)
    .parameter(0)
    .toEqualTypeOf<SignableTransaction>()
  expectTypeOf(
    account.signTransaction,
  ).returns.toEqualTypeOf<SignableTransaction>()
})

test('privateKeyToAccount: returned Signature shape (r/s/v/hex/serialized)', () => {
  const sig = privateKeyToAccount(pk0x).sign({ hash: pk0x })

  expectTypeOf(sig).toEqualTypeOf<Signature>()
  expectTypeOf(sig.r).toEqualTypeOf<Hex>()
  expectTypeOf(sig.s).toEqualTypeOf<Hex>()
  expectTypeOf(sig.v).toEqualTypeOf<number>()
  expectTypeOf(sig.recovery).toEqualTypeOf<number>()
  expectTypeOf(sig.hex).toEqualTypeOf<string>()
  expectTypeOf(sig.serialized).toEqualTypeOf<Hex>()
})
