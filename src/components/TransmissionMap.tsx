import type { EconomySnapshot, PolicySpec } from '../game/types';
import { financialDrivers, fiscalDrivers, growthDrivers, inflationDrivers, policyPath } from '../game/analytics';

export default function TransmissionMap({econ,lastPolicy}:{econ:EconomySnapshot;lastPolicy:PolicySpec|null}){
  const path=policyPath(lastPolicy);
  return <section className="transmission-panel panel-shell">
    <header className="panel-title-row"><div><span className="eyebrow">TRANSMISSION LAB</span><h2>{lastPolicy?lastPolicy.label:'How policy moves through the economy'}</h2></div><span className="status-chip">{econ.impulses.length} active channel{econ.impulses.length===1?'':'s'}</span></header>
    <div className="transmission-flow">{path.map((p,i)=><div className="flow-step" key={p}><span>{String(i+1).padStart(2,'0')}</span><b>{p}</b>{i<path.length-1&&<i>→</i>}</div>)}</div>
    <div className="driver-quads">
      <DriverBlock title="Inflation drivers" rows={inflationDrivers(econ)}/>
      <DriverBlock title="Growth drivers" rows={growthDrivers(econ)}/>
      <DriverBlock title="Fiscal drivers" rows={fiscalDrivers(econ)}/>
      <DriverBlock title="Financial drivers" rows={financialDrivers(econ)}/>
    </div>
  </section>
}

function DriverBlock({title,rows}:{title:string;rows:{label:string;value:string;impact:number;note:string}[]}){
  return <article className="driver-block"><h3>{title}</h3>{rows.map(r=><div className="driver-row" key={r.label}><div><span>{r.label}</span><small>{r.note}</small></div><div className="driver-meter"><i style={{width:`${Math.abs(r.impact)*50}%`,marginLeft:r.impact<0?`${50-Math.abs(r.impact)*50}%`:'50%'}} className={r.impact>.12?'positive':r.impact<-.12?'negative':'neutral'}/><em/></div><b>{r.value}</b></div>)}</article>
}
