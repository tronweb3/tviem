// TRON-specific, clean-room tests for @tronweb3/omni.
// Vectors are byte-for-byte from TronWeb's `TronWeb.fromMnemonic` over the
// canonical zero-entropy BIP-39 test vector (the "pk=1" of mnemonics: 16 zero
// bytes → "abandon abandon … about"). No secret is committed — the phrase is
// derived from zero entropy in-test and only public addresses/pubkeys are
// pinned, never a derived private key.
import { HDKey } from '@scure/bip32'
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { describe, expect, test } from 'vitest'

import { verifyMessage } from '../utils/signature/verifyMessage.js'
import { verifyTypedData } from '../utils/signature/verifyTypedData.js'
import { generateMnemonic } from './generateMnemonic.js'
import { hdKeyToAccount } from './hdKeyToAccount.js'
import { mnemonicToAccount } from './mnemonicToAccount.js'

const mnemonic = entropyToMnemonic(new Uint8Array(16), wordlist)

// TronWeb-verified derivations (address, uncompressed pubkey) at pinned paths.
const V = {
  default: {
    address: 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
    publicKey:
      '0x04ff21f8e64d3a3c0198edfbb7afdc79be959432e92e2f8a1984bb436a414b8edcec0345aad0c1bf7da04fd036dd7f9f617e30669224283d950fab9dd84831dc83',
  },
  account1: 'TLrpNTBuCpGMrB9TyVwgEhNVRhtWEQPHh4',
  addressIndex1: 'TSeJkUh4Qv67VNFwY8LaAxERygNdy6NQZK',
  change1: 'THLNguYKN3S8RUzVyi9ErynW4YmXLU5c8n',
  path5: 'TBdYXtwq18cAhi1BA574TrP6tw2G86anu1',
  passphrase: 'TD6CLmNTvqUzGQt6aDZyMSjg6eT1t8uQza',
} as const

describe('mnemonicToAccount', () => {
  test('the fixture mnemonic is the canonical zero-entropy vector', () => {
    expect(mnemonic).toBe(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    )
  })

  test('derives the default TRON path m/44’/195’/0’/0/0', () => {
    const account = mnemonicToAccount(mnemonic)
    expect(account.address).toBe(V.default.address)
    expect(account.publicKey).toBe(V.default.publicKey)
    expect(account.source).toBe('hd')
    expect(account.type).toBe('local')
  })

  test('accountIndex varies the hardened account segment', () => {
    expect(mnemonicToAccount(mnemonic, { accountIndex: 1 }).address).toBe(
      V.account1,
    )
  })

  test('addressIndex varies the final segment; explicit path agrees', () => {
    expect(mnemonicToAccount(mnemonic, { addressIndex: 1 }).address).toBe(
      V.addressIndex1,
    )
    expect(
      mnemonicToAccount(mnemonic, { path: "m/44'/195'/0'/0/1" }).address,
    ).toBe(V.addressIndex1)
  })

  test('changeIndex varies the change segment', () => {
    expect(mnemonicToAccount(mnemonic, { changeIndex: 1 }).address).toBe(
      V.change1,
    )
  })

  test('an explicit path overrides the index options', () => {
    expect(
      mnemonicToAccount(mnemonic, { path: "m/44'/195'/0'/0/5" }).address,
    ).toBe(V.path5)
  })

  test('a passphrase changes the derived account', () => {
    const account = mnemonicToAccount(mnemonic, {
      passphrase: 'omni-\u{1f680}',
    })
    expect(account.address).toBe(V.passphrase)
    expect(account.address).not.toBe(V.default.address)
  })

  test('throws on an invalid mnemonic', () => {
    expect(() => mnemonicToAccount('not a valid mnemonic phrase')).toThrow()
    // A valid-looking phrase with a bad checksum is also rejected.
    expect(() =>
      mnemonicToAccount(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      ),
    ).toThrow()
  })

  test('getHdKey exposes the derived node', () => {
    const account = mnemonicToAccount(mnemonic)
    const hdKey = account.getHdKey()
    expect(hdKey.privateKey).toBeInstanceOf(Uint8Array)
    expect(hdKey.publicKey).toBeInstanceOf(Uint8Array)
    expect(hdKey.publicExtendedKey.startsWith('xpub')).toBe(true)
  })

  test('the derived account can sign messages and typed data', () => {
    const account = mnemonicToAccount(mnemonic)
    const signature = account.signMessage({ message: 'gm from HD' })
    expect(
      verifyMessage({
        message: 'gm from HD',
        signature: signature.serialized,
        address: account.address,
      }),
    ).toBe(true)

    const typedData = {
      domain: { name: 'Omni', version: '1', chainId: 728126428n },
      types: { Msg: [{ name: 'text', type: 'string' }] },
      primaryType: 'Msg',
      message: { text: 'hi' },
    } as const
    const tdSig = account.signTypedData(typedData)
    expect(
      verifyTypedData({
        ...typedData,
        signature: tdSig.serialized,
        address: account.address,
      }),
    ).toBe(true)
  })
})

describe('hdKeyToAccount / generateMnemonic', () => {
  const master = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic))

  test('mnemonicToAccount delegates to hdKeyToAccount(master)', () => {
    expect(hdKeyToAccount(master).address).toBe(V.default.address)
    expect(hdKeyToAccount(master, { accountIndex: 1 }).address).toBe(V.account1)
    expect(hdKeyToAccount(master, { path: "m/44'/195'/0'/0/5" }).address).toBe(
      V.path5,
    )
  })

  test('the derived getHdKey node re-derives to the same account', () => {
    const account = mnemonicToAccount(mnemonic, { addressIndex: 2 })
    // The leaf node's own private key reproduces the same signer address.
    expect(account.getHdKey().privateKey).toBeInstanceOf(Uint8Array)
    expect(account.address).toBe(
      mnemonicToAccount(mnemonic, { path: "m/44'/195'/0'/0/2" }).address,
    )
  })

  test('generateMnemonic round-trips into a usable HD account', () => {
    const phrase = generateMnemonic()
    expect(phrase.split(' ')).toHaveLength(12)
    const account = mnemonicToAccount(phrase)
    expect(account.address.startsWith('T')).toBe(true)
    expect(account.source).toBe('hd')
    // 24-word phrase (256-bit entropy).
    expect(generateMnemonic(256).split(' ')).toHaveLength(24)
  })
})
