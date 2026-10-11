import type { EconomySnapshot } from './types';

export interface StrategicBrief {
  diagnosis: string;
  priority: string;
  avoid: string;
  horizon: string;
  learning: string;
  focus: string;
}

/** A transparent, rule-based coaching layer: it explains priorities rather than pretending to forecast with certainty. */
export function strategicBrief(e: EconomySnapshot): StrategicBrief {
  const crisis = e.activeEvents
    .filter(event => event.status === 'active')
    .sort((a, b) => b.severity - a.severity)[0];

  let diagnosis = 'Several pressures are interacting';
  let priority = 'Compare demand, supply, finance and fiscal space, then address the binding constraint first.';
  let avoid = 'Avoid stacking several large policies before the previous policy has had time to transmit.';
  let horizon = 'Near term: 1–2 quarters · Structural effects: several quarters';
  let focus = 'Identify which constraint is preventing the economy from improving.';

  if (crisis && crisis.severity >= 4) {
    diagnosis = `Crisis first: ${crisis.title}`;
    priority = crisis.responseLabel + '. Treat the event as a constraint on ordinary policy choices.';
    avoid = `Do not ignore the event deadline; an unresolved shock can trigger a follow-up crisis. Also watch ${e.inflation > .06 ? 'inflation' : e.debtRatio > .8 ? 'fiscal costs' : 'jobs and financial stability'}.`;
    focus = crisis.consequence || crisis.learning || 'Resolve the active shock while limiting spillovers.';
  } else if (e.energySecurity < .55) {
    diagnosis = 'Supply capacity is the binding constraint';
    priority = 'Restore reliable energy and protect essential production; use targeted relief where possible.';
    avoid = 'Broad demand stimulus may raise prices without generating much extra output while energy is scarce.';
    horizon = 'Relief: near term · Supply resilience: medium term';
    focus = 'Check energy security, capacity utilization and inflation together.';
  } else if (e.bankHealth < .55) {
    diagnosis = 'Credit transmission is impaired';
    priority = 'Repair bank intermediation and keep viable firms connected to credit.';
    avoid = 'Do not assume that lower rates alone will restart lending when bank balance sheets are weak.';
    horizon = 'Liquidity: near term · Bank repair and credit recovery: several quarters';
    focus = 'Track bank health and credit growth together, not the policy rate alone.';
  } else if (e.inflation >= .06 && e.unemployment >= .075) {
    diagnosis = 'Stagflation: price stability and jobs conflict';
    priority = 'Favor measures that relieve supply bottlenecks and protect vulnerable households without broadly overheating demand.';
    avoid = 'Avoid treating this as a simple demand recession: broad stimulus may intensify inflation.';
    focus = 'Monitor inflation, unemployment and real wage growth together.';
  } else if (e.debtRatio > .85 || e.sovereignSpread > .055) {
    diagnosis = 'Fiscal space is under pressure';
    priority = 'Build a credible medium-term primary-balance path while protecting high-value productive investment.';
    avoid = 'Avoid abrupt cuts that damage growth, and avoid unfunded broad stimulus that further weakens credibility.';
    focus = 'Compare the primary balance, sovereign spread and GDP growth.';
  } else if (e.outputGap < -.04 || (e.growth < 0 && e.unemployment > .07)) {
    diagnosis = 'Demand weakness and spare capacity dominate';
    priority = 'Support demand and employment where inflation and fiscal room allow, then reassess after the transmission lag.';
    avoid = 'Do not withdraw support just because the first quarter looks noisy; but avoid repeated stimulus without checking inflation and debt.';
    focus = 'Check output gap, unemployment, credit growth and inflation.';
  } else if (e.inflation > .055) {
    diagnosis = 'Persistent inflation is the main constraint';
    priority = 'Identify whether demand, supply costs or expectations are driving prices before choosing a broad instrument.';
    avoid = 'Avoid judging success by GDP growth alone while purchasing power is eroding.';
    focus = 'Track core inflation, real wages and capacity utilization.';
  }

  const review = e.lastLearningReview;
  const learning = review
    ? `Last review: ${review.policyLabel} was ${review.outcome}. ${review.result} Use this as a signal, not proof of causality.`
    : 'No completed policy review yet. Record a decision, wait for its indicative lag, then compare observed outcomes with the original objective.';

  return { diagnosis, priority, avoid, horizon, learning, focus };
}
