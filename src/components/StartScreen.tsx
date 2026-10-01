import { useState } from 'react';
import type { EconomySnapshot, GameMode } from '../game/types';

export type StartSetup={
  role:'Chief Economist'|'Central Bank Governor'|'Finance Minister'|'Development Minister';
  scenario:'Balanced'|'Inflation Shock'|'Recession'|'Financial Crisis';
  difficulty:'Accessible'|'Standard'|'Expert';
};

const pct=(x:number,d=0)=>`${(x*100).toFixed(d)}%`;

export default function StartScreen({hasSave,econ,onContinue,onStart,onGuide}:{hasSave:boolean;econ:EconomySnapshot;onContinue:()=>void;onStart:(mode:GameMode,setup:StartSetup)=>void;onGuide:()=>void;}){
  const [role,setRole]=useState<StartSetup['role']>('Chief Economist');
  const [scenario,setScenario]=useState<StartSetup['scenario']>('Balanced');
  const [difficulty,setDifficulty]=useState<StartSetup['difficulty']>('Standard');
  const setup={role,scenario,difficulty};
  return <div className="start-screen v7-intro">
    <div className="intro-skyline" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="intro-glow"/>
    <main className="intro-shell">
      <header className="intro-header">
        <div className="start-logo">M</div>
        <div><span className="eyebrow">NATIONAL ECONOMIC STRATEGY SIMULATOR</span><h1>MACROSTATE</h1><p>Lead a living economy. Every policy reshapes firms, households, markets, politics and the city around you.</p></div>
      </header>

      <section className="briefing-grid">
        <article className="briefing-main">
          <span className="eyebrow">CABINET BRIEFING</span>
          <h2>Choose your mandate</h2>
          <div className="role-grid">
            {(['Chief Economist','Central Bank Governor','Finance Minister','Development Minister'] as const).map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}><b>{r}</b><small>{roleCopy(r)}</small></button>)}
          </div>
          <div className="briefing-row">
            <div><span className="eyebrow">STARTING ECONOMY</span><div className="choice-strip">{(['Balanced','Inflation Shock','Recession','Financial Crisis'] as const).map(s=><button key={s} className={scenario===s?'active':''} onClick={()=>setScenario(s)}>{s}</button>)}</div></div>
            <div><span className="eyebrow">DIFFICULTY</span><div className="choice-strip">{(['Accessible','Standard','Expert'] as const).map(d=><button key={d} className={difficulty===d?'active':''} onClick={()=>setDifficulty(d)}>{d}</button>)}</div></div>
          </div>
        </article>

        <aside className="briefing-side">
          <span className="eyebrow">THE JOB</span>
          <h3>One quarter. One hard choice.</h3>
          <p>Read the economy, choose a policy, advance time, then judge the consequences in the city and the data. There is no single perfect number to maximize.</p>
          <div className="mandate-list"><span>Price stability</span><span>Jobs & growth</span><span>Financial resilience</span><span>Living standards</span><span>Political trust</span></div>
          <div className="intro-actions">
            {hasSave&&<button className="hero-btn secondary" onClick={onContinue}>Continue saved government</button>}
            <button className="hero-btn" onClick={()=>onStart('mission',setup)}>Start campaign</button>
            <button className="hero-btn secondary" onClick={()=>onStart('sandbox',setup)}>Free sandbox</button>
            <button className="text-btn" onClick={onGuide}>How to play</button>
          </div>
        </aside>
      </section>

      <footer className="intro-kpis"><div><span>Growth</span><b>{pct(econ.growth,1)}</b></div><div><span>Inflation</span><b>{pct(econ.inflation,1)}</b></div><div><span>Unemployment</span><b>{pct(econ.unemployment,1)}</b></div><div><span>Approval</span><b>{pct(econ.approval)}</b></div><small>Tip: the campaign is the best first game. Sandbox unlocks the full policy room immediately.</small></footer>
    </main>
  </div>
}

function roleCopy(r:StartSetup['role']){return r==='Chief Economist'?'Balance the whole system':r==='Central Bank Governor'?'Prices, credit and expectations':r==='Finance Minister'?'Budget, debt and public investment':'Productivity, housing and industry'}
