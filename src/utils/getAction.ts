/**
 * Retrieves an action from a client (if it exists), falling back to the
 * tree-shakable action function.
 *
 * The client consulted is the one the CALLING action was composed with — the
 * object its decorator received — not the final extended client (`.extend()`
 * returns a new object; decorator closures keep the old one). An override is
 * therefore seen by composed actions only when it is installed before the
 * decorator that composes them:
 *
 *   createClient({...}).extend(() => ({ getNowBlock })).extend(publicActions)
 *
 * An override added after the decorators — including any `.extend()` on a
 * client from `createPublicClient` / `createWalletClient`, whose factories
 * apply the decorators first — applies to direct calls only; composed actions
 * keep calling the implementations they were composed with.
 *
 * Lookup order:
 * 1. `client[actionFn.name]` — the implicit name from the function itself.
 * 2. `client[name]` — an explicit name, needed because some minifiers drop
 *    or rename `Function.prototype.name`.
 * 3. the tree-shakable `actionFn` bound to `client`.
 */
export function getAction<parameters, returnType>(
  client: { [key: string]: unknown },
  actionFn: (client: any, parameters: parameters) => returnType,
  // Some minifiers drop `Function.prototype.name`, or replace it with short
  // letters, so the consumer passes the name explicitly.
  name: string,
): (parameters: parameters) => returnType {
  const action_implicit = client[actionFn.name]
  if (typeof action_implicit === 'function')
    return action_implicit as (params: parameters) => returnType

  const action_explicit = client[name]
  if (typeof action_explicit === 'function')
    return action_explicit as (params: parameters) => returnType

  return (params) => actionFn(client, params)
}
