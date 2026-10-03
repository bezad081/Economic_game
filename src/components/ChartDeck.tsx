import { memo, useMemo, useState } from 'react';
import type { EconomySnapshot, HistoryPoint } from '../game/types';

type Lens='Macro'|'Inflation'|'Financial'|'Fiscal'|'Society';
type Metric={key:keyof HistoryPoint;label:string;format:'pct'|'num'|'index';accent:string;current:(e:EconomySnapshot)=>number;reference?:number;goodDirection?:'up'|'down'|'target'};

const LENSES:Record<Lens,Metric[]>={
  Macro:[
    {key:'growth',label:'GDP growth',format:'pct',accent:'#57e1b2',current:e=>e.growth,reference:.025,goodDirection:'target'},
    {key:'inflation',label:'Headline inflation',format:'pct',accent:'#ffd067',current:e=>e.inflation,reference:.025,goodDirection:'target'},
    {key:'unemployment',label:'Unemployment',format:'pct',accent:'#ff857f',current:e=>e.unemployment,reference:.05,goodDirection:'down'},
    {key:'outputGap',label:'Output gap',format:'pct',accent:'#62cfff',current:e=>e.outputGap,reference:0,goodDirection:'target'},
  ],
  Inflation:[
    {key:'inflation',label:'Headline inflation',format:'pct',accent:'#ffd067',current:e=>e.inflation,reference:.025,goodDirection:'target'},
    {key:'coreInflation',label:'Core inflation',format:'pct',accent:'#ff9a78',current:e=>e.coreInflation,reference:.025,goodDirection:'target'},
    {key:'wageGrowth',label:'Wage growth',format:'pct',accent:'#ae9cff',current:e=>e.wageGrowth,reference:.04,goodDirection:'target'},
    {key:'outputGap',label:'Output gap',format:'pct',accent:'#62cfff',current:e=>e.outputGap,reference:0,goodDirection:'target'},
  ],
  Financial:[
    {key:'bankHealth',label:'Bank health',format:'pct',accent:'#57e1b2',current:e=>e.bankHealth,reference:.75,goodDirection:'up'},
    {key:'fci',label:'Financial conditions',format:'index',accent:'#62cfff',current:e=>e.fci,reference:50,goodDirection:'target'},
    {key:'exchangeRate',label:'FX index',format:'num',accent:'#ffd067',current:e=>e.exchangeRate,reference:1,goodDirection:'target'},
    {key:'sovereignSpread',label:'Sovereign spread',format:'pct',accent:'#ff857f',current:e=>e.sovereignSpread,reference:.01,goodDirection:'down'},
  ],
  Fiscal:[
    {key:'debt',label:'Debt / GDP',format:'pct',accent:'#ffd067',current:e=>e.debtRatio,reference:.65,goodDirection:'down'},
    {key:'approval',label:'Approval',format:'pct',accent:'#62cfff',current:e=>e.approval,reference:.55,goodDirection:'up'},
    {key:'growth',label:'GDP growth',format:'pct',accent:'#57e1b2',current:e=>e.growth,reference:.025,goodDirection:'target'},
    {key:'macroRisk',label:'Macro risk',format:'index',accent:'#ff857f',current:e=>e.macroRisk,reference:25,goodDirection:'down'},
  ],
  Society:[
    {key:'approval',label:'Public approval',format:'pct',accent:'#62cfff',current:e=>e.approval,reference:.55,goodDirection:'up'},
    {key:'poverty',label:'Poverty',format:'pct',accent:'#ff857f',current:e=>e.poverty,reference:.10,goodDirection:'down'},
    {key:'housingAffordability',label:'Housing access',format:'pct',accent:'#ae9cff',current:e=>e.housingAffordability,reference:.75,goodDirection:'up'},
    {key:'incumbentShare',label:'Gov. vote share',format:'pct',accent:'#57e1b2',current:e=>e.election.incumbentShare,reference:.50,goodDirection:'up'},
  ]
};

export default memo(function ChartDeck({econ}:{econ:EconomySnapshot}){
  const [lens,setLens]=useState<Lens>('Macro');
  const rows=useMemo(()=>normalizedHistory(econ),[econ.history,econ.turn,econ.inflation,econ.growth,econ.unemployment,econ.macroRisk]);
  return <section className="v9-chart-deck panel-shell v12-chart-deck">
    <header className="panel-title-row">
      <div><span className="eyebrow">ANALYTICAL WORKBENCH</span><h2>Economic telemetry</h2><small className="panel-subtitle">Quarterly history • reference bands • latest impulse</small></div>
      <div className="segmented-tabs">{(Object.keys(LENSES) as Lens[]).map(x=><button key={x} className={lens===x?'active':''} onClick={()=>setLens(x)}>{x}</button>)}</div>
    </header>
    <div className="chart-grid">{LENSES[lens].map(metric=><MetricChart key={metric.label} rows={rows} metric={metric} current={metric.current(econ)}/>)}</div>
  </section>
});

