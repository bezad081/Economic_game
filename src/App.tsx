import { useEffect, useMemo, useRef, useState } from 'react';
import { EconomyEngine } from './game/economy';
import { POLICIES, policiesByTab } from './game/policies';
import type { EconomySnapshot, GameMode, PolicySpec, Tab } from './game/types';

const SAVE_KEY = 'macrostate-economic-lab-v1';
const START_KEY = 'macrostate-economic-lab-started';
type MetricKey = 'growth'|'inflation'|'unemployment'|'debt'|'policyRate'|'creditGrowth'|'exchangeRate'|'bankHealth';

const cfg: Record<MetricKey,{label:string;format:(v:number)=>string}> = {
  growth:{label:'GDP growth',format:v=>(v*100).toFixed(1)+'%'},
  inflation:{label:'Inflation',format:v=>(v*100).toFixed(1)+'%'},
  unemployment:{label:'Unemployment',format:v=>(v*100).toFixed(1)+'%'},
  debt:{label:'Public debt',format:v=>(v*100).toFixed(0)+'% GDP'},
  policyRate:{label:'Policy rate',format:v=>(v*100).toFixed(2)+'%'},
  creditGrowth:{label:'Credit growth',format:v=>(v*100).toFixed(1)+'%'},
  exchangeRate:{label:'FX index',format:v=>v.toFixed(2)},
  bankHealth:{label:'Bank health',format:v=>(v*100).toFixed(0)}
};
const readSave=():EconomySnapshot|undefined=>{try{const r=localStorage.getItem(SAVE_KEY);return r?JSON.parse(r):undefined}catch{return undefined}};

