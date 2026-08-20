import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  http,
  normalizeTronError,
} from '../../../src/clients/transports/http.js'
import {
  TronBroadcastError,
  TronContractValidateError,
  TronNodeError,
} from '../../../src/errors/node.js'
import { HttpRequestError } from '../../../src/errors/request.js'
import { UrlRequiredError } from '../../../src/errors/transport.js'
import { stringToHex } from '../../../src/utils/encoding/toHex.js'

const HOST = 'https://node.example'
const API_KEY = 'super-secret-key'

/** UTF-8 → hex, as TRON encodes node error messages. */
const hexMsg = (s: string) => Buffer.from(s, 'utf8').toString('hex')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function transport(config = {}) {
  return http(HOST, { apiKey: API_KEY, ...config })({})
}

test('throws UrlRequiredError when no url and no chain', () => {
  expect(() => http()({})).toThrow(UrlRequiredError)
})

test('POST full node: url, method, headers and JSON body', async () => {
  const t = transport()
  await t.config.request({
    node: 'full',
    path: 'getaccount',
    body: { address: '4112' },
  })
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(`${HOST}/wallet/getaccount`)
  expect(init.method).toBe('POST')
  const headers = new Headers(init.headers)
  expect(headers.get('Content-Type')).toBe('application/json')
  expect(headers.get('TRON-PRO-API-KEY')).toBe(API_KEY)
  expect(init.body).toBe(JSON.stringify({ address: '4112' }))
})

test('solidity node routes to the /walletsolidity prefix', async () => {
  const t = transport()
  await t.config.request({ node: 'solidity', path: 'getaccount', body: {} })
  const [url] = fetchMock.mock.calls[0] as [string]
  expect(url).toBe(`${HOST}/walletsolidity/getaccount`)
})

test('event node routes a /v1 path to the event host root (no wallet prefix)', async () => {
  const t = transport({ eventUrl: 'https://event.example' })
  await t.config.request({
    node: 'event',
    path: '/v1/contracts/TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe/events',
    method: 'GET',
  })
  const [url] = fetchMock.mock.calls[0] as [string]
  expect(url).toBe(
    'https://event.example/v1/contracts/TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe/events',
  )
})

test('node defaults to full; GET sends no body', async () => {
  const t = transport()
  await t.config.request({ path: 'getnowblock', method: 'GET' })
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(`${HOST}/wallet/getnowblock`)
  expect(init.method).toBe('GET')
  expect(init.body).toBeUndefined()
})

test('leading-slash path escapes the node prefix', async () => {
  const t = transport()
  await t.config.request({ path: '/jsonrpc', body: {} })
  const [url] = fetchMock.mock.calls[0] as [string]
  expect(url).toBe(`${HOST}/jsonrpc`)
})

test('normal business object passes through', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ balance: 5 }))
  const t = transport()
  await expect(
    t.config.request({ node: 'solidity', path: 'getaccount', body: {} }),
  ).resolves.toEqual({ balance: 5 })
})

test('{ result: true } passes through', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ result: true, txid: 'ab' }))
  const t = transport()
  await expect(
    t.config.request({ path: 'broadcasttransaction', body: {} }),
  ).resolves.toEqual({ result: true, txid: 'ab' })
})

test('form 1: { Error } → TronValidationError (plaintext)', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ Error: 'validation failed' }))
  const t = transport()
  await expect(
    t.config.request({ path: 'broadcasttransaction', body: {} }),
  ).rejects.toMatchObject({
    name: 'TronValidationError',
    shortMessage: 'validation failed',
  })
})

test('form 2: { result: { code, message } } → TronContractValidateError (hex decoded)', async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      result: {
        code: 'CONTRACT_VALIDATE_ERROR',
        message: hexMsg('bad contract'),
      },
    }),
  )
  const t = transport()
  const err: any = await t.config
    .request({ path: 'triggersmartcontract', body: {} })
    .catch((e) => e)
  expect(err).toBeInstanceOf(TronContractValidateError)
  expect(err.code).toBe('CONTRACT_VALIDATE_ERROR')
  expect(err.shortMessage).toBe('bad contract')
})

