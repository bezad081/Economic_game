import { describe, expect, it } from 'vitest';
import { EconomyEngine } from '../src/game/economy';
import { applyCrisisScenario, CRISIS_SCENARIOS } from '../src/game/scenarios';
import { transmitDemand, policyLag } from '../src/game/transmission';
import { POLICIES } from '../src/game/policies';
import { assessPolicy } from '../src/game/learning';
import { policyPreviewGuidance } from '../src/game/policyPreview';
import { strategicBrief } from '../src/game/strategy';

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

  it('does not praise a policy just because legacy headline effects look favorable when actual channels move the wrong way', () => {
    const engine = new EconomyEngine('sandbox');
    const before = {
      growth: 0.02, inflation: 0.03, unemployment: 0.05, debt: 0.5,
      creditGrowth: 0.03, investment: 200, consumption: 600,
    };
    const after = {
      ...engine.snapshot(),
      turn: 2,
      growth: 0.01,
      inflation: 0.025,
      unemployment: 0.052,
      debtRatio: 0.5,
      creditGrowth: 0.05,
      investment: 210,
      consumption: 615,
    };
    const review = assessPolicy(POLICIES.find(p => p.id === 'rate_up')!, 0, before, after);
    expect(review.outcome).toBe('unfavorable');
    expect(review.result).toContain('conflict with the policy impulse');
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

  it('waits for the policy-family lag before reviewing structural reform', () => {
    const engine = new EconomyEngine('sandbox');
    expect(engine.enact('business_reform').ok).toBe(true);
    const lag = policyLag('Structural');
    for (let quarter = 0; quarter < lag - 1; quarter += 1) {
      engine.stepQuarter();
      expect(engine.state.lastLearningReview).toBeNull();
      expect(engine.state.pendingPolicies).toHaveLength(1);
    }
    engine.stepQuarter();
    expect(engine.state.lastLearningReview?.policyId).toBe('business_reform');
    expect(engine.state.lastLearningReview?.elapsedQuarters).toBeGreaterThanOrEqual(lag);
    expect(engine.state.pendingPolicies).toHaveLength(0);
    expect(engine.state.pendingPolicy).toBeNull();
  });

  it('keeps earlier policy decisions in the learning queue instead of overwriting them', () => {
    const engine = new EconomyEngine('sandbox');
    expect(engine.enact('rate_up').ok).toBe(true);
    expect(engine.enact('business_reform').ok).toBe(true);
    expect(engine.state.pendingPolicies).toHaveLength(2);
    expect(engine.state.pendingPolicies?.map(p => p.id)).toEqual(['rate_up', 'business_reform']);

    const longestLag = Math.max(policyLag('Monetary'), policyLag('Structural'));
    for (let quarter = 0; quarter < longestLag; quarter += 1) engine.stepQuarter();

    expect(engine.state.pendingPolicies).toHaveLength(0);
    expect(['rate_up', 'business_reform']).toContain(engine.state.lastLearningReview?.policyId);
    expect(engine.state.news.some(item => item.text.includes('Learning review ready: Rate +50bp'))).toBe(true);
    expect(engine.state.news.some(item => item.text.includes('Learning review ready: Business Reform'))).toBe(true);
  });

  it('turns structural reform into a persistent capacity stock', () => {
    const engine = new EconomyEngine('sandbox');
    const startingCapital = engine.state.structuralCapital;
    expect(startingCapital).toBeCloseTo(0.20, 8);
    expect(engine.enact('business_reform').ok).toBe(true);
    expect(engine.state.structuralCapital).toBeGreaterThan(startingCapital);
    const afterEnactment = engine.state.structuralCapital;

    for (let quarter = 0; quarter < 8; quarter += 1) engine.stepQuarter();

    // Benefits persist after the short-run impulse starts fading, with only slight depreciation.
    expect(engine.state.structuralCapital).toBeGreaterThan(startingCapital + 0.07);
    expect(engine.state.structuralCapital).toBeLessThan(afterEnactment);
    expect(engine.state.news.some(item => item.text.includes('Long-run reform stock increased'))).toBe(true);
    expect(Number.isFinite(engine.state.potentialGDP)).toBe(true);
  });

  it('migrates older saved games that do not have structural capital yet', () => {
    const saved = new EconomyEngine('sandbox').snapshot() as any;
    delete saved.structuralCapital;
    const restored = new EconomyEngine('sandbox', saved);
    expect(restored.state.structuralCapital).toBeCloseTo(0.20, 8);
  });

  it('makes monetary tightening and easing produce opposite credit conditions over the same seeded path', () => {
    const tightening = new EconomyEngine('sandbox');
    const easing = new EconomyEngine('sandbox');
    expect(tightening.enact('rate_up').ok).toBe(true);
    expect(easing.enact('rate_down').ok).toBe(true);

    // The policy rate changes immediately; credit and demand transmission then unfolds with lags.
    for (let quarter = 0; quarter < 3; quarter += 1) {
      tightening.stepQuarter();
      easing.stepQuarter();
    }

    expect(tightening.state.policyRate).toBeGreaterThan(easing.state.policyRate);
    expect(tightening.state.creditGrowth).toBeLessThan(easing.state.creditGrowth);
  });

  it('keeps the signs of credit and household-demand transmission economically coherent', () => {
    const engine = new EconomyEngine('sandbox');
    const baseline = engine.snapshot();
    const easing = transmitDemand(baseline, { credit: 0.04, householdDemand: 0.02 });
    const tightening = transmitDemand(baseline, { credit: -0.04, householdDemand: -0.02 });

    expect(easing.credit).toBeGreaterThan(0);
    expect(easing.consumption).toBeGreaterThan(0);
    expect(easing.investment).toBeGreaterThan(0);
    expect(easing.demandGrowth).toBeGreaterThan(0);
    expect(tightening.credit).toBeLessThan(0);
    expect(tightening.consumption).toBeLessThan(0);
    expect(tightening.investment).toBeLessThan(0);
    expect(tightening.demandGrowth).toBeLessThan(0);
  });

  it('gives banking and energy crises different opening diagnosis and response menus', () => {
    const engine = new EconomyEngine('mission');
    const banking = engine.snapshot();
    const energy = engine.snapshot();
    applyCrisisScenario(banking, 'banking');
    applyCrisisScenario(energy, 'energy');

    expect(banking.activeEvents[0].kind).toBe('banking');
    expect(banking.activeEvents[0].responsePolicyIds).toContain('bank_recap');
    expect(energy.activeEvents[0].kind).toBe('energy');
    expect(energy.activeEvents[0].responsePolicyIds).toContain('energy_subsidy');
    expect(energy.activeEvents[0].responsePolicyIds).not.toEqual(banking.activeEvents[0].responsePolicyIds);
    expect(banking.bankHealth).toBeLessThan(energy.bankHealth);
    expect(energy.energySecurity).toBeLessThan(banking.energySecurity);
  });


  it('makes fiscal stimulus weaken and fiscal repair strengthen the primary balance', () => {
    const stimulus = new EconomyEngine('sandbox');
    const repair = new EconomyEngine('sandbox');
    expect(stimulus.enact('stimulus').ok).toBe(true);
    expect(repair.enact('austerity').ok).toBe(true);

    for (let quarter = 0; quarter < 3; quarter += 1) {
      stimulus.stepQuarter();
      repair.stepQuarter();
    }

    expect(stimulus.state.primaryBalance).toBeLessThan(repair.state.primaryBalance);
    expect(stimulus.state.debtRatio).toBeGreaterThan(repair.state.debtRatio);
  });


  it('makes the same fiscal stimulus more inflationary under an energy supply constraint than in a demand recession', () => {
    const energyBaseline = new EconomyEngine('sandbox');
    const energyStimulus = new EconomyEngine('sandbox');
    const recessionBaseline = new EconomyEngine('sandbox');
    const recessionStimulus = new EconomyEngine('sandbox');

    applyCrisisScenario(energyBaseline.state, 'energy');
    applyCrisisScenario(energyStimulus.state, 'energy');
    applyCrisisScenario(recessionBaseline.state, 'recession');
    applyCrisisScenario(recessionStimulus.state, 'recession');

    const energyStart = energyStimulus.state.inflation;
    const recessionStart = recessionStimulus.state.inflation;
    expect(energyStimulus.enact('stimulus').ok).toBe(true);
    expect(recessionStimulus.enact('stimulus').ok).toBe(true);

    for (let quarter = 0; quarter < 4; quarter += 1) {
      energyBaseline.stepQuarter();
      energyStimulus.stepQuarter();
      recessionBaseline.stepQuarter();
      recessionStimulus.stepQuarter();
    }

    const energyStimulusInflationEffect = (energyStimulus.state.inflation - energyStart)
      - (energyBaseline.state.inflation - 0.095);
    const recessionStimulusInflationEffect = (recessionStimulus.state.inflation - recessionStart)
      - (recessionBaseline.state.inflation - 0.025);

    expect(energyStimulusInflationEffect).toBeGreaterThan(recessionStimulusInflationEffect);
  });

  it('gives crisis-specific learning guidance for recession and energy supply shocks', () => {
    const engine = new EconomyEngine('sandbox');
    const policy = POLICIES.find(p => p.id === 'stimulus')!;
    const before = {
      growth: 0, inflation: 0.03, unemployment: 0.08, debt: 0.6,
      creditGrowth: 0, investment: 200, consumption: 600,
    };
    const energyAfter = {
      ...engine.snapshot(), scenarioId: 'energy', turn: 2, growth: 0.01,
      inflation: 0.10, unemployment: 0.08, debtRatio: 0.61,
      creditGrowth: 0.01, investment: 202, consumption: 603,
    };
    const recessionAfter = {
      ...engine.snapshot(), scenarioId: 'recession', turn: 2, growth: 0.01,
      inflation: 0.03, unemployment: 0.12, debtRatio: 0.61,
      creditGrowth: 0.01, investment: 202, consumption: 603,
    };

    const energyReview = assessPolicy(policy, 0, before, energyAfter);
    const recessionReview = assessPolicy(policy, 0, before, recessionAfter);

    expect(energyReview.mechanism).toContain('Energy scarcity');
    expect(energyReview.nextStep).toContain('targeted relief or supply resilience');
    expect(recessionReview.mechanism).toContain('negative output gap');
    expect(recessionReview.nextStep).toContain('demand and employment');
    expect(energyReview.nextStep).not.toBe(recessionReview.nextStep);
  });

  it('delivers a larger real-output response to fiscal stimulus in a deep recession than under an energy bottleneck', () => {
    const recessionBaseline = new EconomyEngine('sandbox');
    const recessionStimulus = new EconomyEngine('sandbox');
    const energyBaseline = new EconomyEngine('sandbox');
    const energyStimulus = new EconomyEngine('sandbox');

    applyCrisisScenario(recessionBaseline.state, 'recession');
    applyCrisisScenario(recessionStimulus.state, 'recession');
    applyCrisisScenario(energyBaseline.state, 'energy');
    applyCrisisScenario(energyStimulus.state, 'energy');

    expect(recessionStimulus.enact('stimulus').ok).toBe(true);
    expect(energyStimulus.enact('stimulus').ok).toBe(true);

    for (let quarter = 0; quarter < 4; quarter += 1) {
      recessionBaseline.stepQuarter();
      recessionStimulus.stepQuarter();
      energyBaseline.stepQuarter();
      energyStimulus.stepQuarter();
    }

    const recessionOutputEffect = recessionStimulus.state.realGDP - recessionBaseline.state.realGDP;
    const energyOutputEffect = energyStimulus.state.realGDP - energyBaseline.state.realGDP;
    expect(recessionOutputEffect).toBeGreaterThan(energyOutputEffect);
  });

});


