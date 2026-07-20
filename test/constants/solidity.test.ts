import { expect, test } from 'vitest'

import * as solidity from '../../src/constants/solidity.js'
import { formatAbiItem } from '../../src/utils/abi/formatAbiItem.js'
import { toFunctionSelector } from '../../src/utils/hash/toFunctionSelector.js'

test('exports solidity', () => {
  expect(solidity).toMatchInlineSnapshot(`
    {
      "solidityError": {
        "inputs": [
          {
            "name": "message",
            "type": "string",
          },
        ],
        "name": "Error",
        "type": "error",
      },
      "solidityPanic": {
        "inputs": [
          {
            "name": "reason",
            "type": "uint256",
          },
        ],
        "name": "Panic",
        "type": "error",
      },
    }
  `)
})

test('selectors derived from the constants', () => {
  // signatures are derived FROM the constants, so these break if the
  // constants' name/inputs are ever edited.
  expect(formatAbiItem(solidity.solidityError)).toEqual('Error(string)')
  expect(toFunctionSelector(formatAbiItem(solidity.solidityError))).toEqual(
    '0x08c379a0',
  )

  expect(formatAbiItem(solidity.solidityPanic)).toEqual('Panic(uint256)')
  expect(toFunctionSelector(formatAbiItem(solidity.solidityPanic))).toEqual(
    '0x4e487b71',
  )
})
