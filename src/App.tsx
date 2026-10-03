import { useMemo, useRef, useState } from 'react';
import ChartDeck from './components/ChartDeck';
import EventDesk from './components/EventDesk';
import KpiBoard from './components/KpiBoard';
import LearningDebrief from './components/LearningDebrief';
import PolicyConsoleV9 from './components/PolicyConsoleV9';
import StartScreenV9, { type V9Setup } from './components/StartScreenV9';
import TransmissionMap from './components/TransmissionMap';
import { EconomyEngine } from './game/economy';
import { POLICIES } from './game/policies';
import type { EconomySnapshot, GameMode, PolicySpec, Tab } from './game/types';

const SAVE_KEY='macrostate-policy-command-v10';
const START_KEY='macrostate-policy-command-v10-started';

function loadSaved():EconomySnapshot|undefined{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw):undefined}catch{return undefined}}

export default function App(){
  const initialSaved=useRef(loadSaved()).current;
  const engineRef=useRef<EconomyEngine>();
  if(!engineRef.current)engineRef.current=new EconomyEngine(initialSaved?.mode??'sandbox',initialSaved);
  const [econ,setEcon]=useState(()=>engineRef.current!.snapshot());
  const [started,setStarted]=useState(()=>localStorage.getItem(START_KEY)==='yes');
  const [tab,setTab]=useState<Tab>('Advisor');
  const [lastPolicy,setLastPolicy]=useState<PolicySpec|null>(null);
  const [newsOpen,setNewsOpen]=useState(false);
  const [difficulty,setDifficulty]=useState<V9Setup['difficulty']>('Learning');
  const [toast,setToast]=useState('Diagnose the economy, choose one instrument, advance one quarter, then read the outcome.');

  const sync=()=>{const s=engineRef.current!.snapshot();setEcon(s);localStorage.setItem(SAVE_KEY,JSON.stringify(s))};
  const recommendations=useMemo(()=>engineRef.current!.advisor(),[econ]);

  const enact=(p:PolicySpec)=>{
    const result=engineRef.current!.enact(p.id);
    if(result.ok){setLastPolicy(p);setToast(`${p.label} enacted. Transmission unfolds over ${p.duration} quarters.`);} else setToast(result.reason);
    sync();
  };

  const advance=()=>{
    try{
      engineRef.current!.stepQuarter();
      sync();
      setToast(engineRef.current!.state.lastLearningNote);
    }catch(err){console.error(err);setToast('Simulation guard caught an error. Your previous state was preserved.');}
  };

  const startGame=(mode:GameMode,setup:V9Setup)=>{
    engineRef.current=new EconomyEngine(mode);
    applySetup(engineRef.current.state,setup);
    setDifficulty(setup.difficulty);
    setTab('Advisor');
    setLastPolicy(null);
    setStarted(true);localStorage.setItem(START_KEY,'yes');
    sync();
    setToast(mode==='mission'?'Guided campaign active. Stabilize the economy while building long-run capacity.':'Sandbox active. Experiment with policies and shocks freely.');
  };

  const continueGame=()=>{setStarted(true);localStorage.setItem(START_KEY,'yes')};
  const reset=()=>{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(START_KEY);engineRef.current=new EconomyEngine('sandbox');setEcon(engineRef.current.snapshot());setStarted(false);setLastPolicy(null)};
  const activeImpulse=lastPolicy??findLastPolicy(econ.lastPolicy);

  if(!started)return <StartScreenV9 hasSave={!!initialSaved} econ={econ} onContinue={continueGame} onStart={startGame}/>;

  return <div className="v10-app">
    <header className="command-header">
      <div className="command-brand"><div className="command-logo">M</div><div><strong>MACROSTATE</strong><small>POLICY COMMAND • V10</small></div></div>
      <div className="header-chip"><span>Quarter</span><b>Q{econ.quarter} {econ.year}</b></div>
      <div className="header-chip"><span>Regime</span><b>{econ.regime}</b></div>
      <div className="header-chip"><span>Mode</span><b>{econ.mode==='mission'?'Campaign':'Sandbox'}</b></div>
      <div className="header-chip hide-mobile"><span>Difficulty</span><b>{difficulty}</b></div>
      <div className="header-chip highlight"><span>National score</span><b>{econ.nationalScore.toFixed(0)}</b></div>
      <div className="command-actions"><button onClick={()=>setTab('Advisor')}>Advisor</button><button onClick={()=>setNewsOpen(v=>!v)}>Wire <i>{econ.news.length}</i></button><button className="reset-button" onClick={reset}>New simulation</button><button className="advance-button" onClick={advance}>Advance quarter →</button></div>
    </header>

    <KpiBoard econ={econ}/>

    <main className="command-grid">
      <PolicyConsoleV9 econ={econ} tab={tab} setTab={setTab} onPolicy={enact} recommendations={recommendations}/>
      <section className="analysis-column">
        <ChartDeck econ={econ}/>
        <div className="analysis-lower-row">
          <TransmissionMap econ={econ} lastPolicy={activeImpulse}/>
          <LearningDebrief econ={econ}/>
        </div>
      </section>
      <EventDesk econ={econ} recommendations={recommendations}/>
    </main>

    <footer className="command-footer"><div className="footer-status"><span className={`pulse-dot ${econ.activeEvents.length?'alert':''}`}/><b>{econ.activeEvents.length?`${econ.activeEvents.length} active policy event${econ.activeEvents.length>1?'s':''}`:'No acute policy event'}</b></div><div className="footer-ticker"><span>{econ.news[0]?.period}</span>{econ.news[0]?.text??'Policy command initialized.'}</div><div className="footer-mode">{econ.mode==='mission'?'GUIDED CAMPAIGN':'OPEN SANDBOX'}</div></footer>

    {newsOpen&&<aside className="wire-drawer"><header><div><span className="eyebrow">ECONOMIC WIRE</span><h2>Policy & market feed</h2></div><button onClick={()=>setNewsOpen(false)}>×</button></header>{econ.news.map(n=><article key={n.id} className={n.tone}><span>{n.period}</span><p>{n.text}</p></article>)}</aside>}
    <div className="command-toast">{toast}</div>
  </div>;
}

