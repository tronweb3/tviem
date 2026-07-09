import type { TronNode } from '../types/transport.js'
import { BaseError } from './base.js'

export type TronNodeErrorParameters = {
  cause?: BaseError | Error | undefined
  /** TRON error code, e.g. `'CONTRACT_VALIDATE_ERROR'`, `'SIGERROR'`. */
  code?: string | undefined
  details?: string | undefined
  metaMessages?: string[] | undefined
  name?: string | undefined
  /** The node role the request was routed to. */
  node?: TronNode | undefined
  /** The endpoint path (never the host / API key). */
  path?: string | undefined
  /** The raw (already-decoded) response body. Never carries request headers. */
  response?: unknown
}

export type TronNodeErrorType = TronNodeError & { name: 'TronNodeError' }
/**
 * Base class for logical errors returned by a TRON node.
 *
 * TRON commonly returns HTTP 200 with an error body, so these are surfaced by
 * the transport's response normalization rather than by HTTP status. The
 * carried `response` is the decoded body only — request headers (and the
 * `TRON-PRO-API-KEY`) are never attached.
 */
export class TronNodeError extends BaseError {
  code?: string | undefined
  node?: TronNode | undefined
  path?: string | undefined
  response?: unknown

  constructor(shortMessage: string, args: TronNodeErrorParameters = {}) {
    super(shortMessage || 'The node returned an error.', {
      cause: args.cause,
      details: args.details,
      metaMessages: [
        args.code && `Code: ${args.code}`,
        args.node && `Node: ${args.node}`,
        args.path && `Path: ${args.path}`,
        ...(args.metaMessages ?? []),
      ].filter(Boolean) as string[],
      name: args.name ?? 'TronNodeError',
    })
    this.code = args.code
    this.node = args.node
    this.path = args.path
    this.response = args.response
  }
}

export type TronValidationErrorType = TronValidationError & {
  name: 'TronValidationError'
}
/** Node rejected the request with a plaintext `{ Error: string }` body. */
export class TronValidationError extends TronNodeError {
  constructor(
    message: string,
    args: Omit<TronNodeErrorParameters, 'name'> = {},
  ) {
    super(message, { ...args, name: 'TronValidationError' })
  }
}

export type TronContractValidateErrorType = TronContractValidateError & {
  name: 'TronContractValidateError'
}
/** Node rejected a contract call/build with `{ result: { code, message } }`. */
export class TronContractValidateError extends TronNodeError {
  constructor(
    message: string,
    args: Omit<TronNodeErrorParameters, 'name'> = {},
  ) {
    super(message, { ...args, name: 'TronContractValidateError' })
  }
}

export type TronBroadcastErrorType = TronBroadcastError & {
  name: 'TronBroadcastError'
}
/** Node rejected a broadcast with `{ result: false, code, message }`. */
export class TronBroadcastError extends TronNodeError {
  /** The transaction id the broadcast was rejected for, if reported. */
  txid?: string | undefined

  constructor(
    message: string,
    args: Omit<TronNodeErrorParameters, 'name'> & {
      txid?: string | undefined
    } = {},
  ) {
    const { txid, ...rest } = args
    super(message, {
      ...rest,
      name: 'TronBroadcastError',
      metaMessages: [
        ...(rest.metaMessages ?? []),
        txid && `Txid: ${txid}`,
      ].filter(Boolean) as string[],
    })
    this.txid = txid
  }
}

export type UnknownNodeErrorType = UnknownNodeError & {
  name: 'UnknownNodeError'
}
/** Wraps a non-{@link BaseError} thrown while processing a node request. */
export class UnknownNodeError extends BaseError {
  constructor({ cause }: { cause?: BaseError | Error | undefined } = {}) {
    super('An unknown node error occurred while processing the request.', {
      cause,
      name: 'UnknownNodeError',
    })
  }
}
