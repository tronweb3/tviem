<br/>

<p align="center">
  <a href="https://walletadapter.org/tviem">
    <img alt="tviem" src="https://img.shields.io/badge/@tronweb3%2Ftviem-c23631?style=for-the-badge" height="34">
  </a>
</p>

<p align="center">
  Lightweight, type-safe TypeScript SDK for the TRON blockchain
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tronweb3/tviem">
    <img src="https://img.shields.io/npm/v/@tronweb3/tviem?colorA=f6f8fa&colorB=f6f8fa&style=flat" alt="Version">
  </a>
  <a href="https://www.npmjs.com/package/@tronweb3/tviem">
    <img src="https://img.shields.io/npm/dm/@tronweb3/tviem?colorA=f6f8fa&colorB=f6f8fa&style=flat" alt="Downloads per month">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/npm/l/@tronweb3/tviem?colorA=f6f8fa&colorB=f6f8fa&style=flat" alt="MIT License">
  </a>
</p>

<br>

## Features

- Abstractions over the TRON [HTTP API](https://developers.tron.network/reference) (fullnode / solidity / event) so you never hand-assemble a request
- First-class APIs for reading and writing [smart contracts](https://developers.tron.network/docs/smart-contracts) (TRC-20 and beyond)
- **Full TronWeb `transactionBuilder` parity** — all 34 system contracts (TRX/TRC-10 transfers, staking v2, resource delegation, voting, proposals, exchanges, permissions…) as standalone, tree-shakable actions
- **Trustless local signing** — the signer verifies the full `txID` + `raw_data` + `raw_data_hex` triple before signing; blind signing is impossible by construction
- TRON-native protocol layer: Base58Check (`T…`) addresses, `SUN` (6-decimal) units, energy/bandwidth accounting, protobuf serialization with `sha256` transaction IDs
- Browser-native [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) — no BigNumber libraries
- Utilities for working with ABIs (encoding / decoding / inspection), including TRON's `trcToken` type
- TypeScript-ready: infer types straight from ABIs and TIP-712 typed data via [`abitype`](https://abitype.dev)
- Tree-shakable ESM + CJS, `sideEffects: false`, and a tiny audited dependency set ([`@noble`](https://paulmillr.com/noble/) / [`@scure`](https://paulmillr.com/noble/) cryptography, [`abitype`](https://abitype.dev))

... and a lot more.

## Install

```bash
npm i @tronweb3/tviem
```

Requires **Node.js 22+**.

## Overview

```ts
// 1. Import modules.
import { createPublicClient, http } from '@tronweb3/tviem'
import { nile } from '@tronweb3/tviem/chains'

// 2. Set up your client with the desired chain & transport.
const client = createPublicClient({
  chain: nile,
  transport: http(),
})

// 3. Consume an action!
const balance = await client.getBalance({
  address: 'T…', // a Base58Check account address
})
```

### Read a contract

`readContract` decodes results against your ABI — pass an `as const` ABI to get
fully inferred argument and return types. Addresses come back in canonical
Base58Check (`T…`) form.

The caller is explicit: `account` is the address the node sees as `msg.sender`,
and a contract may return different values for different callers. Pass it
per-call, or hoist one on the Client — with neither, the read throws
`AccountNotFoundError` instead of quietly picking a placeholder.

```ts
import { createPublicClient, http } from '@tronweb3/tviem'
import { nile } from '@tronweb3/tviem/chains'

const client = createPublicClient({ chain: nile, transport: http() })

const abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const balance = await client.readContract({
  address: 'T…', // a TRC-20 contract address (Nile)
  abi,
  functionName: 'balanceOf',
  args: ['T…'], // the account to query
  account: 'T…', // the caller the node sees as msg.sender
})
```

### Send TRX with a local account

```ts
import {
  createWalletClient,
  http,
  parseTrx,
  privateKeyToAccount,
} from '@tronweb3/tviem'
import { nile } from '@tronweb3/tviem/chains'

const account = privateKeyToAccount('0x…')

const wallet = createWalletClient({
  account,
  chain: nile,
  transport: http(),
})

// Builds, signs (locally, verifying the txID/raw_data/raw_data_hex triple)
// and broadcasts in one call.
const { txID } = await wallet.sendTrx({
  to: 'T…', // recipient (Base58Check T-address)
  amount: parseTrx('1'), // 1 TRX, expressed in SUN
})
```

Prefer to build and sign **offline**? Every write action has a `buildX`
counterpart that returns an unsigned transaction you can hand to
`account.signTransaction(...)` yourself.

## Package layout

Subpath exports, ESM + CJS, `sideEffects: false`:

| Entry | Contents |
| --- | --- |
| `@tronweb3/tviem` | clients, transports, actions, common utils |
| `@tronweb3/tviem/accounts` | local private-key, mnemonic & HD accounts |
| `@tronweb3/tviem/actions` | standalone, tree-shakable chain actions |
| `@tronweb3/tviem/chains` | `mainnet`, `nile`, `shasta` chain definitions |
| `@tronweb3/tviem/utils` | addresses, units, hashing, ABI, protobuf |

## Documentation

Head to the [documentation](https://walletadapter.org/tviem) to read and learn
more.

## Contributing

Contributions are welcome. Please [open an issue](https://github.com/tronweb3/tviem/issues/new) or a pull request.

## License

[MIT](./LICENSE) License. This package adapts portions of MIT-licensed
third-party code — see [`THIRD-PARTY-NOTICES`](./THIRD-PARTY-NOTICES).
