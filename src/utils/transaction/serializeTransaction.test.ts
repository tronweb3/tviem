// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import { decodeRawData } from './decodeRawData.js'
import { serializeTransaction, toBroadcastHex } from './serializeTransaction.js'

// §2.3 canonical transfer (pk=1). raw_data bytes = 133 (0x85), one 65-byte
// (0x41) signature. The full Transaction envelope is `0a`+varint(len)+raw_data
// (field 1) then `12`+`41`+sig (field 2) — a protocol fact, computed here
// independently of the encoder under test.
const rawDataHex =
  '0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31'
const signature =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'
const fullTxHex = `0a8501${rawDataHex}1241${signature}`

describe('serializeTransaction / toBroadcastHex', () => {
  test('wraps raw_data_hex + signature into the full Transaction envelope', () => {
    expect(
      toBroadcastHex({ raw_data_hex: rawDataHex, signature: [signature] }),
    ).toBe(fullTxHex)
  })

  test('encodes the raw_data model identically to raw_data_hex', () => {
    const raw_data = decodeRawData(rawDataHex)
    expect(toBroadcastHex({ raw_data, signature: [signature] })).toBe(fullTxHex)
    // raw_data_hex takes precedence but must agree with the model.
    expect(
      toBroadcastHex({
        raw_data,
        raw_data_hex: rawDataHex,
        signature: [signature],
      }),
    ).toBe(fullTxHex)
  })

  test('accepts 0x-prefixed signatures', () => {
    expect(
      toBroadcastHex({
        raw_data_hex: rawDataHex,
        signature: [`0x${signature}`],
      }),
    ).toBe(fullTxHex)
  })

  test('preserves signature order for multi-sig (two field-2 entries)', () => {
    const sigB = `${'00'.repeat(64)}1b`
    const hex = toBroadcastHex({
      raw_data_hex: rawDataHex,
      signature: [signature, sigB],
    })
    expect(hex).toBe(`0a8501${rawDataHex}1241${signature}1241${sigB}`)
  })

  test('omits the signature field when there are no signatures', () => {
    expect(toBroadcastHex({ raw_data_hex: rawDataHex })).toBe(
      `0a8501${rawDataHex}`,
    )
  })

  test('serializeTransaction returns the same bytes as toBroadcastHex', () => {
    const bytes = serializeTransaction({
      raw_data_hex: rawDataHex,
      signature: [signature],
    })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(fullTxHex.length / 2)
  })

  test('throws without raw_data or raw_data_hex', () => {
    expect(() => serializeTransaction({ signature: [signature] })).toThrow()
  })
})
