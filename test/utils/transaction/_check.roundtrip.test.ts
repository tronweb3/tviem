// TEMPORARY dev validation — deleted before commit. Proves toNodeRawData is
// byte-faithful: java-tron (via tronweb's txJsonToPb) rebuilds the identical
// raw_data bytes from our node-JSON, for EVERY tx fixture.
import { utils } from 'tronweb'
import { describe, expect, test } from 'vitest'

import { loadTxFixtures } from '../../fixtures/tx/loader.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { toNodeRawData } from '../../../src/utils/transaction/toNodeRawData.js'

const { txJsonToPb, txPbToRawDataHex } = utils.transaction

describe('toNodeRawData round-trips through java-tron JsonFormat', () => {
  test.each(loadTxFixtures().map((f) => [f.name, f] as const))(
    '%s',
    (_name, fixture) => {
      const model = decodeRawData(fixture.rawDataHex)
      const nodeJson = toNodeRawData(model)
      const rebuilt = txPbToRawDataHex(
        txJsonToPb({ raw_data: nodeJson, raw_data_hex: fixture.rawDataHex }),
      ).toLowerCase()
      expect(rebuilt).toBe(fixture.rawDataHex.toLowerCase())
    },
  )
})
