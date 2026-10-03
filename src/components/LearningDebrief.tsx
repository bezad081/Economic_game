import { memo } from 'react';
import type { EconomySnapshot } from '../game/types';
import { pct, pp } from '../game/analytics';

function LearningDebrief({econ}:{econ:EconomySnapshot}){
  const h=econ.history;const last=h[h.length-1];const prev=h[h.length-2];
  return <section className="learning-strip panel-shell">
    <div className="learning-main"><span className="eyebrow">POLICY DEBRIEF</span><h3>What the economy is teaching you</h3><p>{econ.lastLearningNote}</p></div>
    <div className="learning-deltas">{last&&prev?<>
      <Delta label="Growth" value={pp(last.growth-prev.growth)} good={last.growth>=prev.growth}/>
      <Delta label="Inflation" value={pp(last.inflation-prev.inflation)} good={last.inflation<=prev.inflation}/>
      <Delta label="Jobs" value={pp(last.unemployment-prev.unemployment)} good={last.unemployment<=prev.unemployment}/>
      <Delta label="Debt" value={pp(last.debt-prev.debt)} good={last.debt<=prev.debt}/>
    </>:<div className="learning-placeholder">Advance one quarter to generate a policy debrief.</div>}</div>
    <div className="learning-context"><div><span>Real rate</span><b>{pct(econ.realRate)}</b></div><div><span>Output gap</span><b>{pct(econ.outputGap)}</b></div><div><span>Core inflation</span><b>{pct(econ.coreInflation)}</b></div></div>
  </section>
}
function Delta({label,value,good}:{label:string;value:string;good:boolean}){return <div className={`learning-delta ${good?'good':'bad'}`}><span>{label}</span><b>{value}</b></div>}

export default memo(LearningDebrief);
