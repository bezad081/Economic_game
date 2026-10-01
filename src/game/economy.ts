import { POLICIES, policyById } from './policies';
import type { ActiveImpulse, AdvisorRecommendation, EconomySnapshot, Effects, GameMode, HistoryPoint, Mission, NewsItem, PolicySpec } from './types';
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
  inflation:.034, inflationExpected:.032, unemployment:.055,
  policyRate:.045, realRate:.013,
  debtRatio:.525, primaryBalance:-.018, treasury:28,
  approval:.56, politicalCapital:72, policyCapacity:100,
  bankHealth:.79, creditGrowth:.038, exchangeRate:1.0,
  housingIndex:100, housingAffordability:.72,
  poverty:.112, inequality:.36,
  technology:72, productivity:1.0, energySecurity:.73, emissions:100,
  corruption:.23, businessConfidence:.64, consumerConfidence:.62,
  exports:115, imports:105,
  fci:50, macroRisk:10, regime:'Balanced Expansion', nationalScore:62,
  missionScore:0, missionsCompleted:0,
  activeMission:null, impulses:[], cooldowns:{}, news:[], history:[],
  lastPolicy:'No policy enacted yet.', lastQuarterSummary:'Economy initialized.',
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
    const impulse:ActiveImpulse = { id:`${id}-${Date.now()}-${Math.floor(this.rng.next()*1e6)}`, label:policy.label, age:0, duration:policy.duration, effects:{...policy.effects} };
    this.state.impulses.push(impulse);
    if (id === 'rate_up') this.state.policyRate = clamp(this.state.policyRate + .005, -.01, .25);
    if (id === 'rate_down') this.state.policyRate = clamp(this.state.policyRate - .005, -.01, .25);
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

    s.inflationExpected = clamp(.72*s.inflationExpected + .28*s.inflation, -.03,.25);
    s.realRate = s.policyRate - s.inflationExpected;

    s.technology = clamp(s.technology + (imp.tech??0) + .12 + noise()*.07, 35, 130);
    s.productivity = clamp(s.productivity * (1 + .0011 + (s.technology-70)*.000012), .7, 1.8);
    const potentialQ = .0045 + (s.productivity-1)*.0015 + Math.max(0,s.technology-70)*.000025;
    s.potentialGDP *= (1 + potentialQ);

    s.creditGrowth = clamp(.032 - .52*(s.policyRate-.04) + .075*(s.bankHealth-.7) + (imp.credit??0) + noise()*.004, -.12,.20);
    s.businessConfidence = clamp(s.businessConfidence + .10*(s.growth-.02) - .08*Math.max(0,s.inflation-.05) + (imp.confidence??0) + noise()*.008, .15,.95);
    s.consumerConfidence = clamp(.65*s.consumerConfidence + .35*(.72 - 1.8*Math.max(0,s.inflation-.025) - 1.2*Math.max(0,s.unemployment-.05) + .3*s.approval), .12,.95);

    const outputGap=(s.realGDP/s.potentialGDP)-1;
    const qGrowth = clamp(
      .0056 + (imp.growth??0) + .012*(s.businessConfidence-.62) + .009*(s.consumerConfidence-.62)
      + .035*(s.creditGrowth-.03) - .075*Math.max(-.02,s.realRate-.012) - .045*Math.max(0,outputGap-.04)
      + noise()*.0022,
      -.055,.07
    );
    s.realGDP *= 1 + qGrowth;
    s.growth = clamp(qGrowth*4, -.20,.30);

    const newGap=(s.realGDP/s.potentialGDP)-1;
    s.inflation = clamp(
      .74*s.inflation + .18*s.inflationExpected + .08*.025 + .038*newGap + (imp.inflation??0) + noise()*.0015,
      -.035,.30
    );
    s.unemployment = clamp(s.unemployment - .24*qGrowth + .08*(.052-s.unemployment) + (imp.unemployment??0) + noise()*.0012, .018,.28);

    s.bankHealth = clamp(s.bankHealth + .030*qGrowth - .12*Math.max(0,s.unemployment-.08) - .055*Math.max(0,s.policyRate-.10) + (imp.bank??0) + noise()*.006, .08,1);
    s.exchangeRate = clamp(s.exchangeRate * (1 + .055*(s.inflation-.025) - .035*(s.policyRate-.04) + .025*(.65-s.bankHealth) + (imp.fx??0) + noise()*.004), .45,2.7);

    s.primaryBalance = clamp(-.018 + .10*(s.debtRatio-.60) - .06*(s.growth-.02), -.12,.10);
    s.treasury += (imp.treasury??0) - s.primaryBalance*10 + noise()*.4;
    const rq=Math.max(-.01,s.policyRate)/4;
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

    s.approval = clamp(
      .78*s.approval + .22*(.68 + 1.6*(s.growth-.02) - 2.2*Math.max(0,s.inflation-.03) - 1.8*Math.max(0,s.unemployment-.055)
      - .6*Math.max(0,s.debtRatio-.9) - .5*Math.max(0,s.poverty-.14)) + (imp.approval??0),
      .08,.92
    );

    s.fci = clamp(50 + 180*(s.policyRate-.04) - 22*(s.creditGrowth-.03) + 18*(1-s.bankHealth) + 7*(s.exchangeRate-1), 0,100);
    s.macroRisk = clamp(100*(.24*Math.max(0,s.inflation-.04)/.12 + .18*Math.max(0,s.unemployment-.07)/.15 + .20*Math.max(0,s.debtRatio-.75)/1.2 + .22*(1-s.bankHealth) + .16*Math.max(0,s.exchangeRate-1)/1.2),0,100);
    s.regime=this.classifyRegime();
    s.nationalScore=this.score();

    s.turn += 1;
    s.quarter += 1;
    if(s.quarter>4){ s.quarter=1; s.year += 1; }

    updateMicroeconomy(s,()=>this.rng.next());
    updateElection(s,()=>this.rng.next());
    if(s.bankruptcies>0) this.pushNews(`${s.bankruptcies} firm${s.bankruptcies===1?'':'s'} entered restructuring this quarter.`, 'bad');
    if(s.firmBirths>0) this.pushNews(`${s.firmBirths} new firm${s.firmBirths===1?'':'s'} entered the market.`, 'good');
    if(s.election.lastElectionTurn===s.turn) this.pushNews(s.election.lastResult, s.election.incumbentShare>=.5?'good':'bad');

    this.updateMission();
    this.randomDevelopment();
    this.recordHistory();
    s.lastQuarterSummary = `${periodLabel(s.year,s.quarter)} • GDP ${s.growth>=0?'+':''}${(s.growth*100).toFixed(1)}% • inflation ${(s.inflation*100).toFixed(1)}% • unemployment ${(s.unemployment*100).toFixed(1)}% • debt ${(s.debtRatio*100).toFixed(1)}%.`;
    this.pushNews(`Quarter closed: ΔGDP ${(s.realGDP-before.gdp).toFixed(1)}, inflation ${((s.inflation-before.inflation)*100).toFixed(1)}pp, unemployment ${((s.unemployment-before.u)*100).toFixed(1)}pp.`, s.growth>=0?'good':'bad');
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
      period:periodLabel(s.year,s.quarter),gdp:s.realGDP,growth:s.growth,inflation:s.inflation,unemployment:s.unemployment,
      debt:s.debtRatio,approval:s.approval,fci:s.fci,poverty:s.poverty,housingAffordability:s.housingAffordability,
      bankHealth:s.bankHealth,macroRisk:s.macroRisk,incumbentShare:s.election?.incumbentShare??.5,turnout:s.election?.turnout??.65
    };
    s.history.push(h); if(s.history.length>48) s.history.shift();
  }

  private pushNews(text:string,tone:NewsItem['tone']){
    const item:NewsItem={id:`${Date.now()}-${Math.floor(this.rng.next()*1e6)}`,period:periodLabel(this.state.year,this.state.quarter),text,tone};
    this.state.news.unshift(item); if(this.state.news.length>20) this.state.news.pop();
  }

  advisor():AdvisorRecommendation[]{
    const s=this.state;
    const recs:{id:string;why:string;watch:string}[]=[];
    if(s.inflation>.055) recs.push({id:'rate_up',why:'Inflation is above the comfort range; tighter demand and expectations may be needed.',watch:'Inflation, credit, unemployment'});
    if(s.unemployment>.075 || s.growth<0) recs.push({id:'sme_credit',why:'Labor-market slack is elevated; targeted firm credit can support hiring.',watch:'Jobs, bank health, inflation'});
    if(s.debtRatio>.9) recs.push({id:'austerity',why:'Debt service is becoming a macro-financial risk.',watch:'Debt, growth, approval'});
    if(s.bankHealth<.60) recs.push({id:'bank_recap',why:'Weak banks are impairing credit transmission.',watch:'Bank health, credit growth, debt'});
    if(s.technology<76) recs.push({id:'research_grant',why:'Productivity is lagging and constrains non-inflationary growth.',watch:'Technology, potential GDP, debt'});
    if(s.housingAffordability<.55) recs.push({id:'housing_support',why:'Housing affordability is deteriorating.',watch:'Housing index, affordability, debt'});
    if(!recs.length) recs.push({id:'business_reform',why:'Conditions are balanced; structural reform can raise medium-term capacity.',watch:'Technology, confidence, growth'});
    return recs.slice(0,4).map(r=>({...r,policy:POLICIES.find(p=>p.id===r.id)!}));
  }

  cabinet(){ return cabinetAdvice(this.state); }

  serialize(){ return JSON.stringify(this.state); }
}
