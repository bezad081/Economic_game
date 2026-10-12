import { describe, expect, it } from 'vitest';
import { updateDebtRatio, updateSovereignSpread } from '../src/game/parameters';

describe('fiscal sustainability accounting', () => {
  const baseline = {
    debt: 0.80,
    policyRate: 0.04,
    spread: 0.015,
    quarterlyGrowth: 0.006,
    inflation: 0.025,
  };

  it('makes a primary deficit raise debt more than a primary surplus', () => {
    const deficit = updateDebtRatio(
      baseline.debt, baseline.policyRate, baseline.spread,
      baseline.quarterlyGrowth, baseline.inflation, -0.04,
    );
    const surplus = updateDebtRatio(
      baseline.debt, baseline.policyRate, baseline.spread,
      baseline.quarterlyGrowth, baseline.inflation, 0.04,
    );
    expect(deficit).toBeGreaterThan(surplus);
  });

  it('makes higher financing costs worsen debt dynamics, all else equal', () => {
    const lowCost = updateDebtRatio(
      baseline.debt, 0.025, 0.005, baseline.quarterlyGrowth,
      baseline.inflation, 0,
    );
    const highCost = updateDebtRatio(
      baseline.debt, 0.085, 0.045, baseline.quarterlyGrowth,
      baseline.inflation, 0,
    );
    expect(highCost).toBeGreaterThan(lowCost);
  });

  it('lets stronger nominal GDP growth reduce the debt ratio, all else equal', () => {
    const weakGrowth = updateDebtRatio(
      baseline.debt, baseline.policyRate, baseline.spread,
      -0.015, 0.005, 0,
    );
    const strongerGrowth = updateDebtRatio(
      baseline.debt, baseline.policyRate, baseline.spread,
      0.015, 0.04, 0,
    );
    expect(strongerGrowth).toBeLessThan(weakGrowth);
  });

  it('links high debt, weak fiscal balance, low credibility and bank stress to wider spreads', () => {
    const resilient = updateSovereignSpread(0.45, 0.02, 0.90, 0.90);
    const fragile = updateSovereignSpread(1.10, -0.08, 0.30, 0.25);
    expect(fragile).toBeGreaterThan(resilient);
    expect(fragile).toBeLessThanOrEqual(0.16);
  });

  it('keeps debt within the model safety bounds during extreme conditions', () => {
    const debt = updateDebtRatio(2.35, 0.25, 0.16, -0.08, 0.30, -0.12, 0.2);
    expect(Number.isFinite(debt)).toBe(true);
    expect(debt).toBeGreaterThanOrEqual(0.08);
    expect(debt).toBeLessThanOrEqual(2.4);
  });
});
