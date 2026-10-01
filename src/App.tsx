import { useEffect, useMemo, useRef, useState } from 'react';
import PhaserCity, { type CityView } from './components/PhaserCity';
import QuarterPulse from './components/QuarterPulse';
import OnboardingModal from './components/OnboardingModal';
import PolicyPanel from './components/PolicyPanel';
import ReportModal from './components/ReportModal';
import SystemsModal from './components/SystemsModal';
import TrendPanel from './components/TrendPanel';
import StartScreen, { type StartSetup } from './components/StartScreen';
import { EconomyEngine } from './game/economy';
import type { EconomySnapshot, GameMode, PolicySpec, Tab } from './game/types';

const KEY='macrostate-native-save-v7-1';
const GUIDE_KEY='macrostate-guide-v7-1';
const SIMPLE_KEY='macrostate-simple-v7-1';
const START_KEY='macrostate-started-v7-1';
const pct=(x:number,d=1)=>`${(x*100).toFixed(d)}%`;

function loadSaved():EconomySnapshot|undefined { try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):undefined}catch{return undefined} }

export default function App(){
  const engineRef=useRef<EconomyEngine>();
  if(!engineRef.current) engineRef.current=new EconomyEngine(loadSaved()?.mode??'sandbox',loadSaved());
  const [econ,setEcon]=useState(()=>engineRef.current!.snapshot());
  const [tab,setTab]=useState<Tab>('Monetary');
  const [paused,setPaused]=useState(true);
  const [speed,setSpeed]=useState(1);
  const [focus,setFocus]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [report,setReport]=useState(false);
  const [systems,setSystems]=useState(false);
  const [showNews,setShowNews]=useState(false);
  const [guide,setGuide]=useState(false);
  const [simple,setSimple]=useState(()=>localStorage.getItem(SIMPLE_KEY)!=='advanced');
  const [trendCollapsed,setTrendCollapsed]=useState(false);
  const [toast,setToast]=useState('Welcome. Read the objective, make one move, then advance a quarter.');
  const [cityView,setCityView]=useState<CityView>('City');
  const [quarterBefore,setQuarterBefore]=useState<EconomySnapshot|null>(null);
  const [showPulse,setShowPulse]=useState(false);
  const [started,setStarted]=useState(()=>localStorage.getItem(START_KEY)==='yes');
  const [role,setRole]=useState<StartSetup['role']>(()=>(localStorage.getItem('macrostate-role-v7-1') as StartSetup['role'])||'Chief Economist');

  const sync=()=>{const s=engineRef.current!.snapshot();setEcon(s);localStorage.setItem(KEY,JSON.stringify(s))};
  const quarter=()=>{
    const before=engineRef.current!.snapshot();
    engineRef.current!.stepQuarter();
    const after=engineRef.current!.snapshot();
    setQuarterBefore(before);
    setEcon(after);
    localStorage.setItem(KEY,JSON.stringify(after));
    setShowPulse(false);
    setToast(engineRef.current!.state.lastQuarterSummary);
  };
  useEffect(()=>{if(paused||!started)return;const ms=speed===1?9500:speed===2?5400:3000;const id=setInterval(quarter,ms);return()=>clearInterval(id)},[paused,speed,started]);

  const recommendations=useMemo(()=>engineRef.current!.advisor(),[econ]);
  const enact=(p:PolicySpec)=>{const r=engineRef.current!.enact(p.id);sync();setToast(r.ok?`${p.label} enacted. Let the effects transmit before overreacting.`:r.reason)};
  const shock=(k:'oil'|'financial'|'sanctions'|'boom'|'food')=>{engineRef.current!.triggerShock(k);sync();setToast(`${k} scenario shock triggered.`)};
  const newGame=(mode:GameMode,setup?:StartSetup)=>{
    engineRef.current=new EconomyEngine(mode);
    if(setup){
      setRole(setup.role);localStorage.setItem('macrostate-role-v7-1',setup.role);
      if(setup.role==='Central Bank Governor')setTab('Monetary');
      else if(setup.role==='Finance Minister')setTab('Fiscal');
      else if(setup.role==='Development Minister')setTab('Structural');
      else setTab('Advisor');
      const s=engineRef.current.state;
      if(setup.scenario==='Inflation Shock'){s.inflation=.079;s.inflationExpected=.061;s.growth=.041;s.approval=.47;s.regime='Overheating';s.macroRisk=34;}
      if(setup.scenario==='Recession'){s.growth=-.032;s.unemployment=.091;s.businessConfidence=.39;s.consumerConfidence=.43;s.approval=.41;s.regime='Recession';s.macroRisk=41;}
      if(setup.scenario==='Financial Crisis'){s.bankHealth=.46;s.creditGrowth=-.052;s.fci=74;s.macroRisk=61;s.approval=.43;s.regime='Financial Stress';}
      if(setup.difficulty==='Accessible'){s.policyCapacity=100;s.politicalCapital=85;setSimple(true);}
      if(setup.difficulty==='Expert'){s.policyCapacity=78;s.politicalCapital=58;s.approval=Math.max(.15,s.approval-.04);s.macroRisk=Math.min(100,s.macroRisk+8);setSimple(false);}
    }
    sync();setSelected(null);setShowPulse(false);setQuarterBefore(null);setPaused(false);setStarted(true);localStorage.setItem(START_KEY,'yes');setToast(mode==='mission'?'Campaign started — follow the mandate and protect the whole economy.':'Sandbox started — every policy tool is available.');
  };
  const guideStart=(mode:GameMode)=>{setGuide(false);newGame(mode);setSimple(true);localStorage.setItem(SIMPLE_KEY,'beginner');localStorage.setItem(GUIDE_KEY,'done');};
  const continueGame=()=>{setStarted(true);setPaused(false);localStorage.setItem(START_KEY,'yes');};
  const openGuide=()=>setGuide(true);
  const toggleSimple=()=>setSimple(v=>{const next=!v;localStorage.setItem(SIMPLE_KEY,next?'beginner':'advanced');return next});
  const district=selected?districtContext(selected,econ):null;
  const topPriority=priorityText(econ);

  return <>
  {!started && <StartScreen hasSave={!!loadSaved()} econ={econ} onContinue={continueGame} onStart={newGame} onGuide={openGuide} />}
  <div className={`app v4 v5 v6 v7 ${focus?'focus':''} ${simple?'simple-mode':'advanced-mode'} ${trendCollapsed?'trend-collapsed':''}`}>
    <header className="topbar">
      <div className="brand"><div className="logo">M</div><div><strong>MACROSTATE</strong><small>{role.toUpperCase()} • V7 PHASER EDITION</small></div></div>
      <div className="period"><span>Q{econ.quarter} {econ.year}</span><b>{econ.regime}</b></div>
      <div className="priority-strip"><span>Priority</span><b>{topPriority}</b></div>
      <div className="top-controls">
        <button className="guide-btn" onClick={openGuide}>Guide</button>
        <button className={`mode-toggle ${simple?'beginner':''}`} onClick={toggleSimple}>{simple?'Beginner':'Advanced'}</button>
        <button onClick={()=>setPaused(v=>!v)}>{paused?'▶ Resume':'Ⅱ Pause'}</button>
        <div className="speed">{[1,2,4].map(s=><button key={s} onClick={()=>setSpeed(s)} className={speed===s?'active':''}>×{s}</button>)}</div>
        {quarterBefore&&<button onClick={()=>setShowPulse(v=>!v)}>Review</button>}
        <button className="next-quarter" onClick={quarter}>Next Quarter →</button>
        {!simple&&<><button onClick={()=>setReport(true)}>Brief</button><button onClick={()=>setSystems(true)}>Systems</button><button onClick={()=>setFocus(v=>!v)}>{focus?'Dashboard':'Focus'}</button></>}
      </div>
    </header>

    <main className="game-layout">
      <section className="city-wrap">
        <PhaserCity econ={econ} focus={focus} view={cityView} onSelect={setSelected}/>
        <div className="city-overlay top-left"><span className="live-dot"/> NATIONAL CAPITAL<div>{selected?'District selected':'Click a district to inspect it'}</div></div>
        <div className="city-lenses"><span>City lens</span>{(['City','Prosperity','Jobs','Risk'] as CityView[]).map(v=><button key={v} className={cityView===v?'active':''} onClick={()=>setCityView(v)}>{v}</button>)}</div>
        {district&&<div className={`district-card ${district.tone}`}><header><span>{district.icon}</span><div><small>{selected}</small><b>{district.title}</b></div><button onClick={()=>setSelected(null)}>×</button></header><p>{district.description}</p><div><span>{district.metricLabel}</span><strong>{district.metric}</strong></div></div>}
        {econ.activeMission&&<div className="mission-card"><span>GUIDED OBJECTIVE</span><b>{econ.activeMission.title}</b><p>{econ.activeMission.description}</p><div><progress value={econ.activeMission.progress} max={1}/><small>{econ.activeMission.targetText} • {Math.max(0,econ.activeMission.deadline-econ.turn)}Q left</small></div></div>}
        <div className="toast"><span>●</span>{toast}</div>
        {showPulse&&<QuarterPulse previous={quarterBefore} current={econ} onClose={()=>setShowPulse(false)}/>}        
      </section>
      {!focus&&<PolicyPanel tab={tab} setTab={setTab} econ={econ} onPolicy={enact} onShock={shock} simple={simple} recommendations={recommendations} onAdvanced={()=>{setSimple(false);localStorage.setItem(SIMPLE_KEY,'advanced')}}/>}
    </main>

    {!focus&&<section className="bottom-deck">
      <div className="metric-rail">
        <Metric title="GDP Growth" value={pct(econ.growth)} sub={econ.growth>.025?'Healthy activity':econ.growth>0?'Soft growth':'Contraction'} state={econ.growth<0?'bad':econ.growth<.015?'warn':'good'}/>
        <Metric title="Inflation" value={pct(econ.inflation)} sub={`Expected ${pct(econ.inflationExpected)}`} state={econ.inflation>.06?'bad':econ.inflation>.04?'warn':'good'}/>
        <Metric title="Unemployment" value={pct(econ.unemployment)} sub={`${econ.totalEmployment} modeled jobs`} state={econ.unemployment>.085?'bad':econ.unemployment>.065?'warn':'good'}/>
        <Metric title="Approval" value={pct(econ.approval,0)} sub={`National score ${econ.nationalScore.toFixed(0)}`} state={econ.approval<.4?'bad':econ.approval<.52?'warn':'good'}/>
        {!simple&&<><Metric title="Debt / GDP" value={pct(econ.debtRatio)} sub={`Treasury ${econ.treasury.toFixed(0)}`} state={econ.debtRatio>.95?'bad':econ.debtRatio>.75?'warn':'good'}/><Metric title="Bank Health" value={`${(econ.bankHealth*100).toFixed(0)}`} sub={`FCI ${econ.fci.toFixed(1)}`} state={econ.bankHealth<.5?'bad':econ.bankHealth<.68?'warn':'good'}/></>}
      </div>
      <TrendPanel econ={econ} collapsed={trendCollapsed} onToggle={()=>setTrendCollapsed(v=>!v)}/>
    </section>}

    <footer className="footer"><div className="mode-switch"><button className={econ.mode==='sandbox'?'active':''} onClick={()=>newGame('sandbox')}>Sandbox</button><button className={econ.mode==='mission'?'active':''} onClick={()=>newGame('mission')}>Guided Campaign</button></div><button className="news-toggle" onClick={()=>setShowNews(v=>!v)}>Economic Wire <b>{econ.news.length}</b></button><div className="ticker"><span className={econ.news[0]?.tone}>{econ.news[0]?.period}</span>{econ.news[0]?.text}</div></footer>
    {showNews&&<aside className="news-drawer"><header><b>Economic Wire</b><button onClick={()=>setShowNews(false)}>×</button></header>{econ.news.map(n=><article key={n.id}><span className={n.tone}>{n.period}</span><p>{n.text}</p></article>)}</aside>}
    {report&&<ReportModal econ={econ} onClose={()=>setReport(false)}/>} 
    {systems&&<SystemsModal econ={econ} advice={engineRef.current!.cabinet()} onPolicy={(p)=>{enact(p);setSystems(false)}} onClose={()=>setSystems(false)}/>} 
    {guide&&<OnboardingModal econ={econ} onClose={()=>setGuide(false)} onStart={guideStart}/>} 
  </div></>;
}