describe('endogenous crisis spillovers', () => {
  it('creates an actionable supply event when weak energy security meets high inflation', () => {
    const engine = new EconomyEngine('sandbox');
    engine.state.energySecurity = 0.30;
    engine.state.inflation = 0.11;
    engine.state.growth = -0.02;
    engine.stepQuarter();

    const event = engine.state.activeEvents.find(e => e.title === 'Energy bottleneck spreads to production');
    expect(event).toBeDefined();
    expect(event?.severity).toBeGreaterThanOrEqual(4);
    expect(event?.deadlineTurn).toBeGreaterThan(engine.state.turn);
    expect(event?.responsePolicyIds).toContain('energy_subsidy');
    expect(engine.state.news.some(n => n.text.includes('Spillover alert'))).toBe(true);
  });

  it('turns simultaneous bank weakness and weak credit into a financial feedback risk', () => {
    const engine = new EconomyEngine('sandbox');
    engine.state.bankHealth = 0.35;
    engine.state.creditGrowth = -0.01;
    engine.stepQuarter();

    expect(engine.state.activeEvents.some(e => e.title === 'Weak credit transmission threatens viable firms')).toBe(true);
  });
});

describe('strategic advisor', () => {
  it('prioritizes supply resilience rather than broad demand stimulus during an energy constraint', () => {
    const econ = new EconomyEngine('sandbox').snapshot();
    econ.scenarioId = 'energy';
    econ.energySecurity = 0.38;
    econ.inflation = 0.095;
    const brief = strategicBrief(econ);
    expect(brief.diagnosis).toContain('Supply capacity');
    expect(brief.priority).toContain('energy');
    expect(brief.avoid).toContain('Broad demand stimulus');
    expect(brief.focus).toContain('capacity utilization');
  });

  it('uses the most severe active crisis and exposes its response goal', () => {
    const econ = new EconomyEngine('mission').snapshot();
    econ.activeEvents = [{
      id: 'test-crisis', kind: 'energy', title: 'Power shortage', description: 'Grid stress',
      severity: 5, startedTurn: 0, deadlineTurn: 2, responsePolicyIds: ['energy_subsidy'],
      responseLabel: 'Protect essential energy supply', learning: 'Supply bottlenecks reduce output',
      status: 'active', consequence: 'Factory output and wages may fall'
    }];
    const brief = strategicBrief(econ);
    expect(brief.diagnosis).toContain('Power shortage');
    expect(brief.priority).toContain('Protect essential energy supply');
    expect(brief.avoid).toContain('event deadline');
  });

  it('connects the previous policy review to the next strategic decision', () => {
    const econ = new EconomyEngine('sandbox').snapshot();
    econ.lastLearningReview = {
      policyId: 'stimulus', policyLabel: 'Demand support', policyTab: 'Fiscal',
      enactedTurn: 0, observedTurn: 2, elapsedQuarters: 2,
      observedChanges: {growth: 0.01, inflation: 0.005, unemployment: -0.01, debt: 0.02, creditGrowth: 0.01, investmentPct: 2, consumptionPct: 1},
      channel: 'Fiscal demand', lagQuarters: 1, outcome: 'mixed',
      result: 'The observed evidence is mixed.', mechanism: 'Demand increased.',
      tradeoff: 'Debt versus jobs', nextStep: 'Watch inflation.'
    };
    expect(strategicBrief(econ).learning).toContain('Demand support was mixed');
    expect(strategicBrief(econ).learning).toContain('not proof of causality');
  });
});

