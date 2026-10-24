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

test('keeps single-currency comparison values in their actual currency',()=>{
  const r=summarizeOffers([{price:15,currency:'EUR',merchant:'A',inStock:true},{price:25,currency:'EUR',merchant:'B',inStock:false}]);
  assert.equal(r.currency,'EUR');assert.equal(r.lowestPrice,15);assert.equal(r.medianPrice,20);
});
test('does not compare euros to dollars or invent foreign exchange rates',()=>{
  const r=summarizeOffers([{price:100,currency:'USD',merchant:'A',inStock:true},{price:80,currency:'EUR',merchant:'B',inStock:false},{price:90,currency:'USD',merchant:'C',inStock:null}]);
  assert.equal(r.currency,null);assert.equal(r.lowestPrice,null);assert.equal(r.highestPrice,null);
  assert.equal(r.medianPrice,null);assert.equal(r.lowestConfirmedInStockPrice,null);
  assert.equal(r.offerCount,3);assert.equal(r.confirmedInStockCount,1);
  assert.equal(r.byCurrency.USD.lowestPrice,90);assert.equal(r.byCurrency.USD.medianPrice,95);
  assert.equal(r.byCurrency.EUR.lowestPrice,80);assert.equal(r.byCurrency.EUR.currency,'EUR');
});
