import type { EconomySnapshot } from './types';

export interface CrisisScenario {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  stats: { inflation: string; unemployment: string; growth: string };
}

export const CRISIS_SCENARIOS: CrisisScenario[] = [
  { id: 'stagflation', title: 'Stagflation trap', subtitle: 'Prices high · jobs weak', description: 'Reduce inflation without deepening the employment crisis.', stats: { inflation: '8.4%', unemployment: '10.4%', growth: '0.6%' } },
  { id: 'recession', title: 'Deep recession', subtitle: 'Demand collapse · mass unemployment', description: 'Restore demand and jobs while keeping debt and inflation manageable.', stats: { inflation: '2.5%', unemployment: '13.0%', growth: '-3.5%' } },
  { id: 'banking', title: 'Banking panic', subtitle: 'Credit frozen · confidence falling', description: 'Stabilize banks and restart credit without creating reckless moral hazard.', stats: { inflation: '4.5%', unemployment: '9.0%', growth: '-2.0%' } },
  { id: 'debt', title: 'Sovereign debt crisis', subtitle: 'High debt · expensive financing', description: 'Restore fiscal credibility without triggering a destructive contraction.', stats: { inflation: '5.5%', unemployment: '9.0%', growth: '0.5%' } },
  { id: 'energy', title: 'Energy supply shock', subtitle: 'Costs surge · capacity constrained', description: 'Protect production and households without turning a supply shock into persistent inflation.', stats: { inflation: '9.5%', unemployment: '7.6%', growth: '0.2%' } },
];

