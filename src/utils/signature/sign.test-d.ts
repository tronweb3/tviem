import { expectTypeOf, test } from 'vitest'

import type { Address } from '../../types/address.js'
import type { ByteArray, Hex, SignableMessage } from '../../types/misc.js'
import { type Signature, type SignParameters, sign } from './sign.js'
import { type SignMessageParameters, signMessage } from './signMessage.js'
import {
  type RecoverMessageAddressParameters,
  recoverMessageAddress,
  type VerifyMessageParameters,
  verifyMessage,
} from './verifyMessage.js'

test('sign: parameter shape — hash is Hex | ByteArray', () => {
  expectTypeOf(sign).parameter(0).toEqualTypeOf<SignParameters>()
  expectTypeOf<SignParameters['hash']>().toEqualTypeOf<Hex | ByteArray>()

  // both digest input forms are accepted
  expectTypeOf<Hex>().toExtend<SignParameters['hash']>()
  expectTypeOf<ByteArray>().toExtend<SignParameters['hash']>()

  // private key accepts 0x-prefixed or bare hex
  expectTypeOf<SignParameters['privateKey']>().toEqualTypeOf<Hex | string>()
})

test('sign: returns the TRON Signature (r/s/v/recovery/hex/serialized)', () => {
  const sig = sign({
    hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
    privateKey:
      '0x0000000000000000000000000000000000000000000000000000000000000001',
  })

  expectTypeOf(sig).toEqualTypeOf<Signature>()
  expectTypeOf(sign).returns.toEqualTypeOf<Signature>()

  expectTypeOf<Signature['r']>().toEqualTypeOf<Hex>()
  expectTypeOf<Signature['s']>().toEqualTypeOf<Hex>()
  expectTypeOf<Signature['v']>().toEqualTypeOf<number>()
  expectTypeOf<Signature['recovery']>().toEqualTypeOf<number>()
  // bare wire-form hex (no 0x prefix) is a plain string
  expectTypeOf<Signature['hex']>().toEqualTypeOf<string>()
  // 0x-prefixed serialized form is branded Hex
  expectTypeOf<Signature['serialized']>().toEqualTypeOf<Hex>()
})

test('signMessage: message is the SignableMessage (string | { raw }) union', () => {
  expectTypeOf(signMessage).parameter(0).toEqualTypeOf<SignMessageParameters>()
  expectTypeOf<
    SignMessageParameters['message']
  >().toEqualTypeOf<SignableMessage>()

  expectTypeOf<SignableMessage>().toEqualTypeOf<
    string | { raw: Hex | ByteArray }
  >()

  // both arms of the union are accepted
  expectTypeOf<string>().toExtend<SignableMessage>()
  expectTypeOf<{ raw: Hex }>().toExtend<SignableMessage>()
  expectTypeOf<{ raw: ByteArray }>().toExtend<SignableMessage>()

  // signMessage yields the same TRON Signature as sign
  expectTypeOf(signMessage).returns.toEqualTypeOf<Signature>()
})

test('verifyMessage: returns boolean', () => {
  expectTypeOf(verifyMessage)
    .parameter(0)
    .toEqualTypeOf<VerifyMessageParameters>()
  expectTypeOf(verifyMessage).returns.toEqualTypeOf<boolean>()

  // the message arg is a SignableMessage
  expectTypeOf<
    VerifyMessageParameters['message']
  >().toEqualTypeOf<SignableMessage>()
})

test('recoverMessageAddress: returns a Base58Check Address', () => {
  expectTypeOf(recoverMessageAddress)
    .parameter(0)
    .toEqualTypeOf<RecoverMessageAddressParameters>()
  expectTypeOf(recoverMessageAddress).returns.toEqualTypeOf<Address>()

  expectTypeOf<
    RecoverMessageAddressParameters['message']
  >().toEqualTypeOf<SignableMessage>()
})
