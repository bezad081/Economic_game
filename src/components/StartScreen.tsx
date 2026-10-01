import type { EconomySnapshot, GameMode } from '../game/types';

const pct=(x:number,d=0)=>`${(x*100).toFixed(d)}%`;

export default function StartScreen({hasSave,econ,onContinue,onStart,onGuide}:{hasSave:boolean;econ:EconomySnapshot;onContinue:()=>void;onStart:(mode:GameMode)=>void;onGuide:()=>void;}){
  return <div className="start-screen">
    <div className="start-bg-grid" />
    <div className="start-hero">
      <div className="start-brand">
        <div className="start-logo">M</div>
        <div>
          <span className="eyebrow">AWARD EDITION • ECONOMIC STRATEGY</span>
          <h1>MACROSTATE</h1>
          <p>You are the chief economic strategist. Balance inflation, growth, jobs, finance and public trust while shaping a living capital city.</p>
        </div>
      </div>

      <div className="start-panels">
        <section className="start-card primary">
          <span className="eyebrow">START</span>
          <h2>Choose how you want to play</h2>
          <div className="start-actions">
            {hasSave && <button className="start-btn strong" onClick={onContinue}>Continue saved city</button>}
            <button className="start-btn strong" onClick={()=>onStart('sandbox')}>Sandbox free play</button>
            <button className="start-btn" onClick={()=>onStart('mission')}>Guided campaign</button>
            <button className="start-btn ghost" onClick={onGuide}>Guide & tutorial</button>
          </div>
        </section>
        <section className="start-card scenario">
          <span className="eyebrow">YOUR ROLE</span>
          <h3>What makes this game fun?</h3>
          <ul>
            <li>Read the city and the economy together.</li>
            <li>Choose one policy move per quarter.</li>
            <li>Watch the results appear in charts, firms and neighborhoods.</li>
            <li>Keep society stable while building long-run capacity.</li>
          </ul>
        </section>
      </div>

      <div className="start-footer-grid">
        <div className="start-stat"><span>Current growth</span><b>{pct(econ.growth,1)}</b><small>Target: healthy expansion</small></div>
        <div className="start-stat"><span>Current inflation</span><b>{pct(econ.inflation,1)}</b><small>Target range: roughly 2–4%</small></div>
        <div className="start-stat"><span>Current unemployment</span><b>{pct(econ.unemployment,1)}</b><small>Keep labor slack from rising</small></div>
        <div className="start-stat"><span>Public approval</span><b>{pct(econ.approval,0)}</b><small>Economic trade-offs shape politics</small></div>
      </div>
    </div>
  </div>
}
