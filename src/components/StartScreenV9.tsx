import { useState, type ChangeEvent } from 'react';
import type { EconomySnapshot, GameMode } from '../game/types';

export type V9Setup={
  role:'Chief Economist'|'Central Bank Governor'|'Finance Minister'|'Planning Minister';
  scenario:'Balanced'|'Inflation Shock'|'Recession'|'Financial Crisis'|'Debt Stress';
  difficulty:'Learning'|'Standard'|'Expert';
};

export default function StartScreenV9({hasSave,econ,onContinue,onStart}:{hasSave:boolean;econ:EconomySnapshot;onContinue:()=>void;onStart:(mode:GameMode,setup:V9Setup)=>void}){
  const [mode,setMode]=useState<GameMode>('mission');
  const [role,setRole]=useState<V9Setup['role']>('Chief Economist');
  const [scenario,setScenario]=useState<V9Setup['scenario']>('Balanced');
  const [difficulty,setDifficulty]=useState<V9Setup['difficulty']>('Learning');
  return <div className="v9-start-screen">
    <div className="v9-start-grid"/>
    <main className="v9-start-shell">
      <section className="v9-start-intro">
        <div className="v9-start-logo">M</div>
        <span className="eyebrow">POLICY COMMAND SIMULATION</span>
        <h1>MACROSTATE <em>V9</em></h1>
        <p>Turn economic theory into decisions. Diagnose the economy, choose policy instruments, absorb shocks, and explain the consequences.</p>
        <div className="loop-ribbon"><span>DIAGNOSE</span><i>→</i><span>DECIDE</span><i>→</i><span>ADVANCE</span><i>→</i><span>OBSERVE</span><i>→</i><span>LEARN</span></div>
        <div className="start-preview-grid"><Preview label="Growth" value={`${(econ.growth*100).toFixed(1)}%`}/><Preview label="Inflation" value={`${(econ.inflation*100).toFixed(1)}%`}/><Preview label="Unemployment" value={`${(econ.unemployment*100).toFixed(1)}%`}/><Preview label="Debt / GDP" value={`${(econ.debtRatio*100).toFixed(0)}%`}/></div>
        {hasSave&&<button className="continue-v9" onClick={onContinue}>Continue saved command room →</button>}
      </section>
      <section className="v9-setup-card">
        <header><span className="eyebrow">NEW POLICY MANDATE</span><h2>Configure your role</h2></header>
        <label>Role</label><div className="role-grid">{(['Chief Economist','Central Bank Governor','Finance Minister','Planning Minister'] as const).map(x=><button key={x} className={role===x?'active':''} onClick={()=>setRole(x)}><b>{x}</b><small>{roleText(x)}</small></button>)}</div>
        <div className="setup-pair"><div><label>Game mode</label><div className="pill-set"><button className={mode==='mission'?'active':''} onClick={()=>setMode('mission')}>Guided campaign</button><button className={mode==='sandbox'?'active':''} onClick={()=>setMode('sandbox')}>Open sandbox</button></div></div><div><label>Starting economy</label><select value={scenario} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setScenario(e.target.value as V9Setup['scenario'])}><option>Balanced</option><option>Inflation Shock</option><option>Recession</option><option>Financial Crisis</option><option>Debt Stress</option></select></div></div>
        <label>Difficulty</label><div className="difficulty-row">{(['Learning','Standard','Expert'] as const).map(x=><button key={x} className={difficulty===x?'active':''} onClick={()=>setDifficulty(x)}><b>{x}</b><small>{x==='Learning'?'More guidance, larger policy buffer':x==='Standard'?'Balanced simulation':'Tighter resources, stronger shocks'}</small></button>)}</div>
        <div className="mandate-note"><b>Your objective</b><span>{mode==='mission'?'Complete policy mandates while preserving macro stability.':'Experiment freely with the full policy toolkit and shock engine.'}</span></div>
        <button className="enter-command" onClick={()=>onStart(mode,{role,scenario,difficulty})}>Enter policy command →</button>
      </section>
    </main>
  </div>
}

function Preview({label,value}:{label:string;value:string}){return <div><span>{label}</span><b>{value}</b></div>}
function roleText(r:V9Setup['role']){return r==='Chief Economist'?'Balance the entire system':r==='Central Bank Governor'?'Prices, expectations and finance':r==='Finance Minister'?'Budget, debt and stabilization':'Productivity, infrastructure and reform'}
