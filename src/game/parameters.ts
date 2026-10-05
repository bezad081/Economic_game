/** Stylized parameters used by the teaching simulation. These are calibration choices, not empirical estimates. */
export const MACRO = {
  anchorInflation: 0.025,
  neutralPolicyRate: 0.04,
  neutralRealRate: 0.012,
  neutralCreditGrowth: 0.03,
  neutralConfidence: 0.62,
  householdIncomeBase: 2.35,
  householdSavingsBase: 0.58,
  firmSalesBase: 94,
  capacityBase: 0.78,
} as const;

export const TRANSMISSION = {
  monetary: {
    creditPassThrough: 0.70,
    consumptionFromCredit: 0.020,
    investmentFromCredit: 0.055,
    confidenceToConsumption: 0.055,
    confidenceToInvestment: 0.075,
    realRateConsumption: 0.018,
    realRateInvestment: 0.045,
    demandToOutput: 0.55,
  },
  fiscal: {
    demandImpulseToGovernment: 0.18,
    demandToOutput: 0.55,
    incomeToConsumption: 0.045,
    savingsToConsumption: 0.025,
  },
  firms: {
    capacityToInvestment: 0.018,
    salesToInvestment: 0.012,
  },
  households: {
    inflationPain: 1.35,
    unemploymentPain: 1.20,
  },
  lags: {
    Monetary: 1,
    Fiscal: 1,
    Trade: 2,
    Structural: 3,
    Emergency: 1,
  },
} as const;
