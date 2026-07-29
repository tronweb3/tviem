import { expect, test } from 'vitest'
import {
  getEnergyFee,
  getTransactionFee,
} from '../../../src/actions/public/getChainParameters.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

test('maps chainParameter[] to a bigint map, absent value -> 0n', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { getchainparameters: { response: rpc('getchainparameters') } },
  })
  const client = createPublicClient({ transport })

  const params = await client.getChainParameters()
  expect(params.getEnergyFee).toBe(210n)
  expect(params.getTransactionFee).toBe(1000n)
  expect(params.getMaxFeeLimit).toBe(15000000000n)
  // `getAllowAdaptiveEnergy` has no `value` in the fixture -> 0n.
  expect(params.getAllowAdaptiveEnergy).toBe(0n)

  // sent-right: full node, empty body.
  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('getchainparameters')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('getchainparameters')).toEqual({})
})

test('convenience getters read a fee (or 0n when absent)', async () => {
  const { transport } = createMockTransport({
    responses: { getchainparameters: { response: rpc('getchainparameters') } },
  })
  const client = createPublicClient({ transport })

  const params = await client.getChainParameters()
  expect(getEnergyFee(params)).toBe(210n)
  expect(getTransactionFee(params)).toBe(1000n)
  expect(getEnergyFee({})).toBe(0n)
  expect(getTransactionFee({})).toBe(0n)
})