function Metric({title,value,sub,state}:{title:string;value:string;sub:string;state:'good'|'warn'|'bad'}){return <div className={`metric ${state}`}><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>}

function priorityText(e:EconomySnapshot){if(e.inflation>.055)return'Inflation';if(e.unemployment>.075||e.growth<0)return'Jobs & growth';if(e.bankHealth<.6)return'Bank stability';if(e.debtRatio>.9)return'Debt sustainability';if(e.housingAffordability<.5)return'Housing';return'Productivity & resilience'}

function districtContext(name:string,e:EconomySnapshot){
  const data:Record<string,{icon:string;title:string;description:string;metricLabel:string;metric:string;tone:string}>={
    'CENTRAL BANK':{icon:'◉',title:'Monetary policy & expectations',description:'Interest rates shape demand, credit, inflation expectations and the currency.',metricLabel:'Policy rate',metric:pct(e.policyRate),tone:e.inflation>.06?'warn':'good'},
    'TREASURY':{icon:'◆',title:'Public finance',description:'Fiscal choices support demand and investment but consume treasury space and affect debt.',metricLabel:'Debt / GDP',metric:pct(e.debtRatio),tone:e.debtRatio>.9?'bad':e.debtRatio>.75?'warn':'good'},
    'TECH PARK':{icon:'⌁',title:'Technology & productivity',description:'Innovation expands potential output and makes growth less inflationary over time.',metricLabel:'Technology',metric:e.technology.toFixed(0),tone:e.technology<75?'warn':'good'},
    'HOSPITAL':{icon:'+',title:'Health & resilience',description:'Household welfare and labor resilience deteriorate when poverty and economic stress rise.',metricLabel:'Poverty',metric:pct(e.poverty),tone:e.poverty>.16?'bad':e.poverty>.12?'warn':'good'},
    'MARKET':{icon:'▦',title:'Household demand',description:'Shops respond to purchasing power, confidence, prices and labor-market conditions.',metricLabel:'Consumer confidence',metric:pct(e.consumerConfidence,0),tone:e.consumerConfidence<.45?'bad':e.consumerConfidence<.58?'warn':'good'},
    'BANK HQ':{icon:'$',title:'Financial transmission',description:'Healthy banks pass monetary policy into lending. Weak banks can choke credit even after rate cuts.',metricLabel:'Bank health',metric:`${(e.bankHealth*100).toFixed(0)}/100`,tone:e.bankHealth<.5?'bad':e.bankHealth<.68?'warn':'good'},
    'FACTORY':{icon:'▰',title:'Industrial production',description:'Industry reacts to demand, financing conditions, energy security and productivity.',metricLabel:'Business confidence',metric:pct(e.businessConfidence,0),tone:e.businessConfidence<.45?'bad':'good'},
    'HOUSING':{icon:'⌂',title:'Housing market',description:'Rates and credit affect house prices while new supply improves long-run affordability.',metricLabel:'Affordability',metric:pct(e.housingAffordability,0),tone:e.housingAffordability<.5?'bad':e.housingAffordability<.65?'warn':'good'},
    'UNIVERSITY':{icon:'◇',title:'Human capital',description:'Education and research increase the productive capacity of workers and firms over time.',metricLabel:'Productivity',metric:e.productivity.toFixed(2),tone:'good'},
    'SME DISTRICT':{icon:'▣',title:'Small business & jobs',description:'SMEs are sensitive to credit, demand and confidence and are a key channel into employment.',metricLabel:'Firms',metric:String(e.firms.length),tone:e.bankruptcies>1?'bad':'good'},
    'PORT / TRADE':{icon:'≋',title:'Trade & exchange rate',description:'Exports, imports and the currency transmit foreign demand and supply shocks into the economy.',metricLabel:'FX index',metric:e.exchangeRate.toFixed(3),tone:e.exchangeRate>1.25?'bad':e.exchangeRate>1.1?'warn':'good'},
    'ENERGY':{icon:'ϟ',title:'Energy system',description:'Energy resilience affects production costs, inflation and the environmental footprint.',metricLabel:'Energy security',metric:pct(e.energySecurity,0),tone:e.energySecurity<.55?'bad':e.energySecurity<.7?'warn':'good'}
  };return data[name]
}
