import type { EconomySnapshot, EffectKey, PolicySpec } from './types';

export type Tone='good'|'warn'|'bad'|'neutral';
export type Driver={label:string;value:string;impact:number;note:string};

export function pct(x:number,d=1){return `${(x*100).toFixed(d)}%`}
export function pp(x:number,d=1){return `${x>=0?'+':''}${(x*100).toFixed(d)}pp`}
export function signed(x:number,d=1){return `${x>=0?'+':''}${x.toFixed(d)}`}

export function metricTone(key:string,e:EconomySnapshot):Tone{
  if(key==='inflation') return e.inflation>.065?'bad':e.inflation>.042?'warn':'good';
  if(key==='growth') return e.growth<0?'bad':e.growth<.015?'warn':'good';
  if(key==='unemployment') return e.unemployment>.085?'bad':e.unemployment>.065?'warn':'good';
  if(key==='debt') return e.debtRatio>.95?'bad':e.debtRatio>.75?'warn':'good';
  if(key==='bank') return e.bankHealth<.5?'bad':e.bankHealth<.68?'warn':'good';
  if(key==='fx') return e.exchangeRate>1.25?'bad':e.exchangeRate>1.1?'warn':'good';
  if(key==='approval') return e.approval<.4?'bad':e.approval<.52?'warn':'good';
  if(key==='risk') return e.macroRisk>60?'bad':e.macroRisk>35?'warn':'good';
  return 'neutral';
}

export function inflationDrivers(e:EconomySnapshot):Driver[]{
  return [
    {label:'Demand / output gap',value:pct(e.outputGap),impact:clamp(e.outputGap/.06,-1,1),note:e.outputGap>0?'Demand is above estimated capacity':'Demand is below capacity'},
    {label:'Expectations',value:pct(e.inflationExpected),impact:clamp((e.inflationExpected-.025)/.05,-1,1),note:`Credibility ${(e.credibility*100).toFixed(0)}/100`},
    {label:'Wages',value:pct(e.wageGrowth),impact:clamp((e.wageGrowth-.035)/.06,-1,1),note:`Real wage ${pct(e.realWageGrowth)}`},
    {label:'Imported prices',value:`FX ${e.exchangeRate.toFixed(2)}`,impact:clamp((e.exchangeRate-1)/.35,-1,1),note:`Energy security ${(e.energySecurity*100).toFixed(0)}/100`}
  ];
}

export function growthDrivers(e:EconomySnapshot):Driver[]{
  return [
    {label:'Consumer demand',value:`${(e.consumerConfidence*100).toFixed(0)}`,impact:clamp((e.consumerConfidence-.55)/.3,-1,1),note:'Household confidence'},
    {label:'Business demand',value:`${(e.businessConfidence*100).toFixed(0)}`,impact:clamp((e.businessConfidence-.55)/.3,-1,1),note:'Investment confidence'},
    {label:'Credit impulse',value:pct(e.creditGrowth),impact:clamp((e.creditGrowth-.02)/.10,-1,1),note:`FCI ${e.fci.toFixed(0)}`},
    {label:'Productive capacity',value:e.technology.toFixed(0),impact:clamp((e.technology-70)/30,-1,1),note:`Productivity ${e.productivity.toFixed(2)}`}
  ];
}

export function fiscalDrivers(e:EconomySnapshot):Driver[]{
  return [
    {label:'Primary balance',value:pct(e.primaryBalance),impact:clamp(e.primaryBalance/.08,-1,1),note:e.primaryBalance<0?'Deficit adds to debt':'Surplus reduces debt'},
    {label:'Growth effect',value:pct(e.growth),impact:clamp((e.growth-.015)/.08,-1,1),note:'Nominal denominator support'},
    {label:'Funding spread',value:pct(e.sovereignSpread),impact:-clamp((e.sovereignSpread-.008)/.07,-1,1),note:'Sovereign risk premium'},
    {label:'Treasury buffer',value:e.treasury.toFixed(0),impact:clamp((e.treasury-15)/30,-1,1),note:'Near-term fiscal room'}
  ];
}

