import { POLICIES, policyById } from './policies';
import type { ActiveImpulse, AdvisorRecommendation, EconomySnapshot, Effects, GameMode, HistoryPoint, MacroEvent, Mission, NewsItem, PolicySpec } from './types';
import { cabinetAdvice, seedFirms, seedHouseholds, updateElection, updateMicroeconomy } from './micro';

const clamp = (x:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, x));
const add = (e:Effects, k:keyof Effects, v:number) => { e[k] = (e[k] ?? 0) + v; };
const periodLabel = (year:number, quarter:number) => `Q${quarter} ${year}`;

class RNG {
  constructor(public seed=987654321) {}
  next(){ this.seed = (1664525*this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  range(a:number,b:number){ return a + (b-a)*this.next(); }
}

const initial = (mode:GameMode):EconomySnapshot => ({
  year:2027, quarter:1, turn:0, mode,
  realGDP:1018, potentialGDP:1000, growth:.028,
  inflation:.034, coreInflation:.031, inflationExpected:.032, wageGrowth:.038, realWageGrowth:.004, unemployment:.055, outputGap:.018,
  policyRate:.045, realRate:.013, credibility:.74,
  debtRatio:.525, primaryBalance:-.018, fiscalDemand:0, sovereignSpread:.012, treasury:28, fxReserves:36, currentAccount:.010,
  approval:.56, politicalCapital:72, policyCapacity:100,
  bankHealth:.79, creditGrowth:.038, exchangeRate:1.0,
  housingIndex:100, housingAffordability:.72,
  poverty:.112, inequality:.36,
  technology:72, productivity:1.0, energySecurity:.73, emissions:100,
  corruption:.23, businessConfidence:.64, consumerConfidence:.62,
  exports:115, imports:105,
  fci:50, macroRisk:10, regime:'Balanced Expansion', nationalScore:62,
  missionScore:0, missionsCompleted:0,
  activeMission:null, activeEvents:[], eventHistory:[], impulses:[], cooldowns:{}, news:[], history:[],
  lastPolicy:'No policy enacted yet.', lastQuarterSummary:'Economy initialized.', lastLearningNote:'Start by reading the regime, risks and policy transmission map.',
  firms:seedFirms(), households:seedHouseholds(),
  election:{lastElectionTurn:0,nextElectionTurn:16,incumbentShare:.54,oppositionShare:.46,turnout:.68,campaignActive:false,lastResult:'No election held yet'},
  bankruptcies:0, firmBirths:0, totalEmployment:0, averageWage:1.0
});

export class EconomyEngine {
  state: EconomySnapshot;
  private rng: RNG;
  private missionHold = 0;

  constructor(mode:GameMode='sandbox', saved?:EconomySnapshot) {
    this.state = saved ? structuredClone(saved) : initial(mode);
    if(!this.state.firms) this.state.firms=seedFirms();
    if(!this.state.households) this.state.households=seedHouseholds();
    if(!this.state.election) this.state.election={lastElectionTurn:0,nextElectionTurn:16,incumbentShare:.54,oppositionShare:.46,turnout:.68,campaignActive:false,lastResult:'No election held yet'};
    this.state.bankruptcies ??= 0; this.state.firmBirths ??= 0; this.state.totalEmployment ??= 0; this.state.averageWage ??= 1;
    this.state.fiscalDemand ??= 0;
    this.state.coreInflation ??= this.state.inflation*.9; this.state.wageGrowth ??= this.state.inflationExpected+.006; this.state.realWageGrowth ??= this.state.wageGrowth-this.state.inflation; this.state.outputGap ??= this.state.realGDP/this.state.potentialGDP-1;
    this.state.credibility ??= .72; this.state.sovereignSpread ??= .012; this.state.fxReserves ??= 36; this.state.currentAccount ??= (this.state.exports-this.state.imports)/Math.max(1,this.state.realGDP); this.state.activeEvents ??= []; this.state.eventHistory ??= []; this.state.lastLearningNote ??= 'Read the macro regime before choosing a policy.';
    if(this.state.totalEmployment<=0){ this.state.totalEmployment=this.state.firms.reduce((a,f)=>a+f.employees,0); this.state.averageWage=this.state.firms.reduce((a,f)=>a+f.employees*f.wage,0)/Math.max(1,this.state.totalEmployment); }
    this.rng = new RNG(20271001 + this.state.turn*97);
    if (!this.state.activeMission && mode === 'mission') this.state.activeMission = this.chooseMission();
    if (!this.state.news.length) {
      this.pushNews('MACROSTATE initialized. Markets are open and the cabinet is in session.', 'neutral');
      this.recordHistory();
    }
  }

  snapshot(){ return structuredClone(this.state); }

  setMode(mode:GameMode){
    this.state.mode = mode;
    this.state.activeMission = mode === 'mission' ? this.chooseMission() : null;
    this.pushNews(mode === 'mission' ? 'Mission Campaign activated.' : 'Free Economy / Sandbox activated.', 'neutral');
  }

  canEnact(policy:PolicySpec): {ok:boolean; reason:string} {
    const cd = this.state.cooldowns[policy.id] ?? 0;
    if (cd > 0) return {ok:false, reason:`Cooldown: ${cd} quarter${cd===1?'':'s'}`};
    if (this.state.policyCapacity < policy.capacityCost) return {ok:false, reason:'Not enough policy capacity'};
    if (this.state.politicalCapital < policy.politicalCost) return {ok:false, reason:'Not enough political capital'};
    return {ok:true, reason:'Ready'};
  }

  enact(id:string): {ok:boolean; reason:string} {
    const policy = policyById(id);
    if (!policy) return {ok:false, reason:'Unknown policy'};
    const allowed = this.canEnact(policy);
    if (!allowed.ok) return allowed;
    this.state.policyCapacity -= policy.capacityCost;
    this.state.politicalCapital = clamp(this.state.politicalCapital - policy.politicalCost, 0, 100);
    this.state.cooldowns[id] = policy.cooldown;
    const impulse:ActiveImpulse = { id:`${id}-${Date.now()}-${Math.floor(this.rng.next()*1e6)}`, label:policy.label, age:0, duration:policy.duration, effects:{...(policy.transmissionEffects ?? policy.effects)} };
    this.state.impulses.push(impulse);
    if (id === 'rate_up') this.state.policyRate = clamp(this.state.policyRate + .005, -.01, .25);
    if (id === 'rate_down') this.state.policyRate = clamp(this.state.policyRate - .005, -.01, .25);
    if (id === 'support_fx') this.state.fxReserves = clamp(this.state.fxReserves-4, 0, 80);
    const matched=this.state.activeEvents.find(e=>e.status==='active'&&e.responsePolicyIds.includes(id));
    if(matched){matched.status='responded';matched.resolvedBy=policy.label;this.state.politicalCapital=clamp(this.state.politicalCapital+3,0,100);this.pushNews(`Policy response matched the ${matched.title} event.`, 'good');}
    this.state.lastPolicy = `${policy.label}: ${policy.description}`;
    this.pushNews(`Cabinet enacted ${policy.label}. Effects will transmit over ${policy.duration} quarters.`, 'neutral');
    return {ok:true, reason:'Enacted'};
  }

  triggerShock(kind:'oil'|'financial'|'sanctions'|'boom'|'food') {
    const map:Record<string,{label:string;duration:number;effects:Effects}> = {
      oil:{label:'Energy supply shock',duration:5,effects:{inflation:.014,growth:-.006,energy:-.08,approval:-.018,fx:.015}},
      financial:{label:'Financial stress event',duration:6,effects:{bank:-.10,credit:-.045,growth:-.008,unemployment:.005,confidence:-.05}},
      sanctions:{label:'External trade disruption',duration:7,effects:{growth:-.006,inflation:.006,fx:.045,confidence:-.04,tech:-.5}},
      boom:{label:'Global demand boom',duration:5,effects:{growth:.008,inflation:.005,fx:-.018,confidence:.035}},
      food:{label:'Food supply shock',duration:4,effects:{inflation:.010,poverty:.014,approval:-.02}}
    };
    const s=map[kind];
    this.state.impulses.push({id:`shock-${kind}-${Date.now()}`,label:s.label,age:0,duration:s.duration,effects:s.effects});
    this.pushNews(`Shock: ${s.label}.`, 'bad');
  }

  private aggregateImpulses():Effects {
    const out:Effects = {};
    for (const imp of this.state.impulses) {
      const phase = (imp.age + 1) / Math.max(1, imp.duration);
      const weight = Math.sin(Math.PI * phase) / Math.max(1, imp.duration * .62);
      for (const [k,v] of Object.entries(imp.effects) as [keyof Effects,number][]) add(out,k,v*weight);
      imp.age += 1;
    }
    this.state.impulses = this.state.impulses.filter(i=>i.age < i.duration);
    return out;
  }

  stepQuarter() {
    const s=this.state;
    const before={gdp:s.realGDP,inflation:s.inflation,u:s.unemployment,debt:s.debtRatio,approval:s.approval};
    const imp=this.aggregateImpulses();
    const noise = () => this.rng.range(-1,1);

    s.policyCapacity = clamp(s.policyCapacity + 30 + 6*Math.max(0,s.approval-.5),0,100);
    s.politicalCapital = clamp(s.politicalCapital + 1.2*(s.approval-.45),0,100);
    for(const k of Object.keys(s.cooldowns)) {
      const next=(s.cooldowns[k]??0)-1;
      if(next<=0) delete s.cooldowns[k]; else s.cooldowns[k]=next;
    }

    const anchor=.025;
    s.credibility=clamp(s.credibility + .035*(1-Math.abs(s.inflation-anchor)/.08) - .025*Math.max(0,s.inflationExpected-.05) + noise()*.003,.15,.98);
    const expectationMemory=.62+.22*(1-s.credibility);
    s.inflationExpected = clamp(expectationMemory*s.inflationExpected + (1-expectationMemory)*s.inflation + .08*s.credibility*(anchor-s.inflationExpected), -.03,.25);
    s.realRate = s.policyRate - s.inflationExpected;

    s.technology = clamp(s.technology + (imp.tech??0) + .12 + noise()*.07, 35, 130);
    s.productivity = clamp(s.productivity * (1 + .0011 + (s.technology-70)*.000012), .7, 1.8);
    const potentialQ = .0045 + (s.productivity-1)*.0015 + Math.max(0,s.technology-70)*.000025;
    s.potentialGDP *= (1 + potentialQ);

    s.creditGrowth = clamp(.032 - .52*(s.policyRate-.04) + .075*(s.bankHealth-.7) + (imp.credit??0) + noise()*.004, -.12,.20);
    s.businessConfidence = clamp(s.businessConfidence + .10*(s.growth-.02) - .08*Math.max(0,s.inflation-.05) + (imp.confidence??0) + noise()*.008, .15,.95);
    s.consumerConfidence = clamp(.65*s.consumerConfidence + .35*(.72 - 1.8*Math.max(0,s.inflation-.025) - 1.2*Math.max(0,s.unemployment-.05) + .3*s.approval), .12,.95);

    const outputGap=(s.realGDP/s.potentialGDP)-1;
    s.outputGap=outputGap;
    const qGrowth = clamp(
      .0056 + (imp.growth??0) + .012*(s.businessConfidence-.62) + .009*(s.consumerConfidence-.62)
      + .012*s.fiscalDemand
      + .035*(s.creditGrowth-.03) - .075*Math.max(-.02,s.realRate-.012) - .045*Math.max(0,outputGap-.04)
      + noise()*.0022,
      -.055,.07
    );
    s.realGDP *= 1 + qGrowth;
    s.growth = clamp(qGrowth*4, -.20,.30);

    const newGap=(s.realGDP/s.potentialGDP)-1;
    s.outputGap=newGap;
    const importedInflation=.018*Math.max(-.15,s.exchangeRate-1)+.012*Math.max(0,.7-s.energySecurity);
    s.coreInflation = clamp(.70*s.coreInflation + .18*s.inflationExpected + .12*.025 + .034*newGap + .010*Math.max(0,s.wageGrowth-.04) + (imp.inflation??0)*.72 + noise()*.0011,-.03,.25);
    s.inflation = clamp(.76*s.coreInflation + .24*(s.coreInflation+importedInflation) + (imp.inflation??0)*.28 + noise()*.0009,-.035,.30);
    s.unemployment = clamp(s.unemployment - .24*qGrowth + .08*(.052-s.unemployment) + (imp.unemployment??0) + noise()*.0012, .018,.28);
    s.wageGrowth=clamp(.58*s.wageGrowth+.25*s.inflationExpected+.17*(.025+s.productivity*.004)+.16*Math.max(0,.055-s.unemployment)+noise()*.0015,-.03,.20);
    s.realWageGrowth=clamp(s.wageGrowth-s.inflation,-.15,.15);

    s.bankHealth = clamp(s.bankHealth + .030*qGrowth - .12*Math.max(0,s.unemployment-.08) - .055*Math.max(0,s.policyRate-.10) + (imp.bank??0) + noise()*.006, .08,1);
    s.exchangeRate = clamp(s.exchangeRate * (1 + .055*(s.inflation-.025) - .035*(s.policyRate-.04) + .025*(.65-s.bankHealth) + (imp.fx??0) + noise()*.004), .45,2.7);

    s.primaryBalance = clamp(-.018 + .10*(s.debtRatio-.60) - .06*(s.growth-.02), -.12,.10);
    s.treasury += (imp.treasury??0) - s.primaryBalance*10 + noise()*.4;
    s.sovereignSpread=clamp(.004+.035*Math.max(0,s.debtRatio-.65)+.025*Math.max(0,-s.primaryBalance-.03)+.020*(1-s.credibility)+.016*Math.max(0,.65-s.bankHealth),.002,.16);
    const rq=Math.max(-.01,s.policyRate+s.sovereignSpread)/4;
    s.debtRatio = clamp(((1+rq)/(1+qGrowth))*s.debtRatio - s.primaryBalance/4 + (imp.debt??0), .08,2.4);

    const housingDemand=.010 + .05*(s.creditGrowth-.03) - .035*(s.policyRate-.04) + .02*(s.growth-.02);
    s.housingIndex = clamp(s.housingIndex*(1 + housingDemand - (imp.housingSupply??0)*.6 + noise()*.003), 45,340);
    s.housingAffordability = clamp(.78*(s.realGDP/s.potentialGDP) * (100/s.housingIndex) * (1-.7*Math.max(0,s.policyRate-.04)), .18,1.35);

    s.poverty = clamp(s.poverty + .06*(s.unemployment-.055) + .035*Math.max(0,s.inflation-.045) - .018*Math.max(0,s.growth-.025) + (imp.poverty??0), .025,.42);
    s.inequality = clamp(s.inequality + .007*(s.growth-.035) + .010*Math.max(0,1-s.housingAffordability) + (imp.inequality??0), .22,.62);
    s.corruption = clamp(s.corruption + (imp.corruption??0) + noise()*.0015, .04,.55);
    s.energySecurity = clamp(s.energySecurity + (imp.energy??0) + .002 + noise()*.003, .15,1);
    s.emissions = clamp(s.emissions + 5*qGrowth + (imp.emissions??0) - .25*Math.max(0,s.technology-80)/10, 35,180);

    s.exports = clamp(s.exports * (1 + .45*qGrowth + .016*(1-s.exchangeRate) + .003*(s.technology-70)/10 + noise()*.003), 45,300);
    s.imports = clamp(s.imports * (1 + .50*qGrowth - .020*(s.exchangeRate-1) + noise()*.003), 35,320);
    s.currentAccount=clamp((s.exports-s.imports)/Math.max(1,s.realGDP),-.20,.20);
    s.fxReserves=clamp(s.fxReserves + Math.max(-2.5,Math.min(2.5,s.currentAccount*8)) + noise()*.35,0,80);

    s.approval = clamp(
      .78*s.approval + .22*(.68 + 1.6*(s.growth-.02) - 2.2*Math.max(0,s.inflation-.03) - 1.8*Math.max(0,s.unemployment-.055)
      - .6*Math.max(0,s.debtRatio-.9) - .5*Math.max(0,s.poverty-.14)) + (imp.approval??0),
      .08,.92
    );

    s.fci = clamp(50 + 150*(s.policyRate-.04) + 75*s.sovereignSpread - 22*(s.creditGrowth-.03) + 18*(1-s.bankHealth) + 7*(s.exchangeRate-1), 0,100);
    s.macroRisk = clamp(100*(.24*Math.max(0,s.inflation-.04)/.12 + .18*Math.max(0,s.unemployment-.07)/.15 + .20*Math.max(0,s.debtRatio-.75)/1.2 + .22*(1-s.bankHealth) + .16*Math.max(0,s.exchangeRate-1)/1.2),0,100);
    s.regime=this.classifyRegime();
    s.nationalScore=this.score();

    s.turn += 1;
    s.quarter += 1;
    if(s.quarter>4){ s.quarter=1; s.year += 1; }

    this.updateEvents();
    this.maybeGenerateEvent();
    updateMicroeconomy(s,()=>this.rng.next());
    updateElection(s,()=>this.rng.next());
    if(s.bankruptcies>0) this.pushNews(`${s.bankruptcies} firm${s.bankruptcies===1?'':'s'} entered restructuring this quarter.`, 'bad');
    if(s.firmBirths>0) this.pushNews(`${s.firmBirths} new firm${s.firmBirths===1?'':'s'} entered the market.`, 'good');
    if(s.election.lastElectionTurn===s.turn) this.pushNews(s.election.lastResult, s.election.incumbentShare>=.5?'good':'bad');

    this.updateMission();
    this.randomDevelopment();
    this.recordHistory();
    s.lastQuarterSummary = `${periodLabel(s.year,s.quarter)} • GDP ${s.growth>=0?'+':''}${(s.growth*100).toFixed(1)}% • inflation ${(s.inflation*100).toFixed(1)}% • unemployment ${(s.unemployment*100).toFixed(1)}% • debt ${(s.debtRatio*100).toFixed(1)}%.`;
    s.lastLearningNote=this.learningNote(before);
    this.pushNews(`Quarter closed: ΔGDP ${(s.realGDP-before.gdp).toFixed(1)}, inflation ${((s.inflation-before.inflation)*100).toFixed(1)}pp, unemployment ${((s.unemployment-before.u)*100).toFixed(1)}pp.`, s.growth>=0?'good':'bad');
  }

  private updateEvents(){
    const s=this.state;
    const followUps:MacroEvent[]=[];
    for(const e of s.activeEvents){
      if(e.status==='responded' && s.turn>e.startedTurn){
        e.status='expired';
        const bonus=this.eventResolutionBonus(e.kind,e.severity);
        if(Object.keys(bonus).length) s.impulses.push({id:`event-resolution-${e.id}`,label:`Resolution: ${e.title}`,age:0,duration:3,effects:bonus});
        this.pushNews(`Event contained: ${e.title}. Response: ${e.resolvedBy}.`,'good');
        continue;
      }
      if(e.status==='active' && s.turn>e.deadlineTurn){
        e.status='expired';
        const penalty=this.eventPenalty(e.kind,e.severity);
        s.impulses.push({id:`event-penalty-${e.id}`,label:`Escalation: ${e.title}`,age:0,duration:4,effects:penalty});
        s.approval=clamp(s.approval-.008*e.severity,.08,.92);
        const next=this.followUpEvent(e);
        if(next) followUps.push(next);
        this.pushNews(`Unresolved event escalated: ${e.title}.`,'bad');
      }
    }
    const finished=s.activeEvents.filter(e=>e.status==='expired');
    if(finished.length){s.eventHistory.unshift(...finished);s.eventHistory=s.eventHistory.slice(0,24);}
    s.activeEvents=s.activeEvents.filter(e=>e.status!=='expired');
    for(const e of followUps){s.activeEvents.push(e);s.impulses.push({id:`event-${e.id}`,label:e.title,age:0,duration:4,effects:this.followUpImpulse(e.kind,e.severity)});this.pushNews(`Event chain advanced: ${e.title}.`,'bad');}
  }

  private eventResolutionBonus(kind:MacroEvent['kind'],severity:number):Effects{
    const m=Math.max(1,severity)/4;
    const map:Record<MacroEvent['kind'],Effects>={
      currency:{fx:-.018*m,inflation:-.002*m,confidence:.012*m},
      banking:{bank:.025*m,credit:.012*m,confidence:.014*m},
      energy:{energy:.02*m,inflation:-.002*m,confidence:.008*m},
      global:{growth:.002*m,confidence:.010*m},
      housing:{bank:.008*m,confidence:.008*m},
      wages:{inflation:-.002*m,confidence:.006*m},
      debt:{debt:-.006*m,confidence:.012*m},
      technology:{tech:.6*m,growth:.0015*m,confidence:.012*m}
    };return map[kind];
  }

  private eventPenalty(kind:MacroEvent['kind'],severity:number):Effects{
    const m=Math.max(1,severity)/3;
    const map:Record<MacroEvent['kind'],Effects>={
      currency:{fx:.045*m,inflation:.006*m,confidence:-.025*m,treasury:-2*m},
      banking:{bank:-.06*m,credit:-.03*m,growth:-.004*m,confidence:-.03*m},
      energy:{energy:-.045*m,inflation:.007*m,growth:-.003*m,approval:-.01*m},
      global:{growth:-.006*m,unemployment:.003*m,confidence:-.025*m},
      housing:{growth:-.003*m,bank:-.018*m,confidence:-.018*m},
      wages:{inflation:.006*m,confidence:-.008*m},
      debt:{debt:.012*m,growth:-.003*m,confidence:-.028*m},
      technology:{tech:-.5*m,growth:-.001*m}
    };return map[kind];
  }

  private followUpImpulse(kind:MacroEvent['kind'],severity:number):Effects{
    const m=Math.max(1,severity)/3;
    const map:Record<MacroEvent['kind'],Effects>={
      currency:{inflation:.005*m,fx:.028*m,confidence:-.016*m},
      banking:{credit:-.025*m,growth:-.004*m,unemployment:.002*m},
      energy:{inflation:.005*m,growth:-.003*m},
      global:{growth:-.004*m,unemployment:.003*m,confidence:-.018*m},
      housing:{bank:-.016*m,credit:-.012*m,confidence:-.015*m},
      wages:{inflation:.005*m,confidence:-.010*m},
      debt:{fx:.02*m,debt:.01*m,confidence:-.02*m},
      technology:{tech:-.3*m,confidence:-.008*m}
    } as any;return map[kind];
  }

  private followUpEvent(parent:MacroEvent):MacroEvent|null{
    if(parent.severity<3 || (parent.stage??1)>=3) return null;
    const s=this.state;
    const stage=(parent.stage??1)+1;
    const chainId=parent.chainId??parent.id;
    const defs:Record<MacroEvent['kind'],{kind:MacroEvent['kind'];title:string;description:string;response:string[];label:string;learning:string;consequence:string}>={
      currency:{kind:'wages',title:'Imported inflation second round',description:'The currency shock is now feeding wage claims and core inflation.',response:['rate_up','food_subsidy','business_reform'],label:'Prevent inflation persistence',learning:'Exchange-rate shocks can become domestic inflation when expectations and wages adjust.',consequence:'Core inflation becomes more persistent.'},
      banking:{kind:'global',title:'Credit crunch reaches the real economy',description:'Weak bank balance sheets are now reducing investment, hiring and working capital.',response:['bank_recap','sme_credit','qe'],label:'Restore credit before layoffs spread',learning:'Bank stress can turn into a real-economy recession through investment and employment.',consequence:'Investment and employment weaken.'},
      energy:{kind:'wages',title:'Cost-of-living wage pressure',description:'Energy prices are feeding wage negotiations and service-sector inflation.',response:['rate_up','energy_subsidy','infra_up'],label:'Contain second-round price effects',learning:'Supply shocks become persistent when wage and expectation channels activate.',consequence:'Wages and core inflation accelerate.'},
      global:{kind:'banking',title:'Export weakness hits corporate balance sheets',description:'Lower foreign demand is weakening cash flow and raising credit risk at exposed firms.',response:['sme_credit','export_support','rate_down'],label:'Protect viable firms and credit',learning:'External demand shocks can migrate into the banking system through corporate defaults.',consequence:'Bank asset quality deteriorates.'},
      housing:{kind:'banking',title:'Mortgage losses pressure banks',description:'Housing weakness is now showing up in bank collateral values and loan quality.',response:['bank_recap','macroprudential','housing_support'],label:'Stop housing stress becoming banking stress',learning:'Property cycles are macro-financial because collateral values affect bank lending capacity.',consequence:'Bank health and credit weaken.'},
      wages:{kind:'currency',title:'Inflation expectations de-anchor',description:'Persistent wage-price pressure is weakening currency and inflation credibility.',response:['rate_up','support_fx','austerity'],label:'Re-anchor expectations',learning:'Persistent inflation can spill into exchange rates and sovereign risk.',consequence:'FX and sovereign risk rise.'},
      debt:{kind:'currency',title:'Fiscal stress becomes external pressure',description:'Higher sovereign risk is spilling into capital flows and the exchange rate.',response:['austerity','income_tax_up','imf_bailout'],label:'Break the debt–currency loop',learning:'Debt credibility and external stability can reinforce each other in both directions.',consequence:'Currency pressure intensifies.'},
      technology:{kind:'global',title:'Productivity opportunity fades',description:'Investment plans are moving abroad as the reform window closes.',response:['research_grant','business_reform','fdi_incentives'],label:'Recover the investment window',learning:'Structural opportunities are time-sensitive and influence future potential output.',consequence:'Potential growth is lower than it could have been.'}
    };
    const d=defs[parent.kind];
    const severity=clamp(parent.severity-1+Math.round(this.rng.range(0,1)),2,5) as MacroEvent['severity'];
    return {id:`evt-chain-${d.kind}-${s.turn}-${Math.floor(this.rng.next()*9999)}`,kind:d.kind,title:d.title,description:d.description,severity,startedTurn:s.turn,deadlineTurn:s.turn+(severity>=4?2:3),responsePolicyIds:d.response,responseLabel:d.label,learning:d.learning,status:'active',chainId,parentEventId:parent.id,stage,consequence:d.consequence};
  }

  private maybeGenerateEvent(){
    const s=this.state;
    if(s.activeEvents.length>=3) return;
    const quietBonus=s.turn<2?-.04:0;
    const riskChance=clamp(.10+.0014*s.macroRisk+(s.mode==='mission'?.035:0)+quietBonus,.035,.30);
    if(this.rng.next()>riskChance) return;
    const candidates:{kind:MacroEvent['kind'];weight:number;title:string;description:string;severity:number;response:string[];label:string;learning:string;effects:Effects;consequence:string}[]=[
      {kind:'currency',weight:.7+Math.max(0,s.exchangeRate-1)*3+Math.max(0,s.inflation-.05)*5,title:'Currency pressure wave',description:'FX demand is rising and imported inflation risk is building.',severity:s.exchangeRate>1.22?4:3,response:['support_fx','rate_up','imf_bailout'],label:'Stabilize FX expectations',learning:'Currency stress links inflation credibility, reserves and interest-rate policy.',effects:{fx:.025,inflation:.003,confidence:-.012},consequence:'If ignored, imported inflation can spread into wages.'},
      {kind:'banking',weight:.55+Math.max(0,.72-s.bankHealth)*4,title:'Bank funding squeeze',description:'Wholesale funding costs are rising and credit transmission is weakening.',severity:s.bankHealth<.55?5:3,response:['bank_recap','qe','macroprudential'],label:'Restore financial transmission',learning:'Weak banks can block monetary transmission even when policy rates fall.',effects:{bank:-.035,credit:-.02,confidence:-.02},consequence:'If unresolved, a credit crunch can hit jobs and investment.'},
      {kind:'energy',weight:.45+Math.max(0,.72-s.energySecurity)*2,title:'Energy supply disruption',description:'Energy costs are threatening production and headline inflation.',severity:s.energySecurity<.55?4:2,response:['energy_subsidy','infra_up','port_upgrade'],label:'Protect supply and households',learning:'Supply shocks create a difficult inflation–growth trade-off.',effects:{energy:-.035,inflation:.005,growth:-.002},consequence:'If persistent, wage-price pressure may follow.'},
      {kind:'global',weight:.5,title:'Global demand slowdown',description:'Export orders are weakening as external growth cools.',severity:2,response:['export_support','fdi_incentives','stimulus'],label:'Support demand without destabilizing prices',learning:'Open economies transmit foreign demand through exports, confidence and investment.',effects:{growth:-.003,confidence:-.018},consequence:'If firms weaken, bank credit quality can deteriorate.'},
      {kind:'housing',weight:.35+Math.max(0,s.housingIndex-120)/80,title:'Housing correction risk',description:'Housing valuations and financing conditions are diverging.',severity:s.housingIndex>150?4:2,response:['housing_support','macroprudential','rate_down'],label:'Manage housing and credit risk',learning:'Housing connects rates, bank balance sheets, household wealth and construction.',effects:{confidence:-.012,bank:-.012},consequence:'If ignored, mortgage losses can pressure banks.'},
      {kind:'wages',weight:.35+Math.max(0,.05-s.unemployment)*8,title:'Wage-price pressure',description:'Labor-market tightness is lifting wage settlements and core inflation.',severity:s.wageGrowth>.07?4:2,response:['rate_up','education_up','business_reform'],label:'Anchor inflation without crushing jobs',learning:'Tight labor markets can sustain core inflation through wage persistence.',effects:{inflation:.004},consequence:'If ignored, expectations and FX credibility may weaken.'},
      {kind:'debt',weight:.3+Math.max(0,s.debtRatio-.75)*2,title:'Sovereign funding stress',description:'Bond investors demand a higher premium for fiscal risk.',severity:s.debtRatio>1?5:3,response:['austerity','income_tax_up','imf_bailout'],label:'Rebuild fiscal credibility',learning:'Debt dynamics depend on growth, primary balances and effective interest costs.',effects:{debt:.008,confidence:-.02},consequence:'If ignored, capital outflow can pressure the currency.'},
      {kind:'technology',weight:.25,title:'Technology investment window',description:'A private investment wave creates an opportunity to lift potential output.',severity:1,response:['research_grant','education_up','business_reform'],label:'Capture the productivity opportunity',learning:'Structural policy works slowly but can raise non-inflationary growth capacity.',effects:{tech:.5,growth:.001,confidence:.012},consequence:'If missed, investment may relocate and potential growth will be lower.'}
    ];
    const total=candidates.reduce((a,c)=>a+c.weight,0);let r=this.rng.next()*total;let c=candidates[0];for(const x of candidates){r-=x.weight;if(r<=0){c=x;break;}}
    const sev=clamp(Math.round(c.severity+this.rng.range(-.5,.5)),1,5) as MacroEvent['severity'];
    const id=`evt-${c.kind}-${s.turn}-${Math.floor(this.rng.next()*9999)}`;
    const event:MacroEvent={id,kind:c.kind,title:c.title,description:c.description,severity:sev,startedTurn:s.turn,deadlineTurn:s.turn+(sev>=4?2:3),responsePolicyIds:c.response,responseLabel:c.label,learning:c.learning,status:'active',chainId:id,stage:1,consequence:c.consequence};
    s.activeEvents.push(event);
    s.impulses.push({id:`event-${id}`,label:c.title,age:0,duration:3,effects:c.effects});
    this.pushNews(`Policy alert: ${c.title}.`,'bad');
  }

  private learningNote(before:{gdp:number;inflation:number;u:number;debt:number;approval:number}){
    const s=this.state;const dPi=s.inflation-before.inflation,dU=s.unemployment-before.u,dY=s.realGDP-before.gdp;
    if(dPi<-.002&&dU>.001)return 'Inflation eased, but unemployment rose: the classic short-run stabilization trade-off is visible.';
    if(dY>0&&dPi>.002)return 'Demand strengthened output, but price pressure also rose. Check the output gap before adding more stimulus.';
    if(s.bankHealth<.6)return 'Financial transmission is impaired: bank health can dominate the effect of ordinary rate changes.';
    if(s.debtRatio>before.debt+.005)return 'Debt rose this quarter. Compare the primary balance with growth and sovereign funding costs.';
    if(s.outputGap>.04)return 'The economy is operating above estimated capacity, increasing the risk of persistent inflation.';
    if(s.outputGap<-.04)return 'A negative output gap is opening. Demand support may help, provided inflation expectations remain anchored.';
    return 'The economy moved gradually this quarter. Use the driver panels to separate demand, supply and financial effects.';
  }

  private randomDevelopment(){
    if(this.rng.next()>.17) return;
    const r=this.rng.next();
    if(r<.2){ this.state.businessConfidence=clamp(this.state.businessConfidence+.04,.1,.95); this.pushNews('Business survey surprises to the upside.', 'good'); }
    else if(r<.4){ this.state.consumerConfidence=clamp(this.state.consumerConfidence-.04,.1,.95); this.pushNews('Households report weaker confidence.', 'bad'); }
    else if(r<.6){ this.state.technology=clamp(this.state.technology+1.2,35,130); this.pushNews('Domestic technology adoption accelerates.', 'good'); }
    else if(r<.8){ this.state.exports*=1.012; this.pushNews('Foreign demand supports exporters.', 'good'); }
    else { this.state.inflation=clamp(this.state.inflation+.004,-.03,.3); this.pushNews('Short-lived supply bottlenecks lift prices.', 'bad'); }
  }

  private classifyRegime(){
    const s=this.state;
    if(s.inflation>.07 && s.growth<.01) return 'Stagflation';
    if(s.growth<-.01) return 'Recession';
    if(s.inflation>.055 && s.growth>.035) return 'Overheating';
    if(s.growth>.045 && s.inflation<.05) return 'Strong Expansion';
    if(s.inflation<.012 && s.growth<.015) return 'Lowflation / Weak Demand';
    if(s.bankHealth<.45) return 'Financial Stress';
    return 'Balanced Expansion';
  }

  private score(){
    const s=this.state;
    const inflation=clamp(1-Math.abs(s.inflation-.025)/.10,0,1);
    const jobs=clamp(1-Math.max(0,s.unemployment-.045)/.16,0,1);
    const growth=clamp(.55+s.growth*4,0,1);
    const debt=clamp(1-Math.max(0,s.debtRatio-.65)/1.1,0,1);
    const social=clamp(.55*s.approval+.45*(1-s.poverty/.30),0,1);
    return 100*(.22*inflation+.18*jobs+.17*growth+.13*debt+.13*s.bankHealth+.10*social+.07*clamp(s.energySecurity,0,1));
  }

  private chooseMission():Mission {
    const s=this.state;
    if(s.inflation>.045) return {id:'prices',title:'Restore Price Stability',description:'Bring inflation below 4% without causing a deep recession.',deadline:s.turn+8,progress:clamp((.08-s.inflation)/.04,0,1),targetText:'Inflation < 4%'};
    if(s.unemployment>.07) return {id:'jobs',title:'Jobs Recovery',description:'Reduce unemployment while keeping inflation contained.',deadline:s.turn+8,progress:clamp((.11-s.unemployment)/.04,0,1),targetText:'Unemployment < 6%'};
    if(s.debtRatio>.8) return {id:'debt',title:'Fiscal Credibility',description:'Stabilize public debt and preserve growth.',deadline:s.turn+10,progress:clamp((1.05-s.debtRatio)/.30,0,1),targetText:'Debt/GDP < 78%'};
    if(s.bankHealth<.65) return {id:'banks',title:'Financial Stability',description:'Restore bank balance sheets and credit transmission.',deadline:s.turn+7,progress:clamp((s.bankHealth-.35)/.40,0,1),targetText:'Bank health > 75'};
    return {id:'productivity',title:'Productivity Agenda',description:'Raise technology and potential output without destabilizing prices.',deadline:s.turn+10,progress:clamp((s.technology-70)/15,0,1),targetText:'Technology > 85'};
  }

  private missionProgress(m:Mission){
    const s=this.state;
    if(m.id==='prices') return clamp((.08-s.inflation)/.04,0,1);
    if(m.id==='jobs') return clamp((.11-s.unemployment)/.05,0,1);
    if(m.id==='debt') return clamp((1.05-s.debtRatio)/.30,0,1);
    if(m.id==='banks') return clamp((s.bankHealth-.35)/.40,0,1);
    return clamp((s.technology-70)/15,0,1);
  }

  private updateMission(){
    const s=this.state;
    if(s.mode!=='mission') return;
    if(!s.activeMission) s.activeMission=this.chooseMission();
    const m=s.activeMission!;
    m.progress=this.missionProgress(m);
    if(m.progress>=1) this.missionHold++; else this.missionHold=0;
    if(this.missionHold>=2){
      s.missionsCompleted++; s.missionScore=clamp(s.missionScore+12,0,100); s.approval=clamp(s.approval+.025,0,1); s.politicalCapital=clamp(s.politicalCapital+8,0,100);
      this.pushNews(`Mission completed: ${m.title}.`, 'good');
      s.activeMission=this.chooseMission(); this.missionHold=0;
    } else if(s.turn>m.deadline){
      s.missionScore=clamp(s.missionScore-6,0,100); s.approval=clamp(s.approval-.02,0,1);
      this.pushNews(`Mission deadline missed: ${m.title}. Cabinet receives a new objective.`, 'bad');
      s.activeMission=this.chooseMission(); this.missionHold=0;
    }
  }

  private recordHistory(){
    const s=this.state;
    const h:HistoryPoint={
      period:periodLabel(s.year,s.quarter),gdp:s.realGDP,growth:s.growth,inflation:s.inflation,coreInflation:s.coreInflation,unemployment:s.unemployment,wageGrowth:s.wageGrowth,
      debt:s.debtRatio,approval:s.approval,fci:s.fci,poverty:s.poverty,housingAffordability:s.housingAffordability,
      bankHealth:s.bankHealth,macroRisk:s.macroRisk,exchangeRate:s.exchangeRate,outputGap:s.outputGap,sovereignSpread:s.sovereignSpread,incumbentShare:s.election?.incumbentShare??.5,turnout:s.election?.turnout??.65
    };
    s.history.push(h); if(s.history.length>48) s.history.shift();
  }

  private pushNews(text:string,tone:NewsItem['tone']){
    const item:NewsItem={id:`${Date.now()}-${Math.floor(this.rng.next()*1e6)}`,period:periodLabel(this.state.year,this.state.quarter),text,tone};
    this.state.news.unshift(item); if(this.state.news.length>20) this.state.news.pop();
  }

  advisor():AdvisorRecommendation[]{
    const s=this.state;
    const needs:Partial<Record<keyof Effects,number>>={
      growth:clamp((.025-s.growth)/.055,-1,1),
      inflation:clamp((.025-s.inflation)/.055,-1,1),
      unemployment:clamp((.05-s.unemployment)/.085,-1,1),
      debt:clamp((.68-s.debtRatio)/.55,-1,1),
      approval:clamp((.55-s.approval)/.35,-1,1),
      bank:clamp((.76-s.bankHealth)/.38,-1,1),
      fx:clamp((1-s.exchangeRate)/.32,-1,1),
      credit:clamp((.03-s.creditGrowth)/.10,-1,1),
      tech:clamp((86-s.technology)/25,-1,1),
      energy:clamp((.78-s.energySecurity)/.35,-1,1),
      poverty:clamp((.10-s.poverty)/.18,-1,1),
      inequality:clamp((.34-s.inequality)/.18,-1,1),
      treasury:clamp((24-s.treasury)/30,-1,1),
      confidence:clamp((.66-(s.businessConfidence+s.consumerConfidence)/2)/.35,-1,1),
      housingSupply:s.housingAffordability<.62?1:.25
    };
    const scales:Partial<Record<keyof Effects,number>>={growth:.008,inflation:.006,unemployment:.004,debt:.02,approval:.025,bank:.05,fx:.05,credit:.03,tech:1.5,energy:.06,poverty:.015,inequality:.012,treasury:8,confidence:.03,housingSupply:.02,emissions:4,corruption:.03};
    const weights:Partial<Record<keyof Effects,number>>={growth:1.2,inflation:1.35,unemployment:1.1,debt:1.05,bank:1.2,fx:.9,credit:.75,tech:.75,energy:.65,poverty:.7,inequality:.45,treasury:.45,confidence:.55,approval:.35,housingSupply:.45};
    const names:Partial<Record<keyof Effects,string>>={growth:'growth',inflation:'inflation',unemployment:'employment',debt:'debt',approval:'approval',bank:'bank stability',fx:'currency',credit:'credit',tech:'productivity',energy:'energy resilience',poverty:'poverty',inequality:'inequality',treasury:'fiscal buffers',confidence:'confidence',housingSupply:'housing supply'};
    const scored=POLICIES.map(policy=>{
      let score=0; const contributions:{key:keyof Effects;v:number;label:string}[]=[];
      for(const [key,value] of Object.entries(policy.effects) as [keyof Effects,number][]){
        const need=needs[key]??0; const scale=scales[key]??1; const w=weights[key]??.25;
        const c=(value/scale)*need*w*12; score+=c;
        if(Math.abs(c)>.4) contributions.push({key,v:c,label:names[key]??String(key)});
      }
      const eventMatches=s.activeEvents.filter(e=>e.status==='active'&&e.responsePolicyIds.includes(policy.id));
      for(const e of eventMatches) score+=22+e.severity*4+(e.stage??1)*2;
      if(s.activeMission){
        if(s.activeMission.id==='prices' && (policy.effects.inflation??0)<0) score+=8;
        if(s.activeMission.id==='jobs' && ((policy.effects.unemployment??0)<0||(policy.effects.growth??0)>0)) score+=8;
        if(s.activeMission.id==='debt' && (policy.effects.debt??0)<0) score+=8;
        if(s.activeMission.id==='banks' && (policy.effects.bank??0)>0) score+=8;
        if(s.activeMission.id==='productivity' && (policy.effects.tech??0)>0) score+=8;
      }
      score-=policy.capacityCost*.08+policy.politicalCost*.12;
      if(!this.canEnact(policy).ok) score-=18;
      contributions.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
      const best=contributions.filter(x=>x.v>0).slice(0,2);
      const worst=contributions.filter(x=>x.v<0).sort((a,b)=>a.v-b.v)[0];
      const event=eventMatches[0];
      const why=event?`${event.title} is active (stage ${event.stage??1}). ${policy.label} directly matches the response set and also addresses ${best.map(x=>x.label).join(' and ')||'the immediate risk'}.`:
        best.length?`Current conditions make ${best.map(x=>x.label).join(' and ')} the strongest channels for this instrument.`:`This is a low-urgency option under current macro conditions.`;
      const watch=worst?`${worst.label}; ${policy.tradeoff}`:policy.tradeoff;
      const expected=best.length?`Expected support: ${best.map(x=>x.label).join(', ')}.`:'Expected effects are mostly medium-term.';
      return {policy,score,why,watch,tradeoff:policy.tradeoff,expected,confidence:clamp(52+Math.max(0,score)*1.25,52,94)};
    }).sort((a,b)=>b.score-a.score);
    const ready=scored.filter(x=>this.canEnact(x.policy).ok);
    return (ready.length>=4?ready:scored).slice(0,5).map((x,i)=>({id:`smart-${x.policy.id}-${i}`,why:x.why,watch:x.watch,policy:x.policy,score:x.score,confidence:x.confidence,tradeoff:x.tradeoff,expected:x.expected}));
  }

  cabinet(){ return cabinetAdvice(this.state); }

  serialize(){ return JSON.stringify(this.state); }
}
