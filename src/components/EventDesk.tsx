import { memo } from 'react';
import type { AdvisorRecommendation, EconomySnapshot } from '../game/types';
import { pct, regimeNarrative, riskSignals } from '../game/analytics';

function EventDesk({econ,recommendations}:{econ:EconomySnapshot;recommendations:AdvisorRecommendation[]}){
  const risks=riskSignals(econ);
  return <aside className="event-desk panel-shell">
    <header className="panel-title-row compact"><div><span className="eyebrow">RISK & EVENT DESK</span><h2>What needs attention?</h2></div><span className={`risk-number ${econ.macroRisk>60?'bad':econ.macroRisk>35?'warn':'good'}`}>{econ.macroRisk.toFixed(0)}</span></header>
    <section className="regime-brief"><span>{econ.regime}</span><p>{regimeNarrative(econ)}</p></section>
    {econ.activeEvents.length>0?<div className="active-events">{econ.activeEvents.map(ev=><article key={ev.id} className={`event-card severity-${ev.severity}`}><header><div><span>ACTIVE EVENT • S{ev.severity} • STAGE {ev.stage??1}</span><h3>{ev.title}</h3></div><b>{Math.max(0,ev.deadlineTurn-econ.turn)}Q</b></header><p>{ev.description}</p>{ev.parentEventId&&<div className="chain-badge">Event chain continuation</div>}<div className="event-response"><span>Policy challenge</span><strong>{ev.responseLabel}</strong></div>{ev.consequence&&<div className="event-consequence"><span>If ignored</span><b>{ev.consequence}</b></div>}<small>{ev.learning}</small>{ev.status==='responded'&&<div className="responded">Response accepted: {ev.resolvedBy}</div>}</article>)}</div>:<div className="no-event"><b>No acute event</b><span>Use the quiet window to rebuild buffers before the next shock.</span></div>}
    {econ.activeMission&&<section className="mission-compact"><div><span className="eyebrow">CAMPAIGN MANDATE</span><b>{econ.activeMission.title}</b></div><progress max={1} value={econ.activeMission.progress}/><p>{econ.activeMission.description}</p><small>{econ.activeMission.targetText} • {Math.max(0,econ.activeMission.deadline-econ.turn)}Q remaining</small></section>}
    <section className="risk-stack"><h3>Vulnerability monitor</h3>{risks.map(r=><div className="risk-row" key={r.label}><div><span>{r.label}</span><small>{r.detail}</small></div><div className="risk-bar"><i style={{width:`${Math.round(r.value*100)}%`}}/></div><b>{Math.round(r.value*100)}</b></div>)}</section>
    <section className="external-box"><div><span>Current account</span><b>{pct(econ.currentAccount)}</b></div><div><span>FX reserves</span><b>{econ.fxReserves.toFixed(0)}</b></div><div><span>Credibility</span><b>{(econ.credibility*100).toFixed(0)}</b></div></section>
  </aside>
}

export default memo(EventDesk);
