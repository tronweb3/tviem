import { defineChain } from '../defineChain.js'

/**
 * TRON Shasta Testnet.
 *
 * - Chain ID `2494104990` (genesis hash suffix `0x94a9059e`).
 * - Public FullNode + SolidityNode served by TronGrid on the same host.
 */
export const shasta = defineChain({
  id: 2494104990,
  name: 'Tron Shasta Testnet',
  nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
  rpcUrls: {
    default: {
      full: { http: ['https://api.shasta.trongrid.io'] },
      solidity: { http: ['https://api.shasta.trongrid.io'] },
      event: { http: ['https://api.shasta.trongrid.io'] },
    },
  },
  blockTime: 3000,
  testnet: true,
})
