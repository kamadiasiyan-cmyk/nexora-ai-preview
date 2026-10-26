'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {webDomain,browseWebResults}=require('../watchlist-utils');
const results=[
  {title:'Guide to Cameras',url:'https://www.camera.test/guides?utm_source=ad',snippet:'Compare mirrorless cameras',domain:'Untrusted provider label'},
  {title:'Duplicate camera guide',url:'https://www.camera.test/guides',snippet:'Duplicate'},
  {title:'Camera deals',url:'https://shop.test/deals',snippet:'Sale this week'},
  {title:'Laptop review',url:'https://www.reviews.test/laptop',snippet:'Fast processor'}
];
test('canonicalizes domains from safe URLs, never untrusted display labels',()=>{
  assert.equal(webDomain('https://www.camera.test/guides?utm_source=ad'),'camera.test');
  assert.equal(webDomain('http://camera.test/'),null);
  assert.equal(webDomain('https://user:pass@camera.test/'),null);
  assert.equal(browseWebResults(results)[0].domain,'camera.test');
});
test('deduplicates tracking variants while preserving original search relevance',()=>{
  const found=browseWebResults(results);
  assert.deepEqual(found.map(x=>x.title),['Guide to Cameras','Camera deals','Laptop review']);
  assert.equal(found[0].url,'https://www.camera.test/guides');
});
test('filters keywords across titles, snippets and canonical domains',()=>{
  assert.equal(browseWebResults(results,{query:'MIRRORLESS'}).length,1);
  assert.equal(browseWebResults(results,{query:'SALE'}).length,1);
  assert.equal(browseWebResults(results,{query:'reviews.test'}).length,1);
  assert.equal(browseWebResults(results,{query:'untrusted provider label'}).length,0);
});
test('filters domains exactly without accidentally including similar hosts',()=>{
  const data=results.concat([{title:'Impersonator',url:'https://camera.test.evil.test/p'}]);
  assert.deepEqual(browseWebResults(data,{domain:'camera.test'}).map(x=>x.title),['Guide to Cameras']);
  assert.equal(browseWebResults(data,{domain:'shop.test'}).length,1);
});
test('sorts by title or domain without mutating provider results',()=>{
  const original=JSON.stringify(results);
  assert.deepEqual(browseWebResults(results,{sort:'title'}).map(x=>x.title),['Camera deals','Guide to Cameras','Laptop review']);
  assert.deepEqual(browseWebResults(results,{sort:'domain'}).map(x=>x.domain),['camera.test','reviews.test','shop.test']);
  assert.equal(JSON.stringify(results),original);
});
test('rejects invalid URLs, blank titles and malformed rows',()=>{
  const bad=[null,42,{}, {title:'',url:'https://good.test'}, {title:'bad',url:'javascript:alert(1)'},{title:'bad',url:'https://name:secret@good.test/'},{title:'bad',url:'http://good.test'}];
  assert.equal(browseWebResults(bad).length,0);
  assert.equal(browseWebResults(results,{domain:'nonexistent.test'}).length,0);
});
test('web search toolbar is accessible, unique and uses local filtering without refetching',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  for(const id of ['webFilters','webFilterQuery','webDomainFilter','webSort','clearWebFilters']){
    assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' must be unique');
  }
  assert.match(html,/role="group" aria-label="Filter website results"/);
  assert.match(html,/W\.browseWebResults\(all,/);
  assert.match(html,/setWebDomains\(latestWebResults\)/);
  assert.match(html,/resetWebFilters\(\)/);
  assert.match(html,/document\.body\.classList\.toggle\('web-mode'/);
  assert.match(html,/addEventListener\('input',rerenderWeb\)/);
  assert.match(html,/No website results match these filters/);
});
