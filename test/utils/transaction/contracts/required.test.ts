// Required-field audit: for every contract type, the fields java-tron rejects
// at their proto3 default must be present (and non-default) to encode. The
// required sets are the intersection of the actuator rules and the fields
// present in EVERY gold-fixture case (fuzz corpus + per-contract fixtures) —
// so the strictness can never reject bytes the differential tests round-trip.
import { describe, expect, test } from 'vitest'
import type { ByteArray } from '../../../../src/types/misc.js'
import {
  encodeAccountCreateContract,
  encodeAccountUpdateContract,
  encodeSetAccountIdContract,
} from '../../../../src/utils/transaction/contracts/account.js'
import {
  encodeAssetIssueContract,
  encodeParticipateAssetIssueContract,
  encodeUpdateAssetContract,
} from '../../../../src/utils/transaction/contracts/asset.js'
import {
  encodeCancelAllUnfreezeV2Contract,
  encodeFreezeBalanceV2Contract,
  encodeUnfreezeBalanceV2Contract,
  encodeWithdrawBalanceContract,
  encodeWithdrawExpireUnfreezeContract,
} from '../../../../src/utils/transaction/contracts/balance.js'
import {
  encodeClearABIContract,
  encodeUpdateEnergyLimitContract,
  encodeUpdateSettingContract,
} from '../../../../src/utils/transaction/contracts/contractAdmin.js'
import {
  encodeExchangeCreateContract,
  encodeExchangeInjectContract,
  encodeExchangeTransactionContract,
  encodeExchangeWithdrawContract,
} from '../../../../src/utils/transaction/contracts/exchange.js'
import { encodeAccountPermissionUpdateContract } from '../../../../src/utils/transaction/contracts/permission.js'
import {
  encodeProposalApproveContract,
  encodeProposalCreateContract,
  encodeProposalDeleteContract,
} from '../../../../src/utils/transaction/contracts/proposal.js'
import {
  encodeDelegateResourceContract,
  encodeUnDelegateResourceContract,
} from '../../../../src/utils/transaction/contracts/resource.js'
import {
  encodeCreateSmartContract,
  encodeTriggerSmartContract,
} from '../../../../src/utils/transaction/contracts/smartContract.js'
import {
  encodeFreezeBalanceContract,
  encodeUnfreezeBalanceContract,
} from '../../../../src/utils/transaction/contracts/stake1.js'
import {
  encodeTransferAssetContract,
  encodeTransferContract,
} from '../../../../src/utils/transaction/contracts/transfer.js'
import { encodeVoteWitnessContract } from '../../../../src/utils/transaction/contracts/vote.js'
import {
  encodeUpdateBrokerageContract,
  encodeWitnessCreateContract,
  encodeWitnessUpdateContract,
} from '../../../../src/utils/transaction/contracts/witness.js'

const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
const other = '412b5ad5c4795c026514f8317c7a215e218dccd6cf'

type Encode = (message: Record<string, unknown>) => ByteArray

/** One contract's audit entry: a valid base body and its required fields. */
type Audit = {
  name: string
  encode: Encode
  base: Record<string, unknown>
  required: string[]
}

const ownerPermission = {
  permission_name: 'owner',
  threshold: 1n,
  keys: [{ address: owner, weight: 1n }],
}
const activePermission = {
  type: 'Active',
  id: 2,
  permission_name: 'active',
  threshold: 1n,
  operations:
    '7fff1fc0033e0000000000000000000000000000000000000000000000000000',
  keys: [{ address: owner, weight: 1n }],
}

