'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const w=require('../watchlist-utils');
const storage=(items={},broken=false)=>({getItem:k=>broken?'broken json':items[k]??null});
test('retains the existing browser storage key',()=>assert.equal(w.WATCH_KEY,'watchtower-watchlist-v1'));
test('loads valid existing products without altering custom fields',()=>{
 const saved=[{title:'Laptop',url:'https://shop.example/p',price:100,custom:'keep'},{title:''},{title:'Bad',url:'javascript:alert(1)'}];
 const out=w.loadItems(storage({[w.WATCH_KEY]:JSON.stringify(saved)}));assert.equal(out.length,2);assert.equal(out[0].custom,'keep');assert.equal(out[1].title,'Bad');assert.equal(out[1].url,undefined);
});
test('corrupt browser storage is handled safely',()=>{assert.deepEqual(w.loadItems(storage({},true)),[]);assert.equal(Object.keys(w.loadHistory(storage({},true))).length,0)});
test('rejects unsafe links and embedded credentials',()=>{assert.equal(w.safeUrl('javascript:alert(1)'),null);assert.equal(w.safeUrl('https://user:pass@shop.example/p'),null);assert.ok(w.safeUrl('https://shop.example/p'))});
test('rejects malformed, boolean and negative target prices',()=>{for(const x of [false,'-1','1e5','1,200','Infinity',null])assert.equal(w.price(x),null);assert.equal(w.price('12.50'),12.5)});
test('merge import preserves existing entries and ignores duplicates',()=>{
 const old=[{title:'Existing',url:'https://shop.example/p',targetPrice:10,custom:'keep'}];
 const out=w.mergeItems(old,[{title:'Changed',url:'https://shop.example/p',targetPrice:2},{title:'New search',mode:'web'}]);
 assert.equal(out.length,2);assert.equal(out[0].targetPrice,10);assert.equal(out[0].custom,'keep');
});
test('observations record price drops, target crossings and confirmed restocks',()=>{
 const h=Object.create(null),item={title:'Item',url:'https://shop.example/p',targetPrice:50};
 w.observe(h,item,75,false,100);const event=w.observe(h,item,40,true,200);
 assert.deepEqual([event.dropped,event.reached,event.restocked],[true,true,true]);assert.equal(h[w.keyFor(item)].length,2);
});
test('unknown stock never triggers a false restock',()=>{
 const h=Object.create(null),item={title:'Item'};w.observe(h,item,10,null,100);
 assert.equal(w.observe(h,item,9,true,200).restocked,false);
 assert.equal(w.observe(h,item,9,true,300).restocked,false);
});
test('identical observations do not bloat history',()=>{
 const h=Object.create(null),item={title:'Item'};w.observe(h,item,10,true,100);w.observe(h,item,10,true,200);
 assert.equal(h[w.keyFor(item)].length,1);
});
test('history is capped and ignores malformed imported rows',()=>{
 const item={title:'Item'},key=w.keyFor(item),h=Object.create(null);
 for(let i=1;i<=100;i++)w.observe(h,item,i,true,i);
 assert.equal(h[key].length,60);
 const restored=w.loadHistory(storage({[w.HISTORY_KEY]:JSON.stringify({[key]:[{at:1,price:false,stock:true},{at:2,price:4,stock:null}]})}));
 assert.equal(restored[key].length,1);
});
test('import merges history without erasing earlier observations',()=>{
 const k=w.keyFor({title:'A'}),out=w.mergeHistory({[k]:[{at:1,price:10,stock:false}]},{[k]:[{at:2,price:9,stock:true}]});
 assert.equal(out[k].length,2);assert.equal(out[k][0].at,1);
});
test('rejects invalid observation amounts',()=>{
 assert.throws(()=>w.observe({}, {title:'A'},NaN,null),/Invalid observation/);
 assert.throws(()=>w.observe({}, {title:'A'},-1,null),/Invalid observation/);
});
test('tracking parameters do not break exact product matching',()=>{
 const a=w.safeUrl('https://shop.example/p?sku=7&utm_source=ads&gclid=123#details');
 const b=w.safeUrl('https://shop.example/p?sku=7');
 assert.equal(a,b);
 assert.equal(w.keyFor({title:'A',url:a}),w.keyFor({title:'B',url:b}));
});
