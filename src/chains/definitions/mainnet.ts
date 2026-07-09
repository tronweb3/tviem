import { defineChain } from '../defineChain.js'

/**
 * TRON Mainnet.
 *
 * - Chain ID `728126428` (genesis hash suffix `0x2b6653dc`).
 * - Public FullNode + SolidityNode served by TronGrid on the same host.
 */
export const mainnet = defineChain({
  id: 728126428,
  name: 'Tron Mainnet',
  nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
  rpcUrls: {
    default: {
      full: { http: ['https://api.trongrid.io'] },
      solidity: { http: ['https://api.trongrid.io'] },
    },
  },
  blockTime: 3000,
})
