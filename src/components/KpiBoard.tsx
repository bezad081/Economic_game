import { memo } from 'react';
import type { EconomySnapshot } from '../game/types';
import { metricTone, pct } from '../game/analytics';

function KpiBoard({econ}:{econ:EconomySnapshot}){
  const items=[
    {k:'growth',label:'GDP growth',v:pct(econ.growth),sub:`Gap ${pct(econ.outputGap)}`},
    {k:'inflation',label:'Inflation',v:pct(econ.inflation),sub:`Core ${pct(econ.coreInflation)}`},
    {k:'unemployment',label:'Unemployment',v:pct(econ.unemployment),sub:`Wages ${pct(econ.wageGrowth)}`},
    {k:'bank',label:'Bank health',v:`${(econ.bankHealth*100).toFixed(0)}`,sub:`Credit ${pct(econ.creditGrowth)}`},
    {k:'debt',label:'Debt / GDP',v:pct(econ.debtRatio),sub:`Spread ${pct(econ.sovereignSpread)}`},
    {k:'fx',label:'FX index',v:econ.exchangeRate.toFixed(2),sub:`Reserves ${econ.fxReserves.toFixed(0)}`},
    {k:'approval',label:'Approval',v:pct(econ.approval,0),sub:`Capital ${econ.politicalCapital.toFixed(0)}`},
    {k:'risk',label:'Macro risk',v:econ.macroRisk.toFixed(0),sub:`FCI ${econ.fci.toFixed(0)}`},
  ];
  return <section className="kpi-board">{items.map(x=><article key={x.label} className={`kpi-card ${metricTone(x.k,econ)}`}><span>{x.label}</span><strong>{x.v}</strong><small>{x.sub}</small></article>)}</section>
}

export default memo(KpiBoard);
