import { useEffect, useRef, useState } from 'react';
import { createCity, updateCity } from '../game/city';
import type { EconomySnapshot } from '../game/types';

const buildings=[
  ['CENTRAL BANK',.07,.08,.19,.17],['TREASURY',.31,.08,.18,.17],['TECH PARK',.54,.07,.20,.18],['HOSPITAL',.78,.08,.15,.18],
  ['MARKET',.09,.39,.17,.12],['BANK HQ',.31,.38,.17,.13],['FACTORY',.54,.37,.20,.14],['HOUSING',.79,.37,.14,.14],
  ['UNIVERSITY',.09,.61,.19,.11],['SME DISTRICT',.33,.61,.17,.11],['PORT / TRADE',.56,.60,.19,.12],['ENERGY',.80,.60,.13,.12]
] as const;

function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath();
}

export default function CityCanvas({econ,focus,onSelect}:{econ:EconomySnapshot;focus:boolean;onSelect:(name:string|null)=>void}){
  const ref=useRef<HTMLCanvasElement>(null);
  const cityRef=useRef(createCity());
  const econRef=useRef(econ); econRef.current=econ;
  const [selected,setSelected]=useState<string|null>(null);

  useEffect(()=>{
    const canvas=ref.current!; const ctx=canvas.getContext('2d')!; let raf=0; let last=performance.now();
    const resize=()=>{ const r=canvas.getBoundingClientRect(); const d=Math.min(1.25,window.devicePixelRatio||1); canvas.width=Math.max(1,Math.floor(r.width*d));canvas.height=Math.max(1,Math.floor(r.height*d));ctx.setTransform(d,0,0,d,0,0); };
    const ro=new ResizeObserver(resize); ro.observe(canvas); resize();
    const render=(now:number)=>{
      const dt=Math.min(.033,(now-last)/1000);last=now;
      const w=canvas.clientWidth,h=canvas.clientHeight,e=econRef.current,city=cityRef.current; updateCity(city,dt,e,w,h);
      const hour=(city.t*1.1+8)%24,night=hour<6||hour>19;
      const sky=ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,night?'#07111f':'#19365a');sky.addColorStop(1,night?'#081018':'#142232');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);

      // ground blocks
      ctx.fillStyle=night?'#101923':'#1a2930';ctx.fillRect(0,h*.24,w,h*.76);
      ctx.fillStyle='#1f3430';ctx.fillRect(w*.02,h*.27,w*.96,h*.66);

      // roads
      const roadYs=[h*.31,h*.52,h*.74,h*.86];
      ctx.strokeStyle='#2e3742';ctx.lineWidth=28;for(const y of roadYs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      ctx.strokeStyle='#d9b84e';ctx.lineWidth=1;ctx.setLineDash([14,12]);for(const y of roadYs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.setLineDash([]);
      ctx.strokeStyle='#2e3742';ctx.lineWidth=28;ctx.beginPath();ctx.moveTo(w*.56,h*.24);ctx.lineTo(w*.56,h);ctx.stroke();

      // buildings
      buildings.forEach((b,i)=>{const [name,rx,ry,rw,rh]=b;const x=w*rx,y=h*ry,bw=w*rw,bh=h*rh;const stress=e.macroRisk/100;ctx.fillStyle=i===0?'#123a55':i===2?'#173b36':i===6?'#443528':'#182936';roundRect(ctx,x,y,bw,bh,8);ctx.fill();ctx.strokeStyle=selected===name?'#74e0ff':'rgba(255,255,255,.12)';ctx.lineWidth=selected===name?2:1;ctx.stroke();
        const cols=5,rows=3;for(let yy=0;yy<rows;yy++)for(let xx=0;xx<cols;xx++){const lit=((i*17+xx*7+yy*13)%10)>2;ctx.fillStyle=night?(lit?'#e5c36b':'#17304a'):'#284b5c';ctx.fillRect(x+10+xx*(bw-20)/cols,y+25+yy*(bh-38)/rows,Math.max(3,(bw-30)/cols-3),5);}
        if(!focus){ctx.fillStyle='#dce8f5';ctx.font='600 10px system-ui';ctx.fillText(name,x+9,y+15);}
        if(i===7 && e.housingAffordability<.5){ctx.fillStyle=`rgba(255,99,99,${.25+stress*.3})`;ctx.fillRect(x,y,bw,bh);}
      });

      // traffic lights
      const lp=(city.t%10)/10,green=lp<.52;const ix=w*.56;ctx.fillStyle=green?'#4ee58a':'#ff6363';ctx.beginPath();ctx.arc(ix-18,h*.52-22,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=!green?'#4ee58a':'#ff6363';ctx.beginPath();ctx.arc(ix+18,h*.52+22,4,0,Math.PI*2);ctx.fill();

      // vehicles
      for(const v of city.vehicles){ctx.save();ctx.translate(v.x,v.y);const dir=v.lane%2===0?1:-1;ctx.scale(dir,1);ctx.fillStyle=v.kind==='bus'?'#e2a842':v.kind==='taxi'?'#f5d94d':v.kind==='bike'?'#7bd4ff':'#b2c3d7';const ww=v.kind==='bus'?25:v.kind==='bike'?8:14,hh=v.kind==='bus'?8:5;ctx.fillRect(-ww/2,-hh/2,ww,hh);ctx.restore();}

      // walkers
      for(const p of city.walkers){ctx.fillStyle=p.mood<e.approval?'#7ce8a3':'#f2a27c';ctx.beginPath();ctx.arc(p.x,p.y,1.7,0,Math.PI*2);ctx.fill();}

      // protests under stress
      if(e.inflation>.075||e.unemployment>.10){ctx.fillStyle='#ff8f70';for(let i=0;i<26;i++){const x=w*.33+(i%9)*5,y=h*.28+Math.floor(i/9)*5;ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}if(!focus){ctx.fillStyle='#ffb199';ctx.font='700 10px system-ui';ctx.fillText('PROTEST',w*.33,h*.275);}}

      // smog / rain
      const haze=Math.max(0,(e.emissions-95)/100);if(haze>0){ctx.fillStyle=`rgba(121,121,101,${Math.min(.22,haze*.16)})`;ctx.fillRect(0,0,w,h);}
      if(city.weather==='rain'){ctx.strokeStyle='rgba(160,205,255,.34)';ctx.lineWidth=1;for(let i=0;i<90;i++){const x=(i*71+city.t*110)%w,y=(i*47+city.t*190)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+9);ctx.stroke();}}

      // vignette
      const vg=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.72);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.46)');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);return()=>{cancelAnimationFrame(raf);ro.disconnect();};
  },[focus,selected]);

  const click=(ev:React.MouseEvent<HTMLCanvasElement>)=>{const r=ev.currentTarget.getBoundingClientRect();const x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height;const hit=buildings.find(b=>x>=b[1]&&x<=b[1]+b[3]&&y>=b[2]&&y<=b[2]+b[4]);const name=hit?.[0]??null;setSelected(name);onSelect(name);};
  return <canvas ref={ref} className="city-canvas" onClick={click}/>;
}