test('form 3: { result: false, code } → TronBroadcastError (txid)', async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      result: false,
      code: 'TAPOS_ERROR',
      message: hexMsg('tapos check failed'),
      txid: 'cafe',
    }),
  )
  const t = transport()
  const err: any = await t.config
    .request({ path: 'broadcasttransaction', body: {} })
    .catch((e) => e)
  expect(err).toBeInstanceOf(TronBroadcastError)
  expect(err.code).toBe('TAPOS_ERROR')
  expect(err.txid).toBe('cafe')
  expect(err.shortMessage).toBe('tapos check failed')
})

test('form 4: top-level { code } → TronNodeError', async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ code: 'SIGERROR', message: hexMsg('bad signature') }),
  )
  const t = transport()
  const err: any = await t.config
    .request({ path: 'broadcasttransaction', body: {} })
    .catch((e) => e)
  expect(err).toBeInstanceOf(TronNodeError)
  expect(err.code).toBe('SIGERROR')
  expect(err.shortMessage).toBe('bad signature')
})

test('non-2xx → HttpRequestError with status', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ nope: 1 }, 500))
  const t = transport()
  const err: any = await t.config
    .request({ path: 'getnowblock', method: 'GET' })
    .catch((e) => e)
  expect(err).toBeInstanceOf(HttpRequestError)
  expect(err.status).toBe(500)
})

test('fetch failure → HttpRequestError', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('network down'))
  const t = transport()
  await expect(
    t.config.request({ path: 'getnowblock', method: 'GET' }),
  ).rejects.toBeInstanceOf(HttpRequestError)
})

test('raw mode skips normalization', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ Error: 'validation failed' }))
  const t = transport({ raw: true })
  await expect(
    t.config.request({ path: 'broadcasttransaction', body: {} }),
  ).resolves.toEqual({ Error: 'validation failed' })
})

test('errors never leak the API key', async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ code: 'SIGERROR', message: hexMsg('bad signature') }),
  )
  const t = transport()
  const err: any = await t.config
    .request({ path: 'broadcasttransaction', body: { secret: 1 } })
    .catch((e) => e)
  const serialized = `${err.message}\n${JSON.stringify(err.response)}`
  expect(serialized).not.toContain(API_KEY)
})

test('value exposes fullUrl / solidityUrl / fetchOptions', () => {
  const t = http(HOST, {
    apiKey: API_KEY,
    solidityUrl: 'https://solidity.example',
  })({})
  expect(t.value?.fullUrl).toBe(HOST)
  expect(t.value?.solidityUrl).toBe('https://solidity.example')
  // headers is a `Headers` instance: lookup is by the platform API,
  // case-insensitively, not by object indexing.
  expect((t.value?.fetchOptions?.headers as Headers).get('tron-pro-api-key')).toBe(
    API_KEY,
  )
})

test('solidityUrl defaults to the full url', () => {
  const t = http(HOST)({})
  expect(t.value?.solidityUrl).toBe(HOST)
})

test('eventUrl comes from config, else defaults to the full url', () => {
  expect(
    http(HOST, { eventUrl: 'https://event.example' })({}).value?.eventUrl,
  ).toBe('https://event.example')
  expect(http(HOST)({}).value?.eventUrl).toBe(HOST)
})

test('normalizeTronError returns non-object bodies unchanged', () => {
  expect(normalizeTronError(null, { node: 'full', path: 'x' })).toBe(null)
  expect(normalizeTronError('ok', { node: 'full', path: 'x' })).toBe('ok')
})

// --- normalizeTronError (called directly): hex decode + graceful passthrough.
// `'full'` is the valid TronNode role (the task's `'fullNode'` isn't a member).
const NODE = { node: 'full', path: '/wallet/triggersmartcontract' } as const

/** Runs `fn`, returning the error it throws (fails if it doesn't throw). */
function caught(fn: () => unknown): any {
  try {
    fn()
  } catch (e) {
    return e
  }
  throw new Error('expected the call to throw')
}

test('normalizeTronError form 2: hex message → TronContractValidateError (decoded)', () => {
  const err = caught(() =>
    normalizeTronError(
      {
        result: {
          code: 'CONTRACT_VALIDATE_ERROR',
          message: stringToHex('insufficient balance'),
        },
      },
      NODE,
    ),
  )
  expect(err).toBeInstanceOf(TronContractValidateError)
  expect(err.code).toBe('CONTRACT_VALIDATE_ERROR')
  expect(err.shortMessage).toBe('insufficient balance')
  expect(err.node).toBe('full')
  expect(err.path).toBe('/wallet/triggersmartcontract')
})

