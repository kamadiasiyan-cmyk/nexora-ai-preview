'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
process.env.SEARCHAPI_KEY='test-placeholder-not-real';
process.env.ALLOWED_ORIGIN='https://example.test';
const {server}=require('./server');
let port;const origin='https://example.test';
const request=(path,method='GET',headers={origin})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path,method,headers},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:body?JSON.parse(body):null}))});req.on('error',reject);req.end()});
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port});
test.after(async()=>{await new Promise(resolve=>server.close(resolve))});
test('health exposes readiness without credentials',async()=>{const r=await request('/health');assert.equal(r.status,200);assert.equal(r.body.configured,true);assert.doesNotMatch(JSON.stringify(r.body),/test-placeholder/);const noOrigin=await request('/health','GET',{});assert.equal(noOrigin.status,200);assert.equal(noOrigin.headers['access-control-allow-origin'],undefined)});
test('rejects unauthorized origins including preflights',async()=>{assert.equal((await request('/api/search?q=shoes','GET',{origin:'https://evil.test'})).status,403);assert.equal((await request('/api/search?q=shoes','OPTIONS',{origin:'https://evil.test'})).status,403);
 const missing=await request('/api/search?q=shoes','GET',{});
 assert.equal(missing.status,403);assert.equal(missing.headers['access-control-allow-origin'],undefined);
 const preflight=await request('/api/search?q=shoes','OPTIONS',{});
 assert.equal(preflight.status,403);
 process.env.ALLOW_NO_ORIGIN='1';
 try{assert.equal((await request('/api/search?q=x','GET',{})).status,400)}
 finally{delete process.env.ALLOW_NO_ORIGIN}
});
test('validates query, method and mode',async()=>{assert.equal((await request('/api/search?q=x')).status,400);assert.equal((await request('/api/search?q='+('x'.repeat(141)))).status,400);assert.equal((await request('/api/search?q=shoes','POST')).status,404);assert.equal((await request('/api/search?q=shoes&mode=bad')).status,400)});
test('normalizes and caches shopping results',async()=>{const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({shopping_results:[{title:'Shoe',price:'$1,299.99',link:'https://shop.test/p',in_stock:true},{title:'Shoe',price:1299.99,link:'https://shop.test/p?utm_source=ad'}]})}};try{const q='/api/search?q=unique-shoe-test';const a=await request('/api/search?q=unique-shoe-%20%20test'),b=await request('/api/search?q=unique-shoe-%20test');assert.equal(a.status,200);assert.equal(a.body.offers.length,1);assert.equal(a.body.offers[0].inStock,true);assert.equal(b.body.cached,true);assert.deepEqual(a.body.comparison,b.body.comparison);assert.equal(a.body.comparison.offerCount,1);assert.equal(a.body.comparison.medianPrice,1299.99);assert.equal(a.body.comparison.confirmedInStockCount,1);assert.equal(calls,1);assert.equal(a.body.query,'unique-shoe- test');assert.equal(b.body.query,'unique-shoe- test')}finally{global.fetch=original}});
test('coalesces parallel requests',async()=>{const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return {ok:true,json:async()=>({organic_results:[{title:'Example',link:'https://site.test/p'}]})}};try{const [a,b]=await Promise.all([request('/api/search?q=parallel-web-test&mode=web'),request('/api/search?q=parallel-web-test&mode=web')]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.comparison,null);assert.equal(b.body.comparison,null);assert.equal(calls,1)}finally{global.fetch=original}});
test('never leaks upstream errors',async()=>{const original=global.fetch;global.fetch=async()=>{throw Error('secret-test-placeholder')};try{const r=await request('/api/search?q=provider-failure-test&mode=web');assert.equal(r.status,502);assert.doesNotMatch(JSON.stringify(r.body),/secret-test-placeholder/)}finally{global.fetch=original}});
test('limits concurrent upstream searches',async()=>{const original=global.fetch;let release;const gate=new Promise(r=>release=r);global.fetch=async()=>{await gate;return {ok:true,json:async()=>({shopping_results:[]})}};try{const jobs=Array.from({length:8},(_,i)=>request('/api/search?q=load-test-'+i));await new Promise(r=>setTimeout(r,30));const busy=await request('/api/search?q=load-test-overflow');assert.equal(busy.status,503);release();assert.equal((await Promise.all(jobs)).filter(x=>x.status===200).length,8)}finally{release();global.fetch=original}});

test('search API keeps mixed currencies separate without disclosing upstream data',async()=>{
 const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({shopping_results:[
  {title:'Headphones',price:'€79.99',link:'https://eu.test/p',source:'Europe'},
  {title:'Headphones',price:'$89.99',link:'https://us.test/p',source:'US'}
 ]})});
 try{
  const r=await request('/api/search?q=mixed-currency-test');
  assert.equal(r.status,200);assert.deepEqual(r.body.offers.map(o=>o.currency),['EUR','USD']);
  assert.equal(r.body.comparison.currency,null);
  assert.equal(r.body.comparison.lowestPrice,null);
  assert.equal(r.body.comparison.byCurrency.EUR.lowestPrice,79.99);
  assert.equal(r.body.comparison.byCurrency.USD.lowestPrice,89.99);
 }finally{global.fetch=original}
});
