import { useState } from 'react';
import type { EconomySnapshot } from '../game/types';

const pct=(x:number)=>`${(x*100).toFixed(1)}%`;
const pp=(x:number)=>`${x>=0?'+':''}${(x*100).toFixed(1)}pp`;

type Props={previous:EconomySnapshot|null;current:EconomySnapshot;onClose:()=>void};

type Move={label:string;before:string;after:string;delta:number;deltaLabel:string;good:boolean};

export default function QuarterPulse({previous,current,onClose}:Props){
  const [expanded,setExpanded]=useState(false);
  if(!previous) return null;
  const moves:Move[]=[
    {label:'GDP growth',before:pct(previous.growth),after:pct(current.growth),delta:current.growth-previous.growth,deltaLabel:pp(current.growth-previous.growth),good:current.growth>=previous.growth},
    {label:'Inflation',before:pct(previous.inflation),after:pct(current.inflation),delta:current.inflation-previous.inflation,deltaLabel:pp(current.inflation-previous.inflation),good:current.inflation<=previous.inflation},
    {label:'Unemployment',before:pct(previous.unemployment),after:pct(current.unemployment),delta:current.unemployment-previous.unemployment,deltaLabel:pp(current.unemployment-previous.unemployment),good:current.unemployment<=previous.unemployment},
    {label:'Approval',before:pct(previous.approval),after:pct(current.approval),delta:current.approval-previous.approval,deltaLabel:pp(current.approval-previous.approval),good:current.approval>=previous.approval},
    {label:'Bank health',before:`${(previous.bankHealth*100).toFixed(0)}`,after:`${(current.bankHealth*100).toFixed(0)}`,delta:current.bankHealth-previous.bankHealth,deltaLabel:`${(current.bankHealth-previous.bankHealth)>=0?'+':''}${((current.bankHealth-previous.bankHealth)*100).toFixed(0)}`,good:current.bankHealth>=previous.bankHealth},
    {label:'Debt / GDP',before:pct(previous.debtRatio),after:pct(current.debtRatio),delta:current.debtRatio-previous.debtRatio,deltaLabel:pp(current.debtRatio-previous.debtRatio),good:current.debtRatio<=previous.debtRatio},
  ].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,3);
  const improved=moves.filter(m=>m.good).length;
  const summary=improved>=2?'Quarter improved on balance':improved===1?'Mixed quarter': 'Pressure increased';
  return <aside className={`quarter-pulse ${expanded?'expanded':'collapsed'}`}>
    <header>
      <div><span className="eyebrow">QUARTER REVIEW</span><b>{summary}</b></div>
      <div className="pulse-actions"><button onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide':'Details'}</button><button onClick={onClose}>×</button></div>
    </header>
    {expanded && <>
      <div className={`pulse-summary ${improved>=2?'good':improved===1?'warn':'bad'}`}>{improved>=2?'Conditions improved on balance':improved===1?'Mixed quarter — watch the trade-offs':'Pressure increased this quarter'}</div>
      <div className="pulse-moves">{moves.map(m=><div className={m.good?'good':'bad'} key={m.label}><span>{m.label}</span><small>{m.before} → {m.after}</small><strong>{m.deltaLabel}</strong></div>)}</div>
      <p>Tip: make one policy move, advance a quarter, then read the charts before acting again.</p>
    </>}
  </aside>;
}