test('normalizeTronError form 3: { result:false, code, hex message, txid } → TronBroadcastError', () => {
  const err = caught(() =>
    normalizeTronError(
      {
        result: false,
        code: 'SIGERROR',
        message: stringToHex('signature error'),
        txid: 'deadbeef01',
      },
      NODE,
    ),
  )
  expect(err).toBeInstanceOf(TronBroadcastError)
  expect(err.code).toBe('SIGERROR')
  expect(err.txid).toBe('deadbeef01')
  expect(err.shortMessage).toBe('signature error')
})

test('normalizeTronError form 4: non-success top-level code + hex message → TronNodeError', () => {
  const err = caught(() =>
    normalizeTronError(
      { code: 'SOME_ERR', message: stringToHex('some node error') },
      NODE,
    ),
  )
  expect(err).toBeInstanceOf(TronNodeError)
  expect(err.code).toBe('SOME_ERR')
  expect(err.shortMessage).toBe('some node error')
})

test('normalizeTronError decodes a message with the 0x prefix stripped', () => {
  const err = caught(() =>
    normalizeTronError(
      { code: 'SOME_ERR', message: stringToHex('no prefix').slice(2) },
      NODE,
    ),
  )
  expect(err.shortMessage).toBe('no prefix')
})

test('normalizeTronError passes a non-hex message through undecoded', () => {
  const err = caught(() =>
    normalizeTronError(
      { code: 'SOME_ERR', message: 'CONTRACT_VALIDATE_ERROR' },
      NODE,
    ),
  )
  expect(err.shortMessage).toBe('CONTRACT_VALIDATE_ERROR')
})

test('normalizeTronError passes an odd-length hex message through undecoded', () => {
  const err = caught(() =>
    normalizeTronError({ code: 'SOME_ERR', message: 'abc' }, NODE),
  )
  expect(err.shortMessage).toBe('abc')
})

test('normalizeTronError decodes an empty message to "" (falls back to default text)', () => {
  const err = caught(() =>
    normalizeTronError({ code: 'SOME_ERR', message: '' }, NODE),
  )
  expect(err.code).toBe('SOME_ERR')
  expect(err.shortMessage).toBe('The node returned an error.')
})

test('normalizeTronError returns { result: true } unchanged (no throw)', () => {
  const body = { result: true, txid: 'ab' }
  expect(normalizeTronError(body, NODE)).toBe(body)
})

test('normalizeTronError returns a SUCCESS-code body unchanged (no throw)', () => {
  const body = { code: 'SUCCESS', result: true }
  expect(normalizeTronError(body, NODE)).toBe(body)
})

// java-tron renders int64 fields as bare JSON numbers; a naive JSON.parse
// corrupts them past 2^53-1 before any BigInt() coercion can help. The body
// MUST be built from raw text — a JS number literal in this test file would
// itself already be corrupted at source-parse time.
test('re-materializes unsafe integer literals losslessly as bigint', async () => {
  fetchMock.mockResolvedValueOnce(
    new Response('{"balance":9007199254740993,"small":5,"note":"ok"}'),
  )
  const t = transport()
  const body = (await t.config.request({
    node: 'solidity',
    path: 'getaccount',
    body: {},
  })) as { balance: unknown; small: unknown; note: unknown }
  expect(body.balance).toBe(9007199254740993n) // 2^53 + 1, exact
  expect(body.small).toBe(5) // safe integers stay numbers
  expect(body.note).toBe('ok')
})

// `fetch` resolves on response HEADERS; the body can still be streaming. The
// timeout and the caller's AbortSignal must stay armed until the body has been
// read, or a trickling node hangs the call with both safety nets already
// disconnected. These pin the whole lifetime, not just the fetch phase.

/** A response whose headers are ready but whose body never settles. */
function stallingBody(signal: AbortSignal | undefined, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: () =>
      new Promise<string>((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(
            Object.assign(new Error('The operation was aborted.'), {
              name: 'AbortError',
            }),
          ),
        )
      }),
  } as unknown as Response
}

