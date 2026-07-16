import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import {
  TronBroadcastError,
  TronContractValidateError,
  TronNodeError,
  TronValidationError,
  UnknownNodeError,
} from '../../src/errors/node.js'

test('TronNodeError carries code / node / path / response', () => {
  const err = new TronNodeError('boom', {
    code: 'SIGERROR',
    node: 'full',
    path: 'broadcasttransaction',
    response: { code: 'SIGERROR' },
  })
  expect(err).toBeInstanceOf(BaseError)
  expect(err.name).toBe('TronNodeError')
  expect(err.code).toBe('SIGERROR')
  expect(err.node).toBe('full')
  expect(err.path).toBe('broadcasttransaction')
  expect(err.response).toEqual({ code: 'SIGERROR' })
  expect(err.message).toContain('Code: SIGERROR')
  expect(err.message).toContain('Node: full')
  expect(err.message).toContain('Path: broadcasttransaction')
})

test('the logical error subclasses extend TronNodeError', () => {
  expect(new TronValidationError('x')).toBeInstanceOf(TronNodeError)
  expect(new TronContractValidateError('x')).toBeInstanceOf(TronNodeError)
  expect(new TronBroadcastError('x')).toBeInstanceOf(TronNodeError)
  expect(new TronValidationError('x').name).toBe('TronValidationError')
  expect(new TronContractValidateError('x').name).toBe(
    'TronContractValidateError',
  )
  expect(new TronBroadcastError('x').name).toBe('TronBroadcastError')
})

test('TronBroadcastError carries txid', () => {
  const err = new TronBroadcastError('rejected', {
    code: 'TAPOS_ERROR',
    txid: 'deadbeef',
  })
  expect(err.txid).toBe('deadbeef')
  expect(err.message).toContain('Txid: deadbeef')
})

test('UnknownNodeError wraps an unexpected cause and is not a TronNodeError', () => {
  const err = new UnknownNodeError({ cause: new Error('weird') })
  expect(err).toBeInstanceOf(BaseError)
  expect(err).not.toBeInstanceOf(TronNodeError)
  expect(err.name).toBe('UnknownNodeError')
  expect(err.details).toBe('weird')
})
