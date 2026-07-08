/**
 * Typed loader for the gold-standard transaction fixtures in this directory
 * (one JSON file per contract type). Each file is an array of cases; a case
 * pins a node-format `rawData`, its canonical `rawDataHex` and the resulting
 * `txID`. The `transfer-contract.json` first case is the §2.3 canonical
 * reference vector, and the `create-smart-contract.json` cases additionally
 * pin the deployed `contractAddress`.
 */
import { readFileSync } from 'node:fs'

/** One gold-standard transaction case, as stored in a fixture file. */
export type TxFixture = {
  /** Human-readable case name. */
  name: string
  /** `Transaction.Contract.type` integer. */
  contractType: number
  /** `Any.type_url`. */
  typeUrl: string
  /** Node-format API input (not consumed directly by the codec). */
  params: unknown
  /** Node-format `raw_data` object. */
  rawData: unknown
  /** Canonical `raw_data_hex` (bare lowercase hex). */
  rawDataHex: string
  /** Transaction id (bare lowercase hex). */
  txID: string
  /** Deployed contract address (`CreateSmartContract` cases only). */
  contractAddress?: string
}

/** All fixture files, in contract-type order. */
export const txFixtureFiles = [
  'transfer-contract.json',
  'transfer-asset-contract.json',
  'vote-witness-contract.json',
  'withdraw-balance-contract.json',
  'create-smart-contract.json',
  'trigger-smart-contract.json',
  'account-permission-update-contract.json',
  'freeze-balance-v2-contract.json',
  'unfreeze-balance-v2-contract.json',
  'withdraw-expire-unfreeze-contract.json',
  'delegate-resource-contract.json',
  'un-delegate-resource-contract.json',
  'cancel-all-unfreeze-v2-contract.json',
] as const

function readJson(fileName: string): TxFixture[] {
  return JSON.parse(
    readFileSync(new URL(fileName, import.meta.url), 'utf8'),
  ) as TxFixture[]
}

/** Loads the cases of one fixture file. */
export function loadTxFixtureFile(fileName: string): TxFixture[] {
  return readJson(fileName)
}

/** Loads every transaction fixture case across all files. */
export function loadTxFixtures(): TxFixture[] {
  return txFixtureFiles.flatMap(readJson)
}
