import { expect, test } from 'vitest'
import { version } from '../../../src/errors/version.js'
import { normalizeSignature } from '../../../src/utils/hash/normalizeSignature.js'

test('foo()', () => {
  expect(normalizeSignature('foo()')).toBe('foo()')
})

test('bar(uint foo)', () => {
  expect(normalizeSignature('bar(uint foo)')).toBe('bar(uint256)')
})

test('bar(int foo)', () => {
  expect(normalizeSignature('bar(int foo)')).toBe('bar(int256)')
})

// bare aliases are canonicalized; already-qualified types are untouched
test('bar(uint foo, uint256 bar, int baz, int256 qux)', () => {
  expect(
    normalizeSignature('bar(uint foo, uint256 bar, int baz, int256 qux)'),
  ).toBe('bar(uint256,uint256,int256,int256)')
})

// canonicalization touches only the bare aliases — sized ints, arrays and
// look-alike names (`mint`) are left alone
test('canonicalizes uint/int aliases in arrays and tuples only', () => {
  expect(normalizeSignature('mint(uint[3] a, int[] b)')).toBe(
    'mint(uint256[3],int256[])',
  )
  expect(normalizeSignature('bar(uint8 a, int32 b)')).toBe('bar(uint8,int32)')
})

test('processAccount(uint256 , address )', () => {
  expect(normalizeSignature('processAccount(uint256 , address )')).toBe(
    'processAccount(uint256,address)',
  )
})

test('function bar()', () => {
  expect(normalizeSignature('function bar()')).toBe('bar()')
})

test('function bar()', () => {
  expect(normalizeSignature('function  bar( )')).toBe('bar()')
})

test('event Bar()', () => {
  expect(normalizeSignature('event Bar()')).toBe('Bar()')
})

test('function bar(uint foo)', () => {
  expect(normalizeSignature('function bar(uint foo)')).toBe('bar(uint256)')
})

test('function bar(uint foo, address baz)', () => {
  expect(normalizeSignature('function bar(uint foo, address baz)')).toBe(
    'bar(uint256,address)',
  )
})

test('event Barry(uint foo)', () => {
  expect(normalizeSignature('event Barry(uint foo)')).toBe('Barry(uint256)')
})

test('Barry(uint indexed foo)', () => {
  expect(normalizeSignature('Barry(uint indexed foo)')).toBe('Barry(uint256)')
})

test('event Barry(uint indexed foo)', () => {
  expect(normalizeSignature('event Barry(uint indexed foo)')).toBe(
    'Barry(uint256)',
  )
})

test('function _compound(uint256 a, uint256 b, uint256 c)', () => {
  expect(
    normalizeSignature('function _compound(uint256 a, uint256 b, uint256 c)'),
  ).toBe('_compound(uint256,uint256,uint256)')
})

test('bar(uint foo, (uint baz))', () => {
  expect(normalizeSignature('bar(uint foo, (uint baz))')).toBe(
    'bar(uint256,(uint256))',
  )
})

test('bar(uint foo, (uint baz, bool x))', () => {
  expect(normalizeSignature('bar(uint foo, (uint baz, bool x))')).toBe(
    'bar(uint256,(uint256,bool))',
  )
})

test('bar(uint foo, (uint baz, bool x) foo)', () => {
  expect(normalizeSignature('bar(uint foo, (uint baz, bool x) foo)')).toBe(
    'bar(uint256,(uint256,bool))',
  )
})

test('bar(uint[] foo, (uint baz, bool x))', () => {
  expect(normalizeSignature('bar(uint[] foo, (uint baz, bool x))')).toBe(
    'bar(uint256[],(uint256,bool))',
  )
})

test('bar(uint[] foo, (uint baz, bool x)[])', () => {
  expect(normalizeSignature('bar(uint[] foo, (uint baz, bool x)[])')).toBe(
    'bar(uint256[],(uint256,bool)[])',
  )
})

test('foo(uint bar)', () => {
  expect(normalizeSignature('foo(uint bar) payable returns (uint)')).toBe(
    'foo(uint256)',
  )
})

test('function submitBlocksWithCallbacks(bool isDataCompressed, bytes calldata data, ((uint16,(uint16,uint16,uint16,bytes)[])[], address[])  calldata config)', () => {
  expect(
    normalizeSignature(
      'function submitBlocksWithCallbacks(bool isDataCompressed, bytes calldata data, ((uint16,(uint16,uint16,uint16,bytes)[])[], address[])  calldata config)',
    ),
  ).toBe(
    'submitBlocksWithCallbacks(bool,bytes,((uint16,(uint16,uint16,uint16,bytes)[])[],address[]))',
  )
})

test('function createEdition(string name, string symbol, uint64 editionSize, uint16 royaltyBPS, address fundsRecipient, address defaultAdmin, (uint104 publicSalePrice, uint32 maxSalePurchasePerAddress, uint64 publicSaleStart, uint64 publicSaleEnd, uint64 presaleStart, uint64 presaleEnd, bytes32 presaleMerkleRoot) saleConfig, string description, string animationURI, string imageURI) returns (address)', () => {
  expect(
    normalizeSignature(
      'function createEdition(string name, string symbol, uint64 editionSize, uint16 royaltyBPS, address fundsRecipient, address defaultAdmin, (uint104 publicSalePrice, uint32 maxSalePurchasePerAddress, uint64 publicSaleStart, uint64 publicSaleEnd, uint64 presaleStart, uint64 presaleEnd, bytes32 presaleMerkleRoot) saleConfig, string description, string animationURI, string imageURI) returns (address)',
    ),
  ).toBe(
    'createEdition(string,string,uint64,uint16,address,address,(uint104,uint32,uint64,uint64,uint64,uint64,bytes32),string,string,string)',
  )
})

test('trim spaces', () => {
  expect(
    normalizeSignature(
      'function  createEdition(string  name,string symbol,   uint64 editionSize  , uint16   royaltyBPS,     address     fundsRecipient,   address    defaultAdmin, ( uint104   publicSalePrice  ,   uint32 maxSalePurchasePerAddress, uint64 publicSaleStart,   uint64 publicSaleEnd, uint64 presaleStart, uint64 presaleEnd, bytes32 presaleMerkleRoot) saleConfig , string description, string animationURI, string imageURI ) returns (address)',
    ),
  ).toBe(
    'createEdition(string,string,uint64,uint16,address,address,(uint104,uint32,uint64,uint64,uint64,uint64,bytes32),string,string,string)',
  )
})

test('error: invalid signatures', () => {
  expect(() => normalizeSignature('bar')).toThrowError(
    expect.objectContaining({
      name: 'BaseError',
      message: `Unable to normalize signature.

Version: @tronweb3/tviem@${version}`,
    }),
  )

  expect(() => normalizeSignature('bar(uint foo')).toThrowError(
    expect.objectContaining({
      name: 'BaseError',
      message: `Unable to normalize signature.

Version: @tronweb3/tviem@${version}`,
    }),
  )

  expect(() => normalizeSignature('baruint foo)')).toThrowError(
    expect.objectContaining({
      name: 'BaseError',
      message: `Unable to normalize signature.

Version: @tronweb3/tviem@${version}`,
    }),
  )

  expect(() => normalizeSignature('bar(uint foo, (uint baz)')).toThrowError(
    expect.objectContaining({
      name: 'BaseError',
      message: `Unable to normalize signature.

Version: @tronweb3/tviem@${version}`,
    }),
  )
})