describe('scenario-aware policy preview', () => {
  it('explains why demand stimulus fits recession better than an energy bottleneck', () => {
    const engine = new EconomyEngine('mission');
    const recession = engine.snapshot();
    const energy = engine.snapshot();
    applyCrisisScenario(recession, 'recession');
    applyCrisisScenario(energy, 'energy');
    const stimulus = POLICIES.find(p => p.id === 'stimulus')!;
    const recessionGuide = policyPreviewGuidance(stimulus, recession);
    const energyGuide = policyPreviewGuidance(stimulus, energy);
    expect(recessionGuide.fit).toBe('strong');
    expect(recessionGuide.likelyUpside).toContain('Spare capacity');
    expect(energyGuide.fit).toBe('weak');
    expect(energyGuide.mainRisk).toContain('supply');
    expect(energyGuide.watch).toContain('Energy security');
  });

  it('flags fiscal-space risks during a sovereign debt crisis', () => {
    const engine = new EconomyEngine('mission');
    const debt = engine.snapshot();
    applyCrisisScenario(debt, 'debt');
    const stimulus = POLICIES.find(p => p.id === 'stimulus')!;
    const guidance = policyPreviewGuidance(stimulus, debt);
    expect(guidance.fit).toBe('conditional');
    expect(guidance.mainRisk).toContain('fiscal space');
    expect(guidance.watch).toContain('Sovereign spread');
  });

  it('provides monitor indicators and an explicit trade-off for every policy', () => {
    const econ = new EconomyEngine('sandbox').snapshot();
    for (const policy of POLICIES) {
      const guidance = policyPreviewGuidance(policy, econ);
      expect(guidance.objective.length).toBeGreaterThan(10);
      expect(guidance.likelyUpside.length).toBeGreaterThan(10);
      expect(guidance.mainRisk.length).toBeGreaterThan(5);
      expect(guidance.watch.length).toBeGreaterThan(5);
    }
  });
});


