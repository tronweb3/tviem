import { expect, test } from 'vitest'

import { TronRpcError } from '../../errors/rpc.js'
import { assertRpcSuccess } from './normalizeResponse.js'

test('passes through a normal business object', () => {
  expect(() => assertRpcSuccess({ balance: 1 })).not.toThrow()
  expect(() => assertRpcSuccess({ result: { result: true } })).not.toThrow()
})

test('ignores non-object bodies', () => {
  expect(() => assertRpcSuccess(null)).not.toThrow()
  expect(() => assertRpcSuccess(undefined)).not.toThrow()
  expect(() => assertRpcSuccess('ok')).not.toThrow()
})

test('throws on a nested { result: { result: false } } failure', () => {
  expect(() =>
    assertRpcSuccess(
      { result: { result: false, code: 'CONTRACT_EXE', message: 'boom' } },
      { path: 'triggerconstantcontract' },
    ),
  ).toThrow(TronRpcError)
})

test('throws on a top-level { result: false } rejection', () => {
  let thrown: unknown
  try {
    assertRpcSuccess({ result: false, code: 'SIGERROR', message: 'bad sig' })
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(TronRpcError)
  expect((thrown as TronRpcError).metaMessages).toContain('Code: SIGERROR')
})
