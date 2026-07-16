import { expect, test } from 'vitest'

import * as unit from '../../src/constants/unit.js'

test('exports unit', () => {
  expect(unit).toMatchInlineSnapshot(`
    {
      "trxUnits": {
        "sun": 6,
      },
    }
  `)
})
