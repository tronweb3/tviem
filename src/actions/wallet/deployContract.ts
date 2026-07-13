// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Abi } from 'abitype'

import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { ContractConstructorArgs } from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import { encodeDeployData } from '../../utils/abi/encodeDeployData.js'
import { toBase58 } from '../../utils/address/toBase58.js'
import { toHex } from '../../utils/address/toHex.js'
import { genContractAddress } from '../../utils/transaction/genContractAddress.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  EntryType,
  type SmartContractAbi,
  type SmartContractAbiEntry,
  type SmartContractAbiParam,
  StateMutabilityType,
} from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

const entryTypes: Record<string, number> = {
  constructor: EntryType.CONSTRUCTOR,
  function: EntryType.FUNCTION,
  event: EntryType.EVENT,
  fallback: EntryType.FALLBACK,
  receive: EntryType.RECEIVE,
  error: EntryType.ERROR,
}

const stateMutabilities: Record<string, number> = {
  pure: StateMutabilityType.PURE,
  view: StateMutabilityType.VIEW,
  nonpayable: StateMutabilityType.NONPAYABLE,
  payable: StateMutabilityType.PAYABLE,
}

type LooseAbiParam = {
  indexed?: boolean | undefined
  name?: string | undefined
  type?: string | undefined
}

function toAbiParam(param: LooseAbiParam): SmartContractAbiParam {
  const result: SmartContractAbiParam = {}
  if (param.indexed !== undefined) result.indexed = param.indexed
  if (param.name !== undefined) result.name = param.name
  if (param.type !== undefined) result.type = param.type
  return result
}

/**
 * Converts an abitype/JSON `Abi` into the protobuf `SmartContract.ABI` shape:
 * string `type` / `stateMutability` map to their numeric enums and the legacy
 * `constant` / `anonymous` / `payable` booleans (when present) pass through.
 * proto3 defaults (`false`, `''`, empty repeated, enum `0`) are dropped by the
 * codec, so the emitted bytes match java-tron's canonical encoding.
 */
function toSmartContractAbi(abi: Abi): SmartContractAbi {
  return {
    entrys: abi.map((item) => {
      const entry = item as LooseAbiParam & {
        anonymous?: boolean | undefined
        constant?: boolean | undefined
        inputs?: readonly LooseAbiParam[] | undefined
        outputs?: readonly LooseAbiParam[] | undefined
        payable?: boolean | undefined
        stateMutability?: string | undefined
        type: string
      }
      const result: SmartContractAbiEntry = {
        type: entryTypes[entry.type] ?? EntryType.UNKNOWN_ENTRY_TYPE,
      }
      if (entry.anonymous !== undefined) result.anonymous = entry.anonymous
      if (entry.constant !== undefined) result.constant = entry.constant
      if (entry.name !== undefined) result.name = entry.name
      if (entry.inputs) result.inputs = entry.inputs.map(toAbiParam)
      if (entry.outputs) result.outputs = entry.outputs.map(toAbiParam)
      if (entry.payable !== undefined) result.payable = entry.payable
      if (entry.stateMutability !== undefined) {
        const stateMutability = stateMutabilities[entry.stateMutability]
        if (stateMutability !== undefined)
          result.stateMutability = stateMutability
      }
      return result
    }),
  }
}

export type DeployContractParameters<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Contract ABI — used to encode constructor `args` and embedded on-chain. */
  abi: abi
  /** Contract creation bytecode. */
  bytecode: Hex
  /** Constructor arguments, appended to the bytecode. */
  args?: ContractConstructorArgs<abi> | readonly unknown[] | undefined
  /** Contract name stored on-chain (`SmartContract.name`). */
  name?: string | undefined
  /** TRX sent with the deployment, in SUN (`SmartContract.call_value`). */
  callValue?: bigint | undefined
  /** Percent of energy paid by the caller (`consume_user_resource_percent`). */
  consumeUserResourcePercent?: bigint | undefined
  /** Deployer's energy limit (`SmartContract.origin_energy_limit`). */
  originEnergyLimit?: bigint | undefined
  /** TRC10 amount sent with the deployment (`call_token_value`). */
  callTokenValue?: bigint | undefined
  /** TRC10 token id (`CreateSmartContract.token_id`). */
  tokenId?: bigint | undefined
  /** Energy/bandwidth fee ceiling in SUN (`raw_data.fee_limit`). */
  feeLimit?: bigint | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}

export type DeployContractReturnType = BuildAndBroadcastReturnType & {
  /** Deterministically derived deployed contract address (Base58Check). */
  contractAddress: Address
}

/**
 * Deploys a smart contract by locally building, signing and broadcasting a
 * `CreateSmartContract` (§ type 30). The constructor `args` are ABI-encoded
 * and appended to `bytecode` (see {@link encodeDeployData}); the deployed
 * address is derived deterministically from the transaction id and deployer
 * (see {@link genContractAddress}) and returned as `contractAddress`.
 *
 * @param client The Client to use.
 * @param parameters ABI, bytecode, optional constructor args, resource limits.
 * @returns `{ txID, contractAddress }`.
 */
export async function deployContract<
  const abi extends Abi | readonly unknown[],
>(
  client: Client,
  parameters: DeployContractParameters<abi>,
): Promise<DeployContractReturnType> {
  const {
    abi,
    bytecode,
    args,
    name,
    callValue,
    consumeUserResourcePercent,
    originEnergyLimit,
    callTokenValue,
    tokenId,
    feeLimit,
  } = parameters as DeployContractParameters<Abi>

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())
  const ownerAddress = toHex(account.address)

  const contract: RawContract = {
    type: ContractType.CreateSmartContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}CreateSmartContract`,
      value: {
        ownerAddress,
        newContract: {
          originAddress: ownerAddress,
          abi: toSmartContractAbi(abi),
          bytecode: encodeDeployData({ abi, bytecode, args }),
          ...(callValue !== undefined ? { callValue } : {}),
          ...(consumeUserResourcePercent !== undefined
            ? { consumeUserResourcePercent }
            : {}),
          ...(name !== undefined ? { name } : {}),
          ...(originEnergyLimit !== undefined ? { originEnergyLimit } : {}),
        },
        ...(callTokenValue !== undefined ? { callTokenValue } : {}),
        ...(tokenId !== undefined ? { tokenId } : {}),
      },
    },
  }

  const { txID } = await buildAndBroadcast(client, {
    contract,
    account,
    now,
    feeLimit,
  })

  const contractAddress = toBase58(
    genContractAddress(txID, ownerAddress) as AddressInput,
  )
  return { txID, contractAddress }
}
