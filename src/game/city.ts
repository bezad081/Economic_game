import type { EconomySnapshot } from './types';

export interface Vehicle { x:number; y:number; vx:number; lane:number; axis:'h'|'v'; kind:'car'|'bus'|'taxi'|'bike'; phase:number; }
export interface Walker { x:number; y:number; tx:number; ty:number; speed:number; mood:number; }
export interface CityState { vehicles:Vehicle[]; walkers:Walker[]; t:number; weather:'clear'|'rain'; weatherUntil:number; }

const seeded=(i:number)=>{ const x=Math.sin(i*999.91)*43758.5453; return x-Math.floor(x); };

export function createCity():CityState {
  const vehicles:Vehicle[]=[];
  for(let i=0;i<46;i++){
    const vertical=i%7===0;
    vehicles.push({x:seeded(i)*1200,y:seeded(i+22)*700,vx:38+seeded(i+44)*44,lane:vertical?i%2:i%4,axis:vertical?'v':'h',kind:i%13===0?'bus':i%8===0?'taxi':i%6===0?'bike':'car',phase:seeded(i+80)*10});
  }
  const walkers:Walker[]=[];
  for(let i=0;i<92;i++) walkers.push({x:70+seeded(i+200)*1060,y:70+seeded(i+400)*590,tx:70+seeded(i+600)*1060,ty:70+seeded(i+800)*590,speed:12+seeded(i+1000)*20,mood:seeded(i+1200)});
  return {vehicles,walkers,t:0,weather:'clear',weatherUntil:24};
}

export function updateCity(city:CityState, dt:number, econ:EconomySnapshot, w:number, h:number){
  city.t += dt;
  if(city.t>city.weatherUntil){city.weather=econ.energySecurity<.42&&Math.sin(city.t*.3)>.1?'rain':(Math.sin(city.t*.09)> .86?'rain':'clear');city.weatherUntil=city.t+18+seeded(Math.floor(city.t))*35}
  const roadYs=[h*.31,h*.52,h*.74,h*.86];
  const roadX=w*.56;
  const lightPhase=(city.t%10)/10;
  const eastGreen=lightPhase<.52;
  const speedMacro=Math.max(.46,Math.min(1.22,.82+econ.growth*3.2-(econ.fci-50)*.0055));

  for(const v of city.vehicles){
    const dir=v.lane%2===0?1:-1;
    const free=(v.kind==='bus'?44:v.kind==='bike'?31:61)*speedMacro;
    let stop=false, headway=999;
    if(v.axis==='h'){
      v.y=roadYs[v.lane%roadYs.length] + (v.lane%2===0?-6:6);
      const dist=dir>0?roadX-v.x:v.x-roadX;
      stop=!eastGreen && dist>0 && dist<72;
      for(const u of city.vehicles){if(u===v||u.axis!=='h'||u.lane!==v.lane)continue;const d=dir>0?u.x-v.x:v.x-u.x;if(d>0&&d<headway)headway=d}
    }else{
      v.x=roadX+(v.lane%2===0?-7:7);
      const dist=dir>0?h*.52-v.y:v.y-h*.52;
      stop=eastGreen && dist>0 && dist<64;
      for(const u of city.vehicles){if(u===v||u.axis!=='v'||u.lane!==v.lane)continue;const d=dir>0?u.y-v.y:v.y-u.y;if(d>0&&d<headway)headway=d}
    }
    const follow=headway<16?0:headway<34?(headway-16)/18:1;
    const desired=stop?0:free*follow;
    const response=desired<Math.abs(v.vx)?6.0:2.7;
    v.vx += (desired-Math.abs(v.vx))*Math.min(1,dt*response);
    if(v.axis==='h'){
      v.x += dir*Math.abs(v.vx)*dt;
      if(v.x>w+40)v.x=-40;if(v.x<-40)v.x=w+40;
    }else{
      v.y += dir*Math.abs(v.vx)*dt;
      if(v.y>h+40)v.y=h*.22-40;if(v.y<h*.22-40)v.y=h+40;
    }
  }

  for(const p of city.walkers){
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
    if(d<8){p.tx=50+Math.random()*Math.max(100,w-100);p.ty=h*.24+25+Math.random()*Math.max(100,h*.68)}
    else{const sp=p.speed*(.75+econ.approval*.45);p.x+=dx/d*sp*dt;p.y+=dy/d*sp*dt}
    p.x=Math.max(20,Math.min(w-20,p.x));p.y=Math.max(h*.23,Math.min(h-20,p.y));
  }
}
