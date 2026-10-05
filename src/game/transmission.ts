import type { Effects, EconomySnapshot, Tab } from './types';
import { TRANSMISSION } from './parameters';

export interface TransmissionResult {
  credit: number;
  consumption: number;
  investment: number;
  government: number;
  demandGrowth: number;
  outputGrowth: number;
  explanation: string[];
}

export function policyLag(tab: Exclude<Tab,'Advisor'>): number {
  return TRANSMISSION.lags[tab];
}

/**
 * Converts policy impulses into intermediate channels and downstream demand effects.
 * The simulation remains stylized; this function is deliberately explicit so learners
 * can inspect the mechanism rather than seeing unexplained direct GDP changes.
 */
export function transmitDemand(s: EconomySnapshot, imp: Effects): TransmissionResult {
  const credit = (imp.credit ?? 0) * TRANSMISSION.monetary.creditPassThrough;
  const confidence = imp.confidence ?? 0;
  const fiscal = imp.fiscalDemand ?? 0;

  const consumption =
    credit * TRANSMISSION.monetary.consumptionFromCredit +
    confidence * TRANSMISSION.monetary.confidenceToConsumption +
    fiscal * TRANSMISSION.fiscal.incomeToConsumption;

  const investment =
    credit * TRANSMISSION.monetary.investmentFromCredit +
    confidence * TRANSMISSION.monetary.confidenceToInvestment +
    fiscal * TRANSMISSION.firms.capacityToInvestment +
    (s.firmSales - TRANSMISSION.firms.salesToInvestment * 0 + 0) * 0;

  const government = fiscal * TRANSMISSION.fiscal.demandImpulseToGovernment;

  const demandGrowth =
    0.61 * consumption +
    0.21 * investment +
    0.19 * government;

  const outputGrowth =
    TRANSMISSION.monetary.demandToOutput * demandGrowth;

  const explanation:string[]=[];
  if (Math.abs(credit) > 0.0001) explanation.push('Credit conditions → household spending and firm investment');
  if (Math.abs(confidence) > 0.0001) explanation.push('Confidence → consumption and investment plans');
  if (Math.abs(fiscal) > 0.0001) explanation.push('Fiscal impulse → government demand → aggregate demand');
  if (!explanation.length) explanation.push('No material policy impulse is currently passing through demand');

  return {credit,consumption,investment,government,demandGrowth,outputGrowth,explanation};
}
