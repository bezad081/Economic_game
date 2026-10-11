import type { EconomySnapshot, PolicySpec } from './types';

export interface PolicyPreviewGuidance {
  objective: string;
  likelyUpside: string;
  mainRisk: string;
  watch: string;
  fit: 'strong' | 'conditional' | 'weak';
  fitLabel: string;
}

/**
 * Beginner-facing interpretation of a counterfactual, not a promise or calibrated forecast.
 * Scenario fit is qualitative and deliberately keeps benefits and risks visible together.
 */
export function policyPreviewGuidance(policy: PolicySpec, s: EconomySnapshot): PolicyPreviewGuidance {
  const id = s.scenarioId;
  if (id === 'recession') {
    if (['stimulus','welfare_up','income_tax_down','rate_down','export_support','sme_credit'].includes(policy.id)) {
      return { objective:'Close the demand shortfall and protect jobs.', likelyUpside:'Spare capacity is high, so additional demand is more likely to lift real output and employment before it mainly raises prices.', mainRisk:'Debt, treasury capacity or financial fragility can still limit how long support is sustainable.', watch:'GDP growth, unemployment, output gap, primary balance and inflation.', fit:'strong', fitLabel:'Good fit for this crisis' };
    }
    if (['austerity','rate_up','income_tax_up','reserve_up'].includes(policy.id)) {
      return { objective:'Cool demand or repair balances.', likelyUpside:'May reduce inflation or improve near-term fiscal/credit restraint.', mainRisk:'Demand is already weak; further restraint can deepen unemployment and reduce the GDP denominator.', watch:'Unemployment, GDP growth, debt-to-GDP and primary balance.', fit:'weak', fitLabel:'High risk in this crisis' };
    }
  }
  if (id === 'energy') {
    if (['energy_subsidy','infra_up','food_subsidy','food_reserve','business_reform','port_upgrade'].includes(policy.id)) {
      return { objective:'Relieve the supply bottleneck and protect essential activity.', likelyUpside:'Targeted relief can cushion households while resilience and capacity measures address the source of lost output.', mainRisk:'Relief costs money; infrastructure and supply-side reforms take time, and broad subsidies can weaken conservation incentives.', watch:'Energy security, capacity utilization, inflation, real wages and treasury.', fit:'strong', fitLabel:'Addresses the supply shock' };
    }
    if (['stimulus','income_tax_down','rate_down'].includes(policy.id)) {
      return { objective:'Support demand while production is constrained.', likelyUpside:'May cushion household spending and prevent an unnecessarily sharp slowdown.', mainRisk:'When energy limits supply, extra demand can pass into prices more than output.', watch:'Inflation, energy security, capacity utilization and real wage growth.', fit:'weak', fitLabel:'Inflation trade-off is high' };
    }
  }
  if (id === 'banking') {
    if (['bank_recap','sme_credit','qe','reserve_down','macroprudential'].includes(policy.id)) {
      return { objective:'Restore sound credit intermediation.', likelyUpside:'A stronger banking channel can help viable firms retain working capital and restart investment.', mainRisk:'Liquidity alone cannot repair insolvent banks; public support can create fiscal costs or moral hazard.', watch:'Bank health, credit growth, firm investment, sovereign spread and treasury.', fit:'strong', fitLabel:'Targets financial stress' };
    }
    if (['rate_down','stimulus'].includes(policy.id)) {
      return { objective:'Support activity despite impaired credit transmission.', likelyUpside:'Can help demand and financing conditions at the margin.', mainRisk:'Weak banks may not pass easier policy into new lending, so the output response may disappoint.', watch:'Bank health, credit growth, firm investment and unemployment.', fit:'conditional', fitLabel:'Depends on credit transmission' };
    }
  }
  if (id === 'debt') {
    if (['austerity','business_reform','anti_corruption','income_tax_up'].includes(policy.id)) {
      return { objective:'Improve fiscal credibility and the economy’s capacity to service debt.', likelyUpside:'A more credible primary balance or stronger confidence can ease refinancing pressure over time.', mainRisk:'Abrupt consolidation can suppress growth; if GDP falls sharply, the debt ratio may not improve as expected.', watch:'Primary balance, sovereign spread, GDP growth, debt ratio and unemployment.', fit:'strong', fitLabel:'Supports fiscal repair' };
    }
    if (['stimulus','income_tax_down','welfare_up'].includes(policy.id)) {
      return { objective:'Support households or demand during a debt crisis.', likelyUpside:'May cushion incomes and prevent a deeper contraction if support is targeted.', mainRisk:'With limited fiscal space and high spreads, unfunded measures can raise refinancing risk.', watch:'Sovereign spread, treasury, primary balance, debt ratio and poverty.', fit:'conditional', fitLabel:'Fiscal space is limited' };
    }
  }
  if (id === 'stagflation') {
    if (['rate_up','food_subsidy','food_reserve','business_reform','infra_up'].includes(policy.id)) {
      return { objective:'Reduce persistent inflation without needlessly damaging productive capacity.', likelyUpside:'The policy can address price pressure, protect vulnerable households or improve supply over time.', mainRisk:'Disinflation may weaken credit, hiring or investment; supply-side gains can arrive slowly.', watch:'Core inflation, inflation expectations, unemployment, real wages and output gap.', fit:'conditional', fitLabel:'Potentially useful with trade-offs' };
    }
  }
  const tabGuidance: Record<string, {objective:string;upside:string;risk:string;watch:string}> = {
    Monetary: { objective:'Change financial conditions and the path of credit.', upside:'The main channel runs through lending, confidence, consumption and investment.', risk:'Transmission depends on bank health and can affect output with a delay.', watch:'Bank health, credit growth, investment, inflation and unemployment.' },
    Fiscal: { objective:'Change public demand, household disposable income or the primary balance.', upside:'Fiscal measures can reach demand directly or cushion vulnerable households.', risk:'Treasury room and debt sustainability constrain repeated support.', watch:'Treasury, primary balance, debt ratio, growth and poverty.' },
    Structural: { objective:'Improve productive capacity, institutions or long-run productivity.', upside:'Benefits may raise potential output and resilience beyond the immediate quarter.', risk:'Implementation is slow and transition costs can appear before benefits.', watch:'Productivity, firm investment, capacity utilization, wages and debt.' },
    Trade: { objective:'Change external competitiveness and supply-chain conditions.', upside:'Trade measures can support exporters or lower imported input costs.', risk:'Exchange-rate, import-price and retaliation effects may offset gains.', watch:'Exports, imports, current account, exchange rate and inflation.' },
    Emergency: { objective:'Contain immediate damage from a shock.', upside:'Targeted action can protect essential supply, financial stability or household welfare.', risk:'Temporary relief can be expensive or delay needed adjustment.', watch:'The active shock, treasury, inflation, employment and the relevant sector indicator.' }
  };
  const g = tabGuidance[policy.tab];
  return { objective:g.objective, likelyUpside:g.upside, mainRisk:policy.tradeoff || g.risk, watch:g.watch, fit:'conditional', fitLabel:'Review the trade-off' };
}