describe('crisis event chains', () => {
  it('escalates an unresolved severe opening event into a linked follow-up shock', () => {
    const baseline = new EconomyEngine('mission').snapshot();
    applyCrisisScenario(baseline, 'energy');
    const engine = new EconomyEngine('mission', baseline);
    engine.state.turn = 5; // the opening event's response deadline was quarter 4
    engine.stepQuarter();
    expect(engine.state.eventHistory.some(e => e.id === 'opening-energy' && e.status === 'expired')).toBe(true);
    const followUp = engine.state.activeEvents.find(e => e.stage === 2 && e.parentEventId === 'opening-energy');
    expect(followUp).toBeDefined();
    expect(followUp?.chainId).toBe('opening-energy');
    expect(followUp?.description).toContain('wage');
    expect(engine.state.news.some(n => n.text.includes('Event chain advanced'))).toBe(true);
  });
});


describe('crisis response effectiveness', () => {
  it('stops the recurring spillover impulse after an appropriate response', () => {
    const engine = new EconomyEngine('sandbox');
    engine.state.energySecurity = 0.30;
    engine.state.inflation = 0.11;
    engine.state.growth = -0.02;
    engine.stepQuarter();

    const event = engine.state.activeEvents.find(e => e.title === 'Energy bottleneck spreads to production');
    expect(event).toBeDefined();
    expect(engine.state.impulses.some(i => i.id === `event-${event?.id}`)).toBe(true);

    const result = engine.enact('energy_subsidy');
    expect(result.ok).toBe(true);
    expect(event?.status).toBe('responded');
    expect(event?.resolvedBy).toBe('Energy Relief');
    expect(engine.state.impulses.some(i => i.id === `event-${event?.id}`)).toBe(false);
    expect(engine.state.news.some(n => n.text.includes('Ongoing spillover pressure has been stopped'))).toBe(true);
  });

  it('does not remove unrelated policy or shock impulses when resolving one event', () => {
    const engine = new EconomyEngine('sandbox');
    engine.state.energySecurity = 0.30;
    engine.state.inflation = 0.11;
    engine.state.growth = -0.02;
    engine.stepQuarter();
    engine.triggerShock('financial');
    const unrelated = engine.state.impulses.find(i => i.id.startsWith('shock-financial-'));
    expect(unrelated).toBeDefined();

    expect(engine.enact('energy_subsidy').ok).toBe(true);
    expect(engine.state.impulses.some(i => i.id === unrelated?.id)).toBe(true);
  });
});


