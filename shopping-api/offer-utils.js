'use strict';
// Search result normalization only. Never call upstream APIs from the browser.
const TRACKING = new Set(['fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'yclid']);
function cleanUrl(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 4096) return null;
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || TRACKING.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}
function parsePrice(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 && raw <= 1e9 ? raw : null;
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(?:(?:USD|US\$)\s*)?\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/i);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, '') + (match[2] ? '.' + match[2] : ''));
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? n : null;
}
function stockState(raw) {
  if (typeof raw?.in_stock === 'boolean') return raw.in_stock;
  if (typeof raw?.inStock === 'boolean') return raw.inStock;
  const status = String(raw?.stock_status ?? raw?.availability ?? '').trim().toLowerCase();
  if (['in stock', 'available'].includes(status)) return true;
  if (['out of stock', 'sold out'].includes(status)) return false;
  return null;
}
function normalizeOffer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = String(raw.title || '').trim().slice(0, 250);
  const url = cleanUrl(raw.link || raw.product_link || raw.url);
  const price = parsePrice(raw.extracted_price ?? raw.price);
  if (!title || !url || price === null) return null;
  return { title, merchant: String(raw.source || raw.merchant || 'Retailer').trim().slice(0, 90),
    price, currency: 'USD', url, shipping: String(raw.delivery || '').slice(0, 140),
    inStock: stockState(raw) };
}
function normalizeOffers(raw) {
  const seen = new Set();
  const offers = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const offer = normalizeOffer(item);
    if (!offer || seen.has(offer.url)) continue;
    seen.add(offer.url);
    offers.push(offer);
    if (offers.length === 40) break;
  }
  return offers;
}
function normalizeWebResults(raw) {
  const seen = new Set(), results = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue;
    const title = String(item.title || '').trim().slice(0, 250), url = cleanUrl(item.link || item.url);
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url, snippet: String(item.snippet || '').slice(0, 400), domain: String(item.displayed_link || '').slice(0, 150) });
    if (results.length === 30) break;
  }
  return results;
}
module.exports = { cleanUrl, parsePrice, stockState, normalizeOffer, normalizeOffers, normalizeWebResults };
