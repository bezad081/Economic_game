import type { CabinetAdvice, EconomySnapshot, FirmSector, FirmState, HouseholdCohort } from './types';

const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
const sectors:FirmSector[]=['Industry','Services','Technology','Construction','Export','Energy'];
const names=['Atlas','Nova','Pioneer','Civic','Vertex','Meridian','Orion','Harbor','Summit','Lattice','Union','Keystone'];

export function seedFirms():FirmState[]{
  return Array.from({length:18},(_,i)=>{
    const sector=sectors[i%sectors.length];
    const size=24+(i*17)%92;
    return {
      id:`firm-${i+1}`,
      name:`${names[i%names.length]} ${sector}`,
      sector,
      employees:size,
      wage:1.0+(i%5)*.08,
      productivity:.88+(i%7)*.045,
      cash:18+(i%6)*5,
      leverage:.28+(i%5)*.09,
      health:.68+(i%4)*.07,
      profit:2+(i%6)*.7,
      investment:1.2+(i%4)*.4,
    };
  });
}

export function seedHouseholds():HouseholdCohort[]{
  return [
    {id:'lower',label:'Lower income',populationShare:.38,income:1.0,wealth:18,consumption:.91,unemployment:.085,sentiment:.54},
    {id:'middle',label:'Middle income',populationShare:.47,income:2.2,wealth:62,consumption:.78,unemployment:.052,sentiment:.63},
    {id:'upper',label:'Upper income',populationShare:.15,income:5.4,wealth:220,consumption:.57,unemployment:.026,sentiment:.71},
  ];
}

