/**
 * Spend rate and paid top-up split.
 * Run: npx tsx tests/creditRates.test.ts
 * Rounding: half up to 2 decimals (Math.round(n * 100) / 100).
 */
import assert from 'node:assert/strict';
import { creditsForTokens, paidTopupSplit, TOKENS_PER_CREDIT, chargeFromUsageMetadata } from '../serverBilling.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

check('live rate is 9000 tokens per credit', () => {
  assert.equal(TOKENS_PER_CREDIT, 9000);
});

check('0 tokens => 0 credits', () => {
  assert.equal(creditsForTokens(0), 0);
});

check('9000 tokens => 1 credit', () => {
  assert.equal(creditsForTokens(9000), 1);
});

check('1120 tokens => 0.12 credits (1120/9000 rounded half up to 2 decimals)', () => {
  assert.equal(creditsForTokens(1120), 0.12);
});

check('missing usage charges nothing and does not invent a token count', () => {
  const quote = chargeFromUsageMetadata(undefined);
  assert.equal(quote.tokensUsed, null);
  assert.equal(quote.creditsCharged, 0);
  assert.equal(quote.usageMissing, true);
});

check('top-up 100 keeps 100 usable and records 10 admin share', () => {
  const split = paidTopupSplit(100);
  assert.equal(split.usableCredits, 100);
  assert.equal(split.adminShareCredits, 10);
  assert.equal(split.usableCredits + split.adminShareCredits, 110);
});

console.log(`\n${passed} credit rate tests passed`);
