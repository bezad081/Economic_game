import type { EconomySnapshot, LearningReview, PolicySpec } from './types';
import { policyLag } from './transmission';
import { TRANSMISSION } from './parameters';

export function buildChannel(policy: PolicySpec): string {
  if (policy.tab === 'Monetary') return 'Interest rate / liquidity → real rate & credit → households and firms → demand → output, prices and jobs';
  if (policy.tab === 'Fiscal') return 'Budget / taxes → household or government demand → consumption & investment → output, prices and debt';
  if (policy.tab === 'Structural') return 'Reform → productivity / capacity → firm decisions → potential output → wages and prices';
  if (policy.tab === 'Trade') return 'Competitiveness → exports / imports → firm sales → output, FX and prices';
  return 'Emergency response → financial or household balance sheets → credit / demand → macro stability';
}

const sign = (x:number):number => Math.abs(x) < 1e-8 ? 0 : Math.sign(x);
const alignmentScore = (expected:number, observed:number, deadband:number):number => {
  if (Math.abs(expected) < 1e-8 || Math.abs(observed) < deadband) return 0;
  return sign(expected) === sign(observed) ? 1 : -1;
};

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
  // Grade the channels that the engine actually applies. Legacy policy.effects often
  // describe intended outcomes, while transmissionEffects are the impulses actually
  // passed through the simulation; mixing the two can falsely praise or blame a policy.
  const active = policy.transmissionEffects ?? policy.effects;
  const credit = active.credit ?? 0;
  const confidence = active.confidence ?? 0;
  const fiscal = active.fiscalDemand ?? 0;
  const household = active.householdDemand ?? 0;
  const expectedConsumption =
    credit * TRANSMISSION.monetary.consumptionFromCredit +
    confidence * TRANSMISSION.monetary.confidenceToConsumption +
    fiscal * TRANSMISSION.fiscal.incomeToConsumption +
    household * TRANSMISSION.monetary.householdDemandToConsumption;
  const expectedInvestment =
    credit * TRANSMISSION.monetary.investmentFromCredit +
    confidence * TRANSMISSION.monetary.confidenceToInvestment +
    fiscal * TRANSMISSION.firms.capacityToInvestment;
  const expectedGovernment = fiscal * TRANSMISSION.fiscal.demandImpulseToGovernment;
  const expectedDemand =
    0.61 * expectedConsumption + 0.21 * expectedInvestment + 0.19 * expectedGovernment;
  const signals = [
    { score: alignmentScore(expectedDemand, dg, 0.0005), weight: 0.35 },
    { score: alignmentScore(credit + (active.bank ?? 0) * 0.2, observedChanges.creditGrowth, 0.0005), weight: 0.25 },
    { score: alignmentScore(expectedInvestment, observedChanges.investmentPct, 0.03), weight: 0.20 },
    { score: alignmentScore(expectedConsumption, observedChanges.consumptionPct, 0.03), weight: 0.20 },
  ].filter(x => x.score !== 0);
  const totalWeight = signals.reduce((sum, x) => sum + x.weight, 0);
  const alignment = totalWeight === 0 ? 0 : signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalWeight;
  const outcome: LearningReview['outcome'] =
    alignment > 0.25 ? 'favorable' : alignment < -0.25 ? 'unfavorable' : 'mixed';
  const lag = policyLag(policy.tab);

  const result =
    outcome === 'favorable'
      ? 'The observed demand and credit channels broadly match the policy impulse. This is an encouraging signal, not proof that the policy caused every change.'
      : outcome === 'unfavorable'
      ? 'The observed demand or credit channels conflict with the policy impulse. Check the transmission channel, implementation timing and unrelated shocks before repeating it.'
      : 'The evidence is mixed or inconclusive. Small movements, policy trade-offs, delayed transmission and unrelated shocks can explain why indicators do not move together.';

  let mechanism = buildChannel(policy);
  if (Math.abs(credit) > 1e-8 && after.creditGrowth < before.creditGrowth) {
    mechanism = after.bankHealth < 0.55
      ? 'Credit contracted while bank health is weak, so impaired intermediation may be limiting the policy channel.'
      : 'Credit tightened, restraining financing-sensitive consumption and firm investment.';
  } else if (policy.tab === 'Fiscal') {
    mechanism = after.growth > before.growth
      ? 'Demand support may be reaching the economy through government demand and/or household disposable income.'
      : 'The fiscal impulse was not enough to overcome other drags on private demand.';
  } else if (policy.tab === 'Trade') {
    mechanism = 'Check export and import volumes, firm sales, the exchange rate and imported inflation together; one indicator alone is not enough to identify the trade-policy channel.';
  }

  const nextStep =
    elapsedQuarters < lag
      ? `This is an early signal: only ${elapsedQuarters} quarter(s) have passed against an indicative ${lag}-quarter lag. Monitor the relevant channel before making another large adjustment.`
      : after.inflation > 0.06
      ? 'Do not judge the policy by GDP alone; inflation persistence is now the key constraint.'
      : after.unemployment > 0.08
      ? 'Watch employment and household income before withdrawing support too quickly.'
      : after.debtRatio > 0.90
      ? 'Fiscal space is becoming more important; compare the policy benefit with its financing cost.'
      : 'Advance another quarter before making a second intervention so lagged effects can be observed.';

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
