import { expect, test } from 'vitest'
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
