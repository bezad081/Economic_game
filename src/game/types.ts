export type Tab = 'Monetary' | 'Fiscal' | 'Structural' | 'Trade' | 'Emergency' | 'Advisor';
export type GameMode = 'mission' | 'sandbox';

export type FirmSector = 'Industry' | 'Services' | 'Technology' | 'Construction' | 'Export' | 'Energy';

export interface FirmState {
  id: string;
  name: string;
  sector: FirmSector;
  employees: number;
  wage: number;
  productivity: number;
  cash: number;
  leverage: number;
  health: number;
  profit: number;
  investment: number;
}

export interface HouseholdCohort {
  id: 'lower' | 'middle' | 'upper';
  label: string;
  populationShare: number;
  income: number;
  wealth: number;
  consumption: number;
  unemployment: number;
  sentiment: number;
}

export interface ElectionState {
  lastElectionTurn: number;
  nextElectionTurn: number;
  incumbentShare: number;
  oppositionShare: number;
  turnout: number;
  campaignActive: boolean;
  lastResult: string;
}

export interface CabinetAdvice {
  role: 'Central Bank' | 'Treasury' | 'Industry' | 'Social Affairs' | 'Energy';
  title: string;
  rationale: string;
  actionId?: string;
  urgency: number;
}

export type EffectKey =
  | 'growth' | 'inflation' | 'unemployment' | 'debt' | 'approval' | 'bank'
  | 'fx' | 'credit' | 'tech' | 'energy' | 'emissions' | 'housingSupply'
  | 'poverty' | 'inequality' | 'corruption' | 'treasury' | 'confidence' | 'fiscalDemand' | 'householdDemand';

export type Effects = Partial<Record<EffectKey, number>>;

export interface PolicySpec {
  id: string;
  label: string;
  tab: Exclude<Tab, 'Advisor'>;
  description: string;
  tradeoff: string;
  capacityCost: number;
  politicalCost: number;
  cooldown: number;
  duration: number;
  effects: Effects;
  /** Expected macro outcomes shown to the learner; actual simulation uses transmissionEffects when provided. */
  transmissionEffects?: Effects;
}

export interface ActiveImpulse {
  id: string;
  label: string;
  age: number;
  duration: number;
  lag?: number;
  effects: Effects;
}

export interface MacroEvent {
  id: string;
  kind: 'currency'|'banking'|'energy'|'global'|'housing'|'wages'|'debt'|'technology';
  title: string;
  description: string;
  severity: 1|2|3|4|5;
  startedTurn: number;
  deadlineTurn: number;
  responsePolicyIds: string[];
  responseLabel: string;
  learning: string;
  status: 'active'|'responded'|'expired';
  resolvedBy?: string;
  chainId?: string;
  parentEventId?: string;
  stage?: number;
  consequence?: string;
}


export interface NewsItem {
  id: string;
  period: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface HistoryPoint {
  period: string;
  gdp: number;
  consumption?: number;
  investment?: number;
  governmentSpending?: number;
  netExports?: number;
  householdIncome?: number;
  householdSavings?: number;
  firmSales?: number;
  firmInvestment?: number;
  capacityUtilization?: number;
  growth: number;
  inflation: number;
  coreInflation?: number;
  unemployment: number;
  wageGrowth?: number;
  debt: number;
  approval: number;
  fci: number;
  poverty: number;
  housingAffordability: number;
  bankHealth: number;
  macroRisk: number;
  exchangeRate?: number;
  outputGap?: number;
  sovereignSpread?: number;
  incumbentShare: number;
  turnout: number;
}

export interface AdvisorRecommendation {
  id: string;
  why: string;
  watch: string;
  policy: PolicySpec;
  score?: number;
  confidence?: number;
  tradeoff?: string;
  expected?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  deadline: number;
  progress: number;
  targetText: string;
}

export interface EconomySnapshot {
  year: number;
  quarter: number;
  turn: number;
  mode: GameMode;
  realGDP: number;
  potentialGDP: number;
  consumption: number;
  investment: number;
  governmentSpending: number;
  netExports: number;
  householdIncome: number;
  householdSavings: number;
  firmSales: number;
  firmInvestment: number;
  capacityUtilization: number;
  growth: number;
  inflation: number;
  coreInflation: number;
  inflationExpected: number;
  wageGrowth: number;
  realWageGrowth: number;
  unemployment: number;
  outputGap: number;
  policyRate: number;
  realRate: number;
  credibility: number;
  debtRatio: number;
  primaryBalance: number;
  fiscalDemand: number;
  sovereignSpread: number;
  treasury: number;
  fxReserves: number;
  currentAccount: number;
  approval: number;
  politicalCapital: number;
  policyCapacity: number;
  bankHealth: number;
  creditGrowth: number;
  exchangeRate: number;
  housingIndex: number;
  housingAffordability: number;
  poverty: number;
  inequality: number;
  technology: number;
  productivity: number;
  energySecurity: number;
  emissions: number;
  corruption: number;
  businessConfidence: number;
  consumerConfidence: number;
  exports: number;
  imports: number;
  fci: number;
  macroRisk: number;
  regime: string;
  nationalScore: number;
  missionScore: number;
  missionsCompleted: number;
  activeMission: Mission | null;
  activeEvents: MacroEvent[];
  eventHistory: MacroEvent[];
  impulses: ActiveImpulse[];
  cooldowns: Record<string, number>;
  news: NewsItem[];
  history: HistoryPoint[];
  lastPolicy: string;
  lastQuarterSummary: string;
  lastLearningNote: string;
  firms: FirmState[];
  households: HouseholdCohort[];
  election: ElectionState;
  bankruptcies: number;
  firmBirths: number;
  totalEmployment: number;
  averageWage: number;
}
