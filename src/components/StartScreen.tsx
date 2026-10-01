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
  const [mode,setMode]=useState<GameMode>('mission');
  const setup={role,scenario,difficulty};
  return <div className="start-screen v8-intro">
    <svg className="intro-city" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="introSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07131f"/><stop offset=".55" stopColor="#173853"/><stop offset="1" stopColor="#285c6c"/></linearGradient><linearGradient id="introWater"><stop stopColor="#0b4056"/><stop offset="1" stopColor="#12718a"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#introSky)"/>
      <circle cx="1270" cy="150" r="60" fill="#f7dda0" opacity=".92"/>
      <g opacity=".85">{Array.from({length:38},(_,i)=>{const h=80+(i*37)%260;return <rect key={i} x={i*46-30} y={610-h} width={24+(i*19)%35} height={h} rx="3" fill={i%5===0?'#23465c':'#19384d'}/>})}</g>
      <rect y="610" width="1600" height="190" fill="#173f32"/>
      <path d="M0 688 H1600 M0 744 H1600" stroke="#202d36" strokeWidth="50"/>
      <path d="M0 688 H1600 M0 744 H1600" stroke="#d2a844" strokeWidth="2" strokeDasharray="35 35"/>
      <rect y="800" width="1600" height="100" fill="url(#introWater)"/>
      <g fill="#2f7651">{Array.from({length:22},(_,i)=><circle key={i} cx={50+i*72} cy={646-(i%2)*7} r={18+(i%3)*4}/>)}</g>
      <g fill="#ffd985" opacity=".72">{Array.from({length:40},(_,i)=><rect key={i} x={i*41} y={420+(i%7)*18} width="7" height="4"/>)}</g>
    </svg>
    <div className="intro-vignette"/>
    <main className="v8-start-shell">
      <section className="v8-title-block">
        <div className="v8-mark">M</div>
        <span className="eyebrow">NATIONAL ECONOMIC STRATEGY GAME</span>
        <h1>MACROSTATE</h1>
        <p>You are the policy team behind a living country. Stabilize prices, create jobs, protect the financial system and make the city visibly prosper.</p>
        <div className="intro-loop"><b>DIAGNOSE</b><i>→</i><b>DECIDE</b><i>→</i><b>ADVANCE</b><i>→</i><b>ADAPT</b></div>
        {hasSave&&<button className="continue-btn" onClick={onContinue}>Continue saved government <span>→</span></button>}
        <button className="how-btn" onClick={onGuide}>How the game works</button>
      </section>

      <section className="new-government-card">
        <header><div><span className="eyebrow">NEW GOVERNMENT</span><h2>Set your mandate</h2></div><span className="brief-seal">CABINET</span></header>
        <div className="setup-section"><label>Your role</label><div className="role-choice">{(['Chief Economist','Central Bank Governor','Finance Minister','Development Minister'] as const).map(r=><button key={r} className={role===r?'active':''} onClick={()=>setRole(r)}><b>{r}</b><small>{roleCopy(r)}</small></button>)}</div></div>
        <div className="setup-section compact"><label>Game type</label><div className="pill-choice"><button className={mode==='mission'?'active':''} onClick={()=>setMode('mission')}>Guided Campaign</button><button className={mode==='sandbox'?'active':''} onClick={()=>setMode('sandbox')}>Free Sandbox</button></div></div>
        <div className="setup-two">
          <div className="setup-section compact"><label>Starting economy</label><select value={scenario} onChange={e=>setScenario(e.target.value as StartSetup['scenario'])}><option>Balanced</option><option>Inflation Shock</option><option>Recession</option><option>Financial Crisis</option></select></div>
          <div className="setup-section compact"><label>Difficulty</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value as StartSetup['difficulty'])}><option>Accessible</option><option>Standard</option><option>Expert</option></select></div>
        </div>
        <div className="brief-preview"><div><span>Growth</span><b>{pct(econ.growth,1)}</b></div><div><span>Inflation</span><b>{pct(econ.inflation,1)}</b></div><div><span>Jobs</span><b>{pct(econ.unemployment,1)}</b></div><div><span>Approval</span><b>{pct(econ.approval)}</b></div></div>
        <button className="launch-btn" onClick={()=>onStart(mode,setup)}>{mode==='mission'?'Enter the cabinet room':'Enter free sandbox'} <span>→</span></button>
        <small className="start-tip">First game? Choose Guided Campaign + Accessible. You can switch to Advanced tools later.</small>
      </section>
    </main>
  </div>
}

function roleCopy(r:StartSetup['role']){return r==='Chief Economist'?'Balance the whole economy':r==='Central Bank Governor'?'Prices, credit and expectations':r==='Finance Minister'?'Budget, debt and public investment':'Productivity, housing and industry'}
