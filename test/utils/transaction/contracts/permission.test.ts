import { expect, test } from 'vitest'

import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeAccountPermissionUpdateContract,
  encodeAccountPermissionUpdateContract,
} from '../../../../src/utils/transaction/contracts/permission.js'
import type { AccountPermissionUpdateContract } from '../../../../src/utils/transaction/types.js'
import { PermissionType } from '../../../../src/utils/transaction/types.js'

// §2.1 V1 / V2.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const
// Default active-permission operations bitmap (32 bytes).
const operations =
  '0x7fff1fc0033e0000000000000000000000000000000000000000000000000000' as const

test('encodeAccountPermissionUpdateContract: owner/witness/actives + 32-byte operations bitmap', () => {
  const x: AccountPermissionUpdateContract = {
    ownerAddress: v1,
    owner: {
      type: PermissionType.OWNER,
      id: 0,
      permissionName: 'owner',
      threshold: 1n,
      parentId: 0,
      operations: '0x',
      keys: [{ address: v1, weight: 1n }],
    },
    witness: {
      type: PermissionType.WITNESS,
      id: 0,
      permissionName: 'witness',
      threshold: 1n,
      parentId: 0,
      operations: '0x',
      keys: [{ address: v1, weight: 1n }],
    },
    actives: [
      {
        type: PermissionType.ACTIVE,
        id: 2,
        permissionName: 'active',
        threshold: 1n,
        parentId: 0,
        operations,
        keys: [{ address: v2, weight: 1n }],
      },
    ],
  }
  const keyV1 = `0a15${v1}1001`
  // OWNER type (0) and id 0 are omitted — proto3 defaults.
  const ownerPerm = `1a056f776e657220013a19${keyV1}`
  const witnessPerm = `08011a077769746e65737320013a19${keyV1}`
  const activePerm = `080210021a0661637469766520013220${operations.slice(2)}3a190a15${v2}1001`
  const expected = `0x0a15${v1}1224${ownerPerm}1a28${witnessPerm}224b${activePerm}`
  expect(bytesToHex(encodeAccountPermissionUpdateContract(x))).toBe(expected)
  expect(
    decodeAccountPermissionUpdateContract(
      encodeAccountPermissionUpdateContract(x),
    ),
  ).toStrictEqual(x)
})

test('empty nested Permission encodes as an empty message and decodes with defaults', () => {
  const encoded = encodeAccountPermissionUpdateContract({
    ownerAddress: v1,
    owner: {},
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}1200`)
  const decoded = decodeAccountPermissionUpdateContract(encoded)
  expect(decoded).toStrictEqual({
    ownerAddress: v1,
    owner: {
      type: 0,
      id: 0,
      permissionName: '',
      threshold: 0n,
      parentId: 0,
      operations: '0x',
      keys: [],
    },
    actives: [],
  })
  // Absent witness permission stays absent.
  expect('witness' in decoded).toBe(false)
})
