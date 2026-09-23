import { expect, test } from 'vitest'
import { recoverEchoedResultBody } from '../../../src/actions/utils/recoverMultisigResult.js'
import { BaseError } from '../../../src/errors/base.js'
import { TronContractValidateError } from '../../../src/errors/node.js'

const okCodes = ['ENOUGH_PERMISSION', 'NOT_ENOUGH_PERMISSION'] as const
const echo = { transaction: { transaction: { txID: 'ab' } } }

/** The transport's Form 2 error for a `{ result: { code, message } }` body. */
function nodeError(code: string, extra: Record<string, unknown> = echo) {
  return new TronContractValidateError('msg', {
    code,
    response: { result: { code, message: 'msg' }, ...extra },
  })
}

test('recovers a body whose result.code is an accepted verdict', () => {
  const body = recoverEchoedResultBody(nodeError('NOT_ENOUGH_PERMISSION'), {
    okCodes,
  })
  expect(body?.result).toEqual({
    code: 'NOT_ENOUGH_PERMISSION',
    message: 'msg',
  })
  expect(body?.transaction).toEqual(echo.transaction)
})

// java-tron sets the transaction echo before its try block, so a genuine
// failure echoes it too: the echo says nothing about whether the body is a
// verdict; only the code does.
test('does not recover a failure code, even when the transaction is echoed', () => {
  expect(
    recoverEchoedResultBody(nodeError('PERMISSION_ERROR'), { okCodes }),
  ).toBeUndefined()
  expect(
    recoverEchoedResultBody(nodeError('OTHER_ERROR', { current_weight: 0 }), {
      okCodes,
    }),
  ).toBeUndefined()
})

test('does not recover a body without a result code', () => {
  const err = new TronContractValidateError('msg', { response: echo })
  expect(recoverEchoedResultBody(err, { okCodes })).toBeUndefined()
})

test('ignores errors that are not node errors', () => {
  expect(
    recoverEchoedResultBody(new BaseError('x'), { okCodes }),
  ).toBeUndefined()
  expect(recoverEchoedResultBody(new Error('x'), { okCodes })).toBeUndefined()
})
