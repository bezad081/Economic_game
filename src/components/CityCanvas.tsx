import { useEffect, useRef, useState } from 'react';
import { createCity, updateCity } from '../game/city';
import type { EconomySnapshot } from '../game/types';

export type CityView = 'City'|'Prosperity'|'Jobs'|'Risk';
type District = readonly [name:string,x:number,y:number,w:number,h:number,kind:string];
const districts:District[]=[
  ['CENTRAL BANK',.055,.075,.185,.17,'bank'],['TREASURY',.285,.075,.17,.17,'treasury'],['TECH PARK',.505,.06,.205,.19,'tech'],['HOSPITAL',.765,.075,.17,.18,'hospital'],
  ['MARKET',.065,.375,.17,.13,'market'],['BANK HQ',.29,.365,.17,.14,'finance'],['FACTORY',.505,.355,.205,.155,'factory'],['HOUSING',.765,.355,.17,.16,'housing'],
  ['UNIVERSITY',.065,.61,.19,.12,'university'],['SME DISTRICT',.29,.60,.18,.13,'sme'],['PORT / TRADE',.52,.59,.20,.14,'port'],['ENERGY',.79,.59,.145,.145,'energy']
];

const seeded=(n:number)=>{const x=Math.sin(n*713.17)*43758.5453;return x-Math.floor(x)};
const rr=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath()};

export default function CityCanvas({econ,focus,view,onSelect}:{econ:EconomySnapshot;focus:boolean;view:CityView;onSelect:(name:string|null)=>void}){
  const ref=useRef<HTMLCanvasElement>(null);
  const cityRef=useRef(createCity());
  const econRef=useRef(econ); econRef.current=econ;
  const staticRef=useRef<HTMLCanvasElement>();
  const dirtyRef=useRef(true);
  const [selected,setSelected]=useState<string|null>(null);

  useEffect(()=>{dirtyRef.current=true},[econ.quarter,econ.year,econ.regime,econ.bankHealth,econ.technology,econ.energySecurity,econ.emissions,econ.housingAffordability,econ.businessConfidence,econ.unemployment,econ.poverty,econ.macroRisk,econ.growth,focus,selected,view]);

  useEffect(()=>{
    const canvas=ref.current!; const ctx=canvas.getContext('2d')!; let raf=0; let last=performance.now(); let dpr=1;
    const resize=()=>{const r=canvas.getBoundingClientRect();dpr=Math.min(1.5,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);dirtyRef.current=true};
    const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
    const render=(now:number)=>{
      const dt=Math.min(.033,(now-last)/1000);last=now;
      const w=canvas.clientWidth,h=canvas.clientHeight,e=econRef.current,city=cityRef.current;updateCity(city,dt,e,w,h);
      const hour=(city.t*0.75+8)%24,night=hour<6.2||hour>19.1,dusk=(hour>17.7&&hour<=19.1)||(hour>=6.2&&hour<7.3);
      drawSky(ctx,w,h,hour,night,dusk,city.weather);
      if(dirtyRef.current||!staticRef.current){staticRef.current=buildStaticLayer(w,h,e,focus,selected,view);dirtyRef.current=false}
      ctx.drawImage(staticRef.current,0,0,w,h);
      drawDynamicDistricts(ctx,w,h,e,city.t,night,focus);
      drawLivingCity(ctx,w,h,e,city.t,night,view);
      drawTraffic(ctx,w,h,e,city,night);
      drawWalkers(ctx,e,city);
      drawStressEvents(ctx,w,h,e,focus,city.t);
      drawWeather(ctx,w,h,e,city.t,city.weather,night);
      drawAtmosphere(ctx,w,h,e,night);
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);return()=>{cancelAnimationFrame(raf);ro.disconnect()};
  },[focus,selected,view]);

  const click=(ev:React.MouseEvent<HTMLCanvasElement>)=>{const r=ev.currentTarget.getBoundingClientRect();const x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height;const hit=districts.find(b=>x>=b[1]&&x<=b[1]+b[3]&&y>=b[2]&&y<=b[2]+b[4]);const name=hit?.[0]??null;setSelected(name);onSelect(name)};
  return <canvas ref={ref} className="city-canvas" onClick={click}/>;
}