export default function App(){
  const saved=useRef(readSave()).current;
  const engineRef=useRef<EconomyEngine>();
  if(!engineRef.current)engineRef.current=new EconomyEngine(saved?.mode||'sandbox',saved);
  const [econ,setEcon]=useState(()=>engineRef.current!.snapshot());
  const [started,setStarted]=useState(()=>localStorage.getItem(START_KEY)==='yes');
  const [intro,setIntro]=useState(false);
  const [live,setLive]=useState(false);
  const [speed,setSpeed]=useState<1|2>(1);
  const [tab,setTab]=useState<Tab>('Monetary');
  const [selected,setSelected]=useState<PolicySpec|null>(null);
  const [wire,setWire]=useState(false);
  const [toast,setToast]=useState('Read the indicators, diagnose the economy, then choose a policy.');

  const persist=(s:EconomySnapshot)=>{setEcon(s);localStorage.setItem(SAVE_KEY,JSON.stringify(s))};
  const advance=()=>{try{engineRef.current!.stepQuarter();const n=engineRef.current!.snapshot();persist(n);const c=n.activeEvents.find(e=>e.status==='active'&&e.severity>=4);if(c){setLive(false);setToast('Critical event: '+c.title+'. Pause and respond.')}else setToast(n.lastLearningNote)}catch(e){console.error(e);setLive(false);setToast('Simulation error caught; previous state preserved.')}};
  const enact=(p:PolicySpec)=>{const r=engineRef.current!.enact(p.id);if(!r.ok){setToast(r.reason);return}setSelected(p);persist(engineRef.current!.snapshot());setToast(p.label+' enacted. Advance the quarter to observe transmission.')};
  const start=(mode:GameMode)=>{engineRef.current=new EconomyEngine(mode);const s=engineRef.current.snapshot();setEcon(s);setStarted(true);setIntro(true);setLive(true);setSelected(null);localStorage.setItem(START_KEY,'yes');localStorage.setItem(SAVE_KEY,JSON.stringify(s));setToast(mode==='mission'?'Scenario mode active. Manage the economy under pressure.':'Sandbox active. Explore the transmission channels.')};
  const continueGame=()=>{setStarted(true);setIntro(true);setLive(true);localStorage.setItem(START_KEY,'yes')};
  const reset=()=>{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(START_KEY);engineRef.current=new EconomyEngine('sandbox');setEcon(engineRef.current.snapshot());setStarted(false);setLive(false);setSelected(null)};
  useEffect(()=>{if(!started||!live)return;const id=window.setInterval(advance,speed===1?12000:6500);return()=>window.clearInterval(id)},[started,live,speed,econ.turn]);
  const recs=useMemo(()=>engineRef.current!.advisor(),[econ.turn,econ.inflation,econ.growth,econ.unemployment,econ.debtRatio,econ.bankHealth]);
  const policies=useMemo(()=>policiesByTab(tab==='Advisor'?'Monetary':tab),[tab]);

  if(!started)return <Landing hasSave={!!saved} onStart={start} onContinue={continueGame}/>;

  return <div className="lab-shell">
    {intro&&<Intro onDone={()=>setIntro(false)}/>}
    <header className="lab-header">
      <div className="brand"><div className="brand-mark">M</div><div><strong>MACROSTATE</strong><span>ECONOMIC POLICY LAB</span></div></div>
      <div className="header-context"><span>Q{econ.quarter} · {econ.year}</span><b>{econ.regime}</b></div>
      <div className="header-actions"><button className={live?'status-live':''} onClick={()=>setLive(v=>!v)}><i/> {live?'Running':'Paused'}</button><button className={speed===1?'selected':''} onClick={()=>setSpeed(1)}>1×</button><button className={speed===2?'selected':''} onClick={()=>setSpeed(2)}>2×</button><button onClick={()=>setWire(true)}>Economic wire</button><button className="primary" onClick={advance}>Advance quarter →</button></div>
    </header>

    <section className="metrics-grid">{(['growth','inflation','unemployment','debt','policyRate','creditGrowth','exchangeRate','bankHealth'] as MetricKey[]).map(k=><MetricCard key={k} k={k} econ={econ}/>)}</section>

    <main className="lab-grid">
      <section className="state-column">
        <Panel eyebrow="ECONOMIC STATE" title="What is happening?">
          <div className="regime-card"><span className="regime-dot"/><div><b>{econ.regime}</b><p>{regimeText(econ)}</p></div></div>
          <SparkChart econ={econ} metric="growth"/><SparkChart econ={econ} metric="inflation"/><SparkChart econ={econ} metric="unemployment"/>
        </Panel>
        <Panel eyebrow="EVENTS" title="What changed?">
          {econ.activeEvents.filter(e=>e.status==='active').slice(0,3).map(e=><EventCard key={e.id} event={e} onPolicy={()=>{const p=POLICIES.find(x=>e.responsePolicyIds.includes(x.id));if(p){setTab(p.tab);setSelected(p)}}}/>)}
          {!econ.activeEvents.some(e=>e.status==='active')&&<div className="empty-state">No acute event. A calm economy still needs monitoring.</div>}
        </Panel>
      </section>

      <section className="center-column">
        <Panel eyebrow="ECONOMIC TRANSMISSION" title="Why is it happening?"><Transmission econ={econ} policy={selected}/></Panel>
        <Panel eyebrow="MACRO TRENDS" title="The economy over time"><MultiChart econ={econ}/></Panel>
        <Panel eyebrow="POLICY RESULT" title="What did the last decision do?"><Debrief econ={econ} policy={selected}/></Panel>
      </section>

      <aside className="decision-column">
        <Panel eyebrow="POLICY DESK" title="Choose an action">
          <div className="tab-row">{(['Monetary','Fiscal','Structural','Trade','Emergency'] as Tab[]).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
          <div className="policy-list">{policies.slice(0,8).map(p=><PolicyCard key={p.id} policy={p} econ={econ} selected={selected?.id===p.id} onSelect={()=>setSelected(p)} onApply={()=>enact(p)}/>)}</div>
        </Panel>
        <Panel eyebrow="ADVISOR" title="Cabinet reasoning">{recs.slice(0,3).map(r=><AdvisorCard key={r.id} rec={r} onApply={()=>enact(r.policy)}/>)}</Panel>
        <Panel eyebrow="POLICY PREVIEW" title={selected?selected.label:'Select a policy'}><Preview policy={selected} now={econ}/></Panel>
      </aside>
    </main>

    <footer className="lab-footer"><div><span className="footer-dot"/><b>{econ.activeEvents.filter(e=>e.status==='active').length?'Active events':'Economy stable'}</b></div><div className="timeline">{econ.history.slice(-7).map(h=><span key={h.period}>{h.period.replace(' ','·')}</span>)}</div><button onClick={()=>{setLive(false);setToast('Simulation paused. Inspect the transmission map.')}}>Pause & inspect</button><button onClick={reset}>New simulation</button></footer>

    {wire&&<div className="drawer-backdrop" onClick={()=>setWire(false)}><aside className="wire-panel" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><small>ECONOMIC WIRE</small><h2>Recent developments</h2></div><button onClick={()=>setWire(false)}>×</button></div>{econ.news.slice().reverse().map(n=><article className={n.tone} key={n.id}><span>{n.period}</span><p>{n.text}</p></article>)}</aside></div>}
    <div className="toast">{toast}</div>
  </div>;
}

function Landing({hasSave,onStart,onContinue}:{hasSave:boolean;onStart:(m:GameMode)=>void;onContinue:()=>void}){
  return <div className="landing"><div className="landing-glow"/><div className="landing-content"><div className="landing-logo">M</div><p className="eyebrow">ECONOMIC POLICY SIMULATION LAB</p><h1>Understand the economy<br/><em>by making it move.</em></h1><p className="landing-copy">Observe. Diagnose. Act. Watch the consequences unfold. MACROSTATE turns disconnected economic concepts into one continuous decision-making environment.</p><div className="landing-actions"><button className="primary large" onClick={()=>onStart('sandbox')}>Start sandbox</button>{hasSave&&<button className="secondary large" onClick={onContinue}>Continue simulation</button>}<button className="secondary large" onClick={()=>onStart('mission')}>Scenario mode</button></div><div className="landing-flow"><span>SHOCK</span><b>→</b><span>DIAGNOSE</span><b>→</b><span>POLICY</span><b>→</b><span>TRANSMISSION</span><b>→</b><span>OUTCOME</span></div></div></div>;
}
function Intro({onDone}:{onDone:()=>void}){useEffect(()=>{const id=window.setTimeout(onDone,3600);return()=>window.clearTimeout(id)},[onDone]);return <div className="intro"><div className="intro-grid"/><div className="intro-core"><div className="intro-mark">M</div><div className="intro-title">MACROSTATE</div><div className="intro-sub">ECONOMIC POLICY LAB</div><div className="intro-chain"><span>SHOCK</span><i/><span>POLICY</span><i/><span>OUTCOME</span></div></div></div>}

function Panel({eyebrow,title,children}:{eyebrow:string;title:string;children:React.ReactNode}){return <section className="panel"><div className="panel-head"><div><small>{eyebrow}</small><h2>{title}</h2></div></div>{children}</section>}
function metricValue(h:any,k:MetricKey){return k==='debt'?h.debt:h[k]}
function MetricCard({k,econ}:{k:MetricKey;econ:EconomySnapshot}){const v=k==='debt'?econ.debtRatio:econ[k];const hist=econ.history.slice(-2);const prev=hist.length>1?metricValue(hist[0],k):v;const d=v-prev;return <div className="metric-card"><span>{cfg[k].label}</span><strong>{cfg[k].format(v)}</strong><small className={tone(k,v)}>{d>0?'↑':d<0?'↓':'→'} {d===0?'stable':'vs previous'}</small></div>}
function tone(k:MetricKey,v:number){if(k==='inflation')return v>.06?'bad':v>.04?'warn':'good';if(k==='unemployment')return v>.08?'bad':v>.065?'warn':'good';if(k==='debt')return v>.9?'bad':v>.7?'warn':'good';if(k==='bankHealth')return v<.5?'bad':v<.68?'warn':'good';if(k==='growth')return v<0?'bad':v<.015?'warn':'good';return 'neutral'}

function SparkChart({econ,metric}:{econ:EconomySnapshot;metric:MetricKey}){const vals=econ.history.slice(-20).map(h=>metricValue(h,metric));if(vals.length<2)return <div className="mini-chart"><span>{cfg[metric].label}</span><small>Build history by advancing quarters</small></div>;const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const points=vals.map((v,i)=>(i/(vals.length-1)*100)+','+(100-(v-min)/range*82-9)).join(' ');return <div className="mini-chart"><div><span>{cfg[metric].label}</span><small>{cfg[metric].format(vals[vals.length-1])}</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points}/></svg></div>}

