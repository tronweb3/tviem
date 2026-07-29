// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { Abi } from 'abitype'
import type { Client } from '../../clients/createClient.js'
import { zeroAddress } from '../../constants/address.js'
import { ContractFunctionRevertedError } from '../../errors/rpc.js'
import type { Address } from '../../types/address.js'
import { decodeAbiParameters } from '../../utils/abi/decodeAbiParameters.js'
import {
  type DecodeFunctionResultReturnType,
  decodeFunctionResult,
} from '../../utils/abi/decodeFunctionResult.js'
import { encodeFunctionData } from '../../utils/abi/encodeFunctionData.js'
import { toHex } from '../../utils/address/toHex.js'
import { hexToString } from '../../utils/encoding/fromHex.js'

/** 4-byte selector of the Solidity `Error(string)` revert helper. */
const ERROR_STRING_SELECTOR = '08c379a0'
/** 4-byte selector of the Solidity `Panic(uint256)` revert helper. */
const PANIC_SELECTOR = '4e487b71'

export type ReadContractParameters = {
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: Abi
  /** The function to call. */
  functionName: string
  /** The function arguments. */
  args?: readonly unknown[] | undefined
  /**
   * The caller address. Defaults to the Client's account (on a Wallet Client)
   * or the zero address — neither triggers a balance check on the node.
   */
  from?: Address | undefined
}
export type ReadContractReturnType = DecodeFunctionResultReturnType

/** Shape of a `triggerconstantcontract` response body. */
type TriggerConstantContractResponse = {
  result?: { result?: boolean; message?: string } | undefined
  constant_result?: string[] | undefined
  energy_used?: number | undefined
}

/**
 * Reads (constant-calls) a contract function via `triggerconstantcontract`
 * without broadcasting a transaction.
 *
 * The calldata is built locally with {@link encodeFunctionData} and sent as the
 * bare `data` field (no `0x`). If the node reports the call reverted
 * (`result.result === false`), the revert payload in `constant_result[0]` is
 * decoded: `Error(string)` → a human-readable reason, `Panic(uint256)` → a
 * panic code — both surfaced as a {@link ContractFunctionRevertedError}.
 * Otherwise `constant_result[0]` is ABI-decoded against the function outputs.
 *
 * @example
 * const balance = await readContract(client, {
 *   address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
 *   abi: trc20Abi,
 *   functionName: 'balanceOf',
 *   args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
 * })
 */
export async function readContract(
  client: Client,
  parameters: ReadContractParameters,
): Promise<ReadContractReturnType> {
  const { abi, address, args, functionName, from } = parameters

  const data = encodeFunctionData({ abi, functionName, args })
  const owner = from ?? client.account?.address ?? zeroAddress

  const response = await client.request<TriggerConstantContractResponse>({
    node: 'full',
    method: 'POST',
    path: 'triggerconstantcontract',
    body: {
      owner_address: toHex(owner),
      contract_address: toHex(address),
      data: data.slice(2),
    },
  })

  if (response?.result?.result === false)
    throw decodeRevert(response.constant_result?.[0], response.result.message, {
      functionName,
    })

  const constantResult = response?.constant_result?.[0] ?? ''
  return decodeFunctionResult({
    abi,
    functionName,
    args,
    data: `0x${constantResult}`,
  }) as ReadContractReturnType
}

/** Decodes a revert payload into a {@link ContractFunctionRevertedError}. */
function decodeRevert(
  constantResult: string | undefined,
  message: string | undefined,
  { functionName }: { functionName: string },
): ContractFunctionRevertedError {
  const hex = (constantResult ?? '').toLowerCase()

  if (hex.startsWith(ERROR_STRING_SELECTOR) && hex.length > 8) {
    try {
      const [reason] = decodeAbiParameters(
        [{ type: 'string' }],
        `0x${hex.slice(8)}`,
      )
      return new ContractFunctionRevertedError({
        functionName,
        reason: reason as string,
        signature: 'Error(string)',
        data: `0x${hex}`,
      })
    } catch {}
  }

  if (hex.startsWith(PANIC_SELECTOR) && hex.length > 8) {
    try {
      const [code] = decodeAbiParameters(
        [{ type: 'uint256' }],
        `0x${hex.slice(8)}`,
      )
      return new ContractFunctionRevertedError({
        functionName,
        code: code as bigint,
        signature: 'Panic(uint256)',
        data: `0x${hex}`,
      })
    } catch {}
  }

  return new ContractFunctionRevertedError({
    functionName,
    reason: decodeNodeMessage(message),
    ...(hex ? { data: `0x${hex}` as const } : {}),
  })
}

/** Best-effort decode of a node-provided (possibly hex-encoded) message. */
function decodeNodeMessage(message: string | undefined): string | undefined {
  if (!message) return undefined
  if (/^[0-9a-fA-F]+$/.test(message) && message.length % 2 === 0) {
    try {
      return hexToString(`0x${message}`)
    } catch {}
  }
  return message
}
