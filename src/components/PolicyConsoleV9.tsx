import { useMemo, useState } from 'react';
import { policiesByTab, TABS } from '../game/policies';
import type { AdvisorRecommendation, EconomySnapshot, PolicySpec, Tab } from '../game/types';
import { policyImpactSummary } from '../game/analytics';

export default function PolicyConsoleV9({econ,tab,setTab,onPolicy,recommendations}:{econ:EconomySnapshot;tab:Tab;setTab:(t:Tab)=>void;onPolicy:(p:PolicySpec)=>void;recommendations:AdvisorRecommendation[]}){
  const [selectedId,setSelectedId]=useState<string|null>(recommendations[0]?.policy.id??null);
  const list=useMemo(()=>tab==='Advisor'?recommendations.map(r=>r.policy):policiesByTab(tab),[tab,recommendations]);
  const selected=list.find(p=>p.id===selectedId)??list[0]??null;
  const selectedRec=recommendations.find(r=>r.policy.id===selected?.id);
  const can=selected?canEnact(selected,econ):{ok:false,reason:'Choose a policy'};
  return <aside className="policy-console panel-shell">
    <header className="panel-title-row compact"><div><span className="eyebrow">POLICY CONSOLE</span><h2>Choose an instrument</h2></div><div className="resource-mini"><span>Capacity <b>{econ.policyCapacity.toFixed(0)}</b></span><span>Political <b>{econ.politicalCapital.toFixed(0)}</b></span></div></header>
    <div className="policy-tabs">{TABS.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setSelectedId(null)}}>{t}</button>)}</div>
    <div className="policy-list">{list.map(p=>{const c=canEnact(p,econ);const recommended=recommendations.some(r=>r.policy.id===p.id);return <button key={p.id} className={`policy-option ${selected?.id===p.id?'selected':''}`} onClick={()=>setSelectedId(p.id)}><div><strong>{p.label}</strong>{recommended&&<span className="rec-dot">Recommended</span>}</div><small>{p.description}</small><footer><span>{p.duration}Q transmission</span><span>{c.ok?'Ready':c.reason}</span></footer></button>})}</div>
    {selected&&<section className="policy-brief"><div className="policy-brief-top"><div><span className="eyebrow">DECISION BRIEF</span><h3>{selected.label}</h3></div><span className={`ready-pill ${can.ok?'ready':'blocked'}`}>{can.ok?'READY':'BLOCKED'}</span></div><p>{selected.description}</p><div className="impact-chips">{policyImpactSummary(selected).map(x=><span key={x.label} className={x.dir}>{x.label} {x.dir==='up'?'↑':'↓'}</span>)}</div><div className="tradeoff-box"><b>Trade-off</b><span>{selected.tradeoff}</span></div>{selectedRec&&<div className="advisor-note"><b>Why now</b><span>{selectedRec.why}</span><small>Watch: {selectedRec.watch}</small></div>}<button className="enact-button" disabled={!can.ok} onClick={()=>onPolicy(selected)}>Enact policy</button></section>}
  </aside>
}

function canEnact(p:PolicySpec,e:EconomySnapshot){const cd=e.cooldowns[p.id]??0;if(cd>0)return{ok:false,reason:`Cooldown ${cd}Q`};if(e.policyCapacity<p.capacityCost)return{ok:false,reason:'Low capacity'};if(e.politicalCapital<p.politicalCost)return{ok:false,reason:'Low political capital'};return{ok:true,reason:'Ready'}}
