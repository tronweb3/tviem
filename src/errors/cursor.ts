import { BaseError } from './base.js'

export type NegativeOffsetErrorType = NegativeOffsetError & {
  name: 'NegativeOffsetError'
}
export class NegativeOffsetError extends BaseError {
  constructor({ offset }: { offset: number }) {
    super(`Offset \`${offset}\` cannot be negative.`, {
      name: 'NegativeOffsetError',
    })
  }
}

export type PositionOutOfBoundsErrorType = PositionOutOfBoundsError & {
  name: 'PositionOutOfBoundsError'
}
export class PositionOutOfBoundsError extends BaseError {
  constructor({ length, position }: { length: number; position: number }) {
    super(
      `Position \`${position}\` is out of bounds (\`0 < position < ${length}\`).`,
      { name: 'PositionOutOfBoundsError' },
    )
  }
}

export type RecursiveReadLimitExceededErrorType =
  RecursiveReadLimitExceededError & {
    name: 'RecursiveReadLimitExceededError'
  }
export class RecursiveReadLimitExceededError extends BaseError {
  constructor({ count, limit }: { count: number; limit: number }) {
    super(
      `Recursive read limit of \`${limit}\` exceeded (recursive read count: \`${count}\`).`,
      { name: 'RecursiveReadLimitExceededError' },
    )
  }
}

export type ReadSizeLimitExceededErrorType = ReadSizeLimitExceededError & {
  name: 'ReadSizeLimitExceededError'
}
/**
 * Total bytes read from a cursor exceeded its input-proportional budget. The
 * recursive-read cap bounds how many times a position is re-read, not the
 * bytes each re-read materializes — so a payload whose dynamic elements share
 * one offset (duplicate / overlapping offsets) could re-decode a single large
 * blob many times, amounting to arbitrary work from a small input. This bounds
 * total reads to O(input).
 */
export class ReadSizeLimitExceededError extends BaseError {
  constructor({ limit, size }: { limit: number; size: number }) {
    super(
      `Read size limit of \`${limit}\` bytes exceeded (read \`${size}\` bytes). The payload re-reads the same data far more than its size — likely duplicate ABI offsets.`,
      { name: 'ReadSizeLimitExceededError' },
    )
  }
}