export function financialDrivers(e:EconomySnapshot):Driver[]{
  return [
    {label:'Bank health',value:`${(e.bankHealth*100).toFixed(0)}/100`,impact:clamp((e.bankHealth-.6)/.35,-1,1),note:'Intermediation capacity'},
    {label:'Credit growth',value:pct(e.creditGrowth),impact:clamp((e.creditGrowth-.02)/.12,-1,1),note:'Lending impulse'},
    {label:'Real policy rate',value:pct(e.realRate),impact:-clamp((e.realRate-.01)/.07,-1,1),note:'Demand restraint'},
    {label:'FX reserves',value:e.fxReserves.toFixed(0),impact:clamp((e.fxReserves-20)/35,-1,1),note:'External liquidity buffer'}
  ];
}

export function policyPath(policy?:PolicySpec|null){
  if(!policy) return ['Policy instrument','Financial conditions','Demand / supply','Output & jobs','Inflation / welfare'];
  const e=policy.effects;
  const first=policy.tab==='Monetary'?'Rates / liquidity':policy.tab==='Fiscal'?'Budget / taxes':policy.tab==='Structural'?'Capacity reform':policy.tab==='Trade'?'External sector':'Emergency response';
  const second=(e.credit??0)!==0?'Credit & asset prices':(e.fx??0)!==0?'FX & imported prices':(e.tech??0)!==0?'Productivity & capacity':(e.debt??0)!==0?'Fiscal space':'Confidence & demand';
  const third=(e.growth??0)!==0?'Aggregate demand / output':(e.bank??0)!==0?'Bank transmission':(e.housingSupply??0)!==0?'Housing supply':'Private behavior';
  const fourth=(e.unemployment??0)!==0?'Employment & wages':(e.inflation??0)!==0?'Prices & expectations':'Potential output';
  const fifth=(e.approval??0)!==0?'Welfare & political support':(e.debt??0)!==0?'Debt sustainability':'Macro stability';
  return [first,second,third,fourth,fifth];
}

export function policyImpactSummary(p:PolicySpec){
  const names:Partial<Record<EffectKey,string>>={growth:'Growth',inflation:'Inflation',unemployment:'Joblessness',debt:'Debt',approval:'Approval',bank:'Bank health',fx:'FX index',credit:'Credit',tech:'Technology',energy:'Energy',poverty:'Poverty',confidence:'Confidence'};
  return Object.entries(p.effects).filter(([k,v])=>names[k as EffectKey]&&Math.abs(Number(v))>.001).slice(0,5).map(([k,v])=>({label:names[k as EffectKey]!,dir:Number(v)>0?'up':'down'}));
}

export function riskSignals(e:EconomySnapshot){
  return [
    {label:'Inflation persistence',value:clamp((e.coreInflation-.025)/.08,0,1),detail:`Core ${pct(e.coreInflation)}`},
    {label:'Labor stress',value:clamp((e.unemployment-.045)/.15,0,1),detail:`Jobless ${pct(e.unemployment)}`},
    {label:'Fiscal stress',value:clamp((e.debtRatio-.60)/1.0,0,1),detail:`Debt ${pct(e.debtRatio)}`},
    {label:'Financial stress',value:clamp(1-e.bankHealth,0,1),detail:`Banks ${(e.bankHealth*100).toFixed(0)}`},
    {label:'External stress',value:clamp(Math.max(0,e.exchangeRate-1)/1.0 + Math.max(0,20-e.fxReserves)/40,0,1),detail:`FX ${e.exchangeRate.toFixed(2)}`},
  ];
}

export function regimeNarrative(e:EconomySnapshot){
  if(e.regime==='Stagflation') return 'Supply pressure and weak activity are colliding. Demand management alone will not solve both objectives.';
  if(e.regime==='Recession') return 'Demand is weak and labor slack is rising. Protect viable activity while watching inflation credibility.';
  if(e.regime==='Overheating') return 'Demand is running ahead of capacity. Stabilization now can reduce the risk of a harder landing later.';
  if(e.regime==='Financial Stress') return 'The banking channel is impaired. Repair intermediation before expecting ordinary policy transmission.';
  if(e.regime==='Strong Expansion') return 'Growth is strong. Use the window to rebuild buffers and expand productive capacity.';
  return 'The economy is broadly balanced. The main challenge is improving capacity without creating new imbalances.';
}

function clamp(x:number,a:number,b:number){return Math.max(a,Math.min(b,x))}
