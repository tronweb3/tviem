/**
 * Retrieves an action from a client (if it exists), falling back to the
 * tree-shakable action function.
 *
 * This is the indirection layer that lets a consumer override an action's
 * implementation on the client (e.g. a custom `writeContract`) while the
 * built-in actions still call each other through the client.
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
