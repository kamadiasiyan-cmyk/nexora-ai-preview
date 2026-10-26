'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {browseOffers}=require('../watchlist-utils');
const offers=[
  {title:'Running shoes',merchant:'North Store',price:80,currency:'USD',url:'https://north.test/shoes',inStock:true},
  {title:'Trail shoes',merchant:'South Store',price:60,currency:'USD',url:'https://south.test/shoes',inStock:false},
  {title:'Running shoes EU',merchant:'North Store',price:50,currency:'EUR',url:'https://north.test/eu',inStock:null},
  {title:'Running shoes sale',merchant:'North Store',price:120,currency:'USD',url:'https://north.test/sale',inStock:true}
];
test('merchant selection matches exact retailer names case-insensitively',()=>{
  const found=browseOffers(offers,{merchant:'north store'});
  assert.equal(found.length,3);
  assert.ok(found.every(x=>x.merchant==='North Store'));
  assert.equal(browseOffers(offers,{merchant:'north'}).length,0);
});
test('keyword search filters titles and merchant names together with retailer selection',()=>{
  assert.equal(browseOffers(offers,{query:'trail'}).length,1);
  assert.equal(browseOffers(offers,{query:'north store',merchant:'South Store'}).length,0);
  assert.equal(browseOffers(offers,{query:'RUNNING',merchant:'North Store'}).length,3);
});
test('USD maximum-price filtering never compares euro prices as dollars',()=>{
  const found=browseOffers(offers,{maxPrice:'90'});
  assert.deepEqual(found.map(x=>x.price),[60,80]);
  assert.equal(browseOffers(offers,{maxPrice:'-1'}).length,0);
  assert.equal(browseOffers(offers,{maxPrice:'not-a-number'}).length,0);
});
test('in-stock-only filter excludes unknown and confirmed out-of-stock offers',()=>{
  assert.deepEqual(browseOffers(offers,{stockOnly:true}).map(x=>x.price),[80,120]);
});
test('price sorts group currencies and do not mutate provider data',()=>{
  const original=offers.map(x=>x.title);
  assert.deepEqual(browseOffers(offers).map(x=>x.price),[50,60,80,120]);
  assert.deepEqual(browseOffers(offers,{sort:'high'}).map(x=>x.price),[50,120,80,60]);
  assert.deepEqual(offers.map(x=>x.title),original);
});
test('rejects unsafe URLs, invalid prices and unsupported currencies',()=>{
  const invalid=[
    {...offers[0],url:'javascript:alert(1)'},
    {...offers[0],price:-1},
    {...offers[0],currency:'XYZ'}
  ];
  assert.equal(browseOffers(invalid).length,0);
});
test('homepage wires new retailer and keyword filters to real offer rendering',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  for(const id of ['merchantFilter','offerFilterQuery','clearOfferFilters']){
    assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' should be unique');
  }
  assert.match(html,/W\.browseOffers\(dedup,/);
  assert.match(html,/setMerchantOptions\(data\.offers\)/);
  assert.match(html,/resetOfferFilters\(\)/);
  assert.match(html,/aria-label="Filter offers by retailer"/);
});
