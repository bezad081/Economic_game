import { useMemo, useState } from 'react';
import type { EconomySnapshot, HistoryPoint } from '../game/types';

type Lens='Macro'|'Inflation'|'Financial'|'Fiscal'|'Society';
type Metric={key:keyof HistoryPoint;label:string;format:'pct'|'num'|'index';accent:string;current:(e:EconomySnapshot)=>number;reference?:number};

const LENSES:Record<Lens,Metric[]>={
  Macro:[
    {key:'growth',label:'GDP growth',format:'pct',accent:'#53dfaa',current:e=>e.growth,reference:.025},
    {key:'inflation',label:'Headline inflation',format:'pct',accent:'#f4c867',current:e=>e.inflation,reference:.03},
    {key:'unemployment',label:'Unemployment',format:'pct',accent:'#ef7e7e',current:e=>e.unemployment,reference:.05},
    {key:'outputGap',label:'Output gap',format:'pct',accent:'#70c9ff',current:e=>e.outputGap,reference:0},
  ],
  Inflation:[
    {key:'inflation',label:'Headline inflation',format:'pct',accent:'#f4c867',current:e=>e.inflation,reference:.03},
    {key:'coreInflation',label:'Core inflation',format:'pct',accent:'#ff9673',current:e=>e.coreInflation,reference:.03},
    {key:'wageGrowth',label:'Wage growth',format:'pct',accent:'#9b8cff',current:e=>e.wageGrowth,reference:.04},
    {key:'outputGap',label:'Output gap',format:'pct',accent:'#70c9ff',current:e=>e.outputGap,reference:0},
  ],
  Financial:[
    {key:'bankHealth',label:'Bank health',format:'pct',accent:'#53dfaa',current:e=>e.bankHealth,reference:.75},
    {key:'fci',label:'Financial conditions',format:'index',accent:'#70c9ff',current:e=>e.fci,reference:50},
    {key:'exchangeRate',label:'FX index',format:'num',accent:'#f4c867',current:e=>e.exchangeRate,reference:1},
    {key:'sovereignSpread',label:'Sovereign spread',format:'pct',accent:'#ef7e7e',current:e=>e.sovereignSpread,reference:.01},
  ],
  Fiscal:[
    {key:'debt',label:'Debt / GDP',format:'pct',accent:'#f4c867',current:e=>e.debtRatio,reference:.6},
    {key:'approval',label:'Approval',format:'pct',accent:'#70c9ff',current:e=>e.approval,reference:.55},
    {key:'growth',label:'GDP growth',format:'pct',accent:'#53dfaa',current:e=>e.growth,reference:.025},
    {key:'macroRisk',label:'Macro risk',format:'index',accent:'#ef7e7e',current:e=>e.macroRisk,reference:25},
  ],
  Society:[
    {key:'approval',label:'Public approval',format:'pct',accent:'#70c9ff',current:e=>e.approval,reference:.55},
    {key:'poverty',label:'Poverty',format:'pct',accent:'#ef7e7e',current:e=>e.poverty,reference:.1},
    {key:'housingAffordability',label:'Housing access',format:'pct',accent:'#9b8cff',current:e=>e.housingAffordability,reference:.75},
    {key:'incumbentShare',label:'Gov. vote share',format:'pct',accent:'#53dfaa',current:e=>e.election.incumbentShare,reference:.5},
  ]
};

export default function ChartDeck({econ}:{econ:EconomySnapshot}){
  const [lens,setLens]=useState<Lens>('Macro');
  const rows=useMemo(()=>normalizedHistory(econ),[econ]);
  return <section className="v9-chart-deck panel-shell">
    <header className="panel-title-row">
      <div><span className="eyebrow">ANALYTICAL WORKBENCH</span><h2>Economic telemetry</h2></div>
      <div className="segmented-tabs">{(Object.keys(LENSES) as Lens[]).map(x=><button key={x} className={lens===x?'active':''} onClick={()=>setLens(x)}>{x}</button>)}</div>
    </header>
    <div className="chart-grid">{LENSES[lens].map(metric=><MetricChart key={metric.label} rows={rows} metric={metric} current={metric.current(econ)}/>)}</div>
  </section>
}

