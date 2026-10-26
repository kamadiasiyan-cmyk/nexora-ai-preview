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

test('history stats use chronological observations and calculate real percentage drops',()=>{
 const stats=w.historyStats([{at:30,price:80},{at:10,price:100},{at:20,price:70}]);
 assert.deepEqual(stats,{count:3,first:100,last:80,lowest:70,highest:100,change:-20,percentChange:-20});
 assert.equal(w.historyStats([]),null);
 assert.equal(w.historyStats([{at:1,price:0},{at:2,price:5}]).percentChange,null);
});
test('price ranges keep different currencies separate and ignore invalid prices',()=>{
 const ranges=w.priceRanges([{price:30,currency:'USD'},{price:10,currency:'USD'},{price:40,currency:'EUR'},{price:null,currency:'USD'},{price:-4,currency:'USD'}]);
 assert.deepEqual(ranges,[{currency:'EUR',min:40,max:40,count:1},{currency:'USD',min:10,max:30,count:2}]);
});
test('price range inputs cannot turn empty or malformed prices into zero',()=>{
 assert.deepEqual(w.priceRanges([{price:'',currency:'USD'},{price:'abc'},{price:false},{price:0,currency:'USD'}]),[{currency:'USD',min:0,max:0,count:1}]);
});

test('currency checks protect watchlist price history from cross-currency updates',()=>{
 const usd={title:'Laptop',currency:'USD'},eur={title:'Laptop',currency:'EUR'};
 assert.equal(w.matchingCurrency(usd,{currency:'EUR'}),false);
 assert.equal(w.matchingCurrency(eur,{currency:'EUR'}),true);
 assert.equal(w.matchingCurrency({title:'Legacy'},{currency:'USD'}),true);
 assert.equal(w.matchingCurrency({title:'Legacy'},{currency:'GBP'}),false);
 assert.equal(w.matchingCurrency({currency:'XYZ'},{currency:'XYZ'}),false);
 assert.equal(w.currencyOf({currency:'eur'}),'EUR');
});
test('invalid currency offers cannot silently appear in USD price ranges',()=>{
 assert.deepEqual(w.priceRanges([{price:10,currency:'XYZ'},{price:25,currency:'USD'},{price:30,currency:'eur'}]),[
  {currency:'EUR',min:30,max:30,count:1},{currency:'USD',min:25,max:25,count:1}
 ]);
});

test('manual price checks produce a bounded browser-local activity inbox',()=>{
 const item={title:'Headphones',url:'https://shop.example/headphones',currency:'USD'};
 const events={dropped:true,reached:true,restocked:true};
 const first=w.recordAlerts([],item,events,49,1000);
 assert.deepEqual(first.map(x=>x.type),['price_drop','target_reached','restock']);
 assert.equal(first[0].price,49);
 assert.equal(w.recordAlerts(first,item,events,49,1000).length,3,'repeat event must not duplicate');
 assert.equal(w.recordAlerts(first,item,{},49,2000).length,3,'unchanged prices should not alert');
 let many=first;
 for(let i=1;i<=150;i++)many=w.recordAlerts(many,item,{dropped:true},40,i+1000);
 assert.equal(many.length,100);
 assert.ok(many[0].at>many[99].at);
});
test('local activity restores safely and invalid imported alerts are discarded',()=>{
 const item={title:'Laptop',currency:'EUR'};
 const good=w.recordAlerts([],item,{reached:true},200,100);
 const invalid=[{...good[0],title:'<img onerror=alert(1)>',price:-1},{...good[0],type:'arbitrary'}];
 const merged=w.mergeAlerts(good,[...invalid,...good]);
 assert.equal(merged.length,1);
 const restored=w.loadAlerts(storage({[w.ALERTS_KEY]:JSON.stringify([...good,...invalid])}));
 assert.deepEqual(restored,good);
 assert.deepEqual(w.loadAlerts(storage({},true)),[]);
});
test('manual activity rejects unsupported currencies and malformed events',()=>{
 const item={title:'Laptop',currency:'XYZ'};
 assert.deepEqual(w.recordAlerts([],item,{dropped:true},20,100),[]);
 assert.deepEqual(w.recordAlerts([], {title:'Laptop',currency:'USD'}, {dropped:true},NaN,100),[]);
 assert.deepEqual(w.recordAlerts([], {title:'Laptop',currency:'USD'}, {dropped:true},20,-1),[]);
});

