import { useMemo, useState } from 'react';
import type { EconomySnapshot, HistoryPoint } from '../game/types';

type Deck='Economy'|'People'|'Finance'|'Politics';
type SeriesKey='growth'|'inflation'|'unemployment'|'approval'|'poverty'|'housingAffordability'|'debt'|'bankHealth'|'macroRisk'|'incumbentShare'|'turnout';

type SeriesSpec={key:SeriesKey;label:string;color:string;transform?:(v:number)=>number};

const GROUPS:Record<Deck,SeriesSpec[]>={
  Economy:[{key:'growth',label:'GDP growth',color:'#59d99f'},{key:'inflation',label:'Inflation',color:'#f1c75b'},{key:'unemployment',label:'Unemployment',color:'#ff7d7a'}],
  People:[{key:'approval',label:'Approval',color:'#6ed7ff'},{key:'poverty',label:'Poverty',color:'#ff8f70'},{key:'housingAffordability',label:'Housing affordability',color:'#b591ff'}],
  Finance:[{key:'debt',label:'Debt / GDP',color:'#f1c75b'},{key:'bankHealth',label:'Bank health',color:'#59d99f'},{key:'macroRisk',label:'Macro risk',color:'#ff7d7a',transform:v=>v/100}],
  Politics:[{key:'approval',label:'Approval',color:'#6ed7ff'},{key:'incumbentShare',label:'Government vote',color:'#59d99f'},{key:'turnout',label:'Turnout',color:'#b591ff'}]
};

export default function TrendPanel({econ,collapsed,onToggle}:{econ:EconomySnapshot;collapsed:boolean;onToggle:()=>void}){
  const [deck,setDeck]=useState<Deck>('Economy');
  const rows=useMemo(()=>normalizeHistory(econ),[econ]);
  const specs=GROUPS[deck];
  return <section className={`trend-panel ${collapsed?'collapsed':''}`}>
    <header className="trend-head"><div><span className="eyebrow">LIVE TREND DECK</span><b>{deck}</b></div><div className="trend-tabs">{(Object.keys(GROUPS) as Deck[]).map(k=><button key={k} className={k===deck?'active':''} onClick={()=>setDeck(k)}>{k}</button>)}</div><button className="trend-collapse" onClick={onToggle}>{collapsed?'▲':'▼'}</button></header>
    {!collapsed&&<div className="trend-body"><TrendChart rows={rows} specs={specs}/><div className="trend-legend">{specs.map(s=><span key={s.key}><i style={{background:s.color}}/>{s.label}</span>)}</div><div className="trend-reading"><span>Current</span>{specs.map(s=>{const val=s.transform?s.transform((econ as any)[s.key]):(econ as any)[s.key];return <div key={s.key}><b>{s.label}</b><strong>{formatPct(val)}</strong></div>})}</div></div>}
  </section>;
}

function normalizeHistory(econ:EconomySnapshot):HistoryPoint[]{
  const rows=econ.history.map(h=>({
    ...h,
    poverty:h.poverty??econ.poverty,
    housingAffordability:h.housingAffordability??econ.housingAffordability,
    bankHealth:h.bankHealth??econ.bankHealth,
    macroRisk:h.macroRisk??econ.macroRisk,
    incumbentShare:h.incumbentShare??econ.election.incumbentShare,
    turnout:h.turnout??econ.election.turnout
  }));
  if(!rows.length) return [{period:`Q${econ.quarter} ${econ.year}`,gdp:econ.realGDP,growth:econ.growth,inflation:econ.inflation,unemployment:econ.unemployment,debt:econ.debtRatio,approval:econ.approval,fci:econ.fci,poverty:econ.poverty,housingAffordability:econ.housingAffordability,bankHealth:econ.bankHealth,macroRisk:econ.macroRisk,incumbentShare:econ.election.incumbentShare,turnout:econ.election.turnout}];
  return rows.slice(-20);
}

function formatPct(v:number){return `${(v*100).toFixed(Math.abs(v)<.1?1:0)}%`}

function TrendChart({rows,specs}:{rows:HistoryPoint[];specs:SeriesSpec[]}){
  const w=760,h=150,padL=42,padR=12,padT=10,padB=24;
  const values=rows.flatMap(r=>specs.map(s=>{const raw=(r as any)[s.key] as number;return s.transform?s.transform(raw):raw}));
  let min=Math.min(...values,0),max=Math.max(...values,.01);
  const range=Math.max(.02,max-min); min-=range*.12; max+=range*.12;
  const x=(i:number)=>rows.length===1?w/2:padL+i*(w-padL-padR)/(rows.length-1);
  const y=(v:number)=>padT+(max-v)*(h-padT-padB)/(max-min);
  const ticks=[0,.25,.5,.75,1].map(t=>max-(max-min)*t);
  return <svg className="trend-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Economic trend chart">
    {ticks.map((v,i)=><g key={i}><line x1={padL} x2={w-padR} y1={y(v)} y2={y(v)} className="trend-grid"/><text x={padL-6} y={y(v)+3} textAnchor="end" className="trend-axis">{formatPct(v)}</text></g>)}
    {rows.map((r,i)=>i===0||i===rows.length-1||i===Math.floor(rows.length/2)?<text key={i} x={x(i)} y={h-5} textAnchor={i===0?'start':i===rows.length-1?'end':'middle'} className="trend-axis x">{r.period}</text>:null)}
    {specs.map(s=>{const pts=rows.map((r,i)=>{const raw=(r as any)[s.key] as number;const v=s.transform?s.transform(raw):raw;return [x(i),y(v)] as const});const d=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');return <g key={s.key}><path d={d} fill="none" stroke={s.color} strokeWidth="2.4" vectorEffect="non-scaling-stroke"/><circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.2" fill={s.color}/></g>})}
    {rows.length===1&&<text x={w/2} y={h/2} textAnchor="middle" className="trend-empty">Advance one quarter to begin the trend.</text>}
  </svg>;
}