test('the timeout covers the response body, not just the headers', async () => {
  const transport = http('https://node.example', {
    timeout: 20,
    retryCount: 0,
    fetchFn: ((_url: string, init: RequestInit) =>
      Promise.resolve(stallingBody(init.signal ?? undefined))) as never,
  })({})

  await expect(
    transport.request({ path: 'wallet/getnowblock', body: {} }),
  ).rejects.toThrow(/timed out/i)
})

test('the timeout covers a stalling ERROR body too', async () => {
  const transport = http('https://node.example', {
    timeout: 20,
    retryCount: 0,
    fetchFn: ((_url: string, init: RequestInit) =>
      Promise.resolve(stallingBody(init.signal ?? undefined, 500))) as never,
  })({})

  // Not a bare status-500 HttpRequestError: nothing ever came back to explain
  // the 500, and the reason the call ended was the timeout.
  await expect(
    transport.request({ path: 'wallet/getnowblock', body: {} }),
  ).rejects.toThrow(/timed out/i)
})

test("a caller's AbortSignal still cancels once the body is streaming", async () => {
  const controller = new AbortController()
  const transport = http('https://node.example', {
    timeout: 10_000,
    retryCount: 0,
    fetchFn: ((_url: string, init: RequestInit) => {
      // Headers have arrived; the caller changes its mind afterwards.
      setTimeout(() => controller.abort(), 5)
      return Promise.resolve(stallingBody(init.signal ?? undefined))
    }) as never,
  })({})

  const err = (await transport
    .request(
      { path: 'wallet/getnowblock', body: {} },
      { signal: controller.signal },
    )
    .catch((e) => e)) as Error
  // The caller's abort propagates as an abort — never as the transport's own
  // TimeoutError, and never as a status-200 HttpRequestError.
  expect(err.name).toBe('AbortError')
})

test('an abort during the body read is not reported as a status-200 error', async () => {
  const transport = http('https://node.example', {
    timeout: 20,
    retryCount: 0,
    fetchFn: ((_url: string, init: RequestInit) =>
      Promise.resolve(stallingBody(init.signal ?? undefined))) as never,
  })({})

  const err = (await transport
    .request({ path: 'wallet/getnowblock', body: {} })
    .catch((e) => e)) as HttpRequestError & { status?: number }
  expect(err).not.toBeInstanceOf(HttpRequestError)
  expect(err.status).toBeUndefined()
})

// Header merging goes through the platform `Headers` class, so every legal
// `HeadersInit` form survives and names merge case-insensitively. The old
// object spread silently emptied a `Headers` instance, turned a tuple list
// into a header named "0", and let a lowercase `content-type` or
// `tron-pro-api-key` ride alongside the default as a duplicate.

/** What actually reaches fetch, re-materialized through the platform. */
function capturedHeaders(fetchOptions: RequestInit) {
  let seen: Headers | undefined
  const transport = http('https://node.example', {
    apiKey: 'config-key',
    fetchOptions: fetchOptions as never,
    retryCount: 0,
    fetchFn: (async (_url: string, init: RequestInit) => {
      seen = new Headers(init.headers)
      return new Response('{}', { status: 200 })
    }) as never,
  })({})
  return transport
    .request({ path: 'wallet/getnowblock', body: {} })
    .then(() => seen!)
}

test('a Headers-instance fetchOptions.headers survives the merge', async () => {
  const seen = await capturedHeaders({
    headers: new Headers([['X-Custom', 'a']]),
  })
  expect(seen.get('X-Custom')).toBe('a')
  expect(seen.get('Content-Type')).toBe('application/json')
})

test('a tuple-list fetchOptions.headers survives the merge', async () => {
  const seen = await capturedHeaders({ headers: [['X-Custom', 'b']] })
  expect(seen.get('X-Custom')).toBe('b')
  expect(seen.get('0')).toBeNull() // the spread artifact must not exist
})

test("a caller's explicit content-type wins over the JSON default", async () => {
  const seen = await capturedHeaders({
    headers: { 'content-type': 'text/plain' },
  })
  expect(seen.get('Content-Type')).toBe('text/plain')
})

test('the config apiKey wins over any header spelling of the key', async () => {
  const seen = await capturedHeaders({
    headers: { 'tron-pro-api-key': 'stale-header-key' },
  })
  // Exactly one key on the wire, and it is the config's.
  expect(seen.get('TRON-PRO-API-KEY')).toBe('config-key')
})