const audits: Audit[] = [
  {
    name: 'TransferContract',
    encode: encodeTransferContract as unknown as Encode,
    base: { owner_address: owner, to_address: other, amount: 1000000n },
    required: ['owner_address', 'to_address', 'amount'],
  },
  {
    name: 'TransferAssetContract',
    encode: encodeTransferAssetContract as unknown as Encode,
    base: {
      asset_name: '31303030303031',
      owner_address: owner,
      to_address: other,
      amount: 5n,
    },
    required: ['asset_name', 'owner_address', 'to_address', 'amount'],
  },
  {
    name: 'AccountCreateContract',
    encode: encodeAccountCreateContract as unknown as Encode,
    base: { owner_address: owner, account_address: other },
    required: ['owner_address', 'account_address'],
  },
  {
    name: 'AccountUpdateContract',
    encode: encodeAccountUpdateContract as unknown as Encode,
    base: { account_name: '616c696365', owner_address: owner },
    required: ['account_name', 'owner_address'],
  },
  {
    name: 'SetAccountIdContract',
    encode: encodeSetAccountIdContract as unknown as Encode,
    base: { account_id: '6d796964', owner_address: owner },
    required: ['account_id', 'owner_address'],
  },
  {
    name: 'AssetIssueContract',
    encode: encodeAssetIssueContract as unknown as Encode,
    base: {
      owner_address: owner,
      name: '414243',
      abbr: '4142',
      total_supply: 1000n,
      trx_num: 1,
      num: 1,
      start_time: 1n,
      end_time: 2n,
      url: '5555',
    },
    // description is NOT required: the chain accepts an empty description
    // (absent from the wire), and the corpus carries such cases.
    required: [
      'owner_address',
      'name',
      'abbr',
      'total_supply',
      'trx_num',
      'num',
      'start_time',
      'end_time',
      'url',
    ],
  },
  {
    name: 'ParticipateAssetIssueContract',
    encode: encodeParticipateAssetIssueContract as unknown as Encode,
    base: {
      owner_address: owner,
      to_address: other,
      asset_name: '31303030303031',
      amount: 10n,
    },
    required: ['owner_address', 'to_address', 'asset_name', 'amount'],
  },
  {
    name: 'UpdateAssetContract',
    encode: encodeUpdateAssetContract as unknown as Encode,
    base: { owner_address: owner },
    required: ['owner_address'],
  },
  {
    name: 'WithdrawBalanceContract',
    encode: encodeWithdrawBalanceContract as unknown as Encode,
    base: { owner_address: owner },
    required: ['owner_address'],
  },
  {
    name: 'WithdrawExpireUnfreezeContract',
    encode: encodeWithdrawExpireUnfreezeContract as unknown as Encode,
    base: { owner_address: owner },
    required: ['owner_address'],
  },
  {
    name: 'CancelAllUnfreezeV2Contract',
    encode: encodeCancelAllUnfreezeV2Contract as unknown as Encode,
    base: { owner_address: owner },
    required: ['owner_address'],
  },
  {
    name: 'FreezeBalanceV2Contract',
    encode: encodeFreezeBalanceV2Contract as unknown as Encode,
    base: { owner_address: owner, frozen_balance: 1000000n },
    required: ['owner_address', 'frozen_balance'],
  },
  {
    name: 'UnfreezeBalanceV2Contract',
    encode: encodeUnfreezeBalanceV2Contract as unknown as Encode,
    base: { owner_address: owner, unfreeze_balance: 1000000n },
    required: ['owner_address', 'unfreeze_balance'],
  },
  {
    name: 'DelegateResourceContract',
    encode: encodeDelegateResourceContract as unknown as Encode,
    base: {
      owner_address: owner,
      balance: 1000000n,
      receiver_address: other,
    },
    required: ['owner_address', 'balance', 'receiver_address'],
  },
  {
    name: 'UnDelegateResourceContract',
    encode: encodeUnDelegateResourceContract as unknown as Encode,
    base: {
      owner_address: owner,
      balance: 1000000n,
      receiver_address: other,
    },
    required: ['owner_address', 'balance', 'receiver_address'],
  },
  {
    name: 'FreezeBalanceContract',
    encode: encodeFreezeBalanceContract as unknown as Encode,
    base: {
      owner_address: owner,
      frozen_balance: 1000000n,
      frozen_duration: 3n,
    },
    required: ['owner_address', 'frozen_balance', 'frozen_duration'],
  },
  {
    name: 'UnfreezeBalanceContract',
    encode: encodeUnfreezeBalanceContract as unknown as Encode,
    base: { owner_address: owner },
    required: ['owner_address'],
  },
  {
    name: 'VoteWitnessContract',
    encode: encodeVoteWitnessContract as unknown as Encode,
    base: {
      owner_address: owner,
      votes: [{ vote_address: other, vote_count: 5n }],
    },
    required: ['owner_address', 'votes'],
  },
  {
    name: 'WitnessCreateContract',
    encode: encodeWitnessCreateContract as unknown as Encode,
    base: { owner_address: owner, url: '68747470' },
    required: ['owner_address', 'url'],
  },
  {
    name: 'WitnessUpdateContract',
    encode: encodeWitnessUpdateContract as unknown as Encode,
    base: { owner_address: owner, update_url: '68747470' },
    required: ['owner_address', 'update_url'],
  },
  {
    // brokerage is NOT required: 0% is a valid brokerage.
    name: 'UpdateBrokerageContract',
    encode: encodeUpdateBrokerageContract as unknown as Encode,
    base: { owner_address: owner, brokerage: 20 },
    required: ['owner_address'],
  },
  {
    // witness is optional; owner and actives the actuator requires.
    name: 'AccountPermissionUpdateContract',
    encode: encodeAccountPermissionUpdateContract as unknown as Encode,
    base: {
      owner_address: owner,
      owner: ownerPermission,
      actives: [activePermission],
    },
    required: ['owner_address', 'owner', 'actives'],
  },
  {
    // parameters is chain-required but the gold corpus carries empty-map
    // cases, so presence is not enforced (the corpus is the hard bound).
    name: 'ProposalCreateContract',
    encode: encodeProposalCreateContract as unknown as Encode,
    base: { owner_address: owner, parameters: [{ key: 1n, value: 1n }] },
    required: ['owner_address'],
  },
  {
    name: 'ProposalApproveContract',
    encode: encodeProposalApproveContract as unknown as Encode,
    base: { owner_address: owner, proposal_id: 1n, is_add_approval: true },
    required: ['owner_address'],
  },
  {
    name: 'ProposalDeleteContract',
    encode: encodeProposalDeleteContract as unknown as Encode,
    base: { owner_address: owner, proposal_id: 1n },
    required: ['owner_address'],
  },
  {
    name: 'ExchangeCreateContract',
    encode: encodeExchangeCreateContract as unknown as Encode,
    base: {
      owner_address: owner,
      first_token_id: '5f',
      first_token_balance: 100n,
      second_token_id: '31303030303031',
      second_token_balance: 200n,
    },
    required: [
      'owner_address',
      'first_token_id',
      'first_token_balance',
      'second_token_id',
      'second_token_balance',
    ],
  },
  {
    name: 'ExchangeInjectContract',
    encode: encodeExchangeInjectContract as unknown as Encode,
    base: { owner_address: owner, exchange_id: 1n, token_id: '5f', quant: 10n },
    required: ['owner_address', 'exchange_id', 'token_id', 'quant'],
  },
  {
    name: 'ExchangeWithdrawContract',
    encode: encodeExchangeWithdrawContract as unknown as Encode,
    base: { owner_address: owner, exchange_id: 1n, token_id: '5f', quant: 10n },
    required: ['owner_address', 'exchange_id', 'token_id', 'quant'],
  },
  {
    name: 'ExchangeTransactionContract',
    encode: encodeExchangeTransactionContract as unknown as Encode,
    base: {
      owner_address: owner,
      exchange_id: 1n,
      token_id: '5f',
      quant: 10n,
      expected: 1n,
    },
    required: ['owner_address', 'exchange_id', 'token_id', 'quant', 'expected'],
  },
  {
    // consume_user_resource_percent is NOT required: 0% is valid.
    name: 'UpdateSettingContract',
    encode: encodeUpdateSettingContract as unknown as Encode,
    base: { owner_address: owner, contract_address: other },
    required: ['owner_address', 'contract_address'],
  },
  {
    name: 'UpdateEnergyLimitContract',
    encode: encodeUpdateEnergyLimitContract as unknown as Encode,
    base: {
      owner_address: owner,
      contract_address: other,
      origin_energy_limit: 10000000n,
    },
    required: ['owner_address', 'contract_address', 'origin_energy_limit'],
  },
  {
    name: 'ClearABIContract',
    encode: encodeClearABIContract as unknown as Encode,
    base: { owner_address: owner, contract_address: other },
    required: ['owner_address', 'contract_address'],
  },
  {
    name: 'CreateSmartContract',
    encode: encodeCreateSmartContract as unknown as Encode,
    base: {
      owner_address: owner,
      new_contract: {
        origin_address: owner,
        origin_energy_limit: 10000000n,
        bytecode: '6080',
      },
    },
    required: ['owner_address', 'new_contract'],
  },
  {
    // data is NOT required: an empty data triggers the fallback function,
    // which the chain accepts.
    name: 'TriggerSmartContract',
    encode: encodeTriggerSmartContract as unknown as Encode,
    base: { owner_address: owner, contract_address: other, data: 'a9059cbb' },
    required: ['owner_address', 'contract_address'],
  },
]