export function updateMicroeconomy(s:EconomySnapshot, rand:()=>number){
  if(!s.firms?.length) s.firms=seedFirms();
  if(!s.households?.length) s.households=seedHouseholds();
  let bankruptcies=0,births=0,totalEmployment=0,wageBill=0,firmSales=0,firmInvestment=0;
  const gap=s.realGDP/Math.max(1,s.potentialGDP)-1;
  const realFunding=Math.max(-.03,s.realRate);
  const sectorBoost:Record<FirmSector,number>={
    Industry:.45*s.growth+.012*(s.energySecurity-.7),
    Services:.55*s.growth+.015*(s.consumerConfidence-.6),
    Technology:.35*s.growth+.0018*(s.technology-72),
    Construction:.6*s.growth+.10*(s.creditGrowth-.03)-.06*Math.max(0,s.policyRate-.05),
    Export:.35*s.growth+.035*(s.exchangeRate-1)+.006*(s.exports/115-1),
    Energy:.30*s.growth+.025*(s.energySecurity-.7),
  };

  for(const f of s.firms){
    const demand=sectorBoost[f.sector]+.012*(s.businessConfidence-.6)+.006*gap;
    const financingDrag=.08*Math.max(0,realFunding-.01)*f.leverage;
    const productivityGrowth=.002+.00035*(s.technology-70)+.002*(f.sector==='Technology'?1:0);
    f.productivity=clamp(f.productivity*(1+productivityGrowth),.6,2.2);
    const revenue=Math.max(.2,(f.employees/28)*f.productivity*(1+demand+rand()*.025));
    const wageCost=(f.employees/34)*f.wage*(1+s.inflation*.22);
    const debtCost=f.leverage*(.7+5*Math.max(0,s.policyRate));
    f.profit=revenue-wageCost-debtCost;
    f.cash=clamp(f.cash+f.profit*.42-f.investment*.25,0,90);
    f.health=clamp(f.health+.018*f.profit-.10*Math.max(0,s.unemployment-.08)-financingDrag+(rand()-.5)*.025,.03,1);
    f.investment=clamp(1.1+3.5*Math.max(0,f.profit)+2.2*Math.max(0,s.creditGrowth)+.8*(s.businessConfidence-.5),0,12);
    f.leverage=clamp(f.leverage+.004*Math.max(0,f.investment-3)-.012*Math.max(0,f.profit),.08,1.2);
    const desired=Math.max(5,Math.round(f.employees*(1+clamp(.18*demand+.006*f.profit,-.07,.08))));
    f.employees=Math.round(.78*f.employees+.22*desired);
    f.wage=clamp(f.wage*(1+.18*s.inflation/4+.015*Math.max(-.03,s.growth/4)),.65,3.2);
    if(f.health<.13 && f.cash<4){
      bankruptcies++;
      f.health=.55; f.cash=12; f.leverage=.22; f.employees=Math.max(8,Math.round(f.employees*.38)); f.profit=0;
    }
    totalEmployment+=f.employees;
    wageBill+=f.employees*f.wage;
    firmSales+=revenue;
    firmInvestment+=f.investment;
  }

  if(s.businessConfidence>.72 && s.creditGrowth>.025 && rand()>.72){
    const i=s.firms.length+1; const sector=sectors[Math.floor(rand()*sectors.length)%sectors.length];
    s.firms.push({id:`firm-${s.turn}-${i}`,name:`New ${names[i%names.length]} ${sector}`,sector,employees:14+Math.round(rand()*18),wage:1.0,productivity:.92+rand()*.18,cash:14,leverage:.24,health:.66,profit:1.2,investment:1.6});
    births++;
  }
  if(s.firms.length>26) s.firms=s.firms.slice(-26);

  const inflationPain=Math.max(0,s.inflation-.025);
  const housingPain=Math.max(0,.68-s.housingAffordability);
  for(const h of s.households){
    const sensitivity=h.id==='lower'?1.35:h.id==='middle'?1:.65;
    h.unemployment=clamp(s.unemployment*(h.id==='lower'?1.35:h.id==='upper' ? .55 : .9),.01,.38);
    const wageGrowth=.35*s.growth+.22*s.inflation-.10*h.unemployment;
    h.income=clamp(h.income*(1+wageGrowth/4),.45,12);
    const wealthReturn=h.id==='upper'?(.012+s.growth*.08-s.policyRate*.02):(.004+s.growth*.03);
    h.wealth=clamp(h.wealth*(1+wealthReturn)+Math.max(0,h.income*(1-h.consumption))*.18,2,700);
    h.consumption=clamp(h.consumption+.025*inflationPain*sensitivity+.015*housingPain*sensitivity-.012*Math.max(0,s.growth-.03),.42,.96);
    h.sentiment=clamp(.76*h.sentiment+.24*(.76-2.2*inflationPain*sensitivity-1.6*h.unemployment-.65*housingPain+s.approval*.35),.08,.94);
  }

  const low=s.households.find(h=>h.id==='lower')!;
  const middle=s.households.find(h=>h.id==='middle')!;
  const householdIncome=s.households.reduce((a,h)=>a+h.income*h.populationShare,0);
  const householdConsumption=s.households.reduce((a,h)=>a+h.income*h.consumption*h.populationShare,0);
  const householdSavings=Math.max(0,householdIncome-householdConsumption);
  const capacityUtilization=clamp(.72+.75*gap+.18*(s.businessConfidence-.6)-.08*Math.max(0,s.policyRate-.06),.45,1.08);
  s.householdIncome=householdIncome;
  s.householdSavings=householdSavings;
  s.firmSales=firmSales;
  s.firmInvestment=firmInvestment;
  s.capacityUtilization=capacityUtilization;
  s.poverty=clamp(.65*s.poverty+.35*(.04+.62*low.unemployment+.10*inflationPain+.08*housingPain),.025,.46);
  s.inequality=clamp(.72*s.inequality+.28*(.28+.12*Math.log(Math.max(1,s.households[2].wealth/middle.wealth))+.06*housingPain),.22,.65);
  s.consumerConfidence=clamp(.45*s.consumerConfidence+.55*s.households.reduce((a,h)=>a+h.sentiment*h.populationShare,0),.1,.95);
  s.businessConfidence=clamp(.52*s.businessConfidence+.48*(s.firms.reduce((a,f)=>a+f.health,0)/Math.max(1,s.firms.length)),.1,.95);
  s.bankruptcies=bankruptcies;
  s.firmBirths=births;
  s.totalEmployment=totalEmployment;
  s.averageWage=wageBill/Math.max(1,totalEmployment);
}

