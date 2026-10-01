import type { HistoryPoint } from '../game/types';

export default function MiniChart({history,keys}:{history:HistoryPoint[];keys:('growth'|'inflation'|'unemployment')[]}){
  const w=520,h=170,pad=18;const rows=history.slice(-20);if(rows.length<2)return <div className="empty-chart">Advance a few quarters to build history.</div>;
  const vals=rows.flatMap(r=>keys.map(k=>r[k]));let min=Math.min(...vals),max=Math.max(...vals);if(Math.abs(max-min)<.01){min-=.01;max+=.01;}const x=(i:number)=>pad+i*(w-pad*2)/(rows.length-1);const y=(v:number)=>h-pad-(v-min)*(h-pad*2)/(max-min);
  return <svg className="mini-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
    {[0,.25,.5,.75,1].map(t=><line key={t} x1={pad} x2={w-pad} y1={pad+t*(h-pad*2)} y2={pad+t*(h-pad*2)} className="grid-line"/>)}
    {keys.map((k,ki)=>{const d=rows.map((r,i)=>`${i?'L':'M'} ${x(i)} ${y(r[k])}`).join(' ');return <path key={k} d={d} className={`series s${ki}`}/>})}
  </svg>;
}
