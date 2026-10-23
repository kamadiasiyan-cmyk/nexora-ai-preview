'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeOffers } = require('./comparison-utils');
test('summarizes an empty search without inventing prices', () => {
  assert.deepEqual(summarizeOffers([]), {offerCount:0,merchantCount:0,lowestPrice:null,highestPrice:null,medianPrice:null,lowestConfirmedInStockPrice:null,confirmedInStockCount:0,confirmedOutOfStockCount:0,unknownStockCount:0,currency:'USD',caveat:'Results may differ in product model, condition, shipping, or seller. Verify at retailer.'});
});
test('summarizes mixed stock states and median without treating unknown as available', () => {
  const r = summarizeOffers([{price:90,merchant:'Shop',inStock:null},{price:30,merchant:'SHOP',inStock:false},{price:50,merchant:'Other',inStock:true},{price:10,merchant:'Third',inStock:true}]);
  assert.equal(r.offerCount,4);assert.equal(r.merchantCount,3);assert.equal(r.lowestPrice,10);assert.equal(r.highestPrice,90);assert.equal(r.medianPrice,40);assert.equal(r.lowestConfirmedInStockPrice,10);assert.equal(r.confirmedInStockCount,2);assert.equal(r.confirmedOutOfStockCount,1);assert.equal(r.unknownStockCount,1);
});
test('excludes malformed prices and does not mutate provider results', () => {
  const offers=[{price:null},{price:'12'},{price:Infinity},{price:-1},{price:12.345,merchant:'Shop',inStock:'true'}];
  const before=JSON.stringify(offers);const r=summarizeOffers(offers);
  assert.equal(r.offerCount,1);assert.equal(r.medianPrice,12.35);assert.equal(r.unknownStockCount,1);assert.equal(JSON.stringify(offers),before);
});
test('computes odd median and cheapest confirmed in-stock offer', () => {
  const r=summarizeOffers([{price:12,merchant:'A',inStock:false},{price:9,merchant:'B',inStock:null},{price:18,merchant:'C',inStock:true}]);
  assert.equal(r.medianPrice,12);assert.equal(r.lowestConfirmedInStockPrice,18);
});
