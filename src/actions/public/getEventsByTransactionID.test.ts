import { expect, test } from 'vitest'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { BaseError } from '../../errors/base.js'
import { getEventsByTransactionID } from './getEventsByTransactionID.js'

const txID = '19f67725574e5de75f75070de21ca3a618eae7606f52d07c582e490834af682d'

test('reads a transaction’s events from /v1/transactions/{txID}/events', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [
          {
            event_name: 'Transfer',
            contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          },
        ],
        success: true,
      },
    },
  })
  const client = createPublicClient({ transport })

  const { events } = await getEventsByTransactionID(client, {
    txID,
    onlyConfirmed: true,
  })
  expect(events).toHaveLength(1)
  const call = calls[0]
  expect(call?.node).toBe('event')
  expect(call?.path).toContain(`/v1/transactions/${txID}/events`)
  expect(call?.path).toContain('only_confirmed=true')
})

test('strips a 0x prefix and rejects a malformed id', async () => {
  const { transport } = createMockTransport({
    responses: {},
    onUnmatched: { response: { data: [], success: true } },
  })
  const client = createPublicClient({ transport })
  await expect(
    getEventsByTransactionID(client, { txID: 'not-a-txid' }),
  ).rejects.toBeInstanceOf(BaseError)
})
