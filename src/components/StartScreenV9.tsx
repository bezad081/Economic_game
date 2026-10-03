import { useState, type ChangeEvent } from 'react';
import type { EconomySnapshot, GameMode } from '../game/types';

export type V9Setup={
  scenario:'Balanced'|'Inflation Shock'|'Recession'|'Financial Crisis'|'Debt Stress';
  difficulty:'Learning'|'Standard'|'Expert';
};

export default function StartScreenV9({hasSave,econ,onContinue,onStart}:{hasSave:boolean;econ:EconomySnapshot;onContinue:()=>void;onStart:(mode:GameMode,setup:V9Setup)=>void}){
  const [mode,setMode]=useState<GameMode>('mission');
  const [scenario,setScenario]=useState<V9Setup['scenario']>('Balanced');
  const [difficulty,setDifficulty]=useState<V9Setup['difficulty']>('Learning');
  return <div className="v10-start-screen">
    <div className="v10-start-shell">
      <section className="v10-start-hero">
        <div className="v10-start-logo">M</div>
        <span className="eyebrow">MACRO POLICY SIMULATION</span>
        <h1>MACROSTATE</h1>
        <p>Practice economics by doing economics. Read the dashboard, choose a policy instrument, advance a quarter, and learn from the trade-offs.</p>
        <div className="hero-metrics">
          <Preview label="Growth" value={`${(econ.growth*100).toFixed(1)}%`} />
          <Preview label="Inflation" value={`${(econ.inflation*100).toFixed(1)}%`} />
          <Preview label="Unemployment" value={`${(econ.unemployment*100).toFixed(1)}%`} />
          <Preview label="Debt / GDP" value={`${(econ.debtRatio*100).toFixed(0)}%`} />
        </div>
        <div className="hero-loop">
          <span>Diagnose</span><i>•</i><span>Choose</span><i>•</i><span>Advance</span><i>•</i><span>Observe</span><i>•</i><span>Learn</span>
        </div>
        {hasSave && <button className="continue-v10" onClick={onContinue}>Continue saved simulation</button>}
      </section>
      <section className="v10-setup-card">
        <header>
          <span className="eyebrow">START SIMULATION</span>
          <h2>Pick a starting economy</h2>
        </header>
        <label>Scenario</label>
        <div className="scenario-grid">
          {(['Balanced','Inflation Shock','Recession','Financial Crisis','Debt Stress'] as const).map(x=><button key={x} className={scenario===x?'active':''} onClick={()=>setScenario(x)}><b>{x}</b><small>{scenarioText(x)}</small></button>)}
        </div>
        <div className="setup-row">
          <div>
            <label>Game mode</label>
            <div className="pill-set">
              <button className={mode==='mission'?'active':''} onClick={()=>setMode('mission')}>Guided campaign</button>
              <button className={mode==='sandbox'?'active':''} onClick={()=>setMode('sandbox')}>Open sandbox</button>
            </div>
          </div>
          <div>
            <label>Difficulty</label>
            <select value={difficulty} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setDifficulty(e.target.value as V9Setup['difficulty'])}>
              <option>Learning</option>
              <option>Standard</option>
              <option>Expert</option>
            </select>
          </div>
        </div>
        <div className="start-note">
          <b>What changes?</b>
          <span>Scenario sets the initial macro conditions. Difficulty changes policy space and political room to maneuver.</span>
        </div>
        <button className="enter-command" onClick={()=>onStart(mode,{scenario,difficulty})}>Enter policy dashboard</button>
      </section>
    </div>
  </div>
}

function Preview({label,value}:{label:string;value:string}){return <div><span>{label}</span><b>{value}</b></div>}
function scenarioText(x:V9Setup['scenario']){
  return x==='Balanced'?'Stable base case for learning the system.':x==='Inflation Shock'?'Demand is hot, prices and wages are drifting up.':x==='Recession'?'Weak demand, high slack, low confidence.':x==='Financial Crisis'?'Credit channels are impaired and macro risk is high.':'Debt and spread pressure constrain the state.'
}