function findLastPolicy(text:string){return POLICIES.find(p=>text.startsWith(p.label))??null}

function applySetup(s:EconomySnapshot,setup:V9Setup){
  if(setup.scenario==='Inflation Shock'){s.inflation=.082;s.coreInflation=.065;s.inflationExpected=.061;s.wageGrowth=.068;s.growth=.038;s.outputGap=.035;s.approval=.47;s.regime='Overheating';s.macroRisk=38;s.credibility=.58;}
  if(setup.scenario==='Recession'){s.growth=-.036;s.unemployment=.094;s.outputGap=-.06;s.businessConfidence=.38;s.consumerConfidence=.41;s.creditGrowth=-.01;s.approval=.42;s.regime='Recession';s.macroRisk=43;}
  if(setup.scenario==='Financial Crisis'){s.bankHealth=.44;s.creditGrowth=-.065;s.fci=77;s.macroRisk=68;s.approval=.43;s.sovereignSpread=.025;s.regime='Financial Stress';}
  if(setup.scenario==='Debt Stress'){s.debtRatio=1.03;s.primaryBalance=-.055;s.sovereignSpread=.055;s.treasury=12;s.approval=.45;s.macroRisk=57;s.regime='Fiscal Stress';}
  if(setup.difficulty==='Learning'){s.policyCapacity=100;s.politicalCapital=88;s.credibility=Math.max(s.credibility,.75);}
  if(setup.difficulty==='Expert'){s.policyCapacity=72;s.politicalCapital=58;s.approval=Math.max(.15,s.approval-.04);s.macroRisk=Math.min(100,s.macroRisk+10);s.credibility=Math.max(.2,s.credibility-.08);}
  s.lastLearningNote='Start by diagnosing the macro regime. Compare demand, inflation, fiscal and financial drivers before using an instrument.';
}