test('watchlist browsing searches titles, stores and saved queries without changing saved order',()=>{
 const items=[{title:'Camera',merchant:'PhotoMart',price:100,url:'https://store.example/camera'},{title:'Running shoes',mode:'web',query:'sneaker reviews'},{title:'Headphones',merchant:'Audio Store',price:60,url:'https://store.example/headphones'}];
 const snapshot=JSON.stringify(items);
 assert.deepEqual(w.browseItems(items,'photomart').map(x=>x.index),[0]);
 assert.deepEqual(w.browseItems(items,'SNEAKER').map(x=>x.index),[1]);
 assert.deepEqual(w.browseItems(items,'store').map(x=>x.index),[2]);
 assert.deepEqual(w.browseItems(items,'').map(x=>x.index),[0,1,2]);
 assert.equal(JSON.stringify(items),snapshot);
});
test('watchlist status filters distinguish products, searches, targets, restocks and unchecked',()=>{
 const items=[
  {title:'Camera',url:'https://store.example/camera',price:80,targetPrice:90,inStock:false,lastChecked:'2026-10-24'},
  {title:'Web query',mode:'web'},
  {title:'Headphones',url:'https://store.example/headphones',price:110,targetPrice:90,inStock:true}
 ];
 for(const [status,expected] of [['products',[0,2]],['searches',[1]],['target',[0,2]],['reached',[0]],['out_of_stock',[0]],['unchecked',[1,2]]]){
  assert.deepEqual(w.browseItems(items,'',status).map(x=>x.index),expected,status);
 }
});
test('watchlist sorting groups currencies, keeps unpriced last and preserves action indices',()=>{
 const items=[
  {title:'Zebra',price:50,currency:'USD'},
  {title:'Apple',price:5,currency:'EUR'},
  {title:'Banana',price:10,currency:'USD'},
  {title:'No price',price:null},
  {title:'Apricot',price:10,currency:'USD'}
 ];
 assert.deepEqual(w.browseItems(items,'','all','name').map(x=>x.index),[1,4,2,3,0]);
 assert.deepEqual(w.browseItems(items,'','all','price-low').map(x=>x.index),[1,2,4,0,3]);
 assert.deepEqual(w.browseItems(items,'','all','price-high').map(x=>x.index),[1,0,2,4,3]);
 assert.deepEqual(w.browseItems(items,'','all','recent').map(x=>x.index),[0,1,2,3,4]);
});


test('sparklines show real observations in chronological order without mutating history',()=>{
 const rows=[{at:30,price:10},{at:10,price:10},{at:20,price:20}];
 const before=JSON.stringify(rows);
 assert.equal(w.sparklinePoints(rows),'5,39 80,5 155,39');
 assert.equal(JSON.stringify(rows),before);
});
test('sparklines reject insufficient or invalid history and safely render flat prices',()=>{
 assert.equal(w.sparklinePoints([]),null);
 assert.equal(w.sparklinePoints([{at:1,price:10}]),null);
 assert.equal(w.sparklinePoints([{at:1,price:NaN},{at:2,price:10}]),null);
 assert.equal(w.sparklinePoints([{at:5,price:8},{at:5,price:8}]),'5,22 155,22');
 assert.equal(w.sparklinePoints([{at:1,price:0},{at:2,price:100}],40,20),'5,15 35,5');
});