function drawSky(ctx:CanvasRenderingContext2D,w:number,h:number,hour:number,night:boolean,dusk:boolean,weather:string){
  const sky=ctx.createLinearGradient(0,0,0,h*.72);
  if(night){sky.addColorStop(0,'#020813');sky.addColorStop(.58,'#07172b');sky.addColorStop(1,'#102336')}
  else if(dusk){sky.addColorStop(0,'#142a48');sky.addColorStop(.55,'#8a5360');sky.addColorStop(1,'#e39669')}
  else{sky.addColorStop(0,'#5a9bc2');sky.addColorStop(.52,'#9bc7da');sky.addColorStop(1,'#d7e3dc')}
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  if(night){ctx.fillStyle='rgba(222,240,255,.85)';for(let i=0;i<52;i++){const x=seeded(i+80)*w,y=seeded(i+300)*h*.23,r=.45+seeded(i+600)*1.2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}const mx=w*.84,my=h*.11;ctx.fillStyle='#dce7e9';ctx.beginPath();ctx.arc(mx,my,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#07172b';ctx.beginPath();ctx.arc(mx+6,my-4,14,0,Math.PI*2);ctx.fill()}
  else{const sx=w*(.18+.64*Math.max(0,Math.min(1,(hour-6)/12))),sy=h*(.16-.06*Math.sin((hour-6)/12*Math.PI));const glow=ctx.createRadialGradient(sx,sy,2,sx,sy,44);glow.addColorStop(0,'rgba(255,248,195,.95)');glow.addColorStop(1,'rgba(255,220,145,0)');ctx.fillStyle=glow;ctx.fillRect(sx-50,sy-50,100,100);ctx.fillStyle='#fff3b4';ctx.beginPath();ctx.arc(sx,sy,10,0,Math.PI*2);ctx.fill()}
  const haze=weather==='rain'?.18:.04;ctx.fillStyle=`rgba(210,226,230,${haze})`;ctx.fillRect(0,0,w,h*.26);
  // distant skyline
  for(let i=0;i<34;i++){const bw=10+seeded(i+900)*24,bh=18+seeded(i+950)*58,x=i*(w/32)-8;ctx.fillStyle=night?'rgba(8,19,31,.86)':'rgba(38,67,77,.28)';ctx.fillRect(x,h*.23-bh,bw,bh)}
}

function buildStaticLayer(w:number,h:number,e:EconomySnapshot,focus:boolean,selected:string|null,view:CityView){
  const c=document.createElement('canvas');c.width=Math.max(1,Math.floor(w));c.height=Math.max(1,Math.floor(h));const ctx=c.getContext('2d')!;
  // districts / ground
  const ground=ctx.createLinearGradient(0,h*.22,0,h);ground.addColorStop(0,'#203b38');ground.addColorStop(1,'#112521');ctx.fillStyle=ground;ctx.fillRect(0,h*.22,w,h*.78);
  // park ribbons
  ctx.fillStyle='#244839';rr(ctx,w*.015,h*.26,w*.96,h*.66,18);ctx.fill();
  drawRoads(ctx,w,h);
  drawParks(ctx,w,h);
  districts.forEach((d,i)=>drawBuilding(ctx,w,h,d,e,selected===d[0],focus,i));
  drawStreetFurniture(ctx,w,h,e);
  drawCityLens(ctx,w,h,e,view);
  drawWaterfront(ctx,w,h,e);
  return c;
}

function drawRoads(ctx:CanvasRenderingContext2D,w:number,h:number){
  const ys=[h*.31,h*.52,h*.74,h*.86];
  for(const y of ys){ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=38;ctx.beginPath();ctx.moveTo(0,y+3);ctx.lineTo(w,y+3);ctx.stroke();ctx.strokeStyle='#313944';ctx.lineWidth=31;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.strokeStyle='#58616a';ctx.lineWidth=1;ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(0,y-8);ctx.lineTo(w,y-8);ctx.stroke();ctx.beginPath();ctx.moveTo(0,y+8);ctx.lineTo(w,y+8);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#d8b957';ctx.lineWidth=1.2;ctx.setLineDash([12,13]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.setLineDash([])}
  const x=w*.56;ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=39;ctx.beginPath();ctx.moveTo(x+3,h*.22);ctx.lineTo(x+3,h);ctx.stroke();ctx.strokeStyle='#313944';ctx.lineWidth=31;ctx.beginPath();ctx.moveTo(x,h*.22);ctx.lineTo(x,h);ctx.stroke();ctx.strokeStyle='#d8b957';ctx.lineWidth=1.2;ctx.setLineDash([12,13]);ctx.beginPath();ctx.moveTo(x,h*.22);ctx.lineTo(x,h);ctx.stroke();ctx.setLineDash([]);
  // sidewalks and crosswalks
  ctx.fillStyle='#6f7777';for(const y of ys){ctx.fillRect(0,y-19,w,3);ctx.fillRect(0,y+16,w,3)}ctx.fillRect(x-19,h*.22,3,h*.78);ctx.fillRect(x+16,h*.22,3,h*.78);
  ctx.fillStyle='rgba(232,236,230,.58)';for(let i=-4;i<=4;i++){ctx.fillRect(x-28+i*6,h*.52-15,3,30);ctx.fillRect(x-15,h*.52-28+i*6,30,3)}
}

function drawParks(ctx:CanvasRenderingContext2D,w:number,h:number){
  const zones=[[.015,.055,.03,.15],[.245,.07,.025,.14],[.72,.065,.03,.18],[.255,.58,.025,.13],[.74,.59,.035,.13]];
  zones.forEach((z,zi)=>{for(let i=0;i<8;i++){const x=w*(z[0]+seeded(zi*30+i)*z[2]),y=h*(z[1]+seeded(zi*30+i+11)*z[3]);drawTree(ctx,x,y,2.8+seeded(i+zi)*2)}})
  // plaza / fountain
  ctx.fillStyle='rgba(170,184,176,.28)';ctx.beginPath();ctx.ellipse(w*.255,h*.335,22,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(113,207,229,.65)';ctx.beginPath();ctx.ellipse(w*.255,h*.333,13,5,0,0,Math.PI*2);ctx.fill();
}

function drawTree(ctx:CanvasRenderingContext2D,x:number,y:number,r:number){ctx.fillStyle='#233329';ctx.fillRect(x-1,y,2,6);ctx.fillStyle='#2d6a47';ctx.beginPath();ctx.arc(x,y-1,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(90,164,109,.45)';ctx.beginPath();ctx.arc(x-r*.35,y-r*.55,r*.46,0,Math.PI*2);ctx.fill()}

function drawBuilding(ctx:CanvasRenderingContext2D,w:number,h:number,d:District,e:EconomySnapshot,selected:boolean,focus:boolean,index:number){
  const [name,rx,ry,rw,rh,kind]=d;const x=w*rx,y=h*ry,bw=w*rw,bh=h*rh;const depth=Math.max(5,Math.min(13,bw*.06));
  const stress=e.macroRisk/100;let front='#1b3343',side='#102531',roof='#294859',accent='#68cce9';
  if(kind==='tech'){front='#153d3a';side='#0e2b29';roof='#23635c';accent='#6ff1cf'}
  if(kind==='factory'){front='#46392f';side='#2d241f';roof='#645044';accent='#e7ad67'}
  if(kind==='hospital'){front='#2f3f4c';accent='#ff807b'}
  if(kind==='housing'){front='#344055';side='#242c3b';roof='#4a5871';accent='#b8c9ff'}
  if(kind==='energy'){front='#213d37';accent='#8ce0a6'}
  if(kind==='treasury'){front='#3b3846';accent='#d9c98f'}
  if(kind==='finance'&&e.bankHealth<.55){front='#472b32';accent='#ff7c7a'}
  ctx.fillStyle='rgba(0,0,0,.28)';rr(ctx,x+6,y+10,bw,bh,8);ctx.fill();
  ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(x+bw,y+depth);ctx.lineTo(x+bw+depth,y);ctx.lineTo(x+bw+depth,y+bh-depth);ctx.lineTo(x+bw,y+bh);ctx.closePath();ctx.fill();
  ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x,y+depth);ctx.lineTo(x+depth,y);ctx.lineTo(x+bw+depth,y);ctx.lineTo(x+bw,y+depth);ctx.closePath();ctx.fill();
  ctx.fillStyle=front;rr(ctx,x,y+depth,bw,bh-depth,7);ctx.fill();
  ctx.strokeStyle=selected?'#86e8ff':'rgba(255,255,255,.14)';ctx.lineWidth=selected?2.2:1;rr(ctx,x,y+depth,bw,bh-depth,7);ctx.stroke();
  // windows
  const cols=Math.max(3,Math.min(7,Math.floor(bw/28))),rows=Math.max(2,Math.min(4,Math.floor(bh/27)));for(let yy=0;yy<rows;yy++)for(let xx=0;xx<cols;xx++){const lit=((index*19+xx*7+yy*11)%10)>(2+Math.floor(stress*2));ctx.fillStyle=lit?'#7eb1c2':'#203847';const wx=x+9+xx*(bw-18)/cols,wy=y+depth+23+yy*(bh-depth-34)/rows,ww=Math.max(3,(bw-24)/cols-4);ctx.fillRect(wx,wy,ww,5)}
  drawBuildingIdentity(ctx,kind,x,y+depth,bw,bh-depth,accent,e);
  if(!focus){ctx.fillStyle='#e8f0f5';ctx.font='700 9px system-ui';ctx.fillText(name,x+8,y+depth+14)}
}

function drawBuildingIdentity(ctx:CanvasRenderingContext2D,kind:string,x:number,y:number,w:number,h:number,accent:string,e:EconomySnapshot){
  ctx.save();ctx.fillStyle=accent;ctx.strokeStyle=accent;
  if(kind==='bank'){ctx.beginPath();ctx.arc(x+w*.78,y+15,7,0,Math.PI*2);ctx.stroke();ctx.font='700 8px system-ui';ctx.fillText('CB',x+w*.78-5,y+18)}
  if(kind==='hospital'){ctx.fillRect(x+w*.72,y+10,4,15);ctx.fillRect(x+w*.72-5.5,y+15.5,15,4)}
  if(kind==='tech'){ctx.fillRect(x+w*.76,y+9,2,18);ctx.beginPath();ctx.arc(x+w*.77,y+7,3,0,Math.PI*2);ctx.fill()}
  if(kind==='treasury'){ctx.beginPath();ctx.arc(x+w*.78,y+17,8,Math.PI,0);ctx.fill();ctx.fillRect(x+w*.70,y+17,w*.16,3)}
  if(kind==='market'){for(let i=0;i<4;i++){ctx.fillStyle=i%2?accent:'#e6d9bd';ctx.fillRect(x+9+i*12,y+h-18,11,5)}}
  if(kind==='finance'){ctx.font='800 13px system-ui';ctx.fillText(e.bankHealth<.55?'!':'$',x+w*.79,y+19)}
  if(kind==='factory'){ctx.fillStyle='#6d5b4d';ctx.fillRect(x+w*.7,y-15,8,18);ctx.fillRect(x+w*.82,y-9,7,12)}
  if(kind==='housing'){for(let i=0;i<3;i++){ctx.fillStyle=i===1?'#516078':'#445169';ctx.fillRect(x+w*(.63+i*.09),y+h*.16-i*4,w*.07,h*.64+i*4)}}
  if(kind==='university'){ctx.fillStyle='#b9c7d0';ctx.beginPath();ctx.moveTo(x+w*.65,y+15);ctx.lineTo(x+w*.78,y+7);ctx.lineTo(x+w*.91,y+15);ctx.closePath();ctx.fill()}
  if(kind==='sme'){for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#5ba2b9':'#d89e66';ctx.fillRect(x+8+i*15,y+h-17,12,6)}}
  if(kind==='port'){ctx.strokeStyle='#d5aa64';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w*.75,y+h*.2);ctx.lineTo(x+w*.75,y+h*.64);ctx.lineTo(x+w*.91,y+h*.64);ctx.stroke()}
  if(kind==='energy'){ctx.strokeStyle='#b5d7d0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+w*.77,y+h*.22);ctx.lineTo(x+w*.77,y+h*.72);ctx.stroke();ctx.beginPath();ctx.arc(x+w*.77,y+h*.25,3,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}

function drawStreetFurniture(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot){
  const ys=[h*.31,h*.52,h*.74,h*.86];ctx.fillStyle='#10171d';for(const y of ys){for(let x=24;x<w;x+=85){ctx.fillRect(x,y-23,2,10);ctx.fillRect(x,y+13,2,10)}}
  // billboards
  ctx.fillStyle='#0b1e29';ctx.fillRect(w*.46,h*.275,78,21);ctx.strokeStyle='#50cbe7';ctx.strokeRect(w*.46,h*.275,78,21);ctx.fillStyle='#8ce8ff';ctx.font='700 8px system-ui';ctx.fillText(e.regime.toUpperCase(),w*.46+5,h*.275+13);
}

function drawDynamicDistricts(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,t:number,night:boolean,focus:boolean){
  // window glow, street lamps
  if(night){ctx.globalCompositeOperation='screen';for(let i=0;i<46;i++){const x=20+seeded(i+1400)*(w-40),y=h*.27+seeded(i+1700)*h*.61;const g=ctx.createRadialGradient(x,y,0,x,y,9);g.addColorStop(0,'rgba(255,214,118,.34)');g.addColorStop(1,'rgba(255,214,118,0)');ctx.fillStyle=g;ctx.fillRect(x-9,y-9,18,18)}ctx.globalCompositeOperation='source-over'}
  // factory smoke responds to emissions
  const smoke=Math.max(.15,Math.min(1.2,e.emissions/100));for(let i=0;i<6;i++){const age=(t*.15+i*.17)%1,x=w*.665+Math.sin(t*.4+i)*4-age*7,y=h*.345-age*42;ctx.fillStyle=`rgba(112,117,111,${(1-age)*.12*smoke})`;ctx.beginPath();ctx.arc(x,y,4+age*9,0,Math.PI*2);ctx.fill()}
  // energy turbines
  const cx=w*.902,cy=h*.64;ctx.strokeStyle='#d1e5e2';ctx.lineWidth=1.4;for(let j=0;j<2;j++){const x=cx-j*26,y=cy+j*14;ctx.beginPath();ctx.moveTo(x,y+28);ctx.lineTo(x,y);ctx.stroke();for(let k=0;k<3;k++){const a=t*1.8+k*Math.PI*2/3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*13,y+Math.sin(a)*13);ctx.stroke()}}
  // construction crane when investment / growth are strong
  if(e.growth>.025||e.housingIndex>108){const x=w*.805,y=h*.34;ctx.strokeStyle='#d7ae55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-44);ctx.lineTo(x+45,y-44);ctx.stroke();ctx.beginPath();ctx.moveTo(x+23,y-44);ctx.lineTo(x+23+Math.sin(t*.5)*8,y-14);ctx.stroke()}
  // port containers depend on trade
  const activity=Math.min(8,Math.max(3,Math.round(e.exports/25)));for(let i=0;i<activity;i++){ctx.fillStyle=['#ba684f','#477b8d','#d2a64f'][i%3];ctx.fillRect(w*.56+(i%4)*15,h*.69-Math.floor(i/4)*8,13,6)}
  if(!focus&&e.technology>82){ctx.fillStyle='rgba(93,244,207,.7)';ctx.font='700 8px system-ui';ctx.fillText('INNOVATION HUB ↑',w*.535,h*.245)}
}


function drawCityLens(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,view:CityView){
  if(view==='City') return;
  const metrics:Record<string,number>={
    bank:view==='Risk'?e.inflation*.7+e.macroRisk/160:view==='Prosperity'?1-Math.min(1,e.inflation*7):1-e.unemployment*6,
    treasury:view==='Risk'?e.debtRatio:view==='Prosperity'?Math.max(0,1-e.debtRatio*.7):1-e.unemployment*6,
    tech:view==='Prosperity'?e.technology/100:view==='Jobs'?Math.min(1,e.technology/120+e.businessConfidence*.35):e.macroRisk/100,
    hospital:view==='Prosperity'?1-e.poverty:view==='Jobs'?1-e.unemployment:view==='Risk'?e.poverty:1-e.poverty,
    market:view==='Prosperity'?e.consumerConfidence:view==='Jobs'?1-e.unemployment:view==='Risk'?1-e.consumerConfidence:e.consumerConfidence,
    finance:view==='Prosperity'?e.bankHealth:view==='Jobs'?e.creditGrowth+.5:view==='Risk'?1-e.bankHealth:e.bankHealth,
    factory:view==='Prosperity'?e.businessConfidence:view==='Jobs'?Math.min(1,.5+e.growth*5):view==='Risk'?e.emissions/150:e.businessConfidence,
    housing:view==='Prosperity'?e.housingAffordability:view==='Jobs'?Math.min(1,.55+e.growth*3):view==='Risk'?1-e.housingAffordability:e.housingAffordability,
    university:view==='Prosperity'?e.productivity/100:view==='Jobs'?e.technology/100:view==='Risk'?e.macroRisk/140:e.productivity/100,
    sme:view==='Prosperity'?e.businessConfidence:view==='Jobs'?1-e.unemployment:view==='Risk'?Math.max(0,1-e.businessConfidence):e.businessConfidence,
    port:view==='Prosperity'?Math.min(1,e.exports/150):view==='Jobs'?Math.min(1,e.exports/170+.25):view==='Risk'?Math.min(1,Math.abs(e.exchangeRate-1)*1.5):Math.min(1,e.exports/150),
    energy:view==='Prosperity'?e.energySecurity:view==='Jobs'?Math.min(1,e.energySecurity*.8+.2):view==='Risk'?1-e.energySecurity:e.energySecurity
  };
  for(const d of districts){const [name,rx,ry,rw,rh,kind]=d;const val=Math.max(0,Math.min(1,metrics[kind]??.5));const isRisk=view==='Risk';const good=isRisk?1-val:val;const hue=good>.66?'84,226,158':good>.42?'241,199,91':'255,108,105';ctx.fillStyle=`rgba(${hue},.055)`;rr(ctx,w*rx-4,h*ry-4,w*rw+8,h*rh+8,10);ctx.fill();ctx.strokeStyle=`rgba(${hue},.46)`;ctx.lineWidth=1.4;rr(ctx,w*rx-4,h*ry-4,w*rw+8,h*rh+8,10);ctx.stroke();ctx.fillStyle='rgba(5,12,18,.78)';rr(ctx,w*rx+5,h*(ry+rh)-17,Math.min(86,w*rw-10),13,5);ctx.fill();ctx.fillStyle=`rgb(${hue})`;ctx.font='700 7px system-ui';ctx.fillText(`${name.split(' / ')[0]} ${Math.round((isRisk?val:good)*100)}`,w*rx+10,h*(ry+rh)-8)}
}

function drawWaterfront(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot){
  const y=h*.94;const water=ctx.createLinearGradient(0,y,0,h);water.addColorStop(0,'rgba(36,92,108,.8)');water.addColorStop(1,'rgba(11,43,58,.96)');ctx.fillStyle=water;ctx.fillRect(0,y,w,h-y);ctx.strokeStyle='rgba(118,204,218,.18)';for(let i=0;i<18;i++){const yy=y+3+i*2;ctx.beginPath();ctx.moveTo((i*47)%90,yy);ctx.lineTo(w-(i*31)%110,yy);ctx.stroke()}
  // promenade
  ctx.fillStyle='#47534f';ctx.fillRect(0,y-5,w,5);ctx.fillStyle='rgba(218,220,203,.35)';for(let x=12;x<w;x+=40)ctx.fillRect(x,y-3,18,1);
  // cargo vessel / ferry activity responds to trade
  const shipX=w*(.18+Math.min(.62,e.exports/300));ctx.fillStyle='#263742';ctx.beginPath();ctx.moveTo(shipX-28,y+8);ctx.lineTo(shipX+30,y+8);ctx.lineTo(shipX+21,y+17);ctx.lineTo(shipX-22,y+17);ctx.closePath();ctx.fill();ctx.fillStyle='#d09b55';ctx.fillRect(shipX-8,y+3,19,5);
}

function drawLivingCity(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,t:number,night:boolean,view:CityView){
  // subtle glass reflections / moving cloud shadows
  const cloud=(t*9)%Math.max(1,w+180)-90;ctx.fillStyle=night?'rgba(90,130,155,.018)':'rgba(255,255,255,.032)';ctx.beginPath();ctx.ellipse(cloud,h*.18,76,17,0,0,Math.PI*2);ctx.ellipse(cloud+55,h*.175,52,13,0,0,Math.PI*2);ctx.fill();
  // animated market activity
  const shoppers=Math.max(3,Math.min(13,Math.round(4+e.consumerConfidence*9)));for(let i=0;i<shoppers;i++){const x=w*.075+(i%7)*11+Math.sin(t*.9+i)*2,y=h*.46+Math.floor(i/7)*7;ctx.fillStyle=i%3===0?'#e8c46d':'#82d8b1';ctx.beginPath();ctx.arc(x,y,1.7,0,Math.PI*2);ctx.fill()}
  // bank queue grows with stress
  if(e.bankHealth<.62){const n=Math.min(12,Math.ceil((.65-e.bankHealth)*32));for(let i=0;i<n;i++){ctx.fillStyle='#e7a883';ctx.beginPath();ctx.arc(w*.31+i*4.5,h*.505,1.5,0,Math.PI*2);ctx.fill()}}
  // university campus activity / innovation pulse
  if(e.technology>78){const pulse=.35+.25*Math.sin(t*2.1);ctx.strokeStyle=`rgba(93,244,207,${pulse})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(w*.15,h*.655,12+4*Math.sin(t*1.6),0,Math.PI*2);ctx.stroke()}
  // hospital ambulance when social stress rises
  if(e.poverty>.18||e.unemployment>.085){const x=(t*55)%(w*.25)+w*.72,y=h*.31;ctx.fillStyle='#e6edf2';rr(ctx,x,y-4,17,8,2);ctx.fill();ctx.fillStyle='#ef625e';ctx.fillRect(x+6,y-3,2,6);ctx.fillRect(x+4,y-1,6,2)}
  // power-grid instability at low energy security
  if(night&&e.energySecurity<.45){const flicker=Math.sin(t*7.3)>.72;if(flicker){ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(w*.74,h*.33,w*.22,h*.25)}}
  // prosperity fireworks are rare and tied to truly strong conditions
  if(e.growth>.045&&e.approval>.65&&e.inflation<.04){for(let j=0;j<3;j++){const cx=w*(.24+j*.26),cy=h*(.16+.025*j),phase=(t*.65+j*.31)%1;ctx.strokeStyle=`rgba(117,231,177,${1-phase})`;for(let k=0;k<9;k++){const a=k*Math.PI*2/9,r=phase*22;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.45,cy+Math.sin(a)*r*.45);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke()}}}
  // lens legend cue inside canvas
  if(view!=='City'){ctx.fillStyle='rgba(4,10,15,.72)';rr(ctx,w-126,h*.245,112,24,7);ctx.fill();ctx.fillStyle='#d9ecf7';ctx.font='700 8px system-ui';ctx.fillText(`${view.toUpperCase()} LENS`,w-117,h*.262)}
}

function drawTraffic(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,city:ReturnType<typeof createCity>,night:boolean){
  const lp=(city.t%10)/10,eastGreen=lp<.52,ix=w*.56;ctx.fillStyle=eastGreen?'#4ee58a':'#ff6363';ctx.beginPath();ctx.arc(ix-19,h*.52-24,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=!eastGreen?'#4ee58a':'#ff6363';ctx.beginPath();ctx.arc(ix+19,h*.52+24,4,0,Math.PI*2);ctx.fill();
  const activity=Math.max(.48,Math.min(1,e.businessConfidence*.65+e.consumerConfidence*.45));
  city.vehicles.forEach((v,i)=>{if(i/city.vehicles.length>activity+.2)return;ctx.save();ctx.translate(v.x,v.y);const dir=v.lane%2===0?1:-1;if(v.axis==='v')ctx.rotate(Math.PI/2);ctx.scale(dir,1);const ww=v.kind==='bus'?27:v.kind==='bike'?8:15,hh=v.kind==='bus'?9:v.kind==='bike'?3:6;ctx.fillStyle=v.kind==='bus'?'#d8a246':v.kind==='taxi'?'#efd64f':v.kind==='bike'?'#71d1ff':['#a6b9c8','#d07f6f','#7396a9','#88976f'][i%4];rr(ctx,-ww/2,-hh/2,ww,hh,2.5);ctx.fill();if(v.kind!=='bike'){ctx.fillStyle='#10202c';ctx.fillRect(-ww*.24,-hh*.42,ww*.35,hh*.55);ctx.fillStyle='#15191d';ctx.beginPath();ctx.arc(-ww*.28,hh*.55,1.6,0,Math.PI*2);ctx.arc(ww*.28,hh*.55,1.6,0,Math.PI*2);ctx.fill()}if(night){const g=ctx.createLinearGradient(ww/2,0,ww/2+18,0);g.addColorStop(0,'rgba(255,237,166,.28)');g.addColorStop(1,'rgba(255,237,166,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(ww/2,-2);ctx.lineTo(ww/2+18,-7);ctx.lineTo(ww/2+18,7);ctx.lineTo(ww/2,2);ctx.closePath();ctx.fill()}ctx.restore()})
}

function drawWalkers(ctx:CanvasRenderingContext2D,e:EconomySnapshot,city:ReturnType<typeof createCity>){
  city.walkers.forEach((p,i)=>{
    if(i>56+Math.round(e.growth*120))return;
    ctx.save();
    ctx.translate(p.x,p.y);
    const happy=p.mood<e.approval;
    ctx.fillStyle=happy?'#79e0ab':'#e7ad87';
    ctx.beginPath();
    ctx.arc(0,-3.3,1.5,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle=happy?'#aef2ca':'#f0c1a0';
    ctx.lineWidth=.9;
    ctx.beginPath();
    ctx.moveTo(0,-1.5); ctx.lineTo(0,2.2);
    ctx.moveTo(0,.2); ctx.lineTo(-1.9,1.2);
    ctx.moveTo(0,.2); ctx.lineTo(1.9,1.3);
    ctx.moveTo(0,2.2); ctx.lineTo(-1.4,4.3);
    ctx.moveTo(0,2.2); ctx.lineTo(1.4,4.2);
    ctx.stroke();
    ctx.restore();
  })
}

function drawStressEvents(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,focus:boolean,t:number){
  const stress=e.inflation>.07||e.unemployment>.095||e.approval<.35;
  if(stress){for(let i=0;i<30;i++){const x=w*.31+(i%10)*5+Math.sin(t*1.4+i)*1.5,y=h*.285+Math.floor(i/10)*5;ctx.fillStyle=i%3===0?'#f1c75b':'#e77f6d';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill()}if(!focus){ctx.fillStyle='#ffb59f';ctx.font='700 9px system-ui';ctx.fillText('CIVIC PROTEST',w*.31,h*.274)}}
  if(e.bankHealth<.5&&!focus){ctx.fillStyle='rgba(255,91,91,.85)';ctx.font='800 9px system-ui';ctx.fillText('STRESS',w*.398,h*.353)}
  if(e.businessConfidence<.35&&!focus){ctx.fillStyle='rgba(12,16,18,.78)';ctx.fillRect(w*.11,h*.47,38,9);ctx.fillStyle='#c7ced1';ctx.font='700 7px system-ui';ctx.fillText('VACANCY',w*.115,h*.477)}
}

function drawWeather(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,t:number,weather:string,night:boolean){
  if(weather==='rain'){ctx.strokeStyle=night?'rgba(139,188,228,.38)':'rgba(89,136,168,.30)';ctx.lineWidth=1;for(let i=0;i<110;i++){const x=(i*71+t*130)%w,y=(i*47+t*205)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+10);ctx.stroke()}}
  const haze=Math.max(0,(e.emissions-90)/90);if(haze>0){ctx.fillStyle=`rgba(112,112,96,${Math.min(.18,haze*.13)})`;ctx.fillRect(0,h*.12,w,h*.88)}
}

function drawAtmosphere(ctx:CanvasRenderingContext2D,w:number,h:number,e:EconomySnapshot,night:boolean){
  if(e.macroRisk>55){ctx.fillStyle=`rgba(92,20,28,${Math.min(.09,(e.macroRisk-55)/500)})`;ctx.fillRect(0,0,w,h)}
  const vg=ctx.createRadialGradient(w/2,h*.48,Math.min(w,h)*.18,w/2,h*.48,Math.max(w,h)*.72);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,night?'rgba(0,0,0,.52)':'rgba(0,0,0,.31)');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h)
}
