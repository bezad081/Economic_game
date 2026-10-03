import { useEffect, useMemo, useRef, useState } from 'react';
import AdvisorDesk from './components/AdvisorDesk';
import ChartDeck from './components/ChartDeck';
import EventDesk from './components/EventDesk';
import KpiBoard from './components/KpiBoard';
import LearningDebrief from './components/LearningDebrief';
import MacroNavigator from './components/MacroNavigator';
import PolicyConsoleV9 from './components/PolicyConsoleV9';
import StartScreenV9, { type V9Setup } from './components/StartScreenV9';
import TransmissionMap from './components/TransmissionMap';
import { EconomyEngine } from './game/economy';
import { POLICIES } from './game/policies';
import type { EconomySnapshot, GameMode, PolicySpec, Tab } from './game/types';

const SAVE_KEY='macrostate-policy-command-v12';
const START_KEY='macrostate-policy-command-v12-started';

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
  const [difficulty,setDifficulty]=useState<V9Setup['difficulty']>('Standard');
  const [live,setLive]=useState(false);
  const [liveSpeed,setLiveSpeed]=useState<1|2>(1);
  const [toast,setToast]=useState('The economy is live. Read the monitor, choose one policy, advance one quarter, then respond to the changes.');

  const persist=(s:EconomySnapshot)=>{setEcon(s);localStorage.setItem(SAVE_KEY,JSON.stringify(s))};
  const sync=()=>persist(engineRef.current!.snapshot());
  const recommendations=useMemo(()=>engineRef.current!.advisor(),[econ]);

  const enact=(p:PolicySpec)=>{
    const result=engineRef.current!.enact(p.id);
    if(result.ok){setLastPolicy(p);setToast(`${p.label} enacted. Watch the transmission channels and risk desk next quarter.`);} else setToast(result.reason);
    sync();
  };

  const advance=()=>{
    try{
      engineRef.current!.stepQuarter();
      const next=engineRef.current!.snapshot();
      persist(next);
      const critical=next.activeEvents.find(e=>e.status==='active'&&e.severity>=4);
      if(critical&&live){setLive(false);setToast(`Critical alert: ${critical.title}. Live simulation paused so you can respond.`);} else setToast(next.lastLearningNote);
    }catch(err){console.error(err);setLive(false);setToast('Simulation guard caught an error. Your previous state was preserved.');}
  };

  useEffect(()=>{
    if(!started||!live)return;
    const ms=liveSpeed===1?12000:7000;
    const id=window.setInterval(advance,ms);
    return()=>window.clearInterval(id);
  },[started,live,liveSpeed,econ.turn]);

  const startGame=(mode:GameMode,setup:V9Setup)=>{
    engineRef.current=new EconomyEngine(mode);
    applySetup(engineRef.current.state,setup);
    setDifficulty(setup.difficulty);
    setTab('Advisor');setLastPolicy(null);setLive(true);
    setStarted(true);localStorage.setItem(START_KEY,'yes');
    sync();
    setToast(mode==='mission'?'Campaign active. Build resilience and respond to shocks as they emerge.':'Sandbox active. The economy begins balanced; events and shocks will arise dynamically.');
  };

  const continueGame=()=>{setStarted(true);setLive(true);localStorage.setItem(START_KEY,'yes')};
  const reset=()=>{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(START_KEY);engineRef.current=new EconomyEngine('sandbox');setEcon(engineRef.current.snapshot());setStarted(false);setLastPolicy(null);setLive(false)};
  const activeImpulse=lastPolicy??findLastPolicy(econ.lastPolicy);

  if(!started)return <StartScreenV9 hasSave={!!initialSaved} econ={econ} onContinue={continueGame} onStart={startGame}/>;

  return <div className="v12-app">
    <header className="command-header">
      <div className="command-brand"><div className="command-logo">M</div><div><strong>MACROSTATE</strong><small>POLICY SIMULATION • V12</small></div></div>
      <div className="header-chip"><span>Quarter</span><b>Q{econ.quarter} {econ.year}</b></div>
      <div className="header-chip"><span>Regime</span><b>{econ.regime}</b></div>
      <div className="header-chip"><span>Mode</span><b>{econ.mode==='mission'?'Campaign':'Sandbox'}</b></div>
      <div className="header-chip"><span>Difficulty</span><b>{difficulty}</b></div>
      <div className="header-chip highlight"><span>National score</span><b>{econ.nationalScore.toFixed(0)}</b></div>
      <div className="live-controls"><button className={live?'live-on':''} onClick={()=>setLive(v=>!v)}><i/> {live?'Live':'Paused'}</button><button className={liveSpeed===1?'active':''} onClick={()=>setLiveSpeed(1)}>1×</button><button className={liveSpeed===2?'active':''} onClick={()=>setLiveSpeed(2)}>2×</button></div>
      <div className="command-actions"><button onClick={()=>setTab('Advisor')}>Advisor</button><button onClick={()=>setNewsOpen(v=>!v)}>Wire <i>{econ.news.length}</i></button><button className="reset-button" onClick={reset}>New simulation</button><button className="advance-button" onClick={advance}>Advance quarter →</button></div>
    </header>

    <KpiBoard econ={econ}/>

    <main className="command-grid v12-layout">
      <MacroNavigator econ={econ}/>
      <section className="analysis-column">
        <ChartDeck econ={econ}/>
        <div className="analysis-lower-row"><TransmissionMap econ={econ} lastPolicy={activeImpulse}/><LearningDebrief econ={econ}/></div>
      </section>
      <aside className="decision-rail">
        <AdvisorDesk econ={econ} recommendations={recommendations} onPolicy={enact}/>
        <EventDesk econ={econ} recommendations={recommendations}/>
        <PolicyConsoleV9 econ={econ} tab={tab} setTab={setTab} onPolicy={enact} recommendations={recommendations}/>
      </aside>
    </main>

    <footer className="command-footer"><div className="footer-status"><span className={`pulse-dot ${econ.activeEvents.length?'alert':''}`}/><b>{econ.activeEvents.length?`${econ.activeEvents.length} active policy event${econ.activeEvents.length>1?'s':''}`:'No acute policy event'}</b></div><div className="footer-ticker"><span>{econ.news[0]?.period}</span>{econ.news[0]?.text??'Policy command initialized.'}</div><div className="footer-mode">{live?`LIVE ${liveSpeed}×`:(econ.mode==='mission'?'GUIDED CAMPAIGN':'OPEN SANDBOX')}</div></footer>

    {newsOpen&&<aside className="wire-drawer"><header><div><span className="eyebrow">ECONOMIC WIRE</span><h2>Policy & market feed</h2></div><button onClick={()=>setNewsOpen(false)}>×</button></header>{econ.news.map(n=><article key={n.id} className={n.tone}><span>{n.period}</span><p>{n.text}</p></article>)}</aside>}
    <div className="command-toast">{toast}</div>
  </div>;
}

function findLastPolicy(text:string){return POLICIES.find(p=>text.startsWith(p.label))??null}
function applySetup(s:EconomySnapshot,setup:V9Setup){if(setup.difficulty==='Learning'){s.policyCapacity=104;s.politicalCapital=90;s.credibility=Math.max(s.credibility,.76);}if(setup.difficulty==='Expert'){s.policyCapacity=76;s.politicalCapital=60;s.approval=Math.max(.15,s.approval-.03);s.macroRisk=Math.min(100,s.macroRisk+6);s.credibility=Math.max(.2,s.credibility-.06);}s.regime='Balanced Expansion';s.lastLearningNote='The economy starts balanced. Shocks and event chains emerge endogenously as quarters pass.';}
