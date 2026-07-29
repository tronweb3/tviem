import { describe, expect, test } from 'vitest'
import {
  TronBroadcastError,
  TronContractValidateError,
} from '../../src/errors/node.js'
import type { TronRequestFn } from '../../src/types/transport.js'
import { rpc } from '../fixtures/rpc/loader.js'
import { createMockTransport } from './createMockTransport.js'

/** Builds a wired mock and its `buildRequest`-wrapped request fn. */
function setup(...args: Parameters<typeof createMockTransport>) {
  const mock = createMockTransport(...args)
  const { config, request } = mock.transport({})
  return { mock, config, request: request as TronRequestFn }
}

describe('createMockTransport', () => {
  test('exposes a Transport-shaped factory', () => {
    const { config } = setup({ responses: {} })
    expect(config.type).toBe('mock')
    expect(config.key).toBe('mock')
    expect(config.name).toBe('Mock Transport')
    expect(typeof config.request).toBe('function')
  })

  test('serves a { response } reply and passes it through normalization', async () => {
    const params = rpc('getchainparameters')
    const { request } = setup({
      responses: { getchainparameters: { response: params } },
    })
    await expect(
      request({ path: 'getchainparameters', body: {} }),
    ).resolves.toEqual(params)
  })

  test('records frozen call snapshots with resolved node/method defaults', async () => {
    const { mock, request } = setup({
      responses: { getnowblock: { response: { ok: true } } },
    })
    await request({ path: 'getnowblock', body: { a: 1 } })
    expect(mock.calls).toHaveLength(1)
    const call = mock.calls[0]!
    expect(call).toEqual({
      node: 'full',
      path: 'getnowblock',
      method: 'POST',
      body: { a: 1 },
    })
    expect(Object.isFrozen(call)).toBe(true)
    expect(mock.bodyOf('getnowblock')).toEqual({ a: 1 })
  })

  test('honors an explicit solidity node and GET method', async () => {
    const { mock, request } = setup({
      responses: { getaccount: { response: {} } },
    })
    await request({ node: 'solidity', method: 'GET', path: 'getaccount' })
    const call = mock.calls[0]!
    expect(call.node).toBe('solidity')
    expect(call.method).toBe('GET')
  })

  test('bodyOf indexes repeated calls to the same path', async () => {
    const { mock, request } = setup({
      responses: { triggerconstantcontract: { response: {} } },
    })
    await request({ path: 'triggerconstantcontract', body: { i: 0 } })
    await request({ path: 'triggerconstantcontract', body: { i: 1 } })
    expect(mock.bodyOf('triggerconstantcontract', 0)).toEqual({ i: 0 })
    expect(mock.bodyOf('triggerconstantcontract', 1)).toEqual({ i: 1 })
    expect(mock.bodyOf('triggerconstantcontract', 2)).toBeUndefined()
  })

  test('array reply is a polling queue with a sticky final entry', async () => {
    const { request } = setup({
      responses: {
        gettransactioninfobyid: [
          { response: {} },
          { response: {} },
          { response: { id: 'abc', receipt: { result: 'SUCCESS' } } },
        ],
      },
    })
    const call = () =>
      request<{ id?: string }>({ path: 'gettransactioninfobyid', body: {} })
    expect(await call()).toEqual({})
    expect(await call()).toEqual({})
    expect(await call()).toEqual({ id: 'abc', receipt: { result: 'SUCCESS' } })
    // Final entry is sticky.
    expect(await call()).toEqual({ id: 'abc', receipt: { result: 'SUCCESS' } })
  })

  test('{ fn } computes a dynamic reply from the request args', async () => {
    const { request } = setup({
      responses: {
        getaccount: { fn: (args) => ({ echoed: args.body }) },
      },
    })
    await expect(
      request({ path: 'getaccount', body: { address: '41abc' } }),
    ).resolves.toEqual({ echoed: { address: '41abc' } })
  })

  test('{ error } resolves a Form-2 body and normalizes to TronContractValidateError', async () => {
    const { request } = setup({
      responses: {
        triggersmartcontract: { error: rpc('errors/contract-validate') },
      },
    })
    const promise = request({ path: 'triggersmartcontract', body: {} })
    await expect(promise).rejects.toBeInstanceOf(TronContractValidateError)
    const error = (await promise.catch(
      (e: unknown) => e,
    )) as TronContractValidateError
    expect(error.code).toBe('CONTRACT_VALIDATE_ERROR')
    expect(error.node).toBe('full')
    expect(error.path).toBe('triggersmartcontract')
    // Hex message is decoded into the short message.
    expect(error.shortMessage).toBe(
      'Validate TransferContract error, balance is not sufficient',
    )
    // Raw response body is preserved verbatim.
    expect(error.response).toEqual(rpc('errors/contract-validate'))
  })

  test('{ error } resolves a Form-3 body and normalizes to TronBroadcastError', async () => {
    const { request } = setup({
      responses: {
        broadcasttransaction: { error: rpc('errors/tapos-expired') },
      },
    })
    const promise = request({ path: 'broadcasttransaction', body: {} })
    await expect(promise).rejects.toBeInstanceOf(TronBroadcastError)
    const error = (await promise.catch((e: unknown) => e)) as TronBroadcastError
    expect(error.code).toBe('TRANSACTION_EXPIRATION_ERROR')
    expect(error.txid).toBe(
      '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba',
    )
    expect(error.shortMessage).toBe('Transaction expired')
  })

  test('onUnmatched defaults to throw with a descriptive error', async () => {
    const { request } = setup({ responses: { getnowblock: { response: {} } } })
    await expect(request({ path: 'getaccount', body: {} })).rejects.toThrow(
      /No mock response for "full\/getaccount"/,
    )
  })

  test('onUnmatched can supply a catch-all default reply', async () => {
    const { request } = setup({
      responses: {},
      onUnmatched: { response: { fallback: true } },
    })
    await expect(request({ path: 'anything', body: {} })).resolves.toEqual({
      fallback: true,
    })
  })

  test('reset clears recorded calls and rewinds the queue', async () => {
    const { mock, request } = setup({
      responses: {
        gettransactioninfobyid: [
          { response: { step: 1 } },
          { response: { step: 2 } },
        ],
      },
    })
    await request({ path: 'gettransactioninfobyid', body: {} })
    await request({ path: 'gettransactioninfobyid', body: {} })
    expect(mock.calls).toHaveLength(2)
    mock.reset()
    expect(mock.calls).toHaveLength(0)
    // Queue rewound to the first entry.
    await expect(
      request({ path: 'gettransactioninfobyid', body: {} }),
    ).resolves.toEqual({ step: 1 })
  })
})
