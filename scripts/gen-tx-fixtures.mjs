// Golden transaction fixture generator (dev-only, never published).
//
// Rebuilds every v0.1 contract type fully OFFLINE through TronWeb's official
// google-protobuf stack: each case pins the TaPoS block header via
// `options.blockHeader` (or a hand-assembled transaction JSON fed to
// TronWeb's `txJsonToPb`), so no network, no wall clock and no randomness
// are involved — reruns are byte-identical.
//
// Output: test/fixtures/tx/<contract-type>.json, one file per contract
// type, each entry shaped as:
//   { name, contractType, typeUrl, params, rawData, rawDataHex, txID }
// - `params`   — logical build inputs (int64-ish values as decimal strings;
//                addresses in the form the case was built with, so encoders
//                can exercise Base58/hex/flex normalization).
// - `rawData`  — canonical (visible=false, hex form) raw_data JSON exactly
//                as produced by TronWeb.
// - `rawDataHex`/`txID` — golden bytes from TronWeb's protobuf serializer.
//
// The generator hard-asserts the canonical TransferContract case against
// the byte-verified reference vector and self-checks every entry with
// TronWeb's `txCheck` before writing anything.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TronWeb, utils } from 'tronweb'

const { txCheck, txJsonToPb, txPbToRawDataHex, txPbToTxID } = utils.transaction

// ---------------------------------------------------------------------------
// Fixed constants (never derived from clock/network/randomness).
// ---------------------------------------------------------------------------

/** Fixed TaPoS + lifetime, identical for every case. */
const BLOCK_HEADER = {
  ref_block_bytes: '1234',
  ref_block_hash: '0102030405060708',
  expiration: 1700000060000,
  timestamp: 1700000000000,
}

// Test addresses (derived from the trivial secp256k1 keys pk=1 / pk=2, plus
// two well-known public constants — no usable secrets involved).
const V1 = {
  base58: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  hex: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
}
const V2 = {
  base58: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
  hex: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
}
/** USDT mainnet contract (public constant, used as a contract/SR address). */
const V3 = {
  base58: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  hex: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
}
/** Reference-vector recipient. */
const TO = {
  base58: 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY',
  hex: '41928c9af0651632157ef27a2cf17ca72c575a4d21',
}

/** Byte-verified reference vector for the canonical TransferContract case. */
const CANONICAL_RAW_DATA_HEX =
  '0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31'
const CANONICAL_TX_ID =
  '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'

/** TRC20 `transfer(address,uint256)` calldata: to=V3(evm form), 1_000_000. */
const TRC20_CALLDATA =
  'a9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240'

/** TRC10 token id, and its ASCII-hex (non-visible) form. */
const TOKEN_ID = '1002000'
const TOKEN_ID_HEX = '31303032303030'

