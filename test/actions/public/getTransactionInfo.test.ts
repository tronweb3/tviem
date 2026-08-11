import { expect, test } from 'vitest'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { TronRpcError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const successHash =
  '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const revertHash =
  '2e8b73373f830f8a100b11291c5e169a079552c212eb94b6c722247320adb698'

test('maps a successful TRC20 receipt (status, resources, log addresses)', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: {
      gettransactioninfobyid: {
        response: rpc('gettransactioninfobyid.success'),
      },
    },
  })
  const client = createPublicClient({ transport })

  const info = await client.getTransactionInfo({ hash: successHash })
  expect(info).not.toBeNull()
  if (!info) throw new Error('expected receipt')

  expect(info.id).toBe(successHash)
  expect(info.status).toBe('success')
  expect(info.blockNumber).toBe(4660n)
  expect(info.blockTimeStamp).toBe(1700000000000n)
  expect(info.energyUsageTotal).toBe(13000n)
  expect(info.energyFee).toBe(2730000n)
  expect(info.netUsage).toBe(345n)
  expect(info.fee).toBe(0n)
  expect(info.contractResult).toEqual([
    '0000000000000000000000000000000000000000000000000000000000000001',
  ])
  // contract_address 41-hex -> Base58.
  expect(info.contractAddress).toBe('TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY')

  // log[].address EVM-form bare hex -> Base58; topics/data get 0x-prefixed.
  const log = info.logs[0]
  expect(log).toBeDefined()
  if (!log) throw new Error('expected log')
  expect(log.address).toBe('TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY')
  expect(log.topics).toHaveLength(3)
  expect(log.topics[0]).toBe(
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  )
  expect(log.data).toBe(
    '0x00000000000000000000000000000000000000000000000000000000000f4240',
  )

  // sent-right: solidity node, `value` body.
  expect(calls[0]?.node).toBe('solidity')
  expect(calls[0]?.path).toBe('gettransactioninfobyid')
  expect(bodyOf('gettransactioninfobyid')).toEqual({ value: successHash })
})

test('maps a reverted receipt (receipt.result REVERT + result FAILED)', async () => {
  const { transport } = createMockTransport({
    responses: {
      gettransactioninfobyid: {
        response: rpc('gettransactioninfobyid.reverted'),
      },
    },
  })
  const client = createPublicClient({ transport })

  const info = await client.getTransactionInfo({ hash: revertHash })
  if (!info) throw new Error('expected receipt')
  expect(info.status).toBe('reverted')
  expect(info.logs).toHaveLength(0)
  expect(info.contractResult[0]?.startsWith('08c379a0')).toBe(true)
})

test('a plain transfer (no receipt.result, result != FAILED) is success', async () => {
  const { transport } = createMockTransport({
    responses: {
      gettransactioninfobyid: {
        fn: () => ({ id: 'aa', blockNumber: 5, receipt: { net_usage: 268 } }),
      },
    },
  })
  const client = createPublicClient({ transport })

  const info = await client.getTransactionInfo({ hash: 'aa' })
  if (!info) throw new Error('expected receipt')
  expect(info.status).toBe('success')
  expect(info.netUsage).toBe(268n)
  expect(info.logs).toHaveLength(0)
})

// A log missing its address omits the field instead of fabricating
// the null address ('41' alone was never a valid address form).
test('a log missing its address is omitted', async () => {
  const { transport } = createMockTransport({
    responses: {
      gettransactioninfobyid: {
        fn: () => ({
          id: 'aa',
          blockNumber: 5,
          receipt: { result: 'SUCCESS' },
          log: [{ topics: ['ff'.repeat(32)], data: '00' }],
        }),
      },
    },
  })
  const client = createPublicClient({ transport })

  const info = await client.getTransactionInfo({ hash: 'aa' })
  if (!info) throw new Error('expected receipt')
  const log = info.logs[0]
  if (!log) throw new Error('expected log')
  expect(log.address).toBeUndefined()
  expect('address' in log).toBe(false)
  expect(log.topics[0]).toBe(`0x${'ff'.repeat(32)}`)
})

// The node emits log addresses in EVM form (bare 20-byte hex), but a
// 41-prefixed 21-byte value must keep converting to the same Base58 address.
test('a 41-prefixed log address also converts to Base58', async () => {
  const { transport } = createMockTransport({
    responses: {
      gettransactioninfobyid: {
        fn: () => ({
          id: 'aa',
          blockNumber: 5,
          receipt: { result: 'SUCCESS' },
          log: [
            {
              address: '41928c9af0651632157ef27a2cf17ca72c575a4d21',
              topics: [],
              data: '00',
            },
          ],
        }),
      },
    },
  })
  const client = createPublicClient({ transport })

  const info = await client.getTransactionInfo({ hash: 'aa' })
  if (!info) throw new Error('expected receipt')
  expect(info.logs[0]?.address).toBe('TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY')
})

// A non-empty receipt without a usable blockNumber is malformed — reporting
// block 0 instead would let a confirmation counter see the receipt as `head`
// blocks deep and pass any requested depth. The guard requires an actual
// positive safe-integer number: `null`, explicit `0`, a `-1` sentinel, the
// string "0" (a spec-conformant proto3-JSON re-serializer's int64 default)
// and a fractional value all count as absence, and none may escape as a raw
// BigInt() engine error.
test('throws on a non-empty receipt without a valid blockNumber', async () => {
  const bodies = [
    { id: 'aa', receipt: { net_usage: 268 } },
    { id: 'aa', blockNumber: null },
    { id: 'aa', blockNumber: 0 },
    { id: 'aa', blockNumber: -1 },
    { id: 'aa', blockNumber: '4660' },
    { id: 'aa', blockNumber: 1.5 },
  ]
  for (const body of bodies) {
    const { transport } = createMockTransport({
      responses: { gettransactioninfobyid: { fn: () => body } },
    })
    const client = createPublicClient({ transport })

    const err = (await client
      .getTransactionInfo({ hash: 'aa' })
      .catch((e) => e)) as TronRpcError
    expect(err).toBeInstanceOf(TronRpcError)
    expect(err.message).toContain('without a valid blockNumber')
  }
})

test('an unpacked transaction ({}) returns null', async () => {
  const { transport } = createMockTransport({
    responses: { gettransactioninfobyid: { response: {} } },
  })
  const client = createPublicClient({ transport })

  expect(await client.getTransactionInfo({ hash: 'deadbeef' })).toBeNull()
})