test('CSV escaping neutralizes spreadsheet formulas and preserves commas and quotes',()=>{
 assert.equal(w.csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
 assert.equal(w.csvCell(' \t+SUM(1,2)'),'"\' \t+SUM(1,2)"');
 assert.equal(w.csvCell('@cmd'),'"\'@cmd"');
 assert.equal(w.csvCell('Shop, "West"'),'"Shop, ""West"""');
 assert.equal(w.csvCell(0),'"0"');
});
test('history CSV contains only actual valid observations with UTC dates and stock labels',()=>{
 const item={title:'=Discount',merchant:'Camera, Inc',url:'https://store.example/p?utm_source=ad&sku=2',currency:'USD'};
 const key=w.keyFor(item),rows=[{at:1000,price:25,stock:false},{at:2000,price:20,stock:true},{at:3000,price:NaN,stock:true},{at:4000,price:10,stock:'unknown'}];
 const csv=w.historyCsv([item],{[key]:rows});
 assert.match(csv,/Observed at \(UTC\)/);
 assert.match(csv,/"'=?Discount"/);
 assert.match(csv,/1970-01-01T00:00:01\.000Z/);
 assert.match(csv,/"Out of stock"/);
 assert.match(csv,/"In stock"/);
 assert.match(csv,/https:\/\/store\.example\/p\?sku=2/);
 assert.doesNotMatch(csv,/utm_source/);
 assert.equal(csv.trimEnd().split('\r\n').length,3);
});
test('activity CSV excludes malformed entries and exports only normalized local events',()=>{
 const item={title:'Headphones',currency:'EUR'};
 const good=w.recordAlerts([],item,{dropped:true,restocked:true},49,1000);
 const csv=w.alertsCsv([...good,{...good[0],price:-3}]);
 assert.match(csv,/price_drop/);
 assert.match(csv,/restock/);
 assert.match(csv,/EUR/);
 assert.equal(csv.trimEnd().split('\r\n').length,3);
 assert.equal(w.alertsCsv([]).trimEnd().split('\r\n').length,1);
});
test('activity filters search product names and event labels without changing stored events',()=>{
 const events=[
  ...w.recordAlerts([],{title:'Laptop'},{dropped:true,restocked:true},100,2000),
  ...w.recordAlerts([],{title:'Shoes'},{reached:true},50,1000)
 ];
 const before=JSON.stringify(events);
 assert.equal(w.browseAlerts(events,'lap').length,2);
 assert.deepEqual(w.browseAlerts(events,'','restock').map(x=>x.title),['Laptop']);
 assert.deepEqual(w.browseAlerts(events,'target reached').map(x=>x.title),['Shoes']);
 assert.equal(w.browseAlerts(events,'missing').length,0);
 assert.equal(JSON.stringify(events),before);
});

test('manual review freshness uses verified checks and seven-day boundary',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const product=lastChecked=>({title:'Camera',url:'https://shop.example/camera',lastChecked});
 assert.equal(w.checkFreshness(product(undefined),now),'never');
 assert.equal(w.checkFreshness(product('bad-date'),now),'never');
 assert.equal(w.checkFreshness(product('2026-10-27T12:00:00Z'),now),'never');
 assert.equal(w.checkFreshness(product('2026-10-19T12:00:00Z'),now),'stale');
 assert.equal(w.checkFreshness(product('2026-10-19T12:00:01Z'),now),'recent');
 assert.equal(w.checkFreshness({title:'Saved search',mode:'web'},now),'not_applicable');
});
test('manual review summary excludes saved searches and does not mutate items',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const items=[{title:'A',url:'https://shop.example/a'},{title:'B',url:'https://shop.example/b',lastChecked:'2026-10-10T00:00:00Z'},{title:'C',url:'https://shop.example/c',lastChecked:'2026-10-25T00:00:00Z'},{title:'Search',mode:'web'}];
 const before=JSON.stringify(items);
 assert.deepEqual(w.reviewSummary(items,now),{products:3,never:1,stale:1,recent:1,due:2});
 assert.equal(JSON.stringify(items),before);
});
test('due filter includes never checked and stale products but not saved searches',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const items=[{title:'Fresh',url:'https://shop.example/f',lastChecked:'2026-10-25T00:00:00Z'},{title:'Search',mode:'products'},{title:'Never',url:'https://shop.example/n'},{title:'Old',url:'https://shop.example/o',lastChecked:'2026-10-01T00:00:00Z'}];
 assert.deepEqual(w.browseItems(items,'','due','recent',now).map(x=>x.index),[2,3]);
 assert.deepEqual(w.browseItems(items,'Old','due','recent',now).map(x=>x.index),[3]);
});
test('manual review sorting prioritizes unverified and oldest checks with stable indices',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const items=[{title:'Fresh',url:'https://shop.example/f',lastChecked:'2026-10-25T00:00:00Z'},{title:'Old',url:'https://shop.example/o',lastChecked:'2026-10-01T00:00:00Z'},{title:'Search',mode:'web'},{title:'Never',url:'https://shop.example/n'},{title:'Older',url:'https://shop.example/p',lastChecked:'2026-09-01T00:00:00Z'}];
 assert.deepEqual(w.browseItems(items,'','all','check-oldest',now).map(x=>x.index),[3,4,1,0,2]);
});
test('manual review handles malformed records and invalid clocks safely',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 assert.deepEqual(w.reviewSummary(null,now),{products:0,never:0,stale:0,recent:0,due:0});
 assert.equal(w.checkFreshness({title:'Bad URL',url:'javascript:alert(1)'},now),'not_applicable');
 assert.equal(w.checkFreshness({title:'Camera',url:'https://shop.example/c',lastChecked:'2026-10-25T00:00:00Z'},NaN),'never');
});
