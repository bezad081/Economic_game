import { policiesByTab, TABS } from '../game/policies';
import type { AdvisorRecommendation, EconomySnapshot, PolicySpec, Tab } from '../game/types';

export default function PolicyPanel({tab,setTab,econ,onPolicy,onShock,simple,recommendations,onAdvanced}:{tab:Tab;setTab:(t:Tab)=>void;econ:EconomySnapshot;onPolicy:(p:PolicySpec)=>void;onShock:(k:'oil'|'financial'|'sanctions'|'boom'|'food')=>void;simple:boolean;recommendations:AdvisorRecommendation[];onAdvanced:()=>void}){
  if(simple) return <BeginnerPanel econ={econ} recommendations={recommendations} onPolicy={onPolicy} onAdvanced={onAdvanced}/>;
  return <aside className="policy-panel advanced-panel">
    <div className="panel-head"><div><span className="eyebrow">POLICY OPERATIONS ROOM</span><h2>{tab}</h2></div><span className={`regime-pill ${econ.macroRisk>50?'danger':''}`}>{econ.regime}</span></div>
    <div className="tabs">{TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={t===tab?'active':''}>{t}</button>)}</div>
    {tab!=='Advisor' ? <>
      <div className="resource-strip"><span>Capacity <b>{econ.policyCapacity.toFixed(0)}</b></span><span>Political <b>{econ.politicalCapital.toFixed(0)}</b></span><span>Treasury <b>{econ.treasury.toFixed(0)}</b></span></div>
      <div className="policy-grid">{policiesByTab(tab).map(p=>{const cd=econ.cooldowns[p.id]??0;const disabled=cd>0||econ.policyCapacity<p.capacityCost||econ.politicalCapital<p.politicalCost;return <button className="policy-card" disabled={disabled} key={p.id} onClick={()=>onPolicy(p)}><span>{p.label}</span><p>{p.description}</p><small>{disabled?(cd?`Cooldown ${cd}Q`:'Insufficient capacity'):`Capacity ${p.capacityCost} • Political ${p.politicalCost}`}</small><em>{effectText(p)}</em></button>})}</div>
      <div className="transmission"><h3>Transmission channels</h3>{econ.impulses.length?econ.impulses.slice(0,5).map(i=><div className="impulse" key={i.id}><div><span>{i.label}</span><b>{Math.max(0,i.duration-i.age)}Q</b></div><progress value={i.age} max={i.duration}/></div>):<p>All transmission channels are idle.</p>}</div>
      {tab==='Emergency'&&<div className="shock-box"><h3>Scenario shocks</h3><p>Use these only to test resilience.</p><div>{(['oil','financial','sanctions','boom','food'] as const).map(s=><button key={s} onClick={()=>onShock(s)}>{s}</button>)}</div></div>}
    </> : <Advisor econ={econ}/>} 
  </aside>
}

