/**
 * Test helper: decodes a `broadcasthex` request body (`{ transaction: <hex> }`,
 * the full `protocol.Transaction` protobuf) back into the pre-broadcasthex
 * shape (`{ txID, raw_data_hex, raw_data, signature }`) so write-action tests
 * can keep asserting on the locally built transaction byte-for-byte.
 */

import { hexToBytes } from '../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../src/utils/encoding/toHex.js'
import { decodeRawData } from '../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../src/utils/transaction/getTransactionId.js'
import type { RawData } from '../../src/utils/transaction/serializeRawData.js'

export type ParsedBroadcast = {
  txID: string
  raw_data_hex: string
  raw_data: RawData
  signature: string[]
}

/** Parses `{ transaction }` (full Transaction hex) into the signed-tx shape. */
export function parseBroadcast(body: unknown): ParsedBroadcast {
  const hex = (body as { transaction?: unknown }).transaction
  if (typeof hex !== 'string')
    throw new Error('parseBroadcast: body has no `transaction` hex string.')

  const bytes = hexToBytes(`0x${hex}`)
  let i = 0
  let rawDataBytes: Uint8Array | undefined
  const signature: string[] = []
  while (i < bytes.length) {
    const key = bytes[i++] as number
    const field = key >> 3
    const wire = key & 7
    if (wire !== 2)
      throw new Error(`parseBroadcast: unexpected wire type ${wire}.`)
    let len = 0
    let shift = 0
    for (;;) {
      const b = bytes[i++] as number
      len |= (b & 0x7f) << shift
      if ((b & 0x80) === 0) break
      shift += 7
    }
    const value = bytes.subarray(i, i + len)
    i += len
    if (field === 1) rawDataBytes = value
    else if (field === 2) signature.push(bytesToHex(value).slice(2))
  }
  if (!rawDataBytes) throw new Error('parseBroadcast: no raw_data field.')

  const raw_data_hex = bytesToHex(rawDataBytes).slice(2)
  const raw_data = decodeRawData(raw_data_hex)
  return { txID: getTransactionId(raw_data), raw_data_hex, raw_data, signature }
}
