import { expect, test } from 'vitest'

import * as unit from './unit.js'

test('exports unit', () => {
  expect(unit).toMatchInlineSnapshot(`
    {
      "trxUnits": {
        "sun": 6,
      },
    }
  `)
})
