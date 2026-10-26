'use strict';
// This test file runs in its own Node test worker to isolate budget configuration.
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
process.env.SEARCHAPI_KEY='test-placeholder-not-real';
process.env.ALLOWED_ORIGIN='https://example.test';
process.env.MAX_DAILY_PROVIDER_REQUESTS='1';
const {server}=require('./server');
let port;
const request=path=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port,path,headers:{origin:'https://example.test'}},res=>{
  let body='';res.on('data',chunk=>body+=chunk);
  res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(body)}));
 });req.on('error',reject);req.end();
});
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port});
test.after(async()=>{await new Promise(resolve=>server.close(resolve))});
test('daily budget charges only new upstream searches; cache and health remain available',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return {ok:true,json:async()=>({shopping_results:[]})}};
 try{
  const first=await request('/api/search?q=budget-integration-one');
  assert.equal(first.status,200);
  assert.equal(first.body.cached,false);
  const cached=await request('/api/search?q=budget-integration-one');
  assert.equal(cached.status,200);
  assert.equal(cached.body.cached,true);
  const limited=await request('/api/search?q=budget-integration-two');
  assert.equal(limited.status,429);
  assert.match(limited.body.error,/budget reached/i);
  assert.ok(Number(limited.headers['retry-after'])>0);
  assert.equal(calls,1);
  const health=await request('/health');
  assert.equal(health.status,200);
 }finally{global.fetch=original}
});
