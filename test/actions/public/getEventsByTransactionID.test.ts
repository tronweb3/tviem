import { expect, test } from 'vitest'
import { getEventsByTransactionID } from '../../../src/actions/public/getEventsByTransactionID.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const txID = '19f67725574e5de75f75070de21ca3a618eae7606f52d07c582e490834af682d'

test('reads a transaction’s events from /v1/transactions/{txID}/events', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [
          {
            event_name: 'Transfer',
            contract_address: 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe',
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

// F-9E1: expose limit + the fingerprint cursor and return meta, instead of
// silently dropping later pages of a multi-event transaction.
test('forwards limit + fingerprint and returns the pagination meta', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [],
        success: true,
        meta: { fingerprint: 'fp', page_size: 20 },
      },
    },
  })
  const client = createPublicClient({ transport })
  const { meta } = await getEventsByTransactionID(client, {
    txID,
    limit: 200,
    fingerprint: 'prev',
  })
  expect(meta.fingerprint).toBe('fp')
  expect(calls[0]?.path).toContain('limit=200')
  expect(calls[0]?.path).toContain('fingerprint=prev')
})
