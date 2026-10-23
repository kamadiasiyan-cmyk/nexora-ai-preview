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
  assert.match(html,/watchtower-watchlist-v1/);
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
