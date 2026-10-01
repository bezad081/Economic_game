import type { EconomySnapshot } from './types';

export interface Vehicle { x:number; y:number; vx:number; lane:number; kind:'car'|'bus'|'taxi'|'bike'; phase:number; }
export interface Walker { x:number; y:number; tx:number; ty:number; speed:number; mood:number; }
export interface CityState { vehicles:Vehicle[]; walkers:Walker[]; t:number; weather:'clear'|'rain'; }

const seeded=(i:number)=>{ const x=Math.sin(i*999.91)*43758.5453; return x-Math.floor(x); };

export function createCity():CityState {
  const vehicles:Vehicle[]=[];
  for(let i=0;i<34;i++) vehicles.push({x:seeded(i)*1200,y:0,vx:42+seeded(i+44)*42,lane:i%4,kind:i%11===0?'bus':i%7===0?'taxi':i%5===0?'bike':'car',phase:seeded(i+80)*10});
  const walkers:Walker[]=[];
  for(let i=0;i<80;i++) walkers.push({x:70+seeded(i+200)*1060,y:70+seeded(i+400)*590,tx:70+seeded(i+600)*1060,ty:70+seeded(i+800)*590,speed:12+seeded(i+1000)*20,mood:seeded(i+1200)});
  return {vehicles,walkers,t:0,weather:'clear'};
}

export function updateCity(city:CityState, dt:number, econ:EconomySnapshot, w:number, h:number){
  city.t += dt;
  const roadYs=[h*.31,h*.52,h*.74,h*.86];
  const lightCycle=10;
  const lightPhase=(city.t%lightCycle)/lightCycle;
  const eastGreen=lightPhase<.52;
  const speedMacro=Math.max(.48,Math.min(1.25,.82+econ.growth*3.5-(econ.fci-50)*.006));

  for(const v of city.vehicles){
    const y=roadYs[v.lane%roadYs.length];
    v.y=y;
    const dir=v.lane%2===0?1:-1;
    const free=(v.kind==='bus'?48:v.kind==='bike'?34:64)*speedMacro;
    const intersection=w*.56;
    const dist=dir>0?intersection-v.x:v.x-intersection;
    const stop=!eastGreen && dist>0 && dist<72;
    let headway=999;
    for(const u of city.vehicles){
      if(u===v || u.lane!==v.lane) continue;
      const d=dir>0?u.x-v.x:v.x-u.x;
      if(d>0 && d<headway) headway=d;
    }
    const followFactor=headway<18?0:headway<34?(headway-18)/16:1;
    const desired=stop?0:free*followFactor;
    const accel=desired<Math.abs(v.vx)?5.2:2.5;
    v.vx += (desired-Math.abs(v.vx))*Math.min(1,dt*accel);
    v.x += dir*Math.abs(v.vx)*dt;
    if(v.x>w+35) v.x=-35;
    if(v.x<-35) v.x=w+35;
  }

  for(const p of city.walkers){
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
    if(d<8){ p.tx=50+Math.random()*Math.max(100,w-100); p.ty=45+Math.random()*Math.max(100,h-110); }
    else { const sp=p.speed*(.78+econ.approval*.45); p.x+=dx/d*sp*dt; p.y+=dy/d*sp*dt; }
    p.x=Math.max(20,Math.min(w-20,p.x)); p.y=Math.max(20,Math.min(h-20,p.y));
  }
}
