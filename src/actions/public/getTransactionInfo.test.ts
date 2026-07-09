import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'

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

  // log[].address 41-hex -> Base58; topics/data get 0x-prefixed.
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

test('an unpacked transaction ({}) returns null', async () => {
  const { transport } = createMockTransport({
    responses: { gettransactioninfobyid: { response: {} } },
  })
  const client = createPublicClient({ transport })

  expect(await client.getTransactionInfo({ hash: 'deadbeef' })).toBeNull()
})
