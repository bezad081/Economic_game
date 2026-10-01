import type { CabinetAdvice, EconomySnapshot, PolicySpec } from '../game/types';
import { policyById } from '../game/policies';

const pct=(x:number,d=1)=>`${(x*100).toFixed(d)}%`;
const health=(x:number)=>x>.7?'Strong':x>.45?'Watch':'Fragile';

export default function SystemsModal({econ,advice,onPolicy,onClose}:{econ:EconomySnapshot;advice:CabinetAdvice[];onPolicy:(p:PolicySpec)=>void;onClose:()=>void}){
  const firms=[...econ.firms].sort((a,b)=>a.health-b.health);
  const e=econ.election;
  const qLeft=Math.max(0,e.nextElectionTurn-econ.turn);
  return <div className="modal-backdrop systems-backdrop" onMouseDown={onClose}>
    <section className="systems-modal" onMouseDown={x=>x.stopPropagation()}>
      <header><div><span className="eyebrow">REAL ECONOMY & POLITICS</span><h2>National Systems Room</h2></div><button onClick={onClose}>×</button></header>
      <div className="systems-grid">
        <section className="system-card cabinet-card"><h3>Cabinet AI</h3>{advice.map((a,i)=>{const p=a.actionId?policyById(a.actionId):undefined;return <article key={i}><div className="urgency"><b>{a.urgency}</b><span>urgency</span></div><div><small>{a.role}</small><strong>{a.title}</strong><p>{a.rationale}</p></div>{p&&<button onClick={()=>onPolicy(p)}>Open policy</button>}</article>})}</section>
        <section className="system-card election-card"><h3>Election cycle</h3><div className="vote-row"><div><span>Government</span><b>{pct(e.incumbentShare)}</b></div><div><span>Opposition</span><b>{pct(e.oppositionShare)}</b></div></div><div className="vote-bar"><i style={{width:`${e.incumbentShare*100}%`}}/></div><p>{e.campaignActive?`Campaign active • ${qLeft} quarter${qLeft===1?'':'s'} to election`:`${qLeft} quarters to next election`}</p><small>Expected turnout {pct(e.turnout)} • {e.lastResult}</small></section>
        <section className="system-card households-card"><h3>Household balance sheets</h3>{econ.households.map(h=><article key={h.id}><div><strong>{h.label}</strong><small>{pct(h.populationShare,0)} of population</small></div><div className="house-kpis"><span>Income <b>{h.income.toFixed(2)}</b></span><span>Wealth <b>{h.wealth.toFixed(0)}</b></span><span>Jobless <b>{pct(h.unemployment)}</b></span><span>Sentiment <b>{pct(h.sentiment,0)}</b></span></div></article>)}</section>
        <section className="system-card firms-card"><div className="firm-head"><h3>Firm microeconomy</h3><span>{econ.firms.length} firms • {econ.totalEmployment} jobs • wage {econ.averageWage.toFixed(2)}</span></div><div className="firm-table"><div className="firm-row firm-columns"><span>Firm</span><span>Sector</span><span>Jobs</span><span>Profit</span><span>Health</span></div>{firms.slice(0,12).map(f=><div className="firm-row" key={f.id}><span><b>{f.name}</b></span><span>{f.sector}</span><span>{f.employees}</span><span className={f.profit>=0?'good':'bad'}>{f.profit.toFixed(1)}</span><span className={f.health<.4?'bad':f.health>.7?'good':'warn'}>{health(f.health)} {(f.health*100).toFixed(0)}</span></div>)}</div><footer><span>Births this quarter: <b className="good">{econ.firmBirths}</b></span><span>Restructurings: <b className={econ.bankruptcies?'bad':''}>{econ.bankruptcies}</b></span></footer></section>
      </div>
    </section>
  </div>
}
