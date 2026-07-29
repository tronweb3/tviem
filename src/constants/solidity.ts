// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { AbiError } from 'abitype'

/** The built-in `Error(string)` revert (4-byte selector `0x08c379a0`). */
export const solidityError = {
  inputs: [
    {
      name: 'message',
      type: 'string',
    },
  ],
  name: 'Error',
  type: 'error',
} as const satisfies AbiError

/** The built-in `Panic(uint256)` revert (4-byte selector `0x4e487b71`). */
export const solidityPanic = {
  inputs: [
    {
      name: 'reason',
      type: 'uint256',
    },
  ],
  name: 'Panic',
  type: 'error',
} as const satisfies AbiError