function MultiChart({econ}:{econ:EconomySnapshot}){const h=econ.history.slice(-24);if(h.length<2)return <div className="empty-state">Advance a few quarters to build the macro history.</div>;const s=[{key:'inflation',label:'Inflation',cls:'line-a'},{key:'unemployment',label:'Unemployment',cls:'line-b'},{key:'growth',label:'GDP growth',cls:'line-c'}] as const;const all=s.flatMap(x=>h.map(y=>y[x.key]));const min=Math.min(...all),max=Math.max(...all),range=max-min||1;return <div><div className="chart-legend">{s.map(x=><span key={x.key}><i className={x.cls}/>{x.label}</span>)}</div><svg className="big-chart" viewBox="0 0 100 100" preserveAspectRatio="none">{s.map(x=><polyline key={x.key} className={x.cls} points={h.map((y,i)=>(i/(h.length-1)*100)+','+(96-(Number(y[x.key])-min)/range*78)).join(' ')}/>)}</svg></div>}

function Transmission({econ,policy}:{econ:EconomySnapshot;policy:PolicySpec|null}){const path=policy?[policy.tab==='Monetary'?'Rates / liquidity':policy.tab==='Fiscal'?'Budget / taxes':policy.tab==='Structural'?'Productive capacity':policy.tab==='Trade'?'External sector':'Emergency response','Financial conditions','Demand / supply','Output & jobs','Inflation / welfare']:['Current conditions','Financial system','Demand / supply','Output & jobs','Inflation / welfare'];return <div className="transmission"><div className="pressure"><span>Dominant pressure</span><b>{pressure(econ)}</b></div><div className="flow">{path.map((x,i)=><div className={i===0?'flow-node selected':'flow-node'} key={x}><span>{i+1}</span><b>{x}</b>{i<path.length-1&&<i>↓</i>}</div>)}</div><div className="causal-note"><b>Think in mechanisms</b><span>{policy?policy.tradeoff:'A policy matters because it changes a mechanism, which then changes output, jobs, prices and welfare.'}</span></div></div>}
function pressure(e:EconomySnapshot){if(e.inflation>.06)return 'Inflation persistence';if(e.unemployment>.08)return 'Labor weakness';if(e.bankHealth<.55)return 'Financial stress';if(e.debtRatio>.9)return 'Fiscal pressure';if(e.growth>.05)return 'Overheating risk';return 'Balanced conditions'}
function regimeText(e:EconomySnapshot){if(e.regime==='Recession')return 'Demand is weak and labor slack is rising.';if(e.regime==='Stagflation')return 'Supply pressure and weak activity are colliding.';if(e.regime==='Overheating')return 'Demand is running ahead of capacity.';if(e.regime==='Financial Stress')return 'The banking channel is impairing normal transmission.';return 'No single imbalance dominates. Watch the emerging pressures.'}

