'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
test('homepage inline scripts parse as valid JavaScript', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, 'Expected a working inline search script');
  for (const [, source] of scripts) new vm.Script(source, { filename: 'index.html' });
});
test('search controls and accessible price comparison summary exist once', () => {
  for (const id of ['query','searchMode','resultGrid','stockOnly','maxPrice','priceRange','watchItems']) {
    assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' must appear exactly once');
  }
  assert.match(html, /id="priceRange"[^>]*aria-live="polite"/);
});
test('frontend retains browser-only watchlist and never embeds server credentials', () => {
  const utils = fs.readFileSync(path.join(__dirname, '..', 'watchlist-utils.js'), 'utf8');
  assert.match(utils,/watchtower-watchlist-v1/);
  assert.match(html,/watchtower-api-url-v1/);
  assert.doesNotMatch(html, /SEARCHAPI_KEY\s*=/);
});

test('watchlist controls, target editor and backup actions are present', () => {
  for(const id of ['exportWatch','importWatch','importWatchFile','watchStats']) {
    assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' must be unique');
  }
  assert.match(html, /<script src="watchlist-utils\.js"><\/script>/);
  assert.match(html, /data-target/);
  assert.match(html, /data-check/);
});
test('manual checks match exact saved product URLs and preserve unmatched prices', () => {
  assert.match(html, /W\.safeUrl\(x\.url\)===url/);
  assert.match(html, /No exact product URL match returned/);
  assert.match(html, /Manual checks only; no background monitoring/);
});
test('backup import has a file size limit and preserves existing items', () => {
  assert.match(html, /file\.size>2000000/);
  assert.match(html, /W\.mergeItems\(saved,data\.items\)/);
  assert.match(html, /W\.mergeHistory\(history,data\.history\)/);
});

test('browser rejects unsafe retailer URLs and clearly explains offline website search', () => {
  assert.match(html, /W\.safeUrl\(x\.url\)/);
  assert.match(html, /const key=W\.safeUrl\(x\.url\)/);
  assert.match(html, /Backend needed/);
  assert.match(html, /id="apiStatus"[^>]*aria-live="polite"/);
});

test('Pages publisher includes only static frontend files and runs tests first', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'publish-watchtower.yml'), 'utf8');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /cp index\.html watchlist-utils\.js _site\//);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.doesNotMatch(workflow, /cp.*shopping-api\/server\.js.*_site/);
});

test('homepage handles blocked browser storage without crashing at initialization',()=>{
  assert.match(html,/const storage=\(\(\)=>\{try\{return window\.localStorage\}catch/);
  assert.match(html,/W\.loadItems\(storage\),history=W\.loadHistory\(storage\)/);
  assert.doesNotMatch(html,/W\.loadItems\(localStorage\)/);
});
test('watchlist caps saves and displays historical min max and percentage changes',()=>{
  assert.match(html,/saved\.length>=500/);
  assert.match(html,/W\.historyStats\(rows\)/);
  assert.match(html,/Lowest observed:/);
  assert.match(html,/Highest observed:/);
  assert.match(html,/stats\.percentChange/);
});
test('visible comparison does not combine unrelated currencies',()=>{
  assert.match(html,/W\.priceRanges\(filtered\)/);
  assert.match(html,/Max price \(USD\)/);
  assert.match(html,/W\.price\(x\.price\)!==null/);
  assert.doesNotMatch(html,/Math\.min\(\.\.\.prices\)/);
});

test('manual-check activity inbox is accessible, explicitly local, and safe to clear',()=>{
 for(const id of ['alerts','alertCount','alertItems','clearAlerts']){
   assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' must be unique');
 }
 assert.match(html,/no background alerts or push notifications/);
 assert.match(html,/W\.loadAlerts\(storage\)/);
 assert.match(html,/W\.recordAlerts\(alerts,item,event,amount\)/);
 assert.match(html,/alerts=\[\];persistAlerts\(\);renderAlerts\(\)/);
 assert.match(html,/history,alerts\},null,2/);
 assert.match(html,/W\.mergeAlerts\(alerts,data\.alerts\)/);
});
test('manual check deduplicates in-flight requests and ignores removed items',()=>{
 assert.match(html,/pendingChecks\.has\(checkedKey\)/);
 assert.match(html,/pendingChecks\.add\(checkedKey\)/);
 assert.match(html,/saved\.includes\(item\)/);
 assert.match(html,/finally\{pendingChecks\.delete\(checkedKey\)\}/);
});

test('watchlist browsing controls are unique, labelled and keep stable saved indices',()=>{
 for(const id of ['watchFilterQuery','watchFilterStatus','watchSort','resetWatchFilters','watchShown']){
   assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id+' must be unique');
 }
 assert.match(html,/W\.browseItems\(saved,\$\('watchFilterQuery'\)\.value,\$\('watchFilterStatus'\)\.value,\$\('watchSort'\)\.value\)/);
 assert.match(html,/visible\.map\(\(\{item:x,index:i\}\)=>/);
 assert.match(html,/data-remove="'+i+'/);
 assert.match(html,/No saved items match these filters/);
 assert.match(html,/id="watchShown"[^>]*aria-live="polite"/);
});
