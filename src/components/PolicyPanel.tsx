import { policiesByTab, TABS } from '../game/policies';
import type { EconomySnapshot, PolicySpec, Tab } from '../game/types';

export default function PolicyPanel({tab,setTab,econ,onPolicy,onShock}:{tab:Tab;setTab:(t:Tab)=>void;econ:EconomySnapshot;onPolicy:(p:PolicySpec)=>void;onShock:(k:'oil'|'financial'|'sanctions'|'boom'|'food')=>void}){
  const recs = econ.regime;
  return <aside className="policy-panel">
    <div className="panel-head"><div><span className="eyebrow">POLICY OPERATIONS ROOM</span><h2>{tab}</h2></div><span className={`regime-pill ${econ.macroRisk>50?'danger':''}`}>{recs}</span></div>
    <div className="tabs">{TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={t===tab?'active':''}>{t}</button>)}</div>
    {tab!=='Advisor' ? <>
      <div className="resource-strip"><span>Capacity <b>{econ.policyCapacity.toFixed(0)}</b></span><span>Political <b>{econ.politicalCapital.toFixed(0)}</b></span><span>Treasury <b>{econ.treasury.toFixed(0)}</b></span></div>
      <div className="policy-grid">{policiesByTab(tab).map(p=>{const cd=econ.cooldowns[p.id]??0;const disabled=cd>0||econ.policyCapacity<p.capacityCost||econ.politicalCapital<p.politicalCost;return <button className="policy-card" disabled={disabled} key={p.id} onClick={()=>onPolicy(p)} title={`${p.description}\nTrade-off: ${p.tradeoff}`}><span>{p.label}</span><small>{disabled?(cd?`Cooldown ${cd}Q`:'Insufficient capacity'):`Cost ${p.capacityCost} • Pol ${p.politicalCost}`}</small></button>})}</div>
      <div className="transmission"><h3>Transmission channels</h3>{econ.impulses.length?econ.impulses.slice(0,5).map(i=><div className="impulse" key={i.id}><div><span>{i.label}</span><b>{Math.max(0,i.duration-i.age)}Q</b></div><progress value={i.age} max={i.duration}/></div>):<p>All transmission channels are idle.</p>}</div>
      {tab==='Emergency'&&<div className="shock-box"><h3>Scenario shocks</h3><div>{(['oil','financial','sanctions','boom','food'] as const).map(s=><button key={s} onClick={()=>onShock(s)}>{s}</button>)}</div></div>}
    </> : <Advisor econ={econ}/>} 
  </aside>
}

function Advisor({econ}:{econ:EconomySnapshot}){
  const diagnose = econ.inflation>.055?'Inflation is the dominant near-term risk.':econ.unemployment>.075?'Labor-market slack is the dominant risk.':econ.bankHealth<.6?'Financial transmission is impaired.':econ.debtRatio>.9?'Fiscal sustainability is deteriorating.':'The economy is broadly balanced; medium-term productivity is the main opportunity.';
  const suggestions = [
    econ.inflation>.055?['Central Bank','Tighten demand gradually; watch credit and unemployment.']:['Central Bank','Preserve credibility and react to inflation expectations.'],
    econ.debtRatio>.8?['Treasury','Rebuild fiscal space without collapsing demand.']:['Treasury','Use fiscal space selectively for supply capacity.'],
    ['Development','Raise productivity, housing supply and trade capacity.']
  ];
  return <div className="advisor"><div className="advisor-lead"><span>DIAGNOSIS</span><p>{diagnose}</p></div>{suggestions.map(x=><div className="advisor-desk" key={x[0]}><b>{x[0]}</b><p>{x[1]}</p></div>)}<div className="risk-board"><div><span>Financial conditions</span><b>{econ.fci.toFixed(1)}</b></div><div><span>Macro risk</span><b>{econ.macroRisk.toFixed(1)}</b></div><div><span>National score</span><b>{econ.nationalScore.toFixed(0)}</b></div></div></div>;
}
