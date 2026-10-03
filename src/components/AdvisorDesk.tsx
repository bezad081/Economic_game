import { memo } from 'react';
import type { AdvisorRecommendation, EconomySnapshot, PolicySpec } from '../game/types';

function AdvisorDesk({econ,recommendations,onPolicy}:{econ:EconomySnapshot;recommendations:AdvisorRecommendation[];onPolicy:(p:PolicySpec)=>void}){
  const top=recommendations[0];
  return <section className="advisor-desk-v12 panel-shell">
    <header className="panel-title-row compact"><div><span className="eyebrow">SMART ADVISOR</span><h2>Policy priorities</h2></div><span className={`advisor-risk ${econ.macroRisk>60?'bad':econ.macroRisk>35?'warn':'good'}`}>{econ.regime}</span></header>
    {top&&<article className="advisor-primary">
      <div className="advisor-rank">01</div>
      <div className="advisor-copy"><span>Highest-value move now</span><h3>{top.policy.label}</h3><p>{top.why}</p><div className="advisor-meta"><b>{Math.round(top.confidence??70)}% confidence</b><span>{top.expected}</span></div><small>Watch: {top.watch}</small></div>
      <button onClick={()=>onPolicy(top.policy)}>Use policy</button>
    </article>}
    <div className="advisor-list">{recommendations.slice(1,4).map((r,i)=><article key={r.id}><span>{String(i+2).padStart(2,'0')}</span><div><b>{r.policy.label}</b><p>{r.why}</p><small>{Math.round(r.confidence??60)}% confidence • Watch {r.watch}</small></div><button onClick={()=>onPolicy(r.policy)}>→</button></article>)}</div>
  </section>
}

export default memo(AdvisorDesk);
