import { ContractFunctionRevertedError } from '../../errors/rpc.js'
import { decodeAbiParameters } from '../../utils/abi/decodeAbiParameters.js'
import { hexToString } from '../../utils/encoding/fromHex.js'

/** 4-byte selector of the Solidity `Error(string)` revert helper. */
const ERROR_STRING_SELECTOR = '08c379a0'
/** 4-byte selector of the Solidity `Panic(uint256)` revert helper. */
const PANIC_SELECTOR = '4e487b71'

/**
 * Decodes a `triggerconstantcontract` revert payload into a
 * {@link ContractFunctionRevertedError}: `Error(string)` → a human-readable
 * reason, `Panic(uint256)` → a panic code; otherwise the node's (possibly
 * hex-encoded) message is surfaced best-effort.
 */
export function decodeRevert(
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
