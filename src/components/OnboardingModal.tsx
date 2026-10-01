import { useState } from 'react';
import type { EconomySnapshot, GameMode } from '../game/types';

const pct=(x:number,d=1)=>`${(x*100).toFixed(d)}%`;

export default function OnboardingModal({econ,onClose,onStart}:{econ:EconomySnapshot;onClose:()=>void;onStart:(mode:GameMode)=>void}){
  const [step,setStep]=useState(0);
  const slides=[
    <div className="guide-slide" key="welcome">
      <div className="guide-hero"><div className="guide-logo">M</div><div><span className="eyebrow">WELCOME TO MACROSTATE</span><h2>You run the economy — one quarter at a time.</h2></div></div>
      <p className="guide-lead">Your job is not to maximize one number. Keep growth, prices, jobs, finance and public support in balance.</p>
      <div className="goal-grid"><GuideGoal label="Growth" value={pct(econ.growth)} note="Keep activity healthy"/><GuideGoal label="Inflation" value={pct(econ.inflation)} note="Aim roughly 2–4%"/><GuideGoal label="Unemployment" value={pct(econ.unemployment)} note="Avoid persistent labor slack"/><GuideGoal label="Approval" value={pct(econ.approval,0)} note="People feel the trade-offs"/></div>
    </div>,
    <div className="guide-slide" key="read">
      <span className="eyebrow">STEP 1 — READ THE SITUATION</span><h2>Start with the priority card, not every statistic.</h2>
      <div className="guide-demo"><div className="demo-priority"><span>TOP PRIORITY</span><b>{econ.inflation>.055?'Bring inflation under control':econ.unemployment>.075?'Protect jobs':econ.bankHealth<.6?'Repair financial stability':'Build long-run capacity'}</b><p>The beginner panel translates the economy into one clear problem and a few actions.</p></div><div className="demo-arrow">→</div><div className="demo-note"><b>Use Advanced mode later</b><p>Detailed fiscal, financial, firm and political systems are still there when you want them.</p></div></div>
    </div>,
    <div className="guide-slide" key="act">
      <span className="eyebrow">STEP 2 — MAKE ONE MOVE</span><h2>Policies have benefits, costs and delays.</h2>
      <div className="guide-flow"><div><b>1</b><span>Choose a policy</span></div><i>→</i><div><b>2</b><span>Advance a quarter</span></div><i>→</i><div><b>3</b><span>Watch the charts</span></div><i>→</i><div><b>4</b><span>Adjust carefully</span></div></div>
      <p className="guide-lead">Do not spam policies. Most effects transmit over several quarters, so overreacting can create a new problem while fixing the old one.</p>
    </div>,
    <div className="guide-slide" key="city">
      <span className="eyebrow">STEP 3 — READ THE CITY</span><h2>The city is part of the dashboard.</h2>
      <div className="city-legend"><span><i className="dot green"/>Busy streets and construction = stronger activity</span><span><i className="dot amber"/>Protests and weak lighting = household stress</span><span><i className="dot red"/>Bank warnings and queues = financial stress</span><span><i className="dot cyan"/>Tech activity and clean energy = productive capacity</span></div>
      <p className="guide-lead">Use the City Lenses to switch between Prosperity, Jobs and Risk heatmaps. After each quarter, the Quarter Review explains the three biggest changes before you choose another policy.</p>
    </div>
  ];
  return <div className="modal-backdrop guide-backdrop"><section className="guide-modal">
    <header><div><span>BEGINNER GUIDE</span><b>{step+1} / {slides.length}</b></div><button onClick={onClose}>×</button></header>
    <div className="guide-body">{slides[step]}</div>
    <footer><div className="guide-dots">{slides.map((_,i)=><button key={i} className={i===step?'active':''} onClick={()=>setStep(i)} aria-label={`Step ${i+1}`}/>)}</div><div className="guide-actions">{step>0&&<button className="ghost" onClick={()=>setStep(s=>s-1)}>Back</button>}{step<slides.length-1?<button className="primary" onClick={()=>setStep(s=>s+1)}>Next</button>:<><button className="ghost" onClick={()=>onStart('sandbox')}>Explore Sandbox</button><button className="primary" onClick={()=>onStart('mission')}>Start Guided Campaign</button></>}</div></footer>
  </section></div>;
}

function GuideGoal({label,value,note}:{label:string;value:string;note:string}){return <div className="guide-goal"><span>{label}</span><b>{value}</b><small>{note}</small></div>}
