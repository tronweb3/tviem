import type { HDKey } from '@scure/bip32'
import { expectTypeOf, test } from 'vitest'

import type { Address } from '../../src/types/address.js'
import type { Hex } from '../../src/types/misc.js'
import type { Signature } from '../../src/utils/signature/sign.js'
import { hdKeyToAccount } from '../../src/accounts/hdKeyToAccount.js'
import { mnemonicToAccount } from '../../src/accounts/mnemonicToAccount.js'
import type { TronAccount, TronHDAccount } from '../../src/accounts/types.js'

const mnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

test('mnemonicToAccount / hdKeyToAccount return a TronHDAccount', () => {
  expectTypeOf(mnemonicToAccount(mnemonic)).toEqualTypeOf<TronHDAccount>()
  expectTypeOf(hdKeyToAccount({} as HDKey)).toEqualTypeOf<TronHDAccount>()
})

test('an HD account is assignable to the account union', () => {
  expectTypeOf(mnemonicToAccount(mnemonic)).toMatchTypeOf<TronAccount>()
})

test('HD account fields are branded/narrowed', () => {
  const account = mnemonicToAccount(mnemonic)
  expectTypeOf(account.address).toEqualTypeOf<Address>()
  expectTypeOf(account.publicKey).toEqualTypeOf<Hex>()
  expectTypeOf(account.source).toEqualTypeOf<'hd'>()
  expectTypeOf(account.type).toEqualTypeOf<'local'>()
  expectTypeOf(account.getHdKey).toEqualTypeOf<() => HDKey>()
})

test('HD account exposes the full signing surface', () => {
  const account = mnemonicToAccount(mnemonic)
  expectTypeOf(account.sign({ hash: '0x00' })).toEqualTypeOf<Signature>()
  expectTypeOf(
    account.signMessage({ message: 'gm' }),
  ).toEqualTypeOf<Signature>()
  expectTypeOf(
    account.signTypedData({ types: {}, primaryType: 'X' }),
  ).toEqualTypeOf<Signature>()
})

test('path option is restricted to the TRON coin type', () => {
  mnemonicToAccount(mnemonic, { path: "m/44'/195'/0'/0/0" })
  // @ts-expect-error — a non-195 path is rejected at the type level.
  mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" })
  // @ts-expect-error — indices and an explicit path are mutually exclusive.
  mnemonicToAccount(mnemonic, { accountIndex: 1, path: "m/44'/195'/0'/0/0" })
})
