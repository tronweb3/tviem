import { trxUnits } from '../../constants/unit.js'

import { type FormatUnitsErrorType, formatUnits } from './formatUnits.js'

export type FormatTrxErrorType = FormatUnitsErrorType

/**
 * Converts numerical sun to a string representation of trx.
 *
 * @example
 * import { formatTrx } from '@tronweb3/tviem'
 *
 * formatTrx(1000000n)
 * // '1'
 */
export function formatTrx(sun: bigint, unit: 'sun' = 'sun') {
  return formatUnits(sun, trxUnits[unit])
}
