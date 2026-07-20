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

test('TronValidationError carries code / node / path / response', () => {
  const response = { Error: 'contract validate error' }
  const err = new TronValidationError('contract validate error', {
    code: 'CONTRACT_VALIDATE_ERROR',
    node: 'full',
    path: 'broadcasttransaction',
    response,
  })
  expect(err).toBeInstanceOf(TronNodeError)
  expect(err.name).toBe('TronValidationError')
  expect(err.code).toBe('CONTRACT_VALIDATE_ERROR')
  expect(err.node).toBe('full')
  expect(err.path).toBe('broadcasttransaction')
  expect(err.response).toEqual(response)
  expect(err.shortMessage).toBe('contract validate error')
})

test('TronContractValidateError carries code / node / path / response', () => {
  const response = {
    result: { code: 'CONTRACT_VALIDATE_ERROR', message: 'insufficient balance' },
  }
  const err = new TronContractValidateError('insufficient balance', {
    code: 'CONTRACT_VALIDATE_ERROR',
    node: 'full',
    path: 'triggersmartcontract',
    response,
  })
  expect(err).toBeInstanceOf(TronNodeError)
  expect(err.name).toBe('TronContractValidateError')
  expect(err.code).toBe('CONTRACT_VALIDATE_ERROR')
  expect(err.node).toBe('full')
  expect(err.path).toBe('triggersmartcontract')
  expect(err.response).toEqual(response)
  expect(err.shortMessage).toBe('insufficient balance')
})

test('UnknownNodeError wraps an unexpected cause and is not a TronNodeError', () => {
  const err = new UnknownNodeError({ cause: new Error('weird') })
  expect(err).toBeInstanceOf(BaseError)
  expect(err).not.toBeInstanceOf(TronNodeError)
  expect(err.name).toBe('UnknownNodeError')
  expect(err.details).toBe('weird')
})
