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

// An empty {} body is "no block", not a block whose every
// field defaulted — and must not surface as a baffling InvalidAddressError.
test('an empty {} body throws BlockNotFoundError', async () => {
  const { transport } = createMockTransport({
    responses: { getnowblock: { response: {} } },
  })
  const client = createPublicClient({ transport })
  await expect(client.getNowBlock()).rejects.toBeInstanceOf(BlockNotFoundError)
})

// A block missing witness_address omits the field instead of fabricating
// the null address ('41' alone was never a valid address form).
test('a missing witness_address is omitted', async () => {
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
  expect(block.witnessAddress).toBeUndefined()
  expect('witnessAddress' in block).toBe(false)
})

// Node routing: the chain head comes from the FullNode by default; confirmed
// switches to the SolidityNode's solidified head.
test('confirmed: true reads the solidified head from the SolidityNode', async () => {
  const def = createMockTransport({
    responses: { getnowblock: { response: rawBlock } },
  })
  await createPublicClient({ transport: def.transport }).getNowBlock()
  expect(def.calls[0]?.node).toBe('full')

  const sol = createMockTransport({
    responses: { getnowblock: { response: rawBlock } },
  })
  await createPublicClient({ transport: sol.transport }).getNowBlock({
    confirmed: true,
  })
  expect(sol.calls[0]?.node).toBe('solidity')
})
