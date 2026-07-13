import { expect, test } from 'vitest'
import { toBase58 } from '../../utils/address/toBase58.js'
import { formatEvent, formatEventMeta } from './formatEvent.js'

const from = '0xafb6ccdb345bc36c69a618b66c1693f36213622b'
const to = '0x2e5531459778bee382355ab73bc93ee763f5ed94'
const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

test('normalizes a TronGrid Transfer event (named args only, typed)', () => {
  const e = formatEvent({
    block_number: 84_423_283,
    block_timestamp: 1_783_939_905_000,
    caller_contract_address: usdt,
    contract_address: usdt,
    event_index: 0,
    event_name: 'Transfer',
    result: {
      '0': from,
      '1': to,
      '2': '1500450000',
      from,
      to,
      value: '1500450000',
    },
    result_type: { from: 'address', to: 'address', value: 'uint256' },
    event: 'Transfer(address indexed from, address indexed to, uint256 value)',
    transaction_id:
      '19f67725574e5de75f75070de21ca3a618eae7606f52d07c582e490834af682d',
    _unconfirmed: true,
  })
  expect(e.blockNumber).toBe(84_423_283)
  expect(e.blockTimestamp).toBe(1_783_939_905_000n)
  expect(e.contractAddress).toBe(usdt)
  expect(e.callerContractAddress).toBe(usdt)
  expect(e.eventName).toBe('Transfer')
  expect(e.eventIndex).toBe(0)
  expect(e.args.from).toBe(toBase58(from))
  expect(e.args.to).toBe(toBase58(to))
  expect(e.args.value).toBe(1_500_450_000n)
  // Positional keys are dropped; only named args survive.
  expect(e.args['0']).toBeUndefined()
  expect(e.signature).toContain('Transfer(')
  expect(e.unconfirmed).toBe(true)
})

test('confirmed (no _unconfirmed) + bool and array conversion', () => {
  const e = formatEvent({
    contract_address: usdt,
    event_name: 'X',
    result: { flag: 'true', ids: ['1', '2'] },
    result_type: { flag: 'bool', ids: 'uint256[]' },
  })
  expect(e.unconfirmed).toBe(false)
  expect(e.args.flag).toBe(true)
  expect(e.args.ids).toEqual([1n, 2n])
})

test('falls back to named result values when result_type is absent', () => {
  const e = formatEvent({
    contract_address: usdt,
    result: { '0': 'x', foo: 'bar' },
  })
  expect(e.args.foo).toBe('bar')
  expect(e.args['0']).toBeUndefined()
})

test('formatEventMeta maps snake_case, omits absent fields', () => {
  expect(formatEventMeta({ fingerprint: 'fp', page_size: 2, at: 5 })).toEqual({
    fingerprint: 'fp',
    pageSize: 2,
    at: 5,
  })
  expect(formatEventMeta(undefined)).toEqual({})
})
