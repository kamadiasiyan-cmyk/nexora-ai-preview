'use strict';
/** Descriptive statistics for retailer offers, not a like-for-like product comparison. */
function summarizeOffers(input) {
  const offers = Array.isArray(input) ? input : [];
  const priced = offers.filter(o => o && typeof o.price === 'number' && Number.isFinite(o.price) && o.price >= 0 && o.price <= 1e9);
  const prices = priced.map(o => o.price).sort((a, b) => a - b);
  const merchants = new Set(priced.map(o => String(o.merchant || '').trim().toLowerCase()).filter(Boolean));
  const inStock = priced.filter(o => o.inStock === true);
  const outOfStock = priced.filter(o => o.inStock === false);
  const unknownStock = priced.filter(o => o.inStock !== true && o.inStock !== false);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length ? (prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2) : null;
  const cents = n => n === null ? null : Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    offerCount: priced.length,
    merchantCount: merchants.size,
    lowestPrice: prices.length ? prices[0] : null,
    highestPrice: prices.length ? prices[prices.length - 1] : null,
    medianPrice: cents(median),
    lowestConfirmedInStockPrice: inStock.length ? Math.min(...inStock.map(o => o.price)) : null,
    confirmedInStockCount: inStock.length,
    confirmedOutOfStockCount: outOfStock.length,
    unknownStockCount: unknownStock.length,
    currency: 'USD',
    caveat: 'Results may differ in product model, condition, shipping, or seller. Verify at retailer.'
  };
}
module.exports = { summarizeOffers };
