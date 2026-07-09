import { defineChain } from '../defineChain.js'

/**
 * TRON Nile Testnet.
 *
 * - Chain ID `3448148188` (genesis hash suffix `0xcd8690dc`).
 * - Public FullNode + SolidityNode served by nileex.io on the same host.
 */
export const nile = defineChain({
  id: 3448148188,
  name: 'Tron Nile Testnet',
  nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
  rpcUrls: {
    default: {
      full: { http: ['https://api.nileex.io'] },
      solidity: { http: ['https://api.nileex.io'] },
    },
  },
  blockTime: 3000,
  testnet: true,
})
