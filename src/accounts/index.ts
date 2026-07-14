// biome-ignore lint/performance/noBarrelFile: entrypoint module
export { HDKey } from '@scure/bip32'
export {
  type GenerateMnemonicErrorType,
  generateMnemonic,
} from './generateMnemonic.js'
export {
  type GeneratePrivateKeyErrorType,
  generatePrivateKey,
} from './generatePrivateKey.js'
export {
  type HDOptions,
  type HdKeyToAccountErrorType,
  hdKeyToAccount,
} from './hdKeyToAccount.js'
export {
  type MnemonicToAccountErrorType,
  type MnemonicToAccountOptions,
  mnemonicToAccount,
} from './mnemonicToAccount.js'
export {
  type PrivateKeyToAccountErrorType,
  privateKeyToAccount,
} from './privateKeyToAccount.js'
export { type ToAccountErrorType, toAccount } from './toAccount.js'
export type {
  AccountSignMessageParameters,
  AccountSignParameters,
  AccountSignTypedDataParameters,
  AccountSource,
  SignableMessage,
  SignableTransaction,
  TronAccount,
  TronCustomAccount,
  TronCustomSource,
  TronHDAccount,
  TronLocalAccount,
} from './types.js'
export {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from './utils/privateKeyToAddress.js'
export {
  type SignTransactionErrorType,
  signTransaction,
} from './utils/signTransaction.js'
