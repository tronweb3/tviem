import { expect, test } from 'vitest'
import * as accounts from '../src/accounts/index.js'
import * as mod from '../src/index.js'
import * as utils from '../src/utils/index.js'

test('root barrel exposes public utils', () => {
  expect(mod.parseTrx('1')).toBe(1000000n)
  expect(mod.formatTrx(1n)).toBe('0.000001')
  expect(mod.toBase58('412b5ad5c4795c026514f8317c7a215e218dccd6cf')).toBe(
    'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
  )
  expect(mod.toTronHex('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K')).toBe(
    '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
  )
  expect(mod.keccak256('0x')).toBe(
    '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
  )
  expect(mod.sha256('0x')).toBe(
    '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
  expect(mod.toFunctionSelector('function transfer(address,uint256)')).toBe(
    '0xa9059cbb',
  )
  expect(mod.isAddress('TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe')).toBe(true)
  expect(mod.isAddress('TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLX')).toBe(false)
  expect(mod.trxUnits.sun).toBe(6)
})

test('root barrel exposes error classes', () => {
  expect(new mod.InvalidAddressError({ address: 'T123' })).toBeInstanceOf(
    mod.BaseError,
  )
  expect(mod.BaseError.name).toBe('BaseError')
})

test('utils barrel exposes public utils', () => {
  expect(utils.parseTrx('0.000001')).toBe(1n)
  expect(utils.toBase58('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf')).toBe(
    'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
  )
  expect(
    utils.formatAbiItem({
      inputs: [{ type: 'address' }, { type: 'uint256' }],
      name: 'transfer',
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    }),
  ).toBe('transfer(address,uint256)')
})

test('accounts barrel exposes privateKeyToAddress', () => {
  expect(
    accounts.privateKeyToAddress(
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    ),
  ).toBe('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')
})

test('root barrel exposes chains and defineChain', () => {
  expect(mod.mainnet.id).toBe(728126428)
  expect(mod.nile.id).toBe(3448148188)
  expect(mod.shasta.id).toBe(2494104990)
  expect(typeof mod.defineChain).toBe('function')
  expect(mod.nile.rpcUrls.default.full.http.length).toBeGreaterThan(0)
})

test('root barrel wires the read-path client (createPublicClient + http)', () => {
  const client = mod.createPublicClient({
    chain: mod.nile,
    transport: mod.http(),
  })
  expect(client.key).toBe('public')
  expect(client.chain?.id).toBe(3448148188)
  // Read action set is bound onto the Client.
  for (const name of [
    'getBalance',
    'getBlock',
    'getNowBlock',
    'getTransactionInfo',
    'getChainParameters',
    'readContract',
    'waitForTransactionReceipt',
  ] as const)
    expect(typeof client[name]).toBe('function')
})

test('root barrel exposes createTransport / createWalletClient / node errors', () => {
  expect(typeof mod.createTransport).toBe('function')
  expect(typeof mod.createWalletClient).toBe('function')
  expect(typeof mod.createClient).toBe('function')
  expect(new mod.TronNodeError('boom')).toBeInstanceOf(mod.BaseError)
  expect(new mod.AccountNotFoundError()).toBeInstanceOf(mod.BaseError)
})
