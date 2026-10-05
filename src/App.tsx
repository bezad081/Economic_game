import { useEffect, useMemo, useRef, useState } from 'react';
import { EconomyEngine } from './game/economy';
import { POLICIES, policiesByTab } from './game/policies';
import type { EconomySnapshot, GameMode, PolicySpec, Tab } from './game/types';

const SAVE_KEY = 'macrostate-economic-lab-v1';
const START_KEY = 'macrostate-economic-lab-started';
type MetricKey = 'growth'|'inflation'|'unemployment'|'debt'|'policyRate'|'creditGrowth'|'exchangeRate'|'bankHealth'|'outputGap'|'productivity'|'realWageGrowth'|'primaryBalance'|'treasury'|'businessConfidence'|'consumerConfidence'|'fxReserves'|'exports'|'imports'|'currentAccount'|'poverty'|'inequality';

const cfg: Record<MetricKey,{label:string;format:(v:number)=>string}> = {
 growth:{label:'GDP growth',format:v=>(v*100).toFixed(1)+'%'}, inflation:{label:'Inflation',format:v=>(v*100).toFixed(1)+'%'}, unemployment:{label:'Unemployment',format:v=>(v*100).toFixed(1)+'%'}, debt:{label:'Debt / GDP',format:v=>(v*100).toFixed(0)+'%'}, policyRate:{label:'Policy rate',format:v=>(v*100).toFixed(2)+'%'}, creditGrowth:{label:'Credit growth',format:v=>(v*100).toFixed(1)+'%'}, exchangeRate:{label:'Exchange rate',format:v=>v.toFixed(2)}, bankHealth:{label:'Bank health',format:v=>(v*100).toFixed(0)}, outputGap:{label:'Output gap',format:v=>(v*100).toFixed(1)+'%'}, productivity:{label:'Productivity',format:v=>v.toFixed(1)}, realWageGrowth:{label:'Real wage growth',format:v=>(v*100).toFixed(1)+'%'}, primaryBalance:{label:'Primary balance',format:v=>(v*100).toFixed(1)+'%'}, treasury:{label:'Treasury',format:v=>v.toFixed(1)}, businessConfidence:{label:'Business confidence',format:v=>(v*100).toFixed(0)}, consumerConfidence:{label:'Consumer confidence',format:v=>(v*100).toFixed(0)}, fxReserves:{label:'FX reserves',format:v=>v.toFixed(1)}, exports:{label:'Exports',format:v=>v.toFixed(1)}, imports:{label:'Imports',format:v=>v.toFixed(1)}, currentAccount:{label:'Current account',format:v=>(v*100).toFixed(1)+'%'}, poverty:{label:'Poverty',format:v=>(v*100).toFixed(1)+'%'}, inequality:{label:'Inequality',format:v=>v.toFixed(2)}
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
  const [advisorOpen,setAdvisorOpen]=useState(false);\n  const [selectedMetric,setSelectedMetric]=useState<MetricKey>('inflation');
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
      <div className="header-actions"><button className={live?'status-live':''} onClick={()=>setLive(v=>!v)}><i/> {live?'Running':'Paused'}</button><button onClick={()=>setAdvisorOpen(true)}>Advisor</button><button onClick={()=>setWire(true)}>Wire</button><button className="primary" onClick={advance}>Advance quarter →</button></div>
    </header>

    <section className="metrics-area">
      <div className="dashboard-title"><div><small>ECONOMIC DASHBOARD</small><h1>The economy at a glance</h1></div><span>Click an indicator to inspect its drivers.</span></div>
      <div className="metric-groups">
        <MetricGroup title="Macro" keys={['growth','inflation','unemployment','outputGap','productivity','realWageGrowth']} econ={econ} selected={selectedMetric} onSelect={setSelectedMetric}/>
        <MetricGroup title="Fiscal" keys={['debt','primaryBalance','treasury']} econ={econ} selected={selectedMetric} onSelect={setSelectedMetric}/>
        <MetricGroup title="Financial" keys={['policyRate','creditGrowth','bankHealth','businessConfidence','consumerConfidence']} econ={econ} selected={selectedMetric} onSelect={setSelectedMetric}/>
        <MetricGroup title="External" keys={['exchangeRate','fxReserves','exports','imports','currentAccount']} econ={econ} selected={selectedMetric} onSelect={setSelectedMetric}/>
        <MetricGroup title="Society" keys={['poverty','inequality']} econ={econ} selected={selectedMetric} onSelect={setSelectedMetric}/>
      </div>
    </section>

    <main className="lab-grid">
      <section className="map-column">
        <Panel eyebrow="ECONOMIC SYSTEM MAP" title="How the economy moves">
          <div className="economic-map">
            <div className="map-node map-policy"><b>{selected?selected.label:'POLICY INSTRUMENTS'}</b><span>{selected?'Selected policy':'Monetary · Fiscal · Structural · Trade'}</span></div>
            <div className="map-node map-finance"><b>FINANCE</b><span>Rates · Credit · Banks</span></div>
            <div className="map-node map-demand"><b>DEMAND</b><span>Consumption · Investment · Government</span></div>
            <div className="map-node map-supply"><b>SUPPLY</b><span>Productivity · Capacity · Energy</span></div>
            <div className="map-node map-output"><b>OUTPUT</b><span>GDP · Output gap</span></div>
            <div className="map-node map-jobs"><b>EMPLOYMENT</b><span>Jobs · Wages</span></div>
            <div className="map-node map-prices"><b>PRICES</b><span>Inflation · Expectations</span></div>
            <div className="map-node map-people"><b>HOUSEHOLDS & FIRMS</b><span>Income · Welfare · Confidence</span></div>
            <div className="map-flow flow-1">↓</div><div className="map-flow flow-2">→</div><div className="map-flow flow-3">↓</div><div className="map-flow flow-4">→</div>
            <div className="map-focus"><b>{cfg[selectedMetric].label}</b><span>{metricExplanation(selectedMetric,econ)}</span></div>
          </div>
          <div className="metric-inspector"><small>WHY IS IT MOVING?</small><h3>{cfg[selectedMetric].label}: {formatMetric(econ,selectedMetric)}</h3><p>{metricExplanation(selectedMetric,econ)}</p><div className="inspector-chain"><span>Drivers</span><b>→</b><span>Transmission</span><b>→</b><span>Outcome</span></div></div>
        </Panel>
      </section>

      <aside className="decision-column">
        <Panel eyebrow="POLICY DESK" title="Choose an action"><div className="tab-row">{(['Monetary','Fiscal','Structural','Trade','Emergency'] as Tab[]).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div><div className="policy-list">{policies.map(p=><PolicyCard key={p.id} policy={p} econ={econ} selected={selected?.id===p.id} onSelect={()=>setSelected(p)} onApply={()=>enact(p)}/>)}</div></Panel>
      </aside>
    </main>

    <section className="lab-grid lower-lab-grid">
      <section className="diagnosis-panel"><Panel eyebrow="ECONOMIC DIAGNOSIS" title={diagnosisTitle(econ)}><div className="diagnosis-copy"><b>{diagnosisLabel(econ)}</b><p>{diagnosisText(econ)}</p><div className="diagnosis-points"><span>Demand: {demandSignal(econ)}</span><span>Finance: {financeSignal(econ)}</span><span>Supply: {supplySignal(econ)}</span></div></div></Panel></section>
      <section><Panel eyebrow="POLICY PREVIEW" title={selected?selected.label:'Select a policy'}><Preview policy={selected} now={econ}/></Panel></section>
    </section>

    <section className="lab-grid event-trend-grid">
      <section><Panel eyebrow="EVENT ENGINE" title="What is changing?">{econ.activeEvents.filter(e=>e.status==='active').slice(0,2).map(e=><EventCard key={e.id} event={e} onPolicy={()=>{const p=POLICIES.find(x=>e.responsePolicyIds.includes(x.id));if(p){setTab(p.tab);setSelected(p)}}}/>)}{!econ.activeEvents.some(e=>e.status==='active')&&<div className="calm-state"><b>No active shock.</b><span>Even a stable economy keeps generating signals and trade-offs.</span></div>}</Panel></section>
      <section><Panel eyebrow="MACRO TRENDS" title="Where the economy has been"><MultiChart econ={econ}/></Panel></section>
    </section>

    <footer className="lab-footer"><div><span className="footer-dot"/><b>{econ.activeEvents.filter(e=>e.status==='active').length?'Active events':'Economy stable'}</b></div><div className="timeline">{econ.history.slice(-7).map(h=><span key={h.period}>{h.period.replace(' ','·')}</span>)}</div><button onClick={()=>{setLive(false);setToast('Simulation paused. Inspect the transmission map.')}}>Pause & inspect</button><button onClick={reset}>New simulation</button></footer>

    {wire&&<div className="drawer-backdrop" onClick={()=>setWire(false)}><aside className="wire-panel" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><small>ECONOMIC WIRE</small><h2>Recent developments</h2></div><button onClick={()=>setWire(false)}>×</button></div>{econ.news.slice().reverse().map(n=><article className={n.tone} key={n.id}><span>{n.period}</span><p>{n.text}</p></article>)}</aside></div>}
    {advisorOpen&&<div className="drawer-backdrop" onClick={()=>setAdvisorOpen(false)}><aside className="wire-panel advisor-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><small>ADVISOR</small><h2>Cabinet reasoning</h2></div><button onClick={()=>setAdvisorOpen(false)}>×</button></div>{recs.slice(0,4).map(r=><AdvisorCard key={r.id} rec={r} onApply={()=>{setAdvisorOpen(false);enact(r.policy)}}/>)}</aside></div>}
    <div className="toast">{toast}</div>
  </div>;
}

function Landing({hasSave,onStart,onContinue}:{hasSave:boolean;onStart:(m:GameMode)=>void;onContinue:()=>void}){
  return <div className="landing"><div className="landing-glow"/><div className="landing-content"><div className="landing-logo">M</div><p className="eyebrow">ECONOMIC POLICY SIMULATION LAB</p><h1>Understand the economy<br/><em>by making it move.</em></h1><p className="landing-copy">Observe. Diagnose. Act. Watch the consequences unfold. MACROSTATE turns disconnected economic concepts into one continuous decision-making environment.</p><div className="landing-actions"><button className="primary large" onClick={()=>onStart('sandbox')}>Start sandbox</button>{hasSave&&<button className="secondary large" onClick={onContinue}>Continue simulation</button>}<button className="secondary large" onClick={()=>onStart('mission')}>Scenario mode</button></div><div className="landing-flow"><span>SHOCK</span><b>→</b><span>DIAGNOSE</span><b>→</b><span>POLICY</span><b>→</b><span>TRANSMISSION</span><b>→</b><span>OUTCOME</span></div></div></div>;
}
function Intro({onDone}:{onDone:()=>void}){useEffect(()=>{const id=window.setTimeout(onDone,3600);return()=>window.clearTimeout(id)},[onDone]);return <div className="intro"><div className="intro-grid"/><div className="intro-core"><div className="intro-mark">M</div><div className="intro-title">MACROSTATE</div><div className="intro-sub">ECONOMIC POLICY LAB</div><div className="intro-chain"><span>SHOCK</span><i/><span>POLICY</span><i/><span>OUTCOME</span></div></div></div>}

function MetricGroup({title,keys,econ,selected,onSelect}:{title:string;keys:MetricKey[];econ:EconomySnapshot;selected:MetricKey;onSelect:(k:MetricKey)=>void}){return <div className="metric-group"><div className="group-label">{title}</div><div className="metrics-row">{keys.map(k=><button key={k} className={'metric-card '+(selected===k?'selected':'')} onClick={()=>onSelect(k)}><span>{cfg[k].label}</span><strong>{formatMetric(econ,k)}</strong><small>{metricDelta(econ,k)}</small></button>)}</div></div>}
function formatMetric(e:EconomySnapshot,k:MetricKey){const v=k==='debt'?e.debtRatio:(e as any)[k];return cfg[k].format(Number(v))}
function metricDelta(e:EconomySnapshot,k:MetricKey){const h=e.history;const v=Number(k==='debt'?e.debtRatio:(e as any)[k]);const prev=h.length>1?Number(k==='debt'?h[h.length-2].debt:(h[h.length-2] as any)[k]):v;return v>prev?'↑ vs previous':v<prev?'↓ vs previous':'→ stable'}
function diagnosisTitle(e:EconomySnapshot){if(e.inflation>.065&&e.growth>.03)return 'The economy is overheating';if(e.inflation>.06&&e.growth<.015)return 'Stagflation pressure is building';if(e.bankHealth<.55)return 'Financial transmission is impaired';if(e.unemployment>.08&&e.outputGap<-.03)return 'Demand is too weak';return 'The economy is mixed but manageable'}
function diagnosisLabel(e:EconomySnapshot){if(e.inflation>.065)return 'DEMAND / PRICE PRESSURE';if(e.bankHealth<.55)return 'FINANCIAL STRESS';if(e.unemployment>.08)return 'RECESSION RISK';return 'MONITOR THE IMBALANCES'}
function diagnosisText(e:EconomySnapshot){if(e.inflation>.065)return 'Demand is running ahead of productive capacity. Inflation expectations and credit conditions should be watched before adding more stimulus.';if(e.inflation>.06&&e.growth<.015)return 'Prices are elevated while activity is weak. Broad demand management has a difficult trade-off here.';if(e.bankHealth<.55)return 'Weak bank balance sheets can block normal monetary transmission and turn financial stress into weaker investment and jobs.';if(e.unemployment>.08)return 'Economic slack is rising. Support demand carefully while protecting inflation credibility.';return 'No single imbalance dominates. The main task is to identify which pressure is becoming important next.'}
function demandSignal(e:EconomySnapshot){return e.outputGap>.02?'overheating':e.outputGap<-.02?'weak':'balanced'}
function financeSignal(e:EconomySnapshot){return e.bankHealth<.55?'stressed':e.creditGrowth>.06?'expansionary':'normal'}
function supplySignal(e:EconomySnapshot){return e.productivity>90?'strong':e.energySecurity<.55?'constrained':'steady'}
function metricExplanation(k:MetricKey,e:EconomySnapshot){if(k==='inflation')return e.inflation>.06?'Demand, wages and expectations are keeping price pressure persistent.':'Inflation is being shaped by demand, wages, expectations and supply conditions.';if(k==='growth')return 'Growth reflects demand, financial conditions and productive capacity, with policy effects arriving through lags.';if(k==='unemployment')return 'Jobs respond to output and firms’ expectations with a delay, so today’s policy affects labor markets over several quarters.';if(k==='creditGrowth')return 'Credit links interest rates and bank health to household consumption and firm investment.';if(k==='debt')return 'Debt changes with the primary balance, growth and the cost of government financing.';return 'This indicator is connected to several parts of the economy. Select another indicator to inspect a different transmission channel.'}
function Panel({eyebrow,title,children}:{eyebrow:string;title:string;children:React.ReactNode}){return <section className="panel"><div className="panel-head"><div><small>{eyebrow}</small><h2>{title}</h2></div></div>{children}</section>}
function metricValue(h:any,k:MetricKey){return k==='debt'?h.debt:h[k]}
function MetricCard({k,econ}:{k:MetricKey;econ:EconomySnapshot}){const v=k==='debt'?econ.debtRatio:econ[k];const hist=econ.history.slice(-2);const prev=hist.length>1?metricValue(hist[0],k):v;const d=v-prev;return <div className="metric-card"><span>{cfg[k].label}</span><strong>{cfg[k].format(v)}</strong><small className={tone(k,v)}>{d>0?'↑':d<0?'↓':'→'} {d===0?'stable':'vs previous'}</small></div>}
function tone(k:MetricKey,v:number){if(k==='inflation')return v>.06?'bad':v>.04?'warn':'good';if(k==='unemployment')return v>.08?'bad':v>.065?'warn':'good';if(k==='debt')return v>.9?'bad':v>.7?'warn':'good';if(k==='bankHealth')return v<.5?'bad':v<.68?'warn':'good';if(k==='growth')return v<0?'bad':v<.015?'warn':'good';return 'neutral'}

function SparkChart({econ,metric}:{econ:EconomySnapshot;metric:MetricKey}){const vals=econ.history.slice(-20).map(h=>metricValue(h,metric));if(vals.length<2)return <div className="mini-chart"><span>{cfg[metric].label}</span><small>Build history by advancing quarters</small></div>;const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const points=vals.map((v,i)=>(i/(vals.length-1)*100)+','+(100-(v-min)/range*82-9)).join(' ');return <div className="mini-chart"><div><span>{cfg[metric].label}</span><small>{cfg[metric].format(vals[vals.length-1])}</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points}/></svg></div>}

function MultiChart({econ}:{econ:EconomySnapshot}){const h=econ.history.slice(-24);if(h.length<2)return <div className="empty-state">Advance a few quarters to build the macro history.</div>;const s=[{key:'inflation',label:'Inflation',cls:'line-a'},{key:'unemployment',label:'Unemployment',cls:'line-b'},{key:'growth',label:'GDP growth',cls:'line-c'}] as const;const all=s.flatMap(x=>h.map(y=>y[x.key]));const min=Math.min(...all),max=Math.max(...all),range=max-min||1;return <div><div className="chart-legend">{s.map(x=><span key={x.key}><i className={x.cls}/>{x.label}</span>)}</div><svg className="big-chart" viewBox="0 0 100 100" preserveAspectRatio="none">{s.map(x=><polyline key={x.key} className={x.cls} points={h.map((y,i)=>(i/(h.length-1)*100)+','+(96-(Number(y[x.key])-min)/range*78)).join(' ')}/>)}</svg></div>}

function Transmission({econ,policy}:{econ:EconomySnapshot;policy:PolicySpec|null}){const path=policy?[policy.tab==='Monetary'?'Rates / liquidity':policy.tab==='Fiscal'?'Budget / taxes':policy.tab==='Structural'?'Productive capacity':policy.tab==='Trade'?'External sector':'Emergency response','Financial conditions','Demand / supply','Output & jobs','Inflation / welfare']:['Current conditions','Financial system','Demand / supply','Output & jobs','Inflation / welfare'];return <div className="transmission"><div className="pressure"><span>Dominant pressure</span><b>{pressure(econ)}</b></div><div className="flow">{path.map((x,i)=><div className={i===0?'flow-node selected':'flow-node'} key={x}><span>{i+1}</span><b>{x}</b>{i<path.length-1&&<i>↓</i>}</div>)}</div><div className="causal-note"><b>Think in mechanisms</b><span>{policy?policy.tradeoff:'A policy matters because it changes a mechanism, which then changes output, jobs, prices and welfare.'}</span></div></div>}
function pressure(e:EconomySnapshot){if(e.inflation>.06)return 'Inflation persistence';if(e.unemployment>.08)return 'Labor weakness';if(e.bankHealth<.55)return 'Financial stress';if(e.debtRatio>.9)return 'Fiscal pressure';if(e.growth>.05)return 'Overheating risk';return 'Balanced conditions'}
function regimeText(e:EconomySnapshot){if(e.regime==='Recession')return 'Demand is weak and labor slack is rising.';if(e.regime==='Stagflation')return 'Supply pressure and weak activity are colliding.';if(e.regime==='Overheating')return 'Demand is running ahead of capacity.';if(e.regime==='Financial Stress')return 'The banking channel is impairing normal transmission.';return 'No single imbalance dominates. Watch the emerging pressures.'}

function Signal({label,value,status}:{label:string;value:string;status:'normal'|'weak'|'high'|'stress'}){return <div className="signal"><span>{label}</span><b>{value}</b><i className={status}>{status}</i></div>}
function EventCard({event,onPolicy}:{event:any;onPolicy:()=>void}){return <article className={'event-card severity-'+event.severity}><span>SEVERITY {event.severity}</span><h3>{event.title}</h3><p>{event.description}</p><button onClick={onPolicy}>View response →</button></article>}
function PolicyCard({policy,econ,selected,onSelect,onApply}:{policy:PolicySpec;econ:EconomySnapshot;selected:boolean;onSelect:()=>void;onApply:()=>void}){const locked=(econ.cooldowns[policy.id]||0)>0||econ.policyCapacity<policy.capacityCost||econ.politicalCapital<policy.politicalCost;return <article className={'policy-card '+(selected?'selected':'')} onClick={onSelect}><div className="policy-top"><div><span>{policy.tab}</span><h3>{policy.label}</h3></div><b>{policy.duration}Q · lag {policy.tab==='Monetary'?1:policy.tab==='Fiscal'?1:policy.tab==='Trade'?2:policy.tab==='Structural'?3:1}Q</b></div><p>{policy.description}</p><div className="tradeoff"><span>Trade-off</span>{policy.tradeoff}</div><div className="policy-meta"><span>Capacity −{policy.capacityCost}</span><span>Political −{policy.politicalCost}</span></div><button disabled={locked} onClick={e=>{e.stopPropagation();onApply()}}>{locked?'Unavailable':'Apply policy'}</button></article>}
function AdvisorCard({rec,onApply}:{rec:any;onApply:()=>void}){return <article className="advisor-card"><div className="advisor-role">{rec.role}</div><h3>{rec.title}</h3><p>{rec.rationale}</p><div className="advisor-watch"><b>Watch:</b> {rec.watch||'Observe the next transmission step before acting again.'}</div><button onClick={onApply}>Open policy →</button></article>}
function Preview({policy,now}:{policy:PolicySpec|null;now:EconomySnapshot}){if(!policy)return <div className="empty-state">Select a policy to inspect its trade-off before committing.</div>;
  const base=new EconomyEngine(now.mode,now); const sim=new EconomyEngine(now.mode,now);
  const enacted=sim.enact(policy.id); if(!enacted.ok)return <div className="empty-state">{enacted.reason}</div>;
  const out:EconomySnapshot[]=[]; const baseOut:EconomySnapshot[]=[];
  for(let i=0;i<8;i++){base.stepQuarter();sim.stepQuarter();baseOut.push(base.snapshot());out.push(sim.snapshot())}
  const horizons=[{q:1,s:out[0],b:baseOut[0]},{q:2,s:out[1],b:baseOut[1]},{q:4,s:out[3],b:baseOut[3]},{q:8,s:out[7],b:baseOut[7]}];
  const delta=(s:EconomySnapshot,b:EconomySnapshot,k:keyof EconomySnapshot)=>Number(s[k])-Number(b[k]);
  const channel=policy.tab==='Monetary'?'Interest rate → real rate → credit & demand → output / inflation':policy.tab==='Fiscal'?'Fiscal impulse → aggregate demand → output & jobs → inflation / debt':policy.tab==='Structural'?'Reform → productivity / capacity → potential output → wages & prices':policy.tab==='Trade'?'Competitiveness → exports / imports → output → FX & prices':'Shock response → financial / household conditions → macro stability';
  return <div className="preview">
    <div className="preview-policy"><b>{policy.label}</b><span>counterfactual model path</span></div>
    <div className="transmission-line"><small>TRANSMISSION</small><p>{channel}</p></div>
    <div className="forecast-head"><span>Change vs no-policy path</span>{horizons.map(h=><b key={h.q}>Q+{h.q}</b>)}</div>
    {[['GDP growth','growth'],['Inflation','inflation'],['Unemployment','unemployment'],['Debt ratio','debtRatio']].map(([label,key])=><div className="forecast-row" key={label as string}><span>{label}</span>{horizons.map(h=>{const d=delta(h.s,h.b,key as keyof EconomySnapshot);return <b className={d>0?'delta-up':d<0?'delta-down':''} key={h.q}>{d>=0?'+':''}{(d*100).toFixed(2)}pp</b>})}</div>)}
    <div className="preview-risk"><b>Main trade-off</b><span>{policy.tradeoff}</span></div>
  </div>
}
function Debrief({econ,policy}:{econ:EconomySnapshot;policy:PolicySpec|null}){return <div className="debrief"><div><span>LEARNING NOTE</span><p>{econ.lastLearningNote}</p></div><div className="debrief-grid"><div><small>Last policy</small><b>{policy?.label||'None'}</b></div><div><small>Macro risk</small><b>{econ.macroRisk.toFixed(0)}/100</b></div><div><small>Approval</small><b>{(econ.approval*100).toFixed(0)}/100</b></div></div></div>}

export {};
