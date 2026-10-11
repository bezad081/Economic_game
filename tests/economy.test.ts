import { describe, expect, it } from 'vitest';
import { EconomyEngine } from '../src/game/economy';
import { applyCrisisScenario, CRISIS_SCENARIOS } from '../src/game/scenarios';
import { transmitDemand, policyLag } from '../src/game/transmission';
import { POLICIES } from '../src/game/policies';

describe('economic model invariants', () => {
  it('initializes every crisis with a coherent baseline and opening event', () => {
    const engine = new EconomyEngine('mission');
    for (const scenario of CRISIS_SCENARIOS) {
      const baseline = engine.snapshot();
      applyCrisisScenario(baseline, scenario.id);
      expect(baseline.scenarioId).toBe(scenario.id);
      expect(baseline.activeEvents).toHaveLength(1);
      expect(baseline.activeEvents[0].status).toBe('active');
      expect(baseline.activeEvents[0].deadlineTurn).toBeGreaterThan(0);
      expect(baseline.realGDP).toBeGreaterThan(0);
      expect(baseline.potentialGDP).toBeGreaterThan(0);
      expect(baseline.consumption + baseline.investment + baseline.governmentSpending + baseline.netExports)
        .toBeCloseTo(baseline.realGDP, 6);
      expect(Number.isFinite(baseline.realWageGrowth)).toBe(true);
      expect(Number.isFinite(baseline.realRate)).toBe(true);
    }
  });

  it('uses longer indicative lags for trade and structural policy', () => {
    expect(policyLag('Monetary')).toBeLessThan(policyLag('Trade'));
    expect(policyLag('Trade')).toBeLessThan(policyLag('Structural'));
  });

  it('lets a weaker banking system dampen the same credit impulse', () => {
    const engine = new EconomyEngine('sandbox');
    const healthy = engine.snapshot();
    const stressed = { ...healthy, bankHealth: 0.25 };
    const impulse = { credit: 0.04 };
    const healthyResult = transmitDemand(healthy, impulse);
    const stressedResult = transmitDemand(stressed, impulse);
    expect(stressedResult.credit).toBeLessThan(healthyResult.credit);
    expect(stressedResult.outputGrowth).toBeLessThan(healthyResult.outputGrowth);
    expect(stressedResult.explanation.join(' ')).toContain('Bank stress');
  });

  it('transmits fiscal stimulus into positive demand and output', () => {
    const engine = new EconomyEngine('sandbox');
    const result = transmitDemand(engine.snapshot(), { fiscalDemand: 0.05, confidence: 0.01 });
    expect(result.demandGrowth).toBeGreaterThan(0);
    expect(result.outputGrowth).toBeGreaterThan(0);
    expect(result.explanation.join(' ')).toContain('Fiscal impulse');
  });

  it('allows a valid policy to be enacted and advances the model without non-finite core values', () => {
    const engine = new EconomyEngine('sandbox');
    const beforeRate = engine.state.policyRate;
    const ratePolicy = POLICIES.find(policy => policy.id === 'rate_up');
    expect(ratePolicy).toBeDefined();
    const result = engine.enact('rate_up');
    expect(result.ok).toBe(true);
    expect(engine.state.policyRate).toBeCloseTo(beforeRate + 0.005, 8);

    for (let quarter = 0; quarter < 8; quarter += 1) engine.stepQuarter();
    for (const key of ['realGDP', 'growth', 'inflation', 'unemployment', 'debtRatio', 'creditGrowth', 'investment'] as const) {
      expect(Number.isFinite(engine.state[key]), key).toBe(true);
    }
    expect(engine.state.realGDP).toBeGreaterThan(0);
    expect(engine.state.unemployment).toBeGreaterThanOrEqual(0);
    expect(engine.state.unemployment).toBeLessThanOrEqual(1);
  });
});
