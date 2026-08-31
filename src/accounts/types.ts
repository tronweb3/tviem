import type { HDKey } from '@scure/bip32'
import type { Address } from '../types/address.js'
import type { Hex, SignableMessage } from '../types/misc.js'
import type { HashTypedDataParameters } from '../utils/signature/hashTypedData.js'
import type { Signature } from '../utils/signature/sign.js'
import type { RawData } from '../utils/transaction/serializeRawData.js'

export type { SignableMessage } from '../types/misc.js'

/**
 * A transaction in signable shape: the full triple — `txID`, the `raw_data`
 * model and the serialized `raw_data_hex` bytes — plus the running
 * `signature` list. The three must be mutually consistent; `txCheck`
 * verifies this at signing time. `signTransaction` appends its signature to
 * `signature` and returns a new object — the input is never mutated.
 */
export type SignableTransaction = {
  /**
   * Transaction id (64 hex chars, no `0x` prefix): the SHA-256 of the
   * `raw_data_hex` bytes. Verified — never derived — at signing time.
   */
  txID: string
  /**
   * The `Transaction.raw_data` in the canonical node-JSON shape (java-tron's
   * `visible: false` rendering) — the same shape whether built by this SDK,
   * returned by a node, or handed over by TronWeb. The `raw_data_hex` bytes
   * are authoritative; the JSON is verified to serialize to exactly those
   * bytes at signing time.
   */
  raw_data: RawData
  /**
   * Serialized `raw_data` bytes (bare hex) — what the signature covers
   * (`txID` is their SHA-256).
   */
  raw_data_hex: string
  /** Accumulated signatures (TRON wire form, bare lowercase hex). */
  signature?: string[]
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

/** Options for an account's `multiSign`. */
export type AccountMultiSignOptions = {
  /**
   * The active/owner permission id (`Permission.id`) this signature is for.
   * Defaults to the id already baked into the transaction
   * (`contract[0].Permission_id`); absent everywhere means the owner
   * permission (id 0).
   */
  permissionId?: number | undefined
}

/**
 * An account's `multiSign`: adds this signer's signature to a multi-signature
 * transaction under a permission id — binding the id into the bytes when it
 * is fresh — and returns the co-signed transaction. Unlike `signTransaction`,
 * the signer need not be the transaction's `owner_address`.
 */
export type AccountMultiSignFn = (
  transaction: SignableTransaction,
  options?: AccountMultiSignOptions,
) => SignableTransaction

/**
 * The signing surface shared by every account. Local (private-key) accounts
 * are implemented today; remote/delegated signers land in v0.1c. All methods
 * are synchronous for locally held keys.
 *
 * Deliberately, there is NO raw-digest `sign({ hash })`: signing an opaque
 * 32-byte hash is blind signing — the signer cannot know what it authorizes.
 * Every signature an account produces carries context: a transaction
 * (integrity-checked against its bytes, owner-guarded), a TIP-191-prefixed
 * message, or a TIP-712 typed-data domain.
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
  /**
   * Co-signs a multi-signature transaction under a permission id (see
   * {@link AccountMultiSignFn}). Optional for custom sources — a source that
   * omits it cannot co-sign as a non-owner; always present on key-backed
   * accounts.
   */
  multiSign?: AccountMultiSignFn | undefined
}

/** How an account holds its signing material. */
export type AccountSource = 'privateKey' | 'custom' | 'hd'

/** A locally-signing account backed by a raw secp256k1 private key. */
export type TronLocalAccount = TronCustomSource & {
  /** Co-signs a multi-signature transaction under a permission id. */
  multiSign: AccountMultiSignFn
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
  /** Co-signs a multi-signature transaction under a permission id. */
  multiSign: AccountMultiSignFn
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

/**
 * A private key in either accepted string form — `0x`-prefixed or bare
 * 64-char hex. In this version every string `account` source is a private key
 * (Base58 watch-only sources are reserved for v0.1c), so this is the string
 * half of every `account` parameter: `TronAccount | AccountKey`. Length, hex
 * shape and secp256k1 range are enforced at runtime by `privateKeyToAccount`
 * — this type only widens the compile-time contract to what the runtime
 * already accepts.
 *
 * The `string & {}` member keeps the union from collapsing to plain `string`,
 * so `0x` completions survive in editors.
 */
export type AccountKey = Hex | (string & {})