function MetricChart({rows,metric,current}:{rows:HistoryPoint[];metric:Metric;current:number}){
  const safeRows=rows.map(r=>({label:r.period,value:Number((r as any)[metric.key])})).filter(x=>Number.isFinite(x.value));
  const data=safeRows.length?safeRows:[{label:'Now',value:current}];
  const w=360,h=122,pL=10,pR=10,pT=10,pB=18;
  const vals=data.map(d=>d.value).concat(metric.reference===undefined?[]:[metric.reference]);
  let min=Math.min(...vals),max=Math.max(...vals);
  const baseRange=Math.max(Math.abs(max-min),metric.format==='pct'?.015:metric.format==='index'?8:.08);
  min-=baseRange*.18;max+=baseRange*.18;
  const x=(i:number)=>data.length===1?w/2:pL+i*(w-pL-pR)/(data.length-1);
  const y=(v:number)=>pT+(max-v)*(h-pT-pB)/(max-min||1);
  const d=data.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last=data[data.length-1];
  const prev=data.length>1?data[data.length-2]:last;
  const delta=last.value-prev.value;
  return <article className="metric-chart-card">
    <header><div><span>{metric.label}</span><strong>{formatValue(current,metric.format)}</strong></div><div className={`delta ${delta>0?'up':delta<0?'down':'flat'}`}>{formatDelta(delta,metric.format)}</div></header>
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="metric-svg">
      {[.25,.5,.75].map(t=><line key={t} x1={pL} x2={w-pR} y1={pT+t*(h-pT-pB)} y2={pT+t*(h-pT-pB)} className="chart-gridline"/>)}
      {metric.reference!==undefined&&metric.reference>=min&&metric.reference<=max&&<line x1={pL} x2={w-pR} y1={y(metric.reference)} y2={y(metric.reference)} className="chart-reference"/>}
      <path d={`${d} L${x(data.length-1)},${h-pB} L${x(0)},${h-pB} Z`} fill={metric.accent} opacity=".08"/>
      <path d={d} fill="none" stroke={metric.accent} strokeWidth="2.4" vectorEffect="non-scaling-stroke"/>
      <circle cx={x(data.length-1)} cy={y(last.value)} r="3.5" fill={metric.accent}/>
      {data.length>1&&<><text x={pL} y={h-3} className="chart-axis">{data[0].label}</text><text x={w-pR} y={h-3} textAnchor="end" className="chart-axis">{last.label}</text></>}
    </svg>
    <footer><span>{metric.reference!==undefined?`Reference ${formatValue(metric.reference,metric.format)}`:'Trend'}</span><span>{data.length} observations</span></footer>
  </article>
}

function normalizedHistory(e:EconomySnapshot):HistoryPoint[]{
  const base=e.history.slice(-20).map(h=>({...h,coreInflation:h.coreInflation??e.coreInflation,wageGrowth:h.wageGrowth??e.wageGrowth,exchangeRate:h.exchangeRate??e.exchangeRate,outputGap:h.outputGap??e.outputGap,sovereignSpread:h.sovereignSpread??e.sovereignSpread}));
  if(base.length)return base;
  return [{period:`Q${e.quarter} ${e.year}`,gdp:e.realGDP,growth:e.growth,inflation:e.inflation,coreInflation:e.coreInflation,unemployment:e.unemployment,wageGrowth:e.wageGrowth,debt:e.debtRatio,approval:e.approval,fci:e.fci,poverty:e.poverty,housingAffordability:e.housingAffordability,bankHealth:e.bankHealth,macroRisk:e.macroRisk,exchangeRate:e.exchangeRate,outputGap:e.outputGap,sovereignSpread:e.sovereignSpread,incumbentShare:e.election.incumbentShare,turnout:e.election.turnout}];
}

function formatValue(v:number,f:Metric['format']){if(f==='pct')return `${(v*100).toFixed(Math.abs(v)<.1?1:0)}%`;if(f==='index')return v.toFixed(0);return v.toFixed(2)}
function formatDelta(v:number,f:Metric['format']){if(Math.abs(v)<1e-7)return '—';const sign=v>0?'+':'';if(f==='pct')return `${sign}${(v*100).toFixed(1)}pp`;if(f==='index')return `${sign}${v.toFixed(1)}`;return `${sign}${v.toFixed(2)}`}
