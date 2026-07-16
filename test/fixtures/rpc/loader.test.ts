import { deriveRefBlockParams } from '../../../src/utils/transaction/prepareTransaction.js'
import { describe, expect, test } from 'vitest'
import { loadTxFixtureFile } from '../tx/loader.js'
import { rpc, rpcFixture, rpcFixtureNames, rpcReq } from './loader.js'

describe('rpc fixtures loader', () => {
  test('every base fixture loads with a well-formed envelope', () => {
    for (const name of rpcFixtureNames) {
      const fixture = rpcFixture(name)
      expect(fixture.endpoint).toBeTypeOf('string')
      expect(fixture.description).toBeTypeOf('string')
      expect(fixture.request.path).toBeTypeOf('string')
      expect(fixture).toHaveProperty('response')
      expect(fixture.recordedAt).toBeTypeOf('string')
      expect([
        'nile-recorded',
        'hand-crafted',
        'derived-from-tx-fixture',
      ]).toContain(fixture.source)
    }
  })

  test('rpc() returns only the response and rpcReq() only the request', () => {
    const fixture = rpcFixture('getchainparameters')
    expect(rpc('getchainparameters')).toEqual(fixture.response)
    expect(rpcReq('getchainparameters')).toEqual(fixture.request)
  })

  test('nested error fixtures load by path name', () => {
    const fixture = rpcFixture('errors/contract-validate')
    expect(fixture.endpoint).toBe('triggersmartcontract')
    expect((fixture.response as { result: { code: string } }).result.code).toBe(
      'CONTRACT_VALIDATE_ERROR',
    )
  })

  test('getnowblock.fixed derives the canonical transfer TaPoS (zero drift)', () => {
    const response = rpc<{
      blockID: string
      block_header: { raw_data: { number: number } }
    }>('getnowblock.fixed')
    const { refBlockBytes, refBlockHash } = deriveRefBlockParams(
      response.block_header.raw_data.number,
      response.blockID,
    )
    const transfer = loadTxFixtureFile('transfer-contract.json')[0]!
    const rawData = transfer.rawData as {
      ref_block_bytes: string
      ref_block_hash: string
    }
    expect(refBlockBytes).toBe(rawData.ref_block_bytes)
    expect(refBlockHash).toBe(rawData.ref_block_hash)
  })
})
