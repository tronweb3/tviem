import { expect, test } from 'vitest'
import { InvalidAddressError } from '../../../src/errors/address.js'
import { toBase58 } from '../../../src/utils/address/toBase58.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { genContractAddress } from '../../../src/utils/transaction/genContractAddress.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'

const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
const createFixtures = loadTxFixtureFile('create-smart-contract.json')

test.each(
  createFixtures,
)('genContractAddress matches gold CreateSmartContract vector: $name', (fixture) => {
  expect(fixture.contractAddress).toBeDefined()
  expect(genContractAddress(fixture.txID, owner)).toBe(fixture.contractAddress)
})

test('genContractAddress accepts 0x-prefixed inputs', () => {
  const fixture = createFixtures[0]!
  expect(genContractAddress(`0x${fixture.txID}`, `0x${owner}`)).toBe(
    fixture.contractAddress,
  )
})

test('genContractAddress: 41 prefix + low 20 bytes of keccak256(txID‖owner)', () => {
  const address = genContractAddress(createFixtures[0]!.txID, owner)
  expect(address.startsWith('41')).toBe(true)
  expect(address).toHaveLength(42)
})

// The preimage is `txID ‖ owner`: a wrong-length input shifts every byte after
// it and still hashes to a plausible-looking `41…` address — so both inputs
// must be length-checked, not just concatenated.
test('genContractAddress rejects a wrong-length txID', () => {
  expect(() => genContractAddress('1', owner)).toThrow()
  expect(() => genContractAddress('', owner)).toThrow()
  expect(() =>
    genContractAddress(`${createFixtures[0]!.txID}00`, owner),
  ).toThrow()
})

test('genContractAddress rejects a non-hex txID', () => {
  expect(() => genContractAddress('zz'.repeat(32), owner)).toThrow()
})

test('genContractAddress rejects an invalid owner address', () => {
  const txID = createFixtures[0]!.txID
  // @ts-expect-error deliberately invalid owner address
  expect(() => genContractAddress(txID, '2')).toThrow(InvalidAddressError)
  expect(() => genContractAddress(txID, `${owner}00`)).toThrow(
    InvalidAddressError,
  )
})

test('owner address-form invariance: 41-hex / base58 / EVM / bytes match', () => {
  const txID = createFixtures[0]!.txID
  const expected = genContractAddress(txID, owner) // pinned by the gold vectors
  expect(genContractAddress(txID, toBase58(owner))).toBe(expected)
  expect(genContractAddress(txID, `0x${owner.slice(2)}`)).toBe(expected)
  expect(genContractAddress(txID, hexToBytes(`0x${owner}`))).toBe(expected)
})
