// Read (public) + write (wallet) action surface, plus the `getContract` facade.
// biome-ignore lint/performance/noBarrelFile: entrypoint module
export {
  type GetContractErrorType,
  type GetContractParameters,
  type GetContractReturnType,
  getContract,
} from './getContract.js'
export {
  type EstimateEnergyParameters,
  type EstimateEnergyReturnType,
  estimateEnergy,
} from './public/estimateEnergy.js'
export {
  type GetBalanceParameters,
  type GetBalanceReturnType,
  getBalance,
} from './public/getBalance.js'
export {
  type GetBlockParameters,
  type GetBlockReturnType,
  getBlock,
} from './public/getBlock.js'
export {
  type GetChainParametersReturnType,
  getChainParameters,
  getEnergyFee,
  getTransactionFee,
} from './public/getChainParameters.js'
export {
  type GetNowBlockReturnType,
  getNowBlock,
} from './public/getNowBlock.js'
export {
  type GetTransactionInfoParameters,
  type GetTransactionInfoReturnType,
  getTransactionInfo,
} from './public/getTransactionInfo.js'
export {
  type ReadContractParameters,
  type ReadContractReturnType,
  readContract,
} from './public/readContract.js'
export {
  type TransactionReceipt,
  type WaitForTransactionReceiptParameters,
  type WaitForTransactionReceiptReturnType,
  waitForTransactionReceipt,
} from './public/waitForTransactionReceipt.js'
export {
  type BroadcastTransactionParameters,
  type BroadcastTransactionReturnType,
  broadcastTransaction,
} from './wallet/broadcastTransaction.js'
export {
  type SendTrxParameters,
  type SendTrxReturnType,
  sendTrx,
} from './wallet/sendTrx.js'
export {
  type WriteContractParameters,
  type WriteContractReturnType,
  writeContract,
} from './wallet/writeContract.js'
