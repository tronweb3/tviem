import { defineChain } from '../defineChain.js'

/**
 * TRON Nile Testnet.
 *
 * - Chain ID `3448148188` (genesis hash suffix `0xcd8690dc`).
 * - Hosted on nile.trongrid.io: unlike api.nileex.io, that host serves the
 *   `/jsonrpc` bridge (`getLogs`) alongside `/wallet` and `/walletsolidity`.
 */
export const nile = defineChain({
  id: 3448148188,
  name: 'Tron Nile Testnet',
  nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
  rpcUrls: {
    default: {
      full: { http: ['https://nile.trongrid.io'] },
      solidity: { http: ['https://nile.trongrid.io'] },
      event: { http: ['https://nile.trongrid.io'] },
    },
  },
  blockTime: 3000,
  testnet: true,
})
