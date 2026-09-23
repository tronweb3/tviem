import {
  NegativeOffsetError,
  type NegativeOffsetErrorType,
  PositionOutOfBoundsError,
  type PositionOutOfBoundsErrorType,
  ReadSizeLimitExceededError,
  type ReadSizeLimitExceededErrorType,
  RecursiveReadLimitExceededError,
  type RecursiveReadLimitExceededErrorType,
} from '../errors/cursor.js'
import type { ErrorType } from '../errors/utils.js'
import type { ByteArray } from '../types/misc.js'

export type Cursor = {
  bytes: ByteArray
  dataView: DataView
  position: number
  positionReadCount: Map<number, number>
  recursiveReadCount: number
  recursiveReadLimit: number
  readSizeLimit: number
  totalReadSize: number
  remaining: number
  assertReadLimit(position?: number): void
  assertReadSize(size: number): void
  assertPosition(position: number): void
  decrementPosition(offset: number): void
  getReadCount(position?: number): number
  incrementPosition(offset: number): void
  inspectByte(position?: number): ByteArray[number]
  inspectBytes(length: number, position?: number): ByteArray
  inspectUint8(position?: number): number
  inspectUint16(position?: number): number
  inspectUint24(position?: number): number
  inspectUint32(position?: number): number
  pushByte(byte: ByteArray[number]): void
  pushBytes(bytes: ByteArray): void
  pushUint8(value: number): void
  pushUint16(value: number): void
  pushUint24(value: number): void
  pushUint32(value: number): void
  readByte(): ByteArray[number]
  readBytes(length: number, size?: number): ByteArray
  readUint8(): number
  readUint16(): number
  readUint24(): number
  readUint32(): number
  setPosition(position: number): () => void
  _touch(): void
}

type CursorErrorType =
  | CursorAssertPositionErrorType
  | CursorDecrementPositionErrorType
  | CursorIncrementPositionErrorType
  | ErrorType

type CursorAssertPositionErrorType = PositionOutOfBoundsErrorType | ErrorType

type CursorDecrementPositionErrorType = NegativeOffsetErrorType | ErrorType

type CursorIncrementPositionErrorType = NegativeOffsetErrorType | ErrorType

type StaticCursorErrorType =
  | NegativeOffsetErrorType
  | ReadSizeLimitExceededErrorType
  | RecursiveReadLimitExceededErrorType