function BeginnerPanel({econ,recommendations,onPolicy,onAdvanced}:{econ:EconomySnapshot;recommendations:AdvisorRecommendation[];onPolicy:(p:PolicySpec)=>void;onAdvanced:()=>void}){
  const top=recommendations[0];
  const diagnosis = econ.inflation>.055?{tag:'PRICE PRESSURE',title:'Inflation is your main problem',text:'Cool demand gradually and watch unemployment. Avoid stacking too many contractionary policies.'}:econ.unemployment>.075||econ.growth<0?{tag:'JOBS & GROWTH',title:'The economy needs support',text:'Target jobs and viable firms while checking whether inflation gives you room to act.'}:econ.bankHealth<.60?{tag:'FINANCIAL STABILITY',title:'Banks are weakening policy transmission',text:'Repair the financial system before relying on broad stimulus.'}:econ.debtRatio>.9?{tag:'FISCAL RISK',title:'Debt is reducing your room to maneuver',text:'Rebuild fiscal space gradually while protecting activity.'}:{tag:'BALANCED ECONOMY',title:'Use this window to build capacity',text:'Conditions are broadly stable. Productivity, housing and institutions are the best medium-term opportunities.'};
  return <aside className="policy-panel beginner-panel">
    <div className="beginner-head"><span className="eyebrow">BEGINNER DECISION COACH</span><div className="priority-badge">{diagnosis.tag}</div><h2>{diagnosis.title}</h2><p>{diagnosis.text}</p></div>
    <div className="simple-status"><Status label="Growth" value={`${(econ.growth*100).toFixed(1)}%`} state={econ.growth<0?'bad':econ.growth<.015?'warn':'good'}/><Status label="Inflation" value={`${(econ.inflation*100).toFixed(1)}%`} state={econ.inflation>.06?'bad':econ.inflation>.04?'warn':'good'}/><Status label="Jobs" value={`${(econ.unemployment*100).toFixed(1)}% jobless`} state={econ.unemployment>.085?'bad':econ.unemployment>.065?'warn':'good'}/></div>
    {top&&<section className="recommended-move"><span>RECOMMENDED NEXT MOVE</span><h3>{top.policy.label}</h3><p>{top.why}</p><div className="effect-chips">{effectChips(top.policy).map(x=><i key={x}>{x}</i>)}</div><button onClick={()=>onPolicy(top.policy)}>Enact {top.policy.label}</button><small>Watch next: {top.watch}. Effects arrive with a lag.</small></section>}
    <section className="alternatives"><header><b>Other reasonable options</b><span>Pick one, then advance a quarter.</span></header>{recommendations.slice(1,3).map(r=><button key={r.id} onClick={()=>onPolicy(r.policy)}><div><strong>{r.policy.label}</strong><small>{r.why}</small></div><span>→</span></button>)}</section>
    <div className="beginner-rule"><b>Rule of thumb</b><p>Make one meaningful change, advance a quarter, then read the chart before changing direction again.</p></div>
    <button className="advanced-link" onClick={onAdvanced}>Open all policy tools →</button>
  </aside>
}

function Status({label,value,state}:{label:string;value:string;state:'good'|'warn'|'bad'}){return <div className={`simple-stat ${state}`}><span>{label}</span><b>{value}</b></div>}

function effectChips(p:PolicySpec){
  const map:Record<string,string>={growth:'Growth',inflation:'Inflation',unemployment:'Unemployment',debt:'Debt',bank:'Banks',fx:'FX',credit:'Credit',tech:'Technology',poverty:'Poverty',confidence:'Confidence'};
  return Object.entries(p.effects).filter(([k,v])=>map[k]&&Math.abs(Number(v))>.001).slice(0,4).map(([k,v])=>`${map[k]} ${Number(v)>0?'↑':'↓'}`);
}
function effectText(p:PolicySpec){const xs=effectChips(p);return xs.length?xs.join(' • '):p.tradeoff}

function Advisor({econ}:{econ:EconomySnapshot}){
  const diagnose = econ.inflation>.055?'Inflation is the dominant near-term risk.':econ.unemployment>.075?'Labor-market slack is the dominant risk.':econ.bankHealth<.6?'Financial transmission is impaired.':econ.debtRatio>.9?'Fiscal sustainability is deteriorating.':'The economy is broadly balanced; medium-term productivity is the main opportunity.';
  const suggestions = [
    econ.inflation>.055?['Central Bank','Tighten demand gradually; watch credit and unemployment.']:['Central Bank','Preserve credibility and react to inflation expectations.'],
    econ.debtRatio>.8?['Treasury','Rebuild fiscal space without collapsing demand.']:['Treasury','Use fiscal space selectively for supply capacity.'],
    ['Development','Raise productivity, housing supply and trade capacity.']
  ];
  return <div className="advisor"><div className="advisor-lead"><span>DIAGNOSIS</span><p>{diagnose}</p></div>{suggestions.map(x=><div className="advisor-desk" key={x[0]}><b>{x[0]}</b><p>{x[1]}</p></div>)}<div className="risk-board"><div><span>Financial conditions</span><b>{econ.fci.toFixed(1)}</b></div><div><span>Macro risk</span><b>{econ.macroRisk.toFixed(1)}</b></div><div><span>National score</span><b>{econ.nationalScore.toFixed(0)}</b></div></div></div>;
}
