import { describe, expect, test } from 'vitest'
import { privateKeyToAccount } from '../../../src/accounts/privateKeyToAccount.js'
import { triggerConstantContract } from '../../../src/actions/public/triggerConstantContract.js'
import { createClient } from '../../../src/clients/createClient.js'
import {
  createTransport,
  type Transport,
} from '../../../src/clients/transports/createTransport.js'
import { normalizeTronError } from '../../../src/clients/transports/http.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import {
  AccountNotFoundError,
  ContractFunctionRevertedError,
} from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import type {
  TronRequestArgs,
  TronRequestFn,
} from '../../../src/types/transport.js'
import { rpc, rpcReq } from '../../fixtures/rpc/loader.js'

const trc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
] as const

const contract = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address
const holder = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as Address

/** An inline transport that replies with `response` and records every request. */
function mockClient(
  response: unknown,
  extra?: Record<string, unknown>,
): { client: ReturnType<typeof createClient>; calls: TronRequestArgs[] } {
  const calls: TronRequestArgs[] = []
  const transport: Transport = () =>
    createTransport(
      {
        key: 'mock',
        name: 'Mock Transport',
        type: 'mock',
        retryCount: 0,
        retryDelay: 0,
        request: (async (args: TronRequestArgs) => {
          calls.push(args)
          return normalizeTronError(response, {
            node: args.node ?? 'full',
            path: args.path,
          })
        }) as unknown as TronRequestFn,
      },
      {},
    )
  const client = createClient({ transport, ...extra })
  return { client, calls }
}

const transferOk = {
  result: { result: true },
  constant_result: [
    '0000000000000000000000000000000000000000000000000000000000000001',
  ],
  energy_used: 13045,
}

describe('triggerConstantContract', () => {
  test('sends the gold-standard triggerconstantcontract request', async () => {
    const { client, calls } = mockClient(
      rpc('triggerconstantcontract.trc20-balanceof'),
    )
    await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'balanceOf',
      args: [holder],
      account: holder,
    })
    const gold = rpcReq('triggerconstantcontract.trc20-balanceof')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.node).toBe('full')
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.path).toBe('triggerconstantcontract')
    expect(calls[0]?.body).toEqual(gold.body)
  })

  test('decodes the result and returns energy_used for a view function', async () => {
    const { client } = mockClient(
      rpc('triggerconstantcontract.trc20-balanceof'),
    )
    const { result, energyUsed } = await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'balanceOf',
      args: [holder],
      account: holder,
    })
    expect(result).toBe(123456789000000000000000000n)
    expect(energyUsed).toBe(933n)
  })

  test('supports a nonpayable (write) function', async () => {
    const { client, calls } = mockClient(transferOk)
    const { result, energyUsed } = await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [holder, 1000000n],
      account: holder,
    })
    expect(result).toBe(true)
    expect(energyUsed).toBe(13045n)
    const body = calls[0]?.body as { data: string }
    expect(body.data.startsWith('a9059cbb')).toBe(true)
  })

  test('supports a payable function with callValue as call_value', async () => {
    const { client, calls } = mockClient({
      result: { result: true },
      energy_used: 500,
    })
    const { result, energyUsed } = await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'deposit',
      callValue: 5n,
      account: holder,
    })
    // `deposit` has no outputs — there is nothing to decode.
    expect(result).toBeUndefined()
    expect(energyUsed).toBe(500n)
    expect((calls[0]?.body as { call_value?: number }).call_value).toBe(5)
  })

  test('rejects a callValue beyond the JSON-safe integer range', async () => {
    const { client } = mockClient(transferOk)
    await expect(
      triggerConstantContract(client, {
        address: contract,
        abi: trc20Abi,
        functionName: 'deposit',
        callValue: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        account: holder,
      }),
    ).rejects.toBeInstanceOf(IntegerOutOfRangeError)
  })

  // The simulation runs against real chain state, so its outcome belongs to a
  // specific caller — the SDK never picks one.
  test('throws AccountNotFoundError without an account', async () => {
    const { client, calls } = mockClient(transferOk)
    await expect(
      triggerConstantContract(client, {
        address: contract,
        abi: trc20Abi,
        functionName: 'transfer',
        args: [holder, 1n],
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError)
    // It throws before touching the node.
    expect(calls).toHaveLength(0)
  })

  test('uses an explicit `account` as owner_address', async () => {
    const { client, calls } = mockClient(transferOk)
    await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [holder, 1n],
      account: holder,
    })
    expect((calls[0]?.body as { owner_address: string }).owner_address).toBe(
      '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
    )
  })

  test('falls back to the client account when no account is passed', async () => {
    // pk = 1 (permitted trivial key).
    const account = privateKeyToAccount(`0x${'0'.repeat(63)}1`)
    const { client, calls } = mockClient(transferOk, { account })
    await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [holder, 1n],
    })
    const { toHex } = await import('../../../src/utils/address/toHex.js')
    expect((calls[0]?.body as { owner_address: string }).owner_address).toBe(
      toHex(account.address),
    )
  })

  test('throws a decoded Error(string) revert', async () => {
    // selector 08c379a0 + ABI-encoded "INSUFFICIENT_BALANCE".
    const revert = {
      result: { result: false, message: '52455645525420' },
      constant_result: [
        '08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014494e53554646494349454e545f42414c414e4345000000000000000000000000',
      ],
    }
    const { client } = mockClient(revert)
    const err = (await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [holder, 1n],
      account: holder,
    }).catch((e) => e)) as ContractFunctionRevertedError
    expect(err).toBeInstanceOf(ContractFunctionRevertedError)
    expect(err.reason).toBe('INSUFFICIENT_BALANCE')
    expect(err.signature).toBe('Error(string)')
  })

  // The shape a real java-tron node emits: `result: true` with a `message`.
  // proto3 omits the `result: false` default, so a check keyed on it alone
  // never fires and the revert payload decodes as if it were the return value.
  test('throws on a real-node revert (result: true + message)', async () => {
    const revert = {
      result: {
        result: true,
        message: '524556455254206f70636f6465206578656375746564',
      },
      constant_result: [
        '08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014494e53554646494349454e545f42414c414e4345000000000000000000000000',
      ],
      energy_used: 885,
    }
    const { client } = mockClient(revert)
    const err = (await triggerConstantContract(client, {
      address: contract,
      abi: trc20Abi,
      functionName: 'transfer',
      args: [holder, 1n],
      account: holder,
    }).catch((e) => e)) as ContractFunctionRevertedError
    expect(err).toBeInstanceOf(ContractFunctionRevertedError)
    expect(err.reason).toBe('INSUFFICIENT_BALANCE')
    expect(err.signature).toBe('Error(string)')
  })
})
