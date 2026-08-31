import { expectTypeOf, test } from 'vitest'
import type { AccountKey, TronAccount } from '../../../src/accounts/types.js'
import type { SendTrxParameters } from '../../../src/actions/wallet/sendTrx.js'

// pk=1, bare form — must be accepted per-call like the 0x form.
const pkBare =
  '0000000000000000000000000000000000000000000000000000000000000001'

type AccountParam = NonNullable<SendTrxParameters['account']>

test('SendTrxParameters: account accepts key strings and built accounts', () => {
  expectTypeOf<AccountKey>().toExtend<AccountParam>()
  expectTypeOf<typeof pkBare>().toExtend<AccountParam>()
  expectTypeOf<TronAccount>().toExtend<AccountParam>()
})