/** Small deploy ABI: payable constructor + view function + event. */
const DEPLOY_ABI = [
  { inputs: [], stateMutability: 'payable', type: 'constructor' },
  {
    constant: true,
    inputs: [{ name: 'who', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
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
]
const DEPLOY_BYTECODE = '608060405260088055600a600b'

/** Standard full-permission operations bitmap (32 bytes). */
const OPERATIONS =
  '7fff1fc0033e0300000000000000000000000000000000000000000000000000'

/** ContractType integers, asserted against the runtime protobuf enum. */
const CONTRACT_TYPE = {
  TransferContract: 1,
  TransferAssetContract: 2,
  VoteWitnessContract: 4,
  WithdrawBalanceContract: 13,
  CreateSmartContract: 30,
  TriggerSmartContract: 31,
  AccountPermissionUpdateContract: 46,
  FreezeBalanceV2Contract: 54,
  UnfreezeBalanceV2Contract: 55,
  WithdrawExpireUnfreezeContract: 56,
  DelegateResourceContract: 57,
  UnDelegateResourceContract: 58,
  CancelAllUnfreezeV2Contract: 59,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`gen-tx-fixtures: ${message}`)
}

// Unroutable host: constructing TronWeb never dials out, and every build
// below carries a full block header, which short-circuits all RPC lookups.
const tronWeb = new TronWeb({ fullHost: 'http://127.0.0.1:9' })

/** Wraps a TronWeb-built transaction into a fixture entry. */
function toEntry(name, typeName, params, tx) {
  assert(
    tx.raw_data.contract[0].parameter.type_url ===
      `type.googleapis.com/protocol.${typeName}`,
    `${name}: unexpected type_url`,
  )
  assert(txCheck(tx), `${name}: TronWeb txCheck failed`)
  return {
    name,
    contractType: CONTRACT_TYPE[typeName],
    typeUrl: tx.raw_data.contract[0].parameter.type_url,
    params,
    rawData: JSON.parse(JSON.stringify(tx.raw_data)),
    rawDataHex: tx.raw_data_hex,
    txID: tx.txID,
  }
}

/**
 * Assembles a transaction JSON by hand and serializes it through TronWeb's
 * protobuf stack (`txJsonToPb`) — used for shapes the high-level builders
 * cannot express (visible=true flex input, missing fee_limit, memo data).
 */
function buildManualTx(typeName, value, options = {}) {
  const contract = {
    parameter: {
      value,
      type_url: `type.googleapis.com/protocol.${typeName}`,
    },
    type: typeName,
  }
  if (options.permissionId) contract.Permission_id = options.permissionId
  const tx = {
    visible: options.visible === true,
    txID: '',
    raw_data_hex: '',
    raw_data: {
      contract: [contract],
      ref_block_bytes: BLOCK_HEADER.ref_block_bytes,
      ref_block_hash: BLOCK_HEADER.ref_block_hash,
      expiration: BLOCK_HEADER.expiration,
      ...(options.data ? { data: options.data } : {}),
      timestamp: BLOCK_HEADER.timestamp,
      ...(options.feeLimit ? { fee_limit: options.feeLimit } : {}),
    },
  }
  const pb = txJsonToPb(tx)
  tx.raw_data_hex = txPbToRawDataHex(pb).toLowerCase()
  tx.txID = txPbToTxID(pb).replace(/^0x/, '')
  return tx
}

const withBlockHeader = (options = {}) => ({
  ...options,
  blockHeader: BLOCK_HEADER,
})

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function buildFixtures() {
  const files = {}
  const add = (file, entry) => {
    files[file] ??= []
    assert(
      !files[file].some((existing) => existing.name === entry.name),
      `duplicate case name: ${entry.name}`,
    )
    files[file].push(entry)
  }
  const builder = tronWeb.transactionBuilder

  // --- TransferContract (canonical, byte-asserted reference vector) ---
  const transferCanonical = await builder.sendTrx(
    TO.base58,
    1000000,
    V1.base58,
    withBlockHeader(),
  )
  assert(
    transferCanonical.raw_data_hex === CANONICAL_RAW_DATA_HEX,
    `canonical raw_data_hex mismatch:\n  got      ${transferCanonical.raw_data_hex}\n  expected ${CANONICAL_RAW_DATA_HEX}`,
  )
  assert(
    transferCanonical.txID === CANONICAL_TX_ID,
    `canonical txID mismatch: got ${transferCanonical.txID}`,
  )
  add(
    'transfer-contract',
    toEntry(
      'transfer canonical (reference vector)',
      'TransferContract',
      {
        value: {
          owner_address: V1.base58,
          to_address: TO.base58,
          amount: '1000000',
        },
      },
      transferCanonical,
    ),
  )

  // Permission_id ≠ 0 variant (Transaction.Contract field 5).
  add(
    'transfer-contract',
    toEntry(
      'transfer with Permission_id=2',
      'TransferContract',
      {
        value: {
          owner_address: V1.base58,
          to_address: TO.base58,
          amount: '1000000',
        },
        permissionId: 2,
      },
      await builder.sendTrx(
        TO.base58,
        1000000,
        V1.base58,
        withBlockHeader({ permissionId: 2 }),
      ),
    ),
  )

  // raw.data memo (field 10) + fee_limit (field 18), hand-assembled.
  add(
    'transfer-contract',
    toEntry(
      'transfer with memo data + fee_limit',
      'TransferContract',
      {
        value: {
          owner_address: V1.hex,
          to_address: TO.hex,
          amount: '1000000',
        },
        data: '6f6d6e69',
        feeLimit: '10000000',
      },
      buildManualTx(
        'TransferContract',
        { owner_address: V1.hex, to_address: TO.hex, amount: 1000000 },
        { data: '6f6d6e69', feeLimit: 10000000 },
      ),
    ),
  )

  // --- TransferAssetContract (asset_name flex: visible false/true) ---
  const assetVisibleFalse = await builder.sendToken(
    V2.base58,
    1000,
    TOKEN_ID,
    V1.base58,
    withBlockHeader(),
  )
  add(
    'transfer-asset-contract',
    toEntry(
      'transfer-asset visible=false (asset_name ASCII-hex)',
      'TransferAssetContract',
      {
        value: {
          owner_address: V1.hex,
          to_address: V2.hex,
          asset_name: TOKEN_ID_HEX,
          amount: '1000',
        },
        visible: false,
      },
      assetVisibleFalse,
    ),
  )

  const assetVisibleTrue = buildManualTx(
    'TransferAssetContract',
    {
      asset_name: TOKEN_ID,
      owner_address: V1.base58,
      to_address: V2.base58,
      amount: 1000,
    },
    { visible: true },
  )
  assert(
    assetVisibleTrue.raw_data_hex === assetVisibleFalse.raw_data_hex &&
      assetVisibleTrue.txID === assetVisibleFalse.txID,
    'visible=true and visible=false TransferAsset forms must be byte-equal',
  )
  add('transfer-asset-contract', {
    ...toEntry(
      'transfer-asset visible=true (asset_name UTF-8, Base58 addresses)',
      'TransferAssetContract',
      {
        value: {
          owner_address: V1.base58,
          to_address: V2.base58,
          asset_name: TOKEN_ID,
          amount: '1000',
        },
        visible: true,
      },
      assetVisibleTrue,
    ),
    // Record the canonical (visible=false) raw_data shape for decoders.
    rawData: JSON.parse(JSON.stringify(assetVisibleFalse.raw_data)),
  })

  // --- VoteWitnessContract (multiple votes) ---
  add(
    'vote-witness-contract',
    toEntry(
      'vote for two witnesses',
      'VoteWitnessContract',
      {
        value: {
          owner_address: V1.base58,
          votes: [
            { vote_address: V2.base58, vote_count: '5' },
            { vote_address: V3.base58, vote_count: '10' },
          ],
        },
      },
      await builder.vote(
        { [V2.base58]: 5, [V3.base58]: 10 },
        V1.base58,
        withBlockHeader(),
      ),
    ),
  )

  // --- WithdrawBalanceContract ---
  add(
    'withdraw-balance-contract',
    toEntry(
      'withdraw block rewards',
      'WithdrawBalanceContract',
      { value: { owner_address: V1.base58 } },
      await builder.withdrawBlockRewards(V1.base58, withBlockHeader()),
    ),
  )

  // --- FreezeBalanceV2Contract (BANDWIDTH=default enum omitted / ENERGY) ---
  add(
    'freeze-balance-v2-contract',
    toEntry(
      'freeze v2 BANDWIDTH',
      'FreezeBalanceV2Contract',
      {
        value: {
          owner_address: V1.base58,
          frozen_balance: '1000000',
          resource: 'BANDWIDTH',
        },
      },
      await builder.freezeBalanceV2(
        1000000,
        'BANDWIDTH',
        V1.base58,
        withBlockHeader(),
      ),
    ),
  )
  add(
    'freeze-balance-v2-contract',
    toEntry(
      'freeze v2 ENERGY',
      'FreezeBalanceV2Contract',
      {
        value: {
          owner_address: V1.base58,
          frozen_balance: '2000000',
          resource: 'ENERGY',
        },
      },
      await builder.freezeBalanceV2(
        2000000,
        'ENERGY',
        V1.base58,
        withBlockHeader(),
      ),
    ),
  )

  // --- UnfreezeBalanceV2Contract ---
  add(
    'unfreeze-balance-v2-contract',
    toEntry(
      'unfreeze v2 BANDWIDTH',
      'UnfreezeBalanceV2Contract',
      {
        value: {
          owner_address: V1.base58,
          unfreeze_balance: '500000',
          resource: 'BANDWIDTH',
        },
      },
      await builder.unfreezeBalanceV2(
        500000,
        'BANDWIDTH',
        V1.base58,
        withBlockHeader(),
      ),
    ),
  )
  add(
    'unfreeze-balance-v2-contract',
    toEntry(
      'unfreeze v2 ENERGY',
      'UnfreezeBalanceV2Contract',
      {
        value: {
          owner_address: V1.base58,
          unfreeze_balance: '250000',
          resource: 'ENERGY',
        },
      },
      await builder.unfreezeBalanceV2(
        250000,
        'ENERGY',
        V1.base58,
        withBlockHeader(),
      ),
    ),
  )

  // --- WithdrawExpireUnfreezeContract ---
  add(
    'withdraw-expire-unfreeze-contract',
    toEntry(
      'withdraw expired unfrozen balance',
      'WithdrawExpireUnfreezeContract',
      { value: { owner_address: V1.base58 } },
      await builder.withdrawExpireUnfreeze(V1.base58, withBlockHeader()),
    ),
  )

  // --- CancelAllUnfreezeV2Contract ---
  add(
    'cancel-all-unfreeze-v2-contract',
    toEntry(
      'cancel all unfreeze v2',
      'CancelAllUnfreezeV2Contract',
      { value: { owner_address: V1.base58 } },
      await builder.cancelUnfreezeBalanceV2(V1.base58, withBlockHeader()),
    ),
  )

  // --- DelegateResourceContract (lock=false / lock=true + lock_period) ---
  add(
    'delegate-resource-contract',
    toEntry(
      'delegate BANDWIDTH lock=false',
      'DelegateResourceContract',
      {
        value: {
          owner_address: V1.base58,
          receiver_address: V2.base58,
          balance: '1000000',
          resource: 'BANDWIDTH',
          lock: false,
        },
      },
      await builder.delegateResource(
        1000000,
        V2.base58,
        'BANDWIDTH',
        V1.base58,
        false,
        undefined,
        withBlockHeader(),
      ),
    ),
  )
  add(
    'delegate-resource-contract',
    toEntry(
      'delegate ENERGY lock=true lock_period=86400',
      'DelegateResourceContract',
      {
        value: {
          owner_address: V1.base58,
          receiver_address: V2.base58,
          balance: '2000000',
          resource: 'ENERGY',
          lock: true,
          lock_period: '86400',
        },
      },
      await builder.delegateResource(
        2000000,
        V2.base58,
        'ENERGY',
        V1.base58,
        true,
        86400,
        withBlockHeader(),
      ),
    ),
  )

  // --- UnDelegateResourceContract ---
  add(
    'un-delegate-resource-contract',
    toEntry(
      'undelegate ENERGY',
      'UnDelegateResourceContract',
      {
        value: {
          owner_address: V1.base58,
          receiver_address: V2.base58,
          balance: '1000000',
          resource: 'ENERGY',
        },
      },
      await builder.undelegateResource(
        1000000,
        V2.base58,
        'ENERGY',
        V1.base58,
        withBlockHeader(),
      ),
    ),
  )

  // --- TriggerSmartContract ---
  const triggerBase = {
    owner_address: V1.base58,
    contract_address: V3.base58,
    data: TRC20_CALLDATA,
  }
  const trigger = async (options) =>
    (
      await builder.triggerSmartContract(
        V3.base58,
        '',
        withBlockHeader({ txLocal: true, input: TRC20_CALLDATA, ...options }),
        [],
        V1.base58,
      )
    ).transaction
  add(
    'trigger-smart-contract',
    toEntry(
      'trigger TRC20 transfer with fee_limit',
      'TriggerSmartContract',
      { value: { ...triggerBase }, feeLimit: '100000000' },
      await trigger({ feeLimit: 100000000 }),
    ),
  )
  add(
    'trigger-smart-contract',
    toEntry(
      'trigger TRC20 transfer without fee_limit',
      'TriggerSmartContract',
      {
        value: {
          owner_address: V1.hex,
          contract_address: V3.hex,
          data: TRC20_CALLDATA,
        },
      },
      buildManualTx('TriggerSmartContract', {
        data: TRC20_CALLDATA,
        owner_address: V1.hex,
        contract_address: V3.hex,
      }),
    ),
  )
  add(
    'trigger-smart-contract',
    toEntry(
      'trigger TRC20 transfer with call_value',
      'TriggerSmartContract',
      {
        value: { ...triggerBase, call_value: '1000000' },
        feeLimit: '100000000',
      },
      await trigger({ feeLimit: 100000000, callValue: 1000000 }),
    ),
  )
  add(
    'trigger-smart-contract',
    toEntry(
      'trigger TRC20 transfer with call_token_value + token_id',
      'TriggerSmartContract',
      {
        value: {
          ...triggerBase,
          call_token_value: '5',
          token_id: TOKEN_ID,
        },
        feeLimit: '100000000',
      },
      await trigger({
        feeLimit: 100000000,
        tokenValue: 5,
        tokenId: TOKEN_ID,
      }),
    ),
  )

  // --- CreateSmartContract ---
  const deployParams = {
    abi: DEPLOY_ABI,
    bytecode: DEPLOY_BYTECODE,
    name: 'OmniTest',
    consume_user_resource_percent: '30',
    origin_energy_limit: '5000000',
  }
  const deployOptions = {
    abi: DEPLOY_ABI,
    bytecode: DEPLOY_BYTECODE,
    name: 'OmniTest',
    userFeePercentage: 30,
    originEnergyLimit: 5000000,
    feeLimit: 1000000000,
  }
  const deployBase = await builder.createSmartContract(
    withBlockHeader(deployOptions),
    V1.base58,
  )
  add('create-smart-contract', {
    ...toEntry(
      'deploy contract with ABI entrys + bytecode',
      'CreateSmartContract',
      {
        value: { owner_address: V1.base58, ...deployParams },
        feeLimit: '1000000000',
      },
      deployBase,
    ),
    // CREATE address prediction golden value (keccak256(txID ++ owner41)).
    contractAddress: deployBase.contract_address,
  })
  const deployToken = await builder.createSmartContract(
    withBlockHeader({ ...deployOptions, tokenValue: 5, tokenId: 1002000 }),
    V1.base58,
  )
  add('create-smart-contract', {
    ...toEntry(
      'deploy contract with call_token_value + token_id',
      'CreateSmartContract',
      {
        value: {
          owner_address: V1.base58,
          ...deployParams,
          call_token_value: '5',
          token_id: TOKEN_ID,
        },
        feeLimit: '1000000000',
      },
      deployToken,
    ),
    contractAddress: deployToken.contract_address,
  })

  // --- AccountPermissionUpdateContract ---
  const ownerPermission = {
    type: 0,
    permission_name: 'owner',
    threshold: 2,
    keys: [
      { address: V1.base58, weight: 1 },
      { address: V2.base58, weight: 1 },
    ],
  }
  const activePermission = {
    type: 2,
    id: 2,
    permission_name: 'active0',
    threshold: 1,
    operations: OPERATIONS,
    keys: [{ address: V1.base58, weight: 1 }],
  }
  add(
    'account-permission-update-contract',
    toEntry(
      'update permissions: owner (2 keys) + active (operations bitmap)',
      'AccountPermissionUpdateContract',
      {
        value: {
          owner_address: V1.base58,
          owner: {
            type: 0,
            permission_name: 'owner',
            threshold: '2',
            keys: [
              { address: V1.base58, weight: '1' },
              { address: V2.base58, weight: '1' },
            ],
          },
          actives: [
            {
              type: 2,
              id: 2,
              permission_name: 'active0',
              threshold: '1',
              operations: OPERATIONS,
              keys: [{ address: V1.base58, weight: '1' }],
            },
          ],
        },
      },
      await builder.updateAccountPermissions(
        V1.base58,
        ownerPermission,
        null,
        [activePermission],
        withBlockHeader(),
      ),
    ),
  )

  return files
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Guard: hardcoded ContractType integers must match the runtime enum.
const runtimeEnum = globalThis.TronWebProto.Transaction.Contract.ContractType
for (const [typeName, value] of Object.entries(CONTRACT_TYPE))
  assert(
    runtimeEnum[typeName.toUpperCase()] === value,
    `ContractType.${typeName} expected ${value}`,
  )

const files = await buildFixtures()

const outDir = resolve(import.meta.dirname, '../test/fixtures/tx')
mkdirSync(outDir, { recursive: true })
let total = 0
for (const [file, entries] of Object.entries(files)) {
  writeFileSync(
    resolve(outDir, `${file}.json`),
    `${JSON.stringify(entries, null, 2)}\n`,
  )
  total += entries.length
  console.log(`${file}.json: ${entries.length} case(s)`)
}
console.log(`wrote ${total} case(s) across ${Object.keys(files).length} files`)
