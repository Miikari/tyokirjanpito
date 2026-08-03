const { PRO_PRICE_IDS } = require('./stripe.js');

// Ordinal tier levels for "at least X" checks — mirrors app/js/billing.js's
// TIER_LEVEL. Add a new tier here (and to PRICE_TIERS below, mapping its
// Stripe Price id(s)) when one is introduced; every isAtLeast() call site
// upgrades automatically without needing to change.
const TIER_LEVEL = { free: 0, pro: 1 };

// Which tier a given Stripe Price id grants a subscriber. Every subscribable
// price must be listed here — both the monthly and yearly Price map to the
// same 'pro' tier, since a billing interval isn't a tier — so checkout/
// webhook can derive the correct tier instead of assuming any successful
// subscription always means 'pro'.
const PRICE_TIERS = {
  [PRO_PRICE_IDS.month]: 'pro',
  [PRO_PRICE_IDS.year]: 'pro',
};

function tierForPrice(priceId) {
  return PRICE_TIERS[priceId] || null;
}

function isAtLeast(plan, tier) {
  return (TIER_LEVEL[plan] ?? 0) >= (TIER_LEVEL[tier] ?? 0);
}

module.exports = { TIER_LEVEL, PRICE_TIERS, tierForPrice, isAtLeast };
