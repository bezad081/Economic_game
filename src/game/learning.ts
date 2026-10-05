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

  const alignment =
    0.35 * Math.sign(dg || expectedGrowth) * Math.sign(expectedGrowth || dg) +
    0.30 * Math.sign(dpi || expectedInflation) * Math.sign(expectedInflation || dpi) +
    0.20 * Math.sign(-du || expectedJobs) * Math.sign(expectedJobs || -du) +
    0.15 * Math.sign(-dd || -(policy.effects.debt ?? 0)) * Math.sign(-(policy.effects.debt ?? 0) || -dd);

  const outcome: LearningReview['outcome'] = alignment > 0.35 ? 'favorable' : alignment < -0.15 ? 'unfavorable' : 'mixed';
  const lag = policyLag(policy.tab);

  const result =
    outcome === 'favorable'
      ? 'The observed movement is broadly consistent with the policy objective, although the trade-off still matters.'
      : outcome === 'unfavorable'
      ? 'The policy moved at least one key outcome in an adverse direction. Check the transmission channel before repeating it.'
      : 'The policy produced a mixed outcome. One objective improved while another cost increased, which is the normal policy problem.';

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
    channel: buildChannel(policy),
    lagQuarters: lag,
    outcome,
    result,
    mechanism,
    tradeoff: policy.tradeoff,
    nextStep,
  };
}
