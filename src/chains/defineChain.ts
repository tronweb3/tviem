import type { Chain } from '../types/chain.js'
import type { Assign, Prettify } from '../types/utils.js'

/**
 * A chain value carrying a chainable `.extend` method. Each `.extend` call
 * shallow-merges an overlay (object or `(base) => overlay` function) onto the
 * chain, preferring the overlay's fields, and re-attaches `.extend`.
 */
export type Extendable<chain> = chain & {
  extend: <const extended extends Record<string, unknown>>(
    extended: extended | ((base: chain) => extended),
  ) => Extendable<Assign<chain, extended>>
}

/**
 * Return type of {@link defineChain}: the chain literal plus an `.extend`
 * method that shallow-merges an overlay onto the chain (preferring the
 * overlay's fields) and re-attaches `.extend` for further chaining.
 */
export type DefineChainReturnType<chain extends Chain = Chain> = Prettify<
  Extendable<chain>
>

/**
 * Defines a TRON {@link Chain}, preserving the literal (`const`) inference of
 * the input and attaching a chainable `.extend` method.
 *
 * Unlike the EVM equivalent there are no `formatters` / `fees` / `serializers`
 * defaults to inject; `.extend` simply overlays extra data onto the chain.
 *
 * @example
 * ```ts
 * const nile = defineChain({ id: 3448148188, name: 'Tron Nile Testnet', ... })
 * const withExplorer = nile.extend({ explorer: 'https://nile.tronscan.org' })
 * ```
 */
export function defineChain<const chain extends Chain>(
  chain: chain,
): DefineChainReturnType<chain> {
  const chainInstance = { ...chain }

  function extend(base: typeof chainInstance) {
    type ExtendFn = (base: typeof chainInstance) => unknown
    return (fnOrExtended: ExtendFn | Record<string, unknown>) => {
      const properties = (
        typeof fnOrExtended === 'function' ? fnOrExtended(base) : fnOrExtended
      ) as Record<string, unknown>
      const combined = { ...base, ...properties }
      return Object.assign(combined, { extend: extend(combined) })
    }
  }

  return Object.assign(chainInstance, {
    extend: extend(chainInstance),
  }) as never
}