export function updateElection(s:EconomySnapshot, rand:()=>number){
  if(!s.election){
    s.election={lastElectionTurn:0,nextElectionTurn:16,incumbentShare:.54,oppositionShare:.46,turnout:.68,campaignActive:false,lastResult:'No election held yet'};
  }
  const e=s.election;
  const quartersLeft=e.nextElectionTurn-s.turn;
  e.campaignActive=quartersLeft<=4 && quartersLeft>0;
  const fundamentals=.50+.27*(s.approval-.5)+.0018*(s.nationalScore-55)+.40*(s.growth-.02)-.55*Math.max(0,s.inflation-.04)-.35*Math.max(0,s.unemployment-.065)-.10*Math.max(0,s.debtRatio-.85);
  e.incumbentShare=clamp(.72*e.incumbentShare+.28*fundamentals+(rand()-.5)*.012,.22,.78);
  e.oppositionShare=1-e.incumbentShare;
  e.turnout=clamp(.62+.14*Math.abs(e.incumbentShare-.5)+.10*Math.max(0,s.macroRisk/100-.25),.5,.82);
  if(s.turn>=e.nextElectionTurn){
    const won=e.incumbentShare>=.5;
    e.lastResult=won?`Government re-elected with ${(e.incumbentShare*100).toFixed(1)}%`:`Government lost with ${(e.incumbentShare*100).toFixed(1)}%; caretaker mandate begins`;
    e.lastElectionTurn=s.turn; e.nextElectionTurn=s.turn+16;
    s.politicalCapital=won?clamp(s.politicalCapital+18,0,100):clamp(Math.min(s.politicalCapital,30),0,100);
    s.approval=clamp(s.approval+(won ? .018 : -.035),.05,.95);
    e.campaignActive=false;
  }
}

export function cabinetAdvice(s:EconomySnapshot):CabinetAdvice[]{
  const out:CabinetAdvice[]=[];
  const add=(role:CabinetAdvice['role'],title:string,rationale:string,urgency:number,actionId?:string)=>out.push({role,title,rationale,urgency,actionId});
  if(s.inflation>.05) add('Central Bank','Anchor inflation expectations','Inflation is above the comfort band and expectations may become persistent.',Math.min(100,55+s.inflation*500),'rate_up');
  else if(s.growth<.005 && s.unemployment>.07) add('Central Bank','Ease financial conditions','Weak demand and labor slack justify cautious monetary support.',72,'rate_down');
  if(s.debtRatio>.82) add('Treasury','Rebuild fiscal space','Debt dynamics are reducing room for future stabilization.',76,'austerity');
  else if(s.growth<0) add('Treasury','Targeted counter-cyclical support','A temporary targeted package can cushion the downturn.',66,'stimulus');
  const weak=s.firms.filter(f=>f.health<.4).length;
  if(weak>3 || s.bankruptcies>0) add('Industry','Stabilize viable firms',`${weak} firms show weak balance sheets; broad support should be avoided in favor of targeted liquidity.`,70,'sme_credit');
  if(s.poverty>.15 || s.households?.[0]?.sentiment<.45) add('Social Affairs','Protect vulnerable households','Cost-of-living and labor-market stress are concentrated in lower-income households.',74,'welfare_up');
  if(s.energySecurity<.62) add('Energy','Improve energy resilience','Energy security is low enough to amplify inflation and production risks.',68,'infra_up');
  if(!out.length) add('Industry','Use the calm window for productivity','Macro conditions are balanced enough for medium-term reforms.',45,'business_reform');
  return out.sort((a,b)=>b.urgency-a.urgency).slice(0,5);
}
