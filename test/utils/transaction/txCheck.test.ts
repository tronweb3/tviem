import { expect, test } from 'vitest'
import { txCheck } from '../../../src/utils/transaction/txCheck.js'
import { loadTxFixtures } from '../../fixtures/tx/loader.js'

const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

test.each(
  loadTxFixtures(),
)('txCheck passes for gold vector: $name', (fixture) => {
  expect(txCheck(fixture.rawDataHex, fixture.txID)).toBe(true)
})

test('txCheck accepts a 0x-prefixed raw_data and txID', () => {
  expect(txCheck(`0x${canonical.rawDataHex}`, `0x${canonical.txID}`)).toBe(true)
})

test('txCheck fails when a raw_data byte is flipped', () => {
  const chars = canonical.rawDataHex.split('')
  // Flip one nibble inside the encoded amount (still valid hex, changes bytes).
  const i = chars.length - 2
  chars[i] = chars[i] === '0' ? '1' : '0'
  const tampered = chars.join('')
  expect(tampered).not.toBe(canonical.rawDataHex)
  expect(txCheck(tampered, canonical.txID)).toBe(false)
})

test('txCheck fails when the txID does not match', () => {
  const wrong = `${canonical.txID.slice(0, -1)}${
    canonical.txID.endsWith('0') ? '1' : '0'
  }`
  expect(txCheck(canonical.rawDataHex, wrong)).toBe(false)
})

test('txCheck returns false (does not throw) on structurally broken data', () => {
  // Truncated: a length prefix now points past the end of the buffer.
  expect(txCheck(canonical.rawDataHex.slice(0, 20), canonical.txID)).toBe(false)
  expect(txCheck('zz', canonical.txID)).toBe(false)
})
