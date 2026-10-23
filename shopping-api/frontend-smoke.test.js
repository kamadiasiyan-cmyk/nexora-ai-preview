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
