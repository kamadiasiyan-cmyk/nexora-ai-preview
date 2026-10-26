'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DEFAULT_DAILY_LIMIT,parseDailyLimit,createDailyBudget}=require('./usage-budget');
test('daily upstream budget defaults to a finite nonzero limit',()=>{
 assert.equal(DEFAULT_DAILY_LIMIT,200);assert.equal(parseDailyLimit(undefined),200);
 assert.equal(parseDailyLimit(''),200);assert.equal(parseDailyLimit('42'),42);
});
test('invalid or excessive budget configuration cannot disable the guard',()=>{
 for(const v of ['-1','Infinity','1e8','100000','2.5','not-a-number'])assert.equal(parseDailyLimit(v),200);
 assert.equal(parseDailyLimit('0'),0);
});
test('budget counts only granted upstream requests and denies further attempts',()=>{
 const now=Date.parse('2026-10-26T10:00:00Z'),b=createDailyBudget(2,()=>now);
 assert.equal(b.snapshot().remaining,2);assert.equal(b.take(),true);assert.equal(b.take(),true);
 assert.equal(b.take(),false);assert.equal(b.snapshot().used,2);assert.equal(b.snapshot().remaining,0);
 assert.equal(b.snapshot().retryAfterSeconds,14*3600);
});
test('budget rolls over at UTC midnight',()=>{
 let now=Date.parse('2026-10-26T23:59:59Z');const b=createDailyBudget('1',()=>now);
 assert.equal(b.take(),true);assert.equal(b.take(),false);assert.equal(b.snapshot().retryAfterSeconds,1);
 now+=1000;assert.equal(b.snapshot().used,0);assert.equal(b.take(),true);
});
test('zero upstream budget deliberately disables new provider calls',()=>{
 const b=createDailyBudget('0',()=>Date.parse('2026-10-26T12:00:00Z'));
 assert.equal(b.take(),false);assert.equal(b.snapshot().remaining,0);
});
