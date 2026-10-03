import { memo } from 'react';
import type { EconomySnapshot } from '../game/types';
import { pct, riskSignals } from '../game/analytics';

type Dial={label:string;value:number;display:string;note:string;tone:'good'|'warn'|'bad';symbol:string};

function MacroNavigator({econ}:{econ:EconomySnapshot}){
  const dials:Dial[]=[
    {label:'Demand heat',value:clamp((econ.outputGap+.06)/.12,0,1),display:pct(econ.outputGap),note:econ.outputGap>=0?'Above capacity':'Below capacity',tone:econ.outputGap>.03?'warn':econ.outputGap<-.03?'bad':'good',symbol:'◔'},
    {label:'Inflation pressure',value:clamp((econ.coreInflation-.01)/.08,0,1),display:pct(econ.coreInflation),note:`Expectations ${pct(econ.inflationExpected)}`,tone:econ.coreInflation>.05?'bad':econ.coreInflation>.035?'warn':'good',symbol:'◎'},
    {label:'Labor market',value:clamp(1-(econ.unemployment-.03)/.12,0,1),display:pct(econ.unemployment),note:`Wage growth ${pct(econ.wageGrowth)}`,tone:econ.unemployment>.075?'bad':econ.unemployment>.055?'warn':'good',symbol:'◕'},
    {label:'Fiscal space',value:clamp(1-(econ.debtRatio-.45)/.75,0,1),display:pct(econ.debtRatio),note:`Spread ${pct(econ.sovereignSpread)}`,tone:econ.debtRatio>.95?'bad':econ.debtRatio>.75?'warn':'good',symbol:'◫'},
    {label:'Financial system',value:clamp(econ.bankHealth,0,1),display:`${(econ.bankHealth*100).toFixed(0)}/100`,note:`Credit ${pct(econ.creditGrowth)}`,tone:econ.bankHealth<.5?'bad':econ.bankHealth<.68?'warn':'good',symbol:'◈'},
    {label:'External sector',value:clamp((econ.fxReserves/40 + (2-Math.min(2,econ.exchangeRate)))/2,0,1),display:`FX ${econ.exchangeRate.toFixed(2)}`,note:`Reserves ${econ.fxReserves.toFixed(0)}`,tone:econ.exchangeRate>1.2?'bad':econ.exchangeRate>1.08?'warn':'good',symbol:'◇'},
    {label:'Social climate',value:clamp(econ.approval,0,1),display:pct(econ.approval,0),note:`Poverty ${pct(econ.poverty)}`,tone:econ.approval<.4?'bad':econ.approval<.52?'warn':'good',symbol:'◌'},
  ];
  const risks=riskSignals(econ);
  return <aside className="macro-navigator panel-shell">
    <header className="panel-title-row compact"><div><span className="eyebrow">ECONOMY MONITOR</span><h2>Core systems</h2></div><span className={`nav-score ${econ.macroRisk>60?'bad':econ.macroRisk>35?'warn':'good'}`}>Risk {econ.macroRisk.toFixed(0)}</span></header>
    <section className="macro-dials">{dials.map(d=><article key={d.label} className={`macro-dial ${d.tone}`}><div className="dial-head"><span className="symbol">{d.symbol}</span><div><b>{d.label}</b><small>{d.note}</small></div><strong>{d.display}</strong></div><div className="dial-bar"><i style={{width:`${Math.round(d.value*100)}%`}}/></div></article>)}</section>
    <section className="pulse-grid">
      <div><span>Policy rate</span><b>{pct(econ.policyRate)}</b></div>
      <div><span>Real rate</span><b>{pct(econ.realRate)}</b></div>
      <div><span>Confidence</span><b>{(econ.businessConfidence*100).toFixed(0)}</b></div>
      <div><span>Tech level</span><b>{econ.technology.toFixed(0)}</b></div>
    </section>
    <section className="mini-risk-board">
      <h3>Pressure map</h3>
      {risks.map(r=><div className="mini-risk" key={r.label}><span>{r.label}</span><div className="mini-risk-track"><i style={{width:`${Math.round(r.value*100)}%`}}/></div><b>{Math.round(r.value*100)}</b></div>)}
    </section>
    <section className="dynamic-note">
      <span className="eyebrow">DYNAMIC ENGINE</span>
      <p>Shocks and policy scenarios emerge inside the simulation. Advance a quarter to let the economy react and create new constraints.</p>
    </section>
  </aside>
}

function clamp(x:number,a:number,b:number){return Math.max(a,Math.min(b,x))}

export default memo(MacroNavigator);
