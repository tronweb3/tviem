// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import { BaseError } from '../../errors/base.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { serializeSignature, sign } from './sign.js'

// §2.3 transaction signing (pk = 1).
const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const txId =
  '0x407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba' as const
const txSignature =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

// §2.2 TIP-191 message digest for "hello @tronweb3/omni" (pk = 1).
const messageDigest =
  '0x068a2c93df26c5f19fb1d6b74abe50efc69cbff8b70a9cc9b915058e0ed9a18e' as const
const messageSignature =
  '855e95dd49d937f13c6cbc5293db9b6fdfab8780d7c27c6eff9b12f8f3d3d56d792f34efe0adb183778c8e6f4c8f1cf66e19bd06be967bc7874613f4ee135dea1b'

describe('sign', () => {
  test('§2.3: signs the tx digest to the authoritative signature (…ae001c)', () => {
    const signature = sign({ hash: txId, privateKey: pk1 })
    expect(signature.hex).toBe(txSignature)
    expect(signature.serialized).toBe(`0x${txSignature}`)
    expect(signature.serialized.endsWith('001c')).toBe(true)
    expect(signature.v).toBe(28)
    expect(signature.recovery).toBe(1)
  })

  test('§2.2: signs the TIP-191 message digest (…dea1b, v = 27)', () => {
    const signature = sign({ hash: messageDigest, privateKey: pk1 })
    expect(signature.hex).toBe(messageSignature)
    expect(signature.serialized).toBe(`0x${messageSignature}`)
    expect(signature.v).toBe(27)
    expect(signature.recovery).toBe(0)
  })

  test('accepts a bytes digest and a bare (no 0x) private key', () => {
    const signature = sign({
      hash: hexToBytes(txId),
      privateKey: pk1.slice(2),
    })
    expect(signature.hex).toBe(txSignature)
  })

  test('is deterministic (RFC 6979) by default', () => {
    const a = sign({ hash: txId, privateKey: pk1 })
    const b = sign({ hash: txId, privateKey: pk1 })
    expect(a.hex).toBe(b.hex)
  })

  test('extraEntropy changes the signature (proves the default is deterministic)', () => {
    const deterministic = sign({ hash: txId, privateKey: pk1 })
    const randomized = sign({ hash: txId, privateKey: pk1, extraEntropy: true })
    expect(randomized.hex).not.toBe(deterministic.hex)
    // Still a valid TRON-form signature.
    expect(randomized.hex).toHaveLength(130)
    expect([27, 28]).toContain(randomized.v)
  })

  test('r/s components are 0x-prefixed 32-byte hex', () => {
    const signature = sign({ hash: txId, privateKey: pk1 })
    expect(signature.r).toBe(`0x${txSignature.slice(0, 64)}`)
    expect(signature.s).toBe(`0x${txSignature.slice(64, 128)}`)
  })

  test('throws on a non-32-byte hash', () => {
    expect(() => sign({ hash: '0xdeadbeef', privateKey: pk1 })).toThrow(
      BaseError,
    )
    expect(() => sign({ hash: new Uint8Array(31), privateKey: pk1 })).toThrow(
      'Invalid hash length: 31 bytes.',
    )
  })
})

describe('serializeSignature', () => {
  test('composes r ++ s ++ v into the 0x wire form', () => {
    const r = `0x${txSignature.slice(0, 64)}` as const
    const s = `0x${txSignature.slice(64, 128)}` as const
    expect(serializeSignature({ r, s, v: 28 })).toBe(`0x${txSignature}`)
  })

  test('round-trips with sign', () => {
    const { r, s, v, serialized } = sign({ hash: txId, privateKey: pk1 })
    expect(serializeSignature({ r, s, v })).toBe(serialized)
  })
})
