// Shared differential harness for the `buildX` write actions: build a
// transaction with @tronweb3/omni AND, independently, with TronWeb's own
// `transactionBuilder`, and assert they agree byte-for-byte and id-for-id.
// Both build offline against the same pinned block header. As a second,
// independent check, omni's `raw_data` is re-encoded through TronWeb's protobuf
// codec (`txJsonToPb`) and must reproduce omni's exact bytes/id — proving
// java-tron agrees with omni's serialization.
import { TronWeb, utils } from 'tronweb'
import { expect } from 'vitest'

import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 → owner TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC on both sides.
export const PK_HEX = `${'0'.repeat(63)}1`
export const pk1 = `0x${PK_HEX}` as const

// The single pinned reference block both sides build against.
const REF = {
  refBlockBytes: '1234',
  refBlockHash: '0102030405060708',
  timestamp: 1700000000000n,
  expiration: 1700000060000n,
}
/** omni's `blockHeader` override (camelCase, bigint timing). */
export const omniHeader = {
  refBlockBytes: REF.refBlockBytes,
  refBlockHash: REF.refBlockHash,
  timestamp: REF.timestamp,
  expiration: REF.expiration,
}
/** TronWeb's `blockHeader` override (snake_case, numeric timing). */
export const twBlockHeader = {
  ref_block_bytes: REF.refBlockBytes,
  ref_block_hash: REF.refBlockHash,
  expiration: Number(REF.expiration),
  timestamp: Number(REF.timestamp),
}

/** An omni wallet client hoisted with pk1; no node is hit (blockHeader is set). */
export function makeOmniClient() {
  const { transport } = createMockTransport({ responses: {} })
  return createWalletClient({ account: pk1, transport })
}

/** A TronWeb instance keyed with pk1 (offline; never queried when blockHeader set). */
export function makeTronWeb(): TronWeb {
  return new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: PK_HEX,
  })
}

const codec = utils.transaction as unknown as {
  txJsonToPb: (tx: unknown) => unknown
  txPbToRawDataHex: (pb: unknown) => string
  txPbToTxID: (pb: unknown) => string
}
const norm = (s: string): string => s.replace(/^0x/, '').toLowerCase()

type NodeTx = {
  txID?: string | undefined
  raw_data: unknown
  raw_data_hex?: string | undefined
}

/**
 * Assert omni's built transaction agrees with TronWeb's own build byte-for-byte
 * and id-for-id, and that java-tron (via `txJsonToPb`) re-encodes omni's
 * `raw_data` to the same bytes/id.
 */
export function expectBuildMatchesTronweb(
  omniTx: NodeTx,
  tronwebTx: NodeTx,
  label: string,
): void {
  expect(
    norm(omniTx.raw_data_hex ?? ''),
    `${label}: raw_data_hex omni↔tronweb`,
  ).toBe(norm(tronwebTx.raw_data_hex ?? ''))
  expect(norm(omniTx.txID ?? ''), `${label}: txID omni↔tronweb`).toBe(
    norm(tronwebTx.txID ?? ''),
  )
  const pb = codec.txJsonToPb({ raw_data: omniTx.raw_data })
  expect(
    norm(codec.txPbToRawDataHex(pb)),
    `${label}: java-tron re-encode`,
  ).toBe(norm(omniTx.raw_data_hex ?? ''))
  expect(norm(codec.txPbToTxID(pb)), `${label}: java-tron txID`).toBe(
    norm(omniTx.txID ?? ''),
  )
}