describe.each(audits)('$name', ({ encode, base, required }) => {
  test('encodes with every required field set', () => {
    expect(() => encode(base)).not.toThrow()
  })

  test.each(required)('rejects a missing %s', (field) => {
    expect(() => encode({ ...base, [field]: undefined })).toThrow(
      `Missing required field "${field}"`,
    )
  })
})

// The wire cannot distinguish a default value from an absent field, so a
// proto3 default on a required field is refused the same as a missing one.
test('a zero amount is refused the same as a missing one', () => {
  expect(() =>
    encodeTransferContract({
      owner_address: owner,
      to_address: other,
      amount: 0n,
    }),
  ).toThrow('Missing required field "amount"')
})

describe('nested message required fields', () => {
  test('a vote entry requires vote_address and vote_count', () => {
    const encode = encodeVoteWitnessContract as unknown as Encode
    expect(() =>
      encode({ owner_address: owner, votes: [{ vote_address: other }] }),
    ).toThrow('Missing required field "vote_count"')
    expect(() =>
      encode({ owner_address: owner, votes: [{ vote_count: 5n }] }),
    ).toThrow('Missing required field "vote_address"')
    expect(() => encode({ owner_address: owner, votes: [] })).toThrow(
      'Missing required field "votes"',
    )
  })

  test('a frozen_supply tranche requires frozen_amount and frozen_days', () => {
    const encode = encodeAssetIssueContract as unknown as Encode
    const base = audits.find((a) => a.name === 'AssetIssueContract')!.base
    expect(() =>
      encode({ ...base, frozen_supply: [{ frozen_amount: 1n }] }),
    ).toThrow('Missing required field "frozen_days"')
    expect(() =>
      encode({ ...base, frozen_supply: [{ frozen_days: 1n }] }),
    ).toThrow('Missing required field "frozen_amount"')
  })

  test('a permission requires threshold and keys; a key requires address and weight', () => {
    const encode = encodeAccountPermissionUpdateContract as unknown as Encode
    const base = audits.find(
      (a) => a.name === 'AccountPermissionUpdateContract',
    )!.base
    expect(() =>
      encode({ ...base, owner: { ...ownerPermission, threshold: undefined } }),
    ).toThrow('Missing required field "threshold"')
    expect(() =>
      encode({ ...base, owner: { ...ownerPermission, keys: [] } }),
    ).toThrow('Missing required field "keys"')
    expect(() =>
      encode({
        ...base,
        actives: [{ ...activePermission, keys: [{ address: owner }] }],
      }),
    ).toThrow('Missing required field "weight"')
    expect(() =>
      encode({
        ...base,
        actives: [{ ...activePermission, keys: [{ weight: 1n }] }],
      }),
    ).toThrow('Missing required field "address"')
  })

  test('a new_contract requires origin_address and origin_energy_limit', () => {
    const encode = encodeCreateSmartContract as unknown as Encode
    expect(() =>
      encode({
        owner_address: owner,
        new_contract: { origin_energy_limit: 10000000n, bytecode: '6080' },
      }),
    ).toThrow('Missing required field "origin_address"')
    expect(() =>
      encode({
        owner_address: owner,
        new_contract: { origin_address: owner, bytecode: '6080' },
      }),
    ).toThrow('Missing required field "origin_energy_limit"')
  })
})
