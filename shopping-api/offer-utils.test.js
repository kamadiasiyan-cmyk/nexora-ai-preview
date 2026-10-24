'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanUrl,parsePrice,stockState,normalizeOffer,normalizeOffers,normalizeWebResults}=require('./offer-utils');
test('parses valid USD prices',()=>{for(const [x,v] of [['$1,299.99',1299.99],['USD 2,500',2500],['US$ 15.50',15.5],[19.99,19.99],[0,0]])assert.equal(parsePrice(x),v)});
test('rejects ambiguous or invalid prices',()=>{for(const x of ['$1.2.3','$12.999','from $19','$10-$20','1,2,3','',null,false,Infinity,-1,'1e5'])assert.equal(parsePrice(x),null)});
test('rejects unsafe URLs and embedded credentials',()=>{for(const x of ['javascript:alert(1)','http://shop.test/p','https://u:p@shop.test/p','//shop.test/p','https://'])assert.equal(cleanUrl(x),null)});
test('removes tracking but keeps product identifiers',()=>assert.equal(cleanUrl('https://shop.test/p?sku=123&utm_source=ad&fbclid=abc#reviews'),'https://shop.test/p?sku=123'));
test('distinguishes confirmed stock from unknown',()=>{assert.equal(stockState({availability:'Sold Out'}),false);assert.equal(stockState({in_stock:true}),true);assert.equal(stockState({delivery:'Ships tomorrow'}),null)});
test('rejects incomplete offers',()=>{assert.equal(normalizeOffer({title:'Phone',link:'https://shop.test/p'}),null);assert.equal(normalizeOffer({title:'Phone',price:'$12.99',link:'https://shop.test/p'}).price,12.99)});
test('deduplicates tracking variants but preserves distinct products',()=>{const x={title:'Phone',price:100,link:'https://shop.test/p?sku=1'};assert.equal(normalizeOffers([x,{...x,link:x.link+'&utm_source=email'}]).length,1);assert.equal(normalizeOffers([x,{...x,link:'https://shop.test/p?sku=2'}]).length,2)});
test('validates website results',()=>{const x={title:'Article',link:'https://site.test/page'};assert.equal(normalizeWebResults([x,{...x,link:x.link+'?utm_source=a'},{title:'Bad',link:'javascript:bad()'}]).length,1)});
test('caps search result sizes',()=>{assert.equal(normalizeOffers(Array.from({length:60},(_,i)=>({title:'Item',price:i,link:'https://store.test/'+i}))).length,40);assert.equal(normalizeWebResults(Array.from({length:50},(_,i)=>({title:'Site',link:'https://site.test/'+i}))).length,30)});

test('retains explicit and symbol-based currencies instead of silently assigning USD',()=>{
  const base={title:'Camera',link:'https://store.test/camera'};
  assert.deepEqual(['EUR','GBP','CAD','JPY'].map((currency,i)=>normalizeOffer({...base,currency,extracted_price:100+i,price:['€100','£101','C$102','¥103'][i]})?.currency),['EUR','GBP','CAD','JPY']);
  assert.equal(normalizeOffer({...base,price:'€1,299.99'})?.price,1299.99);
  assert.equal(normalizeOffer({...base,price:'€1,299.99'})?.currency,'EUR');
  assert.equal(normalizeOffer({...base,price:'GBP 1,299.99'})?.currency,'GBP');
});
test('rejects contradictory and unrecognized retailer currencies',()=>{
  const base={title:'Camera',link:'https://store.test/camera',extracted_price:100};
  assert.equal(normalizeOffer({...base,currency:'USD',price:'€100'}),null);
  assert.equal(normalizeOffer({...base,currency:'XYZ',price:'$100'}),null);
  assert.equal(normalizeOffer({...base,extracted_price:undefined,price:'€1.234,50'}),null);
});
