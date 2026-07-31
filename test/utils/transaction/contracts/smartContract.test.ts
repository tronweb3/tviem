import { expect, test } from 'vitest'

import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeCreateSmartContract,
  decodeTriggerSmartContract,
  encodeCreateSmartContract,
  encodeTriggerSmartContract,
} from '../../../../src/utils/transaction/contracts/smartContract.js'
import type {
  CreateSmartContract,
  TriggerSmartContract,
} from '../../../../src/utils/transaction/types.js'
import {
  EntryType,
  StateMutabilityType,
} from '../../../../src/utils/transaction/types.js'

// §2.1 V1, §2.1 V3 (USDT), §2.4 TRC20 transfer calldata.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const usdt = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c' as const
const calldata =
  '0xa9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240' as const

test('encodeTriggerSmartContract: §2.4 TRC20 transfer call', () => {
  const encoded = encodeTriggerSmartContract({
    owner_address: v1,
    contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    data: calldata,
  })
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${v1}1215${usdt}2244${calldata.slice(2)}`,
  )
})

test('encodeTriggerSmartContract: call_value is field 3', () => {
  const encoded = encodeTriggerSmartContract({
    owner_address: v1,
    contract_address: usdt,
    call_value: 1_000_000n,
    data: calldata,
  })
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${v1}1215${usdt}18c0843d2244${calldata.slice(2)}`,
  )
})

test('decode(encode(x)) canonicalizes (TriggerSmartContract)', () => {
  const x: TriggerSmartContract = {
    owner_address: v1,
    contract_address: usdt,
    call_value: 0n,
    data: calldata,
    call_token_value: 0n,
    token_id: 0n,
  }
  // Zero int64s are proto3 defaults (omitted); data decodes to bare hex.
  expect(
    decodeTriggerSmartContract(encodeTriggerSmartContract(x)),
  ).toStrictEqual({
    owner_address: v1,
    contract_address: usdt,
    data: calldata.slice(2),
  })
})

test('encodeCreateSmartContract: call_value lives on SmartContract (field 5)', () => {
  const encoded = encodeCreateSmartContract({
    owner_address: v1,
    new_contract: { origin_address: v1, call_value: 1_000_000n, name: 'Token' },
  })
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${v1}12220a15${v1}28c0843d3a05546f6b656e`,
  )
})

test('encodeCreateSmartContract: call_token_value(3) / token_id(4)', () => {
  const encoded = encodeCreateSmartContract({
    owner_address: v1,
    call_token_value: 5n,
    token_id: 1_000_001n,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}180520c1843d`)
  // Absent message fields stay absent after decode.
  const decoded = decodeCreateSmartContract(encoded)
  expect('new_contract' in decoded).toBe(false)
})

test('full nested SmartContract/ABI/Entry/Param encodes and round-trips', () => {
  const x: CreateSmartContract = {
    owner_address: v1,
    new_contract: {
      origin_address: v1,
      abi: {
        entrys: [
          {
            anonymous: false,
            constant: false,
            name: 'transfer',
            inputs: [
              { indexed: false, name: '_to', type: 'address' },
              { indexed: false, name: '_value', type: 'uint256' },
            ],
            outputs: [],
            type: EntryType.FUNCTION,
            payable: false,
            stateMutability: StateMutabilityType.NONPAYABLE,
          },
        ],
      },
      bytecode: '0x6080',
      call_value: 0n,
      consume_user_resource_percent: 100n,
      name: 'Token',
      origin_energy_limit: 10_000_000n,
      code_hash: '0x',
      trx_hash: '0x',
      version: 1,
    },
    call_token_value: 0n,
    token_id: 0n,
  }
  // Param { name(2), type(3) } — `indexed: false` omitted.
  const param1 = '12035f746f1a0761646472657373'
  const param2 = '12065f76616c75651a0775696e74323536'
  // Entry { name(3), inputs(4)×2, type(6)=FUNCTION, stateMutability(8)=NONPAYABLE }.
  const entry = `1a087472616e73666572220e${param1}2211${param2}30024003`
  // ABI { entrys(1) }.
  const abi = `0a31${entry}`
  // SmartContract { origin(1), abi(3), bytecode(4), consume(6), name(7), energy(8), version(11) }.
  const sc = `0a15${v1}1a33${abi}2202608030643a05546f6b656e4080ade2045801`
  expect(bytesToHex(encodeCreateSmartContract(x))).toBe(`0x0a15${v1}1260${sc}`)
  // Canonical decode: enum names, bare hex, number int64, defaults omitted.
  expect(decodeCreateSmartContract(encodeCreateSmartContract(x))).toStrictEqual(
    {
      owner_address: v1,
      new_contract: {
        origin_address: v1,
        abi: {
          entrys: [
            {
              name: 'transfer',
              inputs: [
                { name: '_to', type: 'address' },
                { name: '_value', type: 'uint256' },
              ],
              type: 'Function',
              stateMutability: 'Nonpayable',
            },
          ],
        },
        bytecode: '6080',
        consume_user_resource_percent: 100,
        name: 'Token',
        origin_energy_limit: 10_000_000,
        version: 1,
      },
    },
  )
})
