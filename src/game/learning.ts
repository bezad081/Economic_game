import type { EconomySnapshot, LearningReview, PolicySpec } from './types';
import { policyLag } from './transmission';

export function buildChannel(policy: PolicySpec): string {
  if (policy.tab === 'Monetary') return 'Interest rate / liquidity → real rate & credit → households and firms → demand → output, prices and jobs';
  if (policy.tab === 'Fiscal') return 'Budget / taxes → household or government demand → consumption & investment → output, prices and debt';
  if (policy.tab === 'Structural') return 'Reform → productivity / capacity → firm decisions → potential output → wages and prices';
  if (policy.tab === 'Trade') return 'Competitiveness → exports / imports → firm sales → output, FX and prices';
  return 'Emergency response → financial or household balance sheets → credit / demand → macro stability';
}

export function assessPolicy(
  policy: PolicySpec,
  enactedTurn: number,
  before: {growth:number; inflation:number; unemployment:number; debt:number; creditGrowth:number; investment:number; consumption:number},
  after: EconomySnapshot
): LearningReview {
  const dg = after.growth - before.growth;
  const dpi = after.inflation - before.inflation;
  const du = after.unemployment - before.unemployment;
  const dd = after.debtRatio - before.debt;
  const expectedGrowth = policy.effects.growth ?? 0;
  const expectedInflation = policy.effects.inflation ?? 0;
  const expectedJobs = -(policy.effects.unemployment ?? 0);
  const expectedDebtImprovement = -(policy.effects.debt ?? 0);

  // Score only outcomes for which this policy has a stated expected direction.
  // A zero/near-zero observed movement is inconclusive, not automatic success.
  const signals = [
    { expected: expectedGrowth, observed: dg, weight: 0.35, deadband: 0.0005 },
    { expected: expectedInflation, observed: dpi, weight: 0.30, deadband: 0.0004 },
    { expected: expectedJobs, observed: -du, weight: 0.20, deadband: 0.0004 },
    { expected: expectedDebtImprovement, observed: -dd, weight: 0.15, deadband: 0.001 },
  ].filter(x => Math.abs(x.expected) > 0.00005);
  const totalWeight = signals.reduce((sum, x) => sum + x.weight, 0);
  const alignment = totalWeight === 0 ? 0 : signals.reduce((sum, x) => {
    if (Math.abs(x.observed) < x.deadband) return sum;
    return sum + x.weight * (Math.sign(x.observed) === Math.sign(x.expected) ? 1 : -1);
  }, 0) / totalWeight;

  const outcome: LearningReview['outcome'] =
    alignment > 0.25 ? 'favorable' : alignment < -0.25 ? 'unfavorable' : 'mixed';
  const elapsedQuarters = Math.max(0, after.turn - enactedTurn);
  const observedChanges = {
    growth: dg,
    inflation: dpi,
    unemployment: du,
    debt: dd,
    creditGrowth: after.creditGrowth - before.creditGrowth,
    investmentPct: before.investment === 0 ? 0 : ((after.investment / before.investment) - 1) * 100,
    consumptionPct: before.consumption === 0 ? 0 : ((after.consumption / before.consumption) - 1) * 100,
  };
  const lag = policyLag(policy.tab);

  const result =
    outcome === 'favorable'
      ? 'The first observed movements broadly match the policy’s stated direction. This is an encouraging signal, not proof that the policy caused every change.'
      : outcome === 'unfavorable'
      ? 'The first observed movements conflict with at least one stated policy objective. Check the transmission channel, implementation timing and unrelated shocks before repeating it.'
      : 'The first-quarter evidence is mixed or inconclusive. Policy trade-offs, delayed transmission and unrelated shocks can all explain why the indicators do not move together.';

  let mechanism = buildChannel(policy);
  if (policy.tab === 'Monetary') {
    mechanism = after.creditGrowth < before.creditGrowth
      ? 'Credit tightened, so financing-sensitive consumption and investment were restrained.'
      : 'Credit conditions remained supportive, allowing demand to transmit through households and firms.';
  } else if (policy.tab === 'Fiscal') {
    mechanism = after.growth > before.growth
      ? 'Demand support reached the economy through government demand and/or household disposable income.'
      : 'The fiscal impulse was not enough to overcome other drags on private demand.';
  } else if (policy.tab === 'Trade') {
    mechanism = after.firmSales > 94
      ? 'External demand and competitiveness supported firm sales and the real economy.'
      : 'The external channel did not translate into stronger firm sales this period.';
  }

  const nextStep =
    after.inflation > 0.06
      ? 'Do not judge the policy by GDP alone; inflation persistence is now the key constraint.'
      : after.unemployment > 0.08
      ? 'Watch employment and household income before withdrawing support too quickly.'
      : after.debtRatio > 0.90
      ? 'Fiscal space is becoming more important; compare the policy benefit with its financing cost.'
      : 'Advance another quarter before making a second intervention so the lagged effects can be observed.';

  return {
    policyId: policy.id,
    policyLabel: policy.label,
    policyTab: policy.tab,
    enactedTurn,
    observedTurn: after.turn,
    elapsedQuarters,
    observedChanges,
    channel: buildChannel(policy),
    lagQuarters: lag,
    outcome,
    result,
    mechanism,
    tradeoff: policy.tradeoff,
    nextStep,
  };
}