describe('long-horizon simulation stability', () => {
  it('keeps core macro indicators finite and bounded through repeated shocks and event chains', () => {
    const engine = new EconomyEngine('mission');
    const shocks = ['oil', 'financial', 'sanctions', 'food'] as const;

    for (let quarter = 0; quarter < 32; quarter += 1) {
      if (quarter % 6 === 0) engine.triggerShock(shocks[(quarter / 6) % shocks.length]);
      engine.stepQuarter();

      const s = engine.state;
      for (const key of [
        'realGDP', 'potentialGDP', 'growth', 'inflation', 'coreInflation',
        'unemployment', 'debtRatio', 'primaryBalance', 'bankHealth',
        'creditGrowth', 'exchangeRate', 'energySecurity', 'structuralCapital',
        'poverty', 'inequality', 'productivity', 'sovereignSpread'
      ] as const) {
        expect(Number.isFinite(s[key]), `quarter ${quarter + 1}: ${key}`).toBe(true);
      }
      expect(s.realGDP).toBeGreaterThan(0);
      expect(s.potentialGDP).toBeGreaterThan(0);
      expect(s.unemployment).toBeGreaterThanOrEqual(0);
      expect(s.unemployment).toBeLessThanOrEqual(1);
      expect(s.bankHealth).toBeGreaterThanOrEqual(0);
      expect(s.bankHealth).toBeLessThanOrEqual(1);
      expect(s.energySecurity).toBeGreaterThanOrEqual(0);
      expect(s.energySecurity).toBeLessThanOrEqual(1);
      expect(s.poverty).toBeGreaterThanOrEqual(0);
      expect(s.poverty).toBeLessThanOrEqual(1);
      expect(s.inequality).toBeGreaterThanOrEqual(0);
      expect(s.inequality).toBeLessThanOrEqual(1);
      expect(s.activeEvents.length).toBeLessThanOrEqual(3);
    }

    expect(engine.state.turn).toBe(32);
    expect(engine.state.history.length).toBeGreaterThan(20);
  });
});