const staticCursor: Cursor = {
  bytes: new Uint8Array(),
  dataView: new DataView(new ArrayBuffer(0)),
  position: 0,
  positionReadCount: new Map(),
  recursiveReadCount: 0,
  recursiveReadLimit: Number.POSITIVE_INFINITY,
  readSizeLimit: Number.POSITIVE_INFINITY,
  totalReadSize: 0,
  assertReadLimit() {
    if (this.recursiveReadCount >= this.recursiveReadLimit)
      throw new RecursiveReadLimitExceededError({
        count: this.recursiveReadCount + 1,
        limit: this.recursiveReadLimit,
      })
  },
  // The recursive-read cap counts re-reads; this caps the BYTES they
  // materialize. A dynamic `bytes` / `string` element hexifies `readBytes(L)`
  // with L from the data, and many array offsets can point at one blob, so the
  // same L bytes are rebuilt N times — arbitrary work the count cap never sees.
  // Charged per read and bounded to a multiple of the input, so valid data
  // (each region read ~once) always passes and only duplicate-offset payloads
  // trip it.
  assertReadSize(size) {
    if (this.readSizeLimit === Number.POSITIVE_INFINITY) return
    this.totalReadSize += size
    if (this.totalReadSize > this.readSizeLimit)
      throw new ReadSizeLimitExceededError({
        limit: this.readSizeLimit,
        size: this.totalReadSize,
      })
  },
  assertPosition(position) {
    if (position < 0 || position > this.bytes.length - 1)
      throw new PositionOutOfBoundsError({
        length: this.bytes.length,
        position,
      })
  },
  decrementPosition(offset) {
    if (offset < 0) throw new NegativeOffsetError({ offset })
    const position = this.position - offset
    this.assertPosition(position)
    this.position = position
  },
  getReadCount(position) {
    return this.positionReadCount.get(position || this.position) || 0
  },
  incrementPosition(offset) {
    if (offset < 0) throw new NegativeOffsetError({ offset })
    const position = this.position + offset
    this.assertPosition(position)
    this.position = position
  },
  inspectByte(position_) {
    const position = position_ ?? this.position
    this.assertPosition(position)
    return this.bytes[position]!
  },
  inspectBytes(length, position_) {
    const position = position_ ?? this.position
    this.assertPosition(position + length - 1)
    return this.bytes.subarray(position, position + length)
  },
  inspectUint8(position_) {
    const position = position_ ?? this.position
    this.assertPosition(position)
    return this.bytes[position]!
  },
  inspectUint16(position_) {
    const position = position_ ?? this.position
    this.assertPosition(position + 1)
    return this.dataView.getUint16(position)
  },
  inspectUint24(position_) {
    const position = position_ ?? this.position
    this.assertPosition(position + 2)
    return (
      (this.dataView.getUint16(position) << 8) +
      this.dataView.getUint8(position + 2)
    )
  },
  inspectUint32(position_) {
    const position = position_ ?? this.position
    this.assertPosition(position + 3)
    return this.dataView.getUint32(position)
  },
  pushByte(byte: ByteArray[number]) {
    this.assertPosition(this.position)
    this.bytes[this.position] = byte
    this.position++
  },
  pushBytes(bytes: ByteArray) {
    this.assertPosition(this.position + bytes.length - 1)
    this.bytes.set(bytes, this.position)
    this.position += bytes.length
  },
  pushUint8(value: number) {
    this.assertPosition(this.position)
    this.bytes[this.position] = value
    this.position++
  },
  pushUint16(value: number) {
    this.assertPosition(this.position + 1)
    this.dataView.setUint16(this.position, value)
    this.position += 2
  },
  pushUint24(value: number) {
    this.assertPosition(this.position + 2)
    this.dataView.setUint16(this.position, value >> 8)
    this.dataView.setUint8(this.position + 2, value & ~4294967040)
    this.position += 3
  },
  pushUint32(value: number) {
    this.assertPosition(this.position + 3)
    this.dataView.setUint32(this.position, value)
    this.position += 4
  },
  readByte() {
    this.assertReadLimit()
    this.assertReadSize(1)
    this._touch()
    const value = this.inspectByte()
    this.position++
    return value
  },
  readBytes(length, size) {
    this.assertReadLimit()
    this.assertReadSize(length)
    this._touch()
    const value = this.inspectBytes(length)
    this.position += size ?? length
    return value
  },
  readUint8() {
    this.assertReadLimit()
    this.assertReadSize(1)
    this._touch()
    const value = this.inspectUint8()
    this.position += 1
    return value
  },
  readUint16() {
    this.assertReadLimit()
    this.assertReadSize(2)
    this._touch()
    const value = this.inspectUint16()
    this.position += 2
    return value
  },
  readUint24() {
    this.assertReadLimit()
    this.assertReadSize(3)
    this._touch()
    const value = this.inspectUint24()
    this.position += 3
    return value
  },
  readUint32() {
    this.assertReadLimit()
    this.assertReadSize(4)
    this._touch()
    const value = this.inspectUint32()
    this.position += 4
    return value
  },
  get remaining() {
    return this.bytes.length - this.position
  },
  setPosition(position) {
    const oldPosition = this.position
    this.assertPosition(position)
    this.position = position
    return () => (this.position = oldPosition)
  },
  _touch() {
    if (this.recursiveReadLimit === Number.POSITIVE_INFINITY) return
    const count = this.getReadCount()
    this.positionReadCount.set(this.position, count + 1)
    if (count > 0) this.recursiveReadCount++
  },
}

type CursorConfig = {
  recursiveReadLimit?: number | undefined
  readSizeLimit?: number | undefined
}

// Total bytes read may exceed the input a bounded number of times: valid ABI
// data reads each region ~once (ratio ≈ 1), so this leaves generous headroom
// while still capping the duplicate-offset blowup at O(input).
const READ_SIZE_LIMIT_FACTOR = 8

export type CreateCursorErrorType =
  | CursorErrorType
  | StaticCursorErrorType
  | ErrorType

export function createCursor(
  bytes: ByteArray,
  { recursiveReadLimit = 8_192, readSizeLimit }: CursorConfig = {},
): Cursor {
  const cursor: Cursor = Object.create(staticCursor)
  cursor.bytes = bytes
  cursor.dataView = new DataView(
    bytes.buffer ?? bytes,
    bytes.byteOffset,
    bytes.byteLength,
  )
  cursor.positionReadCount = new Map()
  cursor.recursiveReadCount = 0
  cursor.recursiveReadLimit = recursiveReadLimit
  cursor.totalReadSize = 0
  // An explicit limit wins; otherwise derive it from the input, except when
  // recursion tracking is itself disabled (the "no limits" escape hatch).
  cursor.readSizeLimit =
    readSizeLimit ??
    (recursiveReadLimit === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : bytes.length * READ_SIZE_LIMIT_FACTOR)
  return cursor
}
