import { useMemo, useState } from 'react';
import type { EconomySnapshot, HistoryPoint } from '../game/types';

type Deck='Economy'|'People'|'Finance'|'Politics';
type SeriesKey='growth'|'inflation'|'unemployment'|'approval'|'poverty'|'housingAffordability'|'debt'|'bankHealth'|'macroRisk'|'incumbentShare'|'turnout'|'fci';

type SeriesSpec={key:SeriesKey;label:string;color:string;transform?:(v:number)=>number;note:string};

const GROUPS:Record<Deck,SeriesSpec[]>= {
  Economy:[
    {key:'growth',label:'GDP growth',color:'#59d99f',note:'Activity momentum'},
    {key:'inflation',label:'Inflation',color:'#f1c75b',note:'Price pressure'},
    {key:'unemployment',label:'Unemployment',color:'#ff7d7a',note:'Labor slack'},
    {key:'fci',label:'Financial conditions',color:'#6ed7ff',transform:v=>v/100,note:'Credit climate'}
  ],
  People:[
    {key:'approval',label:'Approval',color:'#6ed7ff',note:'Public sentiment'},
    {key:'poverty',label:'Poverty',color:'#ff8f70',note:'Household strain'},
    {key:'housingAffordability',label:'Housing access',color:'#b591ff',note:'Affordability'},
    {key:'turnout',label:'Turnout',color:'#59d99f',note:'Political engagement'}
  ],
  Finance:[
    {key:'debt',label:'Debt / GDP',color:'#f1c75b',note:'Fiscal space'},
    {key:'bankHealth',label:'Bank health',color:'#59d99f',note:'Credit transmission'},
    {key:'macroRisk',label:'Macro risk',color:'#ff7d7a',transform:v=>v/100,note:'Systemic strain'},
    {key:'fci',label:'FCI',color:'#6ed7ff',transform:v=>v/100,note:'Funding conditions'}
  ],
  Politics:[
    {key:'approval',label:'Approval',color:'#6ed7ff',note:'Incumbent standing'},
    {key:'incumbentShare',label:'Government vote',color:'#59d99f',note:'Election support'},
    {key:'turnout',label:'Turnout',color:'#b591ff',note:'Participation'},
    {key:'macroRisk',label:'Macro risk',color:'#ff7d7a',transform:v=>v/100,note:'Political stress'}
  ]
};

export default function TrendPanel({econ,collapsed,onToggle}:{econ:EconomySnapshot;collapsed:boolean;onToggle:()=>void}){
  const [deck,setDeck]=useState<Deck>('Economy');
  const rows=useMemo(()=>normalizeHistory(econ),[econ]);
  const specs=GROUPS[deck];
  return <section className={`trend-panel trend-grid-panel ${collapsed?'collapsed':''}`}>
    <header className="trend-head">
      <div><span className="eyebrow">LIVE TREND DECK</span><b>{deck}</b></div>
      <div className="trend-tabs">{(Object.keys(GROUPS) as Deck[]).map(k=><button key={k} className={k===deck?'active':''} onClick={()=>setDeck(k)}>{k}</button>)}</div>
      <button className="trend-collapse" onClick={onToggle}>{collapsed?'▲':'▼'}</button>
    </header>
    {!collapsed&&<div className="trend-cards">{specs.map(spec=>{const current = spec.transform?spec.transform((econ as any)[spec.key]):(econ as any)[spec.key];return <article className="trend-card" key={spec.key}><div className="trend-card-head"><div><span>{spec.label}</span><b>{formatPct(current)}</b></div><i style={{background:spec.color}}/></div><Sparkline rows={rows} spec={spec}/><small>{spec.note}</small></article>})}</div>}
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
    turnout:h.turnout??econ.election.turnout,
    fci:h.fci??econ.fci
  } as HistoryPoint & {fci:number}));
  if(!rows.length) return [{period:`Q${econ.quarter} ${econ.year}`,gdp:econ.realGDP,growth:econ.growth,inflation:econ.inflation,unemployment:econ.unemployment,debt:econ.debtRatio,approval:econ.approval,fci:econ.fci,poverty:econ.poverty,housingAffordability:econ.housingAffordability,bankHealth:econ.bankHealth,macroRisk:econ.macroRisk,incumbentShare:econ.election.incumbentShare,turnout:econ.election.turnout}] as any;
  return rows.slice(-16) as any;
}

function formatPct(v:number){return `${(v*100).toFixed(Math.abs(v)<.1?1:0)}%`}

function Sparkline({rows,spec}:{rows:any[];spec:SeriesSpec}){
  const w=240,h=88,p=8;
  const values=rows.map(r=>spec.transform?spec.transform(r[spec.key]):r[spec.key]);
  let min=Math.min(...values),max=Math.max(...values);
  if(max-min<0.015){min-=0.01;max+=0.01}
  const x=(i:number)=>p+i*(w-p*2)/Math.max(1,rows.length-1);
  const y=(v:number)=>h-p-(v-min)*(h-p*2)/(max-min);
  const d=values.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
    {[0,.5,1].map((t,i)=>{const gy=p+t*(h-p*2);return <line key={i} x1={p} x2={w-p} y1={gy} y2={gy} className="trend-grid"/>})}
    <path d={d} fill="none" stroke={spec.color} strokeWidth="2.4" vectorEffect="non-scaling-stroke"/>
    <circle cx={x(values.length-1)} cy={y(values[values.length-1])} r="3.5" fill={spec.color}/>
  </svg>
}
