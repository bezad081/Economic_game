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
