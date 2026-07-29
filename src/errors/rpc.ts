// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { BaseError } from './base.js'

/**
 * Thrown by a write Action (e.g. `sendTrx`, `writeContract`) when no account is
 * available — neither passed per-call via `account` nor hoisted on the Client.
 */
export type AccountNotFoundErrorType = AccountNotFoundError & {
  name: 'AccountNotFoundError'
}
export class AccountNotFoundError extends BaseError {
  constructor({ docsPath }: { docsPath?: string | undefined } = {}) {
    super(
      [
        'Could not find an Account to execute with this Action.',
        'Please provide an Account with the `account` argument on the Action, or by supplying an `account` to the Client.',
      ].join('\n'),
      {
        docsPath,
        docsSlug: 'account',
        name: 'AccountNotFoundError',
      },
    )
  }
}

/**
 * Thrown by `getBlock` when the requested block does not exist — the node
 * returns an empty `{}` body for an unknown block number.
 */
export type BlockNotFoundErrorType = BlockNotFoundError & {
  name: 'BlockNotFoundError'
}
export class BlockNotFoundError extends BaseError {
  constructor({
    blockNumber,
  }: { blockNumber?: bigint | number | undefined } = {}) {
    super(
      `Block${
        blockNumber !== undefined ? ` "${blockNumber}"` : ''
      } could not be found.`,
      { name: 'BlockNotFoundError' },
    )
  }
}

// --- Reserved action-level error shells (fleshed out by T4/T5). ---------------
// These are minimal, functional `BaseError` subclasses so that the read/write
// action modules (RD-6 / WR-*) have stable import targets. T4/T5 own their
// message shapes and constructor parameters; keep the class names stable.

/** Generic wrapper for a failed TRON RPC call (T4/T5 flesh out `metaMessages`). */
export type TronRpcErrorType = TronRpcError & { name: 'TronRpcError' }
export class TronRpcError extends BaseError {
  constructor(
    shortMessage: string,
    args: {
      cause?: BaseError | Error | undefined
      details?: string | undefined
      docsPath?: string | undefined
      metaMessages?: string[] | undefined
    } = {},
  ) {
    super(shortMessage || 'An RPC error occurred.', {
      ...args,
      name: 'TronRpcError',
    })
  }
}

/**
 * A contract read (`triggerconstantcontract`) that reverted on-chain. RD-5
 * decodes the revert payload: `Error(string)` (selector `0x08c379a0`) yields a
 * human-readable `reason`; `Panic(uint256)` (selector `0x4e487b71`) yields a
 * numeric panic `code`; any other payload is surfaced as raw `data`.
 */
export type ContractFunctionRevertedErrorType =
  ContractFunctionRevertedError & {
    name: 'ContractFunctionRevertedError'
  }
export class ContractFunctionRevertedError extends BaseError {
  /** The decoded `Error(string)` revert reason, if present. */
  reason?: string | undefined
  /** The decoded `Panic(uint256)` code, if the revert was a panic. */
  code?: bigint | undefined
  /** The ABI signature of the decoded revert payload (e.g. `Error(string)`). */
  signature?: string | undefined
  /** The raw revert payload (`0x`-prefixed), if it could not be decoded. */
  data?: `0x${string}` | undefined

  constructor({
    code,
    data,
    docsPath,
    functionName,
    message,
    metaMessages,
    reason,
    signature,
  }: {
    code?: bigint | undefined
    data?: `0x${string}` | undefined
    docsPath?: string | undefined
    functionName?: string | undefined
    message?: string | undefined
    metaMessages?: string[] | undefined
    reason?: string | undefined
    signature?: string | undefined
  } = {}) {
    const target = functionName
      ? `The contract function "${functionName}" reverted`
      : 'The contract function reverted'
    const shortMessage = (() => {
      if (message) return message
      if (reason) return `${target} with the following reason:\n${reason}`
      if (code !== undefined)
        return `${target} with the following panic code: ${code}`
      return `${target}.`
    })()
    super(shortMessage, {
      docsPath,
      metaMessages,
      name: 'ContractFunctionRevertedError',
    })
    this.code = code
    this.data = data
    this.reason = reason
    this.signature = signature
  }
}

/** A top-level call execution failure (T4 RD-5 wraps the underlying cause). */
export type CallExecutionErrorType = CallExecutionError & {
  name: 'CallExecutionError'
}
export class CallExecutionError extends BaseError {
  constructor(
    cause: BaseError | Error,
    { docsPath }: { docsPath?: string | undefined } = {},
  ) {
    super('Execution reverted with an unexpected error.', {
      cause,
      docsPath,
      name: 'CallExecutionError',
    })
  }
}

/** `waitForTransactionReceipt` exceeded its timeout (T5 WR-5). */
export type WaitForTransactionReceiptTimeoutErrorType =
  WaitForTransactionReceiptTimeoutError & {
    name: 'WaitForTransactionReceiptTimeoutError'
  }
export class WaitForTransactionReceiptTimeoutError extends BaseError {
  constructor({ hash }: { hash?: string | undefined } = {}) {
    super(
      `Timed out while waiting for transaction${
        hash ? ` "${hash}"` : ''
      } to be confirmed.`,
      { name: 'WaitForTransactionReceiptTimeoutError' },
    )
  }
}

/** The broadcast transaction's reference block expired before inclusion (T5). */
export type TransactionExpiredErrorType = TransactionExpiredError & {
  name: 'TransactionExpiredError'
}
export class TransactionExpiredError extends BaseError {
  constructor({ hash }: { hash?: string | undefined } = {}) {
    super(
      `Transaction${
        hash ? ` "${hash}"` : ''
      } expired before it could be included in a block.`,
      { name: 'TransactionExpiredError' },
    )
  }
}

/**
 * Thrown when a node echoes back a transaction (e.g. from `getSignWeight` /
 * `getApprovedList`) whose `raw_data_hex` or `txID` does not byte-for-byte
 * match the locally built one. A malicious or man-in-the-middled node can
 * substitute a tampered `raw_data`; this SDK never signs or trusts the
 * node-supplied transaction, and surfaces the mismatch here so a multi-sig
 * flow fails closed instead of approving something other than what was built.
 */
export type TransactionTamperedErrorType = TransactionTamperedError & {
  name: 'TransactionTamperedError'
}
export class TransactionTamperedError extends BaseError {
  constructor({
    localTxId,
    nodeTxId,
    path,
  }: {
    localTxId?: string | undefined
    nodeTxId?: string | undefined
    path?: string | undefined
  } = {}) {
    super(
      [
        'The node returned a transaction that does not match the locally built one.',
        'This can indicate transaction tampering by a malicious or man-in-the-middled node.',
        'No signature was produced over the node-supplied transaction.',
      ].join('\n'),
      {
        name: 'TransactionTamperedError',
        metaMessages: [
          localTxId ? `Local txID: ${localTxId}` : undefined,
          nodeTxId ? `Node txID:  ${nodeTxId}` : undefined,
          path ? `Path: ${path}` : undefined,
        ].filter((m): m is string => Boolean(m)),
      },
    )
  }
}
