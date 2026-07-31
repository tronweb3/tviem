import type { HDKey } from '@scure/bip32'
import type { Address } from '../types/address.js'
import type { Hex, SignableMessage } from '../types/misc.js'
import type { HashTypedDataParameters } from '../utils/signature/hashTypedData.js'
import type { Signature } from '../utils/signature/sign.js'
import type { RawData } from '../utils/transaction/serializeRawData.js'

export type { SignableMessage } from '../types/misc.js'

/**
 * A transaction in signable shape: it carries a `txID` and/or a `raw_data`
 * model (from which the id is derived when `txID` is absent), plus the running
 * `signature` list. `signTransaction` appends its signature to `signature` and
 * returns a new object — the input is never mutated.
 */
export type SignableTransaction = {
  /**
   * Transaction id (64 hex chars, no `0x` prefix). Derived from `raw_data`
   * when omitted.
   */
  txID?: string | undefined
  /**
   * The `Transaction.raw_data` in the canonical node-JSON shape (java-tron's
   * `visible: false` rendering) — the same shape whether built by this SDK,
   * returned by a node, or handed over by TronWeb. When accompanied by
   * `raw_data_hex`, the bytes are authoritative and the JSON is verified
   * against them at signing time.
   */
  raw_data?: RawData | undefined
  /** Serialized `raw_data` bytes (bare hex), passed through untouched. */
  raw_data_hex?: string | undefined
  /** Accumulated signatures (TRON wire form, bare lowercase hex). */
  signature?: string[] | undefined
}

/** Parameters for an account's `signMessage`. */
export type AccountSignMessageParameters = {
  /** The message to sign — a UTF-8 string or `{ raw }`. */
  message: SignableMessage
}

/**
 * Parameters for an account's `signTypedData`: the TIP-712 `domain`, `types`,
 * `primaryType` and `message` (the private key is supplied by the account).
 */
export type AccountSignTypedDataParameters = HashTypedDataParameters

/**
 * The signing surface shared by every account. Local (private-key) accounts
 * are implemented today; remote/delegated signers land in v0.1c. All methods
 * are synchronous for locally held keys.
 *
 * Deliberately, there is NO raw-digest `sign({ hash })`: signing an opaque
 * 32-byte hash is blind signing — the signer cannot know what it authorizes.
 * Every signature an account produces carries context: a transaction (five
 * sign guards), a TIP-191-prefixed message, or a TIP-712 typed-data domain.
 */
export type TronCustomSource = {
  /** The account's canonical Base58Check address. */
  address: Address
  /** The uncompressed secp256k1 public key (`0x04…`, 65 bytes). */
  publicKey: Hex
  /** Signs a message per TIP-191. */
  signMessage: (parameters: AccountSignMessageParameters) => Signature
  /** Signs TIP-712 typed structured data. */
  signTypedData: (parameters: AccountSignTypedDataParameters) => Signature
  /** Signs a transaction, appending to its `signature` list. */
  signTransaction: (transaction: SignableTransaction) => SignableTransaction
}

/** How an account holds its signing material. */
export type AccountSource = 'privateKey' | 'custom' | 'hd'

/** A locally-signing account backed by a raw secp256k1 private key. */
export type TronLocalAccount = TronCustomSource & {
  /** Signing source. `'privateKey'` = a locally held key. */
  source: 'privateKey'
  /** Discriminant for the account union. */
  type: 'local'
}

/**
 * A locally-signing account derived from a BIP-39 mnemonic / BIP-32 HD node
 * (via {@link mnemonicToAccount} / {@link hdKeyToAccount}). Signs with the
 * derived private key; `getHdKey` exposes the derived node for further
 * derivation or extended-key export.
 */
export type TronHDAccount = TronCustomSource & {
  /** Signing source. `'hd'` = derived from an HD key. */
  source: 'hd'
  /** Discriminant for the account union. */
  type: 'local'
  /** Returns the derived BIP-32 HD node (`@scure/bip32`). */
  getHdKey: () => HDKey
}

/**
 * An account backed by a caller-supplied signing source (its own `sign`
 * functions) rather than a raw private key held by this SDK. Produced by
 * `toAccount` from a {@link TronCustomSource}; the reserved shape that v0.1c
 * delegated/remote signers plug into.
 */
export type TronCustomAccount = TronCustomSource & {
  /** Signing source. `'custom'` = caller-supplied signing functions. */
  source: 'custom'
  /** Discriminant for the account union. */
  type: 'local'
}

/**
 * Any account this SDK can produce: a private-key-backed
 * {@link TronLocalAccount}, an HD-derived {@link TronHDAccount}, or a
 * caller-supplied {@link TronCustomAccount}.
 */
export type TronAccount = TronLocalAccount | TronHDAccount | TronCustomAccount