describe('expenditure-side macro demand accounting', () => {
  it('makes export exposure and import leakage affect output growth in the expected direction', () => {
    const base = new EconomyEngine('sandbox').state;
    const exportLedState = structuredClone(base);
    exportLedState.exports = 160;
    exportLedState.imports = 80;
    const importLedState = structuredClone(base);
    importLedState.exports = 80;
    importLedState.imports = 160;

    const exportLed = new EconomyEngine('sandbox', exportLedState);
    const importLed = new EconomyEngine('sandbox', importLedState);
    exportLed.stepQuarter();
    importLed.stepQuarter();

    expect(exportLed.state.growth).toBeGreaterThan(importLed.state.growth);
    expect(Number.isFinite(exportLed.state.realGDP)).toBe(true);
    expect(Number.isFinite(importLed.state.realGDP)).toBe(true);
  });

  it('keeps growth finite when net exports are negative', () => {
    const state = new EconomyEngine('sandbox').state;
    state.exports = 70;
    state.imports = 145;
    state.netExports = -75;
    const engine = new EconomyEngine('sandbox', state);

    for (let quarter = 0; quarter < 12; quarter += 1) engine.stepQuarter();
    expect(Number.isFinite(engine.state.growth)).toBe(true);
    expect(Number.isFinite(engine.state.realGDP)).toBe(true);
    expect(engine.state.realGDP).toBeGreaterThan(0);
  });
});


describe('nominal-growth debt dynamics', () => {
  it('recognizes that inflation raises nominal GDP and can lower the debt ratio, all else equal', async () => {
    const { updateDebtRatio } = await import('../src/game/parameters');
    const lowInflation = updateDebtRatio(0.80, 0.05, 0.015, 0.005, 0.01, -0.01);
    const higherInflation = updateDebtRatio(0.80, 0.05, 0.015, 0.005, 0.06, -0.01);
    expect(higherInflation).toBeLessThan(lowInflation);
  });

  it('makes higher funding costs worsen debt dynamics, all else equal', async () => {
    const { updateDebtRatio } = await import('../src/game/parameters');
    const lowerCost = updateDebtRatio(0.90, 0.03, 0.005, 0.004, 0.025, 0.005);
    const higherCost = updateDebtRatio(0.90, 0.08, 0.035, 0.004, 0.025, 0.005);
    expect(higherCost).toBeGreaterThan(lowerCost);
  });

  it('keeps debt ratio finite and bounded under recession and high inflation', async () => {
    const { updateDebtRatio } = await import('../src/game/parameters');
    const ratio = updateDebtRatio(1.5, 0.12, 0.08, -0.04, 0.25, -0.10, 0.02);
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeGreaterThanOrEqual(0.08);
    expect(ratio).toBeLessThanOrEqual(2.4);
  });
});


describe('Okun-style labor-market dynamics', () => {
  it('reduces unemployment when growth exceeds potential growth', async () => {
    const { updateUnemployment } = await import('../src/game/parameters');
    const abovePotential = updateUnemployment(0.08, 0.025, 0.005);
    const belowPotential = updateUnemployment(0.08, -0.005, 0.005);
    expect(abovePotential).toBeLessThan(belowPotential);
    expect(abovePotential).toBeLessThan(0.08);
    expect(belowPotential).toBeGreaterThan(0.08);
  });

  it('does not automatically treat positive growth below potential as a labor-market boom', async () => {
    const { updateUnemployment } = await import('../src/game/parameters');
    const unemployment = updateUnemployment(0.07, 0.004, 0.009);
    expect(unemployment).toBeGreaterThan(0.07);
  });

  it('keeps unemployment bounded under large shocks', async () => {
    const { updateUnemployment } = await import('../src/game/parameters');
    expect(updateUnemployment(0.27, -0.08, 0.01, 0.10)).toBeLessThanOrEqual(0.28);
    expect(updateUnemployment(0.02, 0.08, 0, -0.10)).toBeGreaterThanOrEqual(0.018);
  });
});


