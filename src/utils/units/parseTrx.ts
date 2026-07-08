import { trxUnits } from '../../constants/unit.js'
import type { ErrorType } from '../../errors/utils.js'

import { type ParseUnitsErrorType, parseUnits } from './parseUnits.js'

export type ParseTrxErrorType = ParseUnitsErrorType | ErrorType

/**
 * Converts a string representation of trx to numerical sun.
 *
 * @example
 * import { parseTrx } from '@tronweb3/omni'
 *
 * parseTrx('420')
 * // 420000000n
 */
export function parseTrx(trx: string, unit: 'sun' = 'sun') {
  return parseUnits(trx, trxUnits[unit])
}
