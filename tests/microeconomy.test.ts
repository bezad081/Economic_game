import { describe, expect, it } from 'vitest';
import { EconomyEngine } from '../src/game/economy';
import { updateMicroeconomy } from '../src/game/micro';

describe('distributional policy transmission', () => {
  it('routes targeted transfers more strongly to lower-income households', () => {
    const baseline = new EconomyEngine('sandbox').snapshot();
    const supported = structuredClone(baseline);
    updateMicroeconomy(baseline, () => 0.5);
    updateMicroeconomy(supported, () => 0.5, { targetedTransfer: 0.05 });

    const baseLower = baseline.households.find(h => h.id === 'lower')!;
    const supportLower = supported.households.find(h => h.id === 'lower')!;
    const baseUpper = baseline.households.find(h => h.id === 'upper')!;
    const supportUpper = supported.households.find(h => h.id === 'upper')!;

    expect(supportLower.income).toBeGreaterThan(baseLower.income);
    expect(supportLower.income - baseLower.income)
      .toBeGreaterThan(supportUpper.income - baseUpper.income);
  });

  it('lets targeted relief reduce measured poverty and raise household consumption propensity', () => {
    const baseline = new EconomyEngine('sandbox').snapshot();
    const supported = structuredClone(baseline);
    updateMicroeconomy(baseline, () => 0.5);
    updateMicroeconomy(supported, () => 0.5, { targetedTransfer: 0.05 });

    expect(supported.poverty).toBeLessThan(baseline.poverty);
    expect(supported.households[0].consumption).toBeGreaterThan(baseline.households[0].consumption);
    expect(Number.isFinite(supported.householdIncome)).toBe(true);
    expect(Number.isFinite(supported.inequality)).toBe(true);
  });

  it('keeps household and poverty indicators bounded under an unusually large transfer impulse', () => {
    const state = new EconomyEngine('sandbox').snapshot();
    updateMicroeconomy(state, () => 0.5, { targetedTransfer: 0.8 });
    for (const household of state.households) {
      expect(Number.isFinite(household.income)).toBe(true);
      expect(household.income).toBeGreaterThanOrEqual(0.45);
      expect(household.income).toBeLessThanOrEqual(12);
      expect(household.consumption).toBeGreaterThanOrEqual(0.42);
      expect(household.consumption).toBeLessThanOrEqual(0.96);
    }
    expect(state.poverty).toBeGreaterThanOrEqual(0.025);
    expect(state.poverty).toBeLessThanOrEqual(0.46);
  });
});


describe('firm aggregate indicators and labor transmission', () => {
  it('keeps firm sales and investment on their documented macro index scales', () => {
    const state = new EconomyEngine('sandbox').snapshot();
    updateMicroeconomy(state, () => 0.5);
    expect(state.firmSales).toBeGreaterThan(70);
    expect(state.firmSales).toBeLessThan(120);
    expect(state.firmInvestment).toBeGreaterThan(3);
    expect(state.firmInvestment).toBeLessThan(6);
  });

  it('translates stronger demand into higher firm employment under the same random sequence', () => {
    const base = new EconomyEngine('sandbox').snapshot();
    const strongerDemand = structuredClone(base);
    const weakerDemand = structuredClone(base);
    strongerDemand.growth = 0.08;
    strongerDemand.businessConfidence = 0.78;
    weakerDemand.growth = -0.04;
    weakerDemand.businessConfidence = 0.45;
    updateMicroeconomy(strongerDemand, () => 0.5);
    updateMicroeconomy(weakerDemand, () => 0.5);
    expect(strongerDemand.firmSales).toBeGreaterThan(weakerDemand.firmSales);
  });

  it('routes stronger credit availability into the aggregate firm-investment indicator', () => {
    const base = new EconomyEngine('sandbox').snapshot();
    const supported = structuredClone(base);
    const constrained = structuredClone(base);
    supported.creditGrowth = 0.12;
    constrained.creditGrowth = -0.08;
    updateMicroeconomy(supported, () => 0.5);
    updateMicroeconomy(constrained, () => 0.5);
    expect(supported.firmInvestment).toBeGreaterThan(constrained.firmInvestment);
  });
});
