/**
 * TRON address types.
 *
 * TRON has three interchangeable address forms (all derived from the same
 * 21-byte payload, pivot = `0x41 ++ 20-byte EVM address`):
 * - Base58Check: `T`-prefixed, 34 characters (canonical user-facing form).
 * - TRON hex: `41`-prefixed, 21 bytes (42 hex characters), no `0x` prefix.
 * - EVM hex: `0x`-prefixed, 20 bytes (form used inside the TVM/ABI layer).
 */

/**
 * Canonical TRON address: a `T`-prefixed, 34-character Base58Check string.
 *
 * The template-literal prefix acts as a lightweight brand (like an EVM-style
 * `0x${string}`): plain `string` is not assignable, but literals are.
 *
 * @example 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
 */
export type Address = `T${string}`

/**
 * TRON hex-form address: `41`-prefixed, 21 bytes (42 hex characters),
 * without a `0x` prefix.
 *
 * @example '412b5ad5c4795c026514f8317c7a215e218dccd6cf'
 */
export type TronHexAddress = `41${string}`

/**
 * EVM-form address: `0x`-prefixed, 20 bytes (40 hex characters). Used at the
 * TVM/ABI boundary (e.g. ABI encoding, log topics).
 *
 * @example '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'
 */
export type EvmAddress = `0x${string}`

/**
 * Any accepted address input form (wide-in): Base58Check (`T…`),
 * TRON hex (`41…`), or EVM hex (`0x…`). Normalizers accept this union and
 * pivot on the 21-byte payload.
 */
export type AddressInput = Address | TronHexAddress | EvmAddress
