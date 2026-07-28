import { expect, test } from 'vitest'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BlockNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const rawBlock = {
  blockID: 'aa'.repeat(32),
  block_header: {
    raw_data: {
      number: 100,
      timestamp: 1700000000000,
      witness_address: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
    },
  },
}

test('reads and formats the latest block', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getnowblock: { response: rawBlock } },
  })
  const client = createPublicClient({ transport })
  const block = await client.getNowBlock()
  expect(block.number).toBe(100n)
  expect(block.witnessAddress).toBe('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')
  expect(calls[0]?.path).toBe('getnowblock')
})

// F-9R2 (day 9): an empty {} body is "no block", not a block whose every
// field defaulted — and must not surface as a baffling InvalidAddressError.
test('an empty {} body throws BlockNotFoundError', async () => {
  const { transport } = createMockTransport({
    responses: { getnowblock: { response: {} } },
  })
  const client = createPublicClient({ transport })
  await expect(client.getNowBlock()).rejects.toBeInstanceOf(BlockNotFoundError)
})

// A block missing witness_address degrades to the null address instead of
// crashing the formatter ('41' alone was never a valid address form).
test('a missing witness_address degrades to the null address', async () => {
  const { transport } = createMockTransport({
    responses: {
      getnowblock: {
        response: {
          blockID: 'bb'.repeat(32),
          block_header: { raw_data: { number: 7 } },
        },
      },
    },
  })
  const client = createPublicClient({ transport })
  const block = await client.getNowBlock()
  expect(block.witnessAddress).toBe('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb')
})
