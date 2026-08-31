// biome-ignore lint/performance/noBarrelFile: entrypoint module
export { HDKey } from '@scure/bip32'
export {
  type ParseAccount,
  type ParseAccountErrorType,
  parseAccount,
} from '../types/account.js'
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
  AccountKey,
  AccountMultiSignFn,
  AccountMultiSignOptions,
  AccountSignMessageParameters,
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
  type MultiSignTransactionErrorType,
  type MultiSignTransactionParameters,
  multiSignTransaction,
} from './utils/multiSignTransaction.js'
export {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from './utils/privateKeyToAddress.js'
export {
  type SignTransactionErrorType,
  signTransaction,
} from './utils/signTransaction.js'
