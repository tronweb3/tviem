import { expect, test } from 'vitest'
import { hexToBytes } from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeAssetIssueContract,
  encodeAssetIssueContract,
} from '../../../../src/utils/transaction/contracts/asset.js'

const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const

// java-tron's AssetIssueContract carries fields beyond the creation set:
// `order` (11, int64), `public_free_asset_net_usage` (24, int64),
// `public_latest_free_net_time` (25, int64) and the chain-assigned `id`
// (41, string). A foreign raw_data may carry any of them, so the codec must
// represent them rather than throw.
test('order / public usage / id fields encode at their proto numbers (byte gold)', () => {
  const encoded = encodeAssetIssueContract({
    owner_address: owner,
    name: '414243',
    abbr: '4142',
    total_supply: 1000n,
    trx_num: 1,
    num: 1,
    start_time: 1n,
    end_time: 2n,
    order: 3n,
    description: '4444',
    url: '5555',
    public_free_asset_net_usage: 4n,
    public_latest_free_net_time: 5n,
    id: '1000001',
  })
  // owner (field 1, `0a15…`), name (2, `1203…`), abbr (3, `1a02…`),
  // total_supply=1000 (4, `20e807`), trx_num=1 (6, `3001`), num=1 (8, `4001`),
  // start_time=1 (9, `4801`), end_time=2 (10, `5002`), order=3 (11, `5803`),
  // description (20, `a20102…`), url (21, `aa0102…`),
  // public_free_asset_net_usage=4 (24, `c00104`),
  // public_latest_free_net_time=5 (25, `c80105`),
  // id="1000001" (41, `ca0207` + ASCII).
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${owner}12034142431a02414220e80730014001480150025803a201024444aa01025555c00104c80105ca020731303030303031`,
  )
})

test('order / public usage / id fields round-trip through decode', () => {
  const decoded = decodeAssetIssueContract(
    hexToBytes(`0x0a15${owner}5803c00104c80105ca020731303030303031`),
  )
  expect(decoded).toStrictEqual({
    owner_address: owner,
    order: 3,
    public_free_asset_net_usage: 4,
    public_latest_free_net_time: 5,
    id: '1000001',
  })
})
