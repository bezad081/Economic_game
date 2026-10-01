import { useEffect, useRef, useState } from 'react';
import CityCanvas from './components/CityCanvas';
import PolicyPanel from './components/PolicyPanel';
import ReportModal from './components/ReportModal';
import SystemsModal from './components/SystemsModal';
import { EconomyEngine } from './game/economy';
import type { EconomySnapshot, GameMode, PolicySpec, Tab } from './game/types';

const KEY='macrostate-native-save-v1';
const pct=(x:number,d=1)=>`${(x*100).toFixed(d)}%`;

function loadSaved():EconomySnapshot|undefined { try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):undefined}catch{return undefined} }

export default function App(){
  const engineRef=useRef<EconomyEngine>();
  if(!engineRef.current) engineRef.current=new EconomyEngine(loadSaved()?.mode??'sandbox',loadSaved());
  const [econ,setEcon]=useState(()=>engineRef.current!.snapshot());
  const [tab,setTab]=useState<Tab>('Monetary');
  const [paused,setPaused]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [focus,setFocus]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [report,setReport]=useState(false);
  const [systems,setSystems]=useState(false);
  const [showNews,setShowNews]=useState(false);
  const [toast,setToast]=useState('Systems engine online');

  const sync=()=>{const s=engineRef.current!.snapshot();setEcon(s);localStorage.setItem(KEY,JSON.stringify(s));};
  const quarter=()=>{engineRef.current!.stepQuarter();sync();setToast(engineRef.current!.state.lastQuarterSummary)};

  useEffect(()=>{if(paused)return;const ms=speed===1?8500:speed===2?4800:2500;const id=setInterval(quarter,ms);return()=>clearInterval(id)},[paused,speed]);

  const enact=(p:PolicySpec)=>{const r=engineRef.current!.enact(p.id);sync();setToast(r.ok?`${p.label} enacted — effects are lagged.`:r.reason)};
  const shock=(k:'oil'|'financial'|'sanctions'|'boom'|'food')=>{engineRef.current!.triggerShock(k);sync();setToast(`${k} scenario shock triggered.`)};
  const newGame=(mode:GameMode)=>{engineRef.current=new EconomyEngine(mode);sync();setToast(mode==='mission'?'Mission Campaign started.':'New Sandbox started.');};

  return <div className={`app ${focus?'focus':''}`}>
    <header className="topbar"><div className="brand"><div className="logo">M</div><div><strong>MACROSTATE</strong><small>SYSTEMS EDITION</small></div></div><div className="period"><span>Q{econ.quarter} {econ.year}</span><b>{econ.regime}</b></div><div className="top-controls"><button onClick={()=>setPaused(v=>!v)}>{paused?'▶ Resume':'Ⅱ Pause'}</button><div className="speed">{[1,2,4].map(s=><button key={s} onClick={()=>setSpeed(s)} className={speed===s?'active':''}>×{s}</button>)}</div><button onClick={quarter}>Next Quarter</button><button onClick={()=>setReport(true)}>Brief</button><button onClick={()=>setSystems(true)}>Systems</button><button onClick={()=>setFocus(v=>!v)}>{focus?'Dashboard':'Focus'}</button></div></header>

    <main className="game-layout"><section className="city-wrap"><CityCanvas econ={econ} focus={focus} onSelect={setSelected}/><div className="city-overlay top-left"><span className="live-dot"/> LIVE CITY<div>{selected?`Selected: ${selected}`:'Click a district for context'}</div></div>{econ.activeMission&&<div className="mission-card"><span>MISSION</span><b>{econ.activeMission.title}</b><p>{econ.activeMission.description}</p><div><progress value={econ.activeMission.progress} max={1}/><small>{econ.activeMission.targetText} • {Math.max(0,econ.activeMission.deadline-econ.turn)}Q left</small></div></div>}<div className="toast">{toast}</div></section>{!focus&&<PolicyPanel tab={tab} setTab={setTab} econ={econ} onPolicy={enact} onShock={shock}/>}</main>

    {!focus&&<section className="dashboard"><Metric title="Real GDP" value={econ.realGDP.toFixed(0)} sub={`Growth ${pct(econ.growth)}`} good={econ.growth>0}/><Metric title="Inflation" value={pct(econ.inflation)} sub={`Expected ${pct(econ.inflationExpected)}`} good={econ.inflation<.045}/><Metric title="Unemployment" value={pct(econ.unemployment)} sub={`Credit ${pct(econ.creditGrowth)}`} good={econ.unemployment<.065}/><Metric title="Approval" value={pct(econ.approval,0)} sub={`National ${econ.nationalScore.toFixed(0)}/100`} good={econ.approval>.5}/><Metric title="Debt / GDP" value={pct(econ.debtRatio)} sub={`Treasury ${econ.treasury.toFixed(0)}`} good={econ.debtRatio<.8}/><Metric title="Bank health" value={`${(econ.bankHealth*100).toFixed(0)}`} sub={`FCI ${econ.fci.toFixed(1)}`} good={econ.bankHealth>.65}/><Metric title="FX" value={econ.exchangeRate.toFixed(3)} sub={`Risk ${econ.macroRisk.toFixed(1)}`} good={econ.exchangeRate<1.25}/><Metric title="Housing" value={econ.housingIndex.toFixed(0)} sub={`Affordability ${(econ.housingAffordability*100).toFixed(0)}`} good={econ.housingAffordability>.6}/></section>}

    <footer className="footer"><div className="mode-switch"><button className={econ.mode==='sandbox'?'active':''} onClick={()=>newGame('sandbox')}>New Sandbox</button><button className={econ.mode==='mission'?'active':''} onClick={()=>newGame('mission')}>New Campaign</button></div><button className="news-toggle" onClick={()=>setShowNews(v=>!v)}>News {econ.news.length}</button><div className="ticker"><span className={econ.news[0]?.tone}>{econ.news[0]?.period}</span>{econ.news[0]?.text}</div></footer>
    {showNews&&<aside className="news-drawer"><header><b>Economic Wire</b><button onClick={()=>setShowNews(false)}>×</button></header>{econ.news.map(n=><article key={n.id}><span className={n.tone}>{n.period}</span><p>{n.text}</p></article>)}</aside>}
    {report&&<ReportModal econ={econ} onClose={()=>setReport(false)}/>}
    {systems&&<SystemsModal econ={econ} advice={engineRef.current!.cabinet()} onPolicy={(p)=>{enact(p);setSystems(false)}} onClose={()=>setSystems(false)}/>} 
  </div>;
}

function Metric({title,value,sub,good}:{title:string;value:string;sub:string;good:boolean}){return <div className="metric"><span>{title}</span><strong>{value}</strong><small className={good?'good':'warn'}>{sub}</small></div>}