describe('real-rate and sovereign-risk credit channel', () => {
  it('reduces credit growth as real policy rates rise, all else equal', async () => {
    const { updateCreditGrowth } = await import('../src/game/parameters');
    const easier = updateCreditGrowth(0.03, 0.025, 0.8, 0.01);
    const tighter = updateCreditGrowth(0.09, 0.025, 0.8, 0.01);
    expect(tighter).toBeLessThan(easier);
  });

  it('makes sovereign-risk premiums weigh on credit supply', async () => {
    const { updateCreditGrowth } = await import('../src/game/parameters');
    const calmMarkets = updateCreditGrowth(0.05, 0.03, 0.75, 0.01);
    const stressedMarkets = updateCreditGrowth(0.05, 0.03, 0.75, 0.07);
    expect(stressedMarkets).toBeLessThan(calmMarkets);
  });

  it('preserves stronger lending capacity in healthier banks under equal financing costs', async () => {
    const { updateCreditGrowth } = await import('../src/game/parameters');
    const healthy = updateCreditGrowth(0.06, 0.03, 0.9, 0.02);
    const fragile = updateCreditGrowth(0.06, 0.03, 0.25, 0.02);
    expect(healthy).toBeGreaterThan(fragile);
  });
});


describe('expectations, wage setting and sovereign-risk feedback', () => {
  it('anchors inflation expectations faster when credibility is stronger', async () => {
    const { updateInflationExpectations } = await import('../src/game/parameters');
    const credible = updateInflationExpectations(0.08, 0.03, 0.95, 0.025);
    const fragile = updateInflationExpectations(0.08, 0.03, 0.20, 0.025);
    expect(Math.abs(credible - 0.025)).toBeLessThan(Math.abs(fragile - 0.025));
  });

  it('lets persistent current inflation lift expectations, but keeps them bounded', async () => {
    const { updateInflationExpectations } = await import('../src/game/parameters');
    const calm = updateInflationExpectations(0.03, 0.025, 0.75);
    const inflationShock = updateInflationExpectations(0.03, 0.14, 0.75);
    expect(inflationShock).toBeGreaterThan(calm);
    expect(updateInflationExpectations(0.24, 0.30, 0.15)).toBeLessThanOrEqual(0.25);
  });

  it('connects wage growth to inflation expectations and labor-market tightness', async () => {
    const { updateWageGrowth } = await import('../src/game/parameters');
    const highExpectations = updateWageGrowth(0.04, 0.08, 1.0, 0.055);
    const anchoredExpectations = updateWageGrowth(0.04, 0.02, 1.0, 0.055);
    const tightLabor = updateWageGrowth(0.04, 0.03, 1.0, 0.025);
    const slackLabor = updateWageGrowth(0.04, 0.03, 1.0, 0.12);
    expect(highExpectations).toBeGreaterThan(anchoredExpectations);
    expect(tightLabor).toBeGreaterThan(slackLabor);
  });

  it('prices sovereign risk higher when debt, credibility or bank conditions deteriorate', async () => {
    const { updateSovereignSpread } = await import('../src/game/parameters');
    const stable = updateSovereignSpread(0.50, 0.00, 0.90, 0.90);
    expect(updateSovereignSpread(0.95, -0.08, 0.90, 0.90)).toBeGreaterThan(stable);
    expect(updateSovereignSpread(0.50, 0.00, 0.20, 0.90)).toBeGreaterThan(stable);
    expect(updateSovereignSpread(0.50, 0.00, 0.90, 0.20)).toBeGreaterThan(stable);
    expect(updateSovereignSpread(2.0, -1.0, 0.0, 0.0)).toBeLessThanOrEqual(0.16);
  });

  it('keeps the integrated engine finite while expectation and sovereign-risk feedback interact', () => {
    const engine = new EconomyEngine('mission');
    engine.state.inflation = 0.12;
    engine.state.inflationExpected = 0.09;
    engine.state.credibility = 0.25;
    engine.state.debtRatio = 0.92;
    engine.state.bankHealth = 0.30;
    for (let i = 0; i < 16; i += 1) engine.stepQuarter();
    for (const value of [
      engine.state.inflationExpected,
      engine.state.wageGrowth,
      engine.state.realWageGrowth,
      engine.state.sovereignSpread,
      engine.state.creditGrowth,
      engine.state.debtRatio,
    ]) expect(Number.isFinite(value)).toBe(true);
  });
});
