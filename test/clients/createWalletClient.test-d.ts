import { expectTypeOf, test } from 'vitest'
import type { TronAccount, TronLocalAccount } from '../../src/accounts/types.js'
import { createWalletClient } from '../../src/clients/createWalletClient.js'
import { http } from '../../src/clients/transports/http.js'

// pk=1, in both accepted input forms.
const pk0x =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const pkBare =
  '0000000000000000000000000000000000000000000000000000000000000001'

test('createWalletClient: hoisting a bare private key infers TronLocalAccount', () => {
  const client = createWalletClient({ account: pkBare, transport: http() })
  expectTypeOf(client.account).toEqualTypeOf<TronLocalAccount>()
})

test('createWalletClient: hoisting a 0x private key infers TronLocalAccount', () => {
  const client = createWalletClient({ account: pk0x, transport: http() })
  expectTypeOf(client.account).toEqualTypeOf<TronLocalAccount>()
})

test('createWalletClient: a built account passes through unchanged', () => {
  const account = {} as TronLocalAccount
  const client = createWalletClient({ account, transport: http() })
  expectTypeOf(client.account).toEqualTypeOf<TronLocalAccount>()
})

test('sendTrx: a per-call bare private key type-checks', () => {
  const client = createWalletClient({ transport: http() })
  type AccountParam = NonNullable<
    Parameters<typeof client.sendTrx>[0]['account']
  >
  expectTypeOf<typeof pkBare>().toExtend<AccountParam>()
  expectTypeOf<typeof pk0x>().toExtend<AccountParam>()
  expectTypeOf<TronAccount>().toExtend<AccountParam>()
})