const MetricChart=memo(function MetricChart({rows,metric,current}:{rows:HistoryPoint[];metric:Metric;current:number}){
  const safeRows=rows.map(r=>({label:r.period,value:Number((r as any)[metric.key])})).filter(x=>Number.isFinite(x.value));
  const data=safeRows.length?safeRows:[{label:'Now',value:current}];
  const w=420,h=160,pL=12,pR=12,pT=14,pB=24;
  const vals=data.map(d=>d.value).concat(metric.reference===undefined?[]:[metric.reference]);
  let min=Math.min(...vals),max=Math.max(...vals);
  const baseRange=Math.max(Math.abs(max-min),metric.format==='pct'?.015:metric.format==='index'?8:.08);
  min-=baseRange*.22;max+=baseRange*.22;
  const x=(i:number)=>data.length===1?w/2:pL+i*(w-pL-pR)/(data.length-1);
  const y=(v:number)=>pT+(max-v)*(h-pT-pB)/(max-min||1);
  const d=data.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last=data[data.length-1];
  const prev=data.length>1?data[data.length-2]:last;
  const delta=last.value-prev.value;
  const trendTone=toneDelta(delta,current,metric);
  const gid=`grad-${String(metric.key).replace(/[^a-z0-9]/gi,'')}`;
  return <article className={`metric-chart-card trend-${trendTone}`}>
    <header><div><span>{metric.label}</span><strong>{formatValue(current,metric.format)}</strong></div><div className={`delta ${trendTone}`}>{formatDelta(delta,metric.format)}</div></header>
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="metric-svg" aria-label={`${metric.label} chart`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={metric.accent} stopOpacity=".22"/><stop offset="100%" stopColor={metric.accent} stopOpacity="0"/></linearGradient></defs>
      {[.2,.4,.6,.8].map(t=><line key={t} x1={pL} x2={w-pR} y1={pT+t*(h-pT-pB)} y2={pT+t*(h-pT-pB)} className="chart-gridline"/>)}
      {metric.reference!==undefined&&metric.reference>=min&&metric.reference<=max&&<><line x1={pL} x2={w-pR} y1={y(metric.reference)} y2={y(metric.reference)} className="chart-reference"/><text x={w-pR} y={y(metric.reference)-4} textAnchor="end" className="reference-label">ref {formatValue(metric.reference,metric.format)}</text></>}
      <path key={`area-${data.length}-${last.label}`} d={`${d} L${x(data.length-1)},${h-pB} L${x(0)},${h-pB} Z`} fill={`url(#${gid})`} className="metric-area"/>
      <path key={`line-${data.length}-${last.label}`} d={d} fill="none" stroke={metric.accent} strokeWidth="2.7" vectorEffect="non-scaling-stroke" className="metric-line"/>
      <circle cx={x(data.length-1)} cy={y(last.value)} r="4" fill={metric.accent} className="latest-point"/>
      <text x={pL} y={12} className="y-label">{formatValue(max,metric.format)}</text><text x={pL} y={h-pB-3} className="y-label">{formatValue(min,metric.format)}</text>
      {data.length>1&&<><text x={pL} y={h-4} className="chart-axis">{data[0].label}</text><text x={w-pR} y={h-4} textAnchor="end" className="chart-axis">{last.label}</text></>}
    </svg>
    <footer><span>{metric.reference!==undefined?`Reference ${formatValue(metric.reference,metric.format)}`:'Trend'}</span><span>{data.length} quarters</span></footer>
  </article>
});

function normalizedHistory(e:EconomySnapshot):HistoryPoint[]{
  const base=e.history.slice(-24).map(h=>({...h,coreInflation:h.coreInflation??e.coreInflation,wageGrowth:h.wageGrowth??e.wageGrowth,exchangeRate:h.exchangeRate??e.exchangeRate,outputGap:h.outputGap??e.outputGap,sovereignSpread:h.sovereignSpread??e.sovereignSpread}));
  if(base.length)return base;
  return [{period:`Q${e.quarter} ${e.year}`,gdp:e.realGDP,growth:e.growth,inflation:e.inflation,coreInflation:e.coreInflation,unemployment:e.unemployment,wageGrowth:e.wageGrowth,debt:e.debtRatio,approval:e.approval,fci:e.fci,poverty:e.poverty,housingAffordability:e.housingAffordability,bankHealth:e.bankHealth,macroRisk:e.macroRisk,exchangeRate:e.exchangeRate,outputGap:e.outputGap,sovereignSpread:e.sovereignSpread,incumbentShare:e.election.incumbentShare,turnout:e.election.turnout}];
}
function toneDelta(delta:number,current:number,m:Metric){if(Math.abs(delta)<1e-7)return'flat';if(m.goodDirection==='up')return delta>0?'good':'bad';if(m.goodDirection==='down')return delta<0?'good':'bad';if(m.reference===undefined)return delta>0?'up':'down';return Math.abs(current-m.reference)<Math.abs(current-delta-m.reference)?'good':'bad'}
function formatValue(v:number,f:Metric['format']){if(f==='pct')return `${(v*100).toFixed(Math.abs(v)<.1?1:0)}%`;if(f==='index')return v.toFixed(0);return v.toFixed(2)}
function formatDelta(v:number,f:Metric['format']){if(Math.abs(v)<1e-7)return '—';const sign=v>0?'+':'';if(f==='pct')return `${sign}${(v*100).toFixed(1)}pp`;if(f==='index')return `${sign}${v.toFixed(1)}`;return `${sign}${v.toFixed(2)}`}