export function applyCrisisScenario(s: EconomySnapshot, id: string): void {
  // Reset common scenario state so every briefing begins from a clean, reproducible baseline.
  s.scenarioId = id;
  s.history = [];
  s.news = [];
  s.activeEvents = [];
  s.eventHistory = [];
  s.impulses = [];
  s.cooldowns = {};
  s.turn = 0;
  s.year = 2027;
  s.quarter = 1;
  s.missionsCompleted = 0;
  s.missionScore = 0;
  s.pendingPolicy = null;
  s.lastLearningReview = null;
  s.lastPolicy = 'No policy enacted yet.';
  s.nationalScore = 45;
  s.realGDP = 982;
  s.potentialGDP = 1000;
  s.outputGap = -0.018;
  s.growth = 0.006;
  s.inflation = 0.084;
  s.coreInflation = 0.076;
  s.inflationExpected = 0.071;
  s.wageGrowth = 0.082;
  s.realWageGrowth = s.wageGrowth - s.inflation;
  s.unemployment = 0.104;
  s.policyRate = 0.052;
  s.realRate = s.policyRate - s.inflationExpected;
  s.debtRatio = 0.61;
  s.primaryBalance = -0.035;
  s.sovereignSpread = 0.012;
  s.treasury = 20;
  s.bankHealth = 0.72;
  s.creditGrowth = 0.01;
  s.consumerConfidence = 0.42;
  s.businessConfidence = 0.45;
  s.approval = 0.38;
  s.fci = 63;
  s.macroRisk = 27;
  s.regime = 'Stagflation';
  s.lastLearningNote = 'Prices are rising while jobs are scarce. Balance stabilization with the risk of weakening activity further.';

  if (id === 'recession') {
    s.realGDP = 940; s.potentialGDP = 1000; s.outputGap = -0.06; s.growth = -0.035;
    s.exports = 86; s.imports = 94; s.firmSales = 79; s.firmInvestment = 2.4; s.investment = 175; s.energySecurity = 0.68;
    s.inflation = 0.025; s.coreInflation = 0.027; s.inflationExpected = 0.028; s.wageGrowth = 0.018; s.realWageGrowth = -0.007;
    s.unemployment = 0.13; s.policyRate = 0.025; s.realRate = -0.003; s.debtRatio = 0.64; s.primaryBalance = -0.04;
    s.sovereignSpread = 0.018; s.treasury = 16; s.bankHealth = 0.66; s.creditGrowth = -0.025;
    s.consumerConfidence = 0.28; s.businessConfidence = 0.31; s.approval = 0.34; s.fci = 72; s.macroRisk = 35; s.regime = 'Recession';
    s.lastLearningNote = 'Demand has collapsed and unemployment is very high. Support activity, but monitor debt sustainability and the risk of poorly targeted stimulus.';
  } else if (id === 'banking') {
    s.realGDP = 965; s.potentialGDP = 1000; s.outputGap = -0.035; s.growth = -0.02;
    s.inflation = 0.045; s.coreInflation = 0.041; s.inflationExpected = 0.043; s.wageGrowth = 0.035; s.realWageGrowth = -0.01;
    s.unemployment = 0.09; s.policyRate = 0.045; s.realRate = 0.002; s.debtRatio = 0.68; s.primaryBalance = -0.032;
    s.sovereignSpread = 0.025; s.treasury = 14; s.bankHealth = 0.34; s.creditGrowth = -0.045;
    s.exports = 103; s.imports = 106; s.firmSales = 82; s.firmInvestment = 2.8; s.investment = 183;
    s.consumerConfidence = 0.36; s.businessConfidence = 0.29; s.approval = 0.35; s.fci = 82; s.macroRisk = 49; s.regime = 'Financial Stress';
    s.lastLearningNote = 'Bank balance sheets are impaired and credit is contracting. Liquidity support alone may fail if banks are insolvent; watch lending, deposits and public contingent liabilities.';
  } else if (id === 'energy') {
    s.realGDP = 990; s.potentialGDP = 1000; s.outputGap = -0.01; s.growth = 0.002;
    s.exports = 110; s.imports = 108; s.firmInvestment = 3.5; s.investment = 205;
    s.inflation = 0.095; s.coreInflation = 0.061; s.inflationExpected = 0.064; s.wageGrowth = 0.058;
    s.unemployment = 0.076; s.policyRate = 0.052; s.realRate = s.policyRate - s.inflationExpected;
    s.debtRatio = 0.59; s.primaryBalance = -0.031; s.energySecurity = 0.27; s.emissions = 108;
    s.firmSales = 88; s.capacityUtilization = 0.84; s.businessConfidence = 0.43; s.consumerConfidence = 0.44;
    s.approval = 0.36; s.fci = 67; s.macroRisk = 42; s.regime = 'Energy Supply Shock';
    s.lastLearningNote = 'An energy supply disruption is pushing up costs while constraining output. Targeted relief and supply resilience can help, but broad demand stimulus may add inflation pressure.';
  } else if (id === 'debt') {
    s.realGDP = 990; s.potentialGDP = 1000; s.outputGap = -0.01; s.growth = 0.005;
    s.exports = 109; s.imports = 111; s.firmSales = 91; s.firmInvestment = 3.3; s.investment = 195;
    s.inflation = 0.055; s.coreInflation = 0.052; s.inflationExpected = 0.054; s.wageGrowth = 0.061; s.realWageGrowth = 0.006;
    s.unemployment = 0.09; s.policyRate = 0.065; s.realRate = 0.011; s.debtRatio = 0.94; s.primaryBalance = -0.055;
    s.sovereignSpread = 0.047; s.treasury = 7; s.bankHealth = 0.58; s.creditGrowth = -0.01;
    s.consumerConfidence = 0.37; s.businessConfidence = 0.40; s.approval = 0.31; s.fci = 78; s.macroRisk = 58; s.regime = 'Debt Crisis';
    s.lastLearningNote = 'High debt and sovereign spreads threaten refinancing. Credible medium-term adjustment matters, but abrupt cuts can depress GDP and worsen the debt ratio denominator.';
  }

  s.realWageGrowth = s.wageGrowth - s.inflation;
  s.realRate = s.policyRate - s.inflationExpected;
  s.netExports = s.exports - s.imports;
  s.currentAccount = s.netExports / Math.max(1, s.realGDP);
  s.consumption = s.realGDP * 0.61;
  s.investment = s.realGDP * 0.21;
  s.governmentSpending = s.realGDP - s.consumption - s.investment - s.netExports;
  s.activeMission = null;
}