function EventCard({event,onPolicy}:{event:any;onPolicy:()=>void}){return <article className={'event-card severity-'+event.severity}><span>SEVERITY {event.severity}</span><h3>{event.title}</h3><p>{event.description}</p><button onClick={onPolicy}>View response →</button></article>}
function PolicyCard({policy,econ,selected,onSelect,onApply}:{policy:PolicySpec;econ:EconomySnapshot;selected:boolean;onSelect:()=>void;onApply:()=>void}){const locked=(econ.cooldowns[policy.id]||0)>0||econ.policyCapacity<policy.capacityCost||econ.politicalCapital<policy.politicalCost;return <article className={'policy-card '+(selected?'selected':'')} onClick={onSelect}><div className="policy-top"><div><span>{policy.tab}</span><h3>{policy.label}</h3></div><b>{policy.duration}Q · lag {policy.tab==='Monetary'?1:policy.tab==='Fiscal'?1:policy.tab==='Trade'?2:policy.tab==='Structural'?3:1}Q</b></div><p>{policy.description}</p><div className="tradeoff"><span>Trade-off</span>{policy.tradeoff}</div><div className="policy-meta"><span>Capacity −{policy.capacityCost}</span><span>Political −{policy.politicalCost}</span></div><button disabled={locked} onClick={e=>{e.stopPropagation();onApply()}}>{locked?'Unavailable':'Apply policy'}</button></article>}
function AdvisorCard({rec,onApply}:{rec:any;onApply:()=>void}){return <article className="advisor-card"><div className="advisor-role">{rec.role}</div><h3>{rec.title}</h3><p>{rec.rationale}</p><div className="advisor-watch"><b>Watch:</b> {rec.watch||'Observe the next transmission step before acting again.'}</div><button onClick={onApply}>Open policy →</button></article>}
function Preview({policy,now}:{policy:PolicySpec|null;now:EconomySnapshot}){if(!policy)return <div className="empty-state">Select a policy to inspect its trade-off before committing.</div>;const sim=new EconomyEngine(now.mode,now);const r=sim.enact(policy.id);if(!r.ok)return <div className="empty-state">{r.reason}</div>;const out:EconomySnapshot[]=[];for(let i=0;i<4;i++){sim.stepQuarter();out.push(sim.snapshot())}const f=out[3];return <div className="preview"><div className="preview-policy"><b>{policy.label}</b><span>4-quarter model preview</span></div>{[['GDP growth',now.growth,f.growth],['Inflation',now.inflation,f.inflation],['Unemployment',now.unemployment,f.unemployment],['Debt ratio',now.debtRatio,f.debtRatio]].map(x=><div className="preview-row" key={x[0] as string}><span>{x[0]}</span><b>{(Number(x[1])*100).toFixed(1)}% → {(Number(x[2])*100).toFixed(1)}%</b></div>)}<div className="preview-risk"><b>Main trade-off</b><span>{policy.tradeoff}</span></div></div>}
function Debrief({econ,policy}:{econ:EconomySnapshot;policy:PolicySpec|null}){return <div className="debrief"><div><span>LEARNING NOTE</span><p>{econ.lastLearningNote}</p></div><div className="debrief-grid"><div><small>Last policy</small><b>{policy?.label||'None'}</b></div><div><small>Macro risk</small><b>{econ.macroRisk.toFixed(0)}/100</b></div><div><small>Approval</small><b>{(econ.approval*100).toFixed(0)}/100</b></div></div></div>}

export {};
