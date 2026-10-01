import { useMemo } from 'react';
import type { EconomySnapshot } from '../game/types';

export type CityView='City'|'Prosperity'|'Jobs'|'Risk';

type Props={econ:EconomySnapshot;view:CityView;selected:string|null;onSelect:(name:string|null)=>void};

type District={name:string;x:number;y:number;w:number;h:number;kind:string;accent:string};

const DISTRICTS:District[]=[
  {name:'CENTRAL BANK',x:86,y:98,w:226,h:126,kind:'bank',accent:'#54c7ef'},
  {name:'TREASURY',x:354,y:98,w:205,h:126,kind:'treasury',accent:'#dec16f'},
  {name:'TECH PARK',x:603,y:87,w:282,h:137,kind:'tech',accent:'#55dfc4'},
  {name:'HOSPITAL',x:923,y:98,w:223,h:126,kind:'hospital',accent:'#ef7771'},
  {name:'MARKET',x:84,y:331,w:221,h:112,kind:'market',accent:'#e2bd58'},
  {name:'BANK HQ',x:350,y:326,w:211,h:117,kind:'finance',accent:'#62c9ef'},
  {name:'FACTORY',x:606,y:316,w:280,h:127,kind:'factory',accent:'#c78c66'},
  {name:'HOUSING',x:925,y:316,w:221,h:127,kind:'housing',accent:'#8da5d7'},
  {name:'UNIVERSITY',x:83,y:530,w:226,h:101,kind:'university',accent:'#b6cad8'},
  {name:'SME DISTRICT',x:349,y:526,w:211,h:105,kind:'sme',accent:'#e5a55d'},
  {name:'PORT / TRADE',x:607,y:512,w:282,h:119,kind:'port',accent:'#6bc3df'},
  {name:'ENERGY',x:930,y:509,w:216,h:122,kind:'energy',accent:'#88c6b4'},
];

const trafficPaths=[
  'M -80 265 H 1680','M 1680 287 H -80','M -80 474 H 1680','M 1680 496 H -80','M -80 666 H 1680','M 1680 688 H -80',
  'M 775 -60 V 820','M 810 820 V -60'
];
const walkPaths=[
  'M 50 239 H 315 V 308 H 50 Z','M 334 239 H 572 V 308 H 334 Z','M 591 239 H 902 V 308 H 591 Z','M 917 239 H 1164 V 308 H 917 Z',
  'M 52 450 H 315 V 510 H 52 Z','M 335 450 H 574 V 510 H 335 Z','M 592 450 H 904 V 510 H 592 Z','M 918 450 H 1162 V 510 H 918 Z',
  'M 52 638 H 1164 V 718 H 52 Z'
];

const seeded=(n:number)=>{const x=Math.sin(n*712.31)*43758.5453;return x-Math.floor(x)};

export default function LivingCity({econ,view,selected,onSelect}:Props){
  const traffic=useMemo(()=>Array.from({length:36},(_,i)=>({
    path:trafficPaths[i%trafficPaths.length], delay:-seeded(i+4)*18, dur:10+seeded(i+9)*12, type:i%11===0?'bus':i%7===0?'taxi':i%6===0?'bike':'car', tone:i%5
  })),[]);
  const people=useMemo(()=>Array.from({length:54},(_,i)=>({path:walkPaths[i%walkPaths.length],delay:-seeded(i+50)*24,dur:18+seeded(i+80)*20,tone:i%6})),[]);
  const activity=Math.max(.45,Math.min(1, .55+econ.growth*3 + econ.consumerConfidence*.35));
  const activeCars=Math.max(18,Math.floor(traffic.length*activity));
  const activePeople=Math.max(22,Math.floor(people.length*Math.max(.45,.55+econ.consumerConfidence*.45)));
  const night=econ.turn%8>=5;
  const stressed=econ.inflation>.07||econ.unemployment>.09||econ.approval<.38;
  const construction=econ.growth>.035&&econ.businessConfidence>.58;
  const bankQueue=econ.bankHealth<.58;
  const pollution=Math.max(0,Math.min(.26,(econ.emissions-95)/260));

  return <div className="living-city-shell">
    <svg className="living-city" viewBox="0 0 1240 760" role="img" aria-label="Living capital city">
      <defs>
        <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#427ca5"/><stop offset=".54" stopColor="#8bb6c8"/><stop offset="1" stopColor="#d9d7c4"/></linearGradient>
        <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#06101c"/><stop offset=".55" stopColor="#0f263d"/><stop offset="1" stopColor="#183649"/></linearGradient>
        <linearGradient id="water" x1="0" x2="1"><stop offset="0" stopColor="#0b4157"/><stop offset=".5" stopColor="#176d82"/><stop offset="1" stopColor="#0d4e65"/></linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#000" floodOpacity=".38"/></filter>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <pattern id="roadDots" width="44" height="8" patternUnits="userSpaceOnUse"><rect width="22" height="2" y="3" fill="#d8ae43" opacity=".8"/></pattern>
      </defs>

      <rect width="1240" height="760" fill={night?'url(#skyNight)':'url(#skyDay)'}/>
      {night&&Array.from({length:38},(_,i)=><circle key={i} cx={30+seeded(i)*1180} cy={18+seeded(i+100)*115} r={.7+seeded(i+200)*1.3} fill="#eaf4ff" opacity={.35+seeded(i+300)*.5}/>) }
      {!night&&<><circle cx="1035" cy="72" r="32" fill="#fff0b5" opacity=".9" filter="url(#glow)"/><circle cx="1035" cy="72" r="10" fill="#fff9d8"/></>}
      {night&&<><circle cx="1030" cy="70" r="23" fill="#e3edf5"/><circle cx="1040" cy="62" r="23" fill="#0e2236"/></>}

      <g opacity=".72">{Array.from({length:30},(_,i)=>{const h=35+seeded(i+20)*92;return <rect key={i} x={i*45-20} y={185-h} width={18+seeded(i+40)*31} height={h} rx="2" fill={i%4===0?'#18384d':'#173144'}/>})}</g>
      <rect y="185" width="1240" height="520" fill="#214937"/>
      <rect y="710" width="1240" height="50" fill="url(#water)"/>
      <g opacity=".36">{Array.from({length:12},(_,i)=><path key={i} d={`M ${i*110} ${726+i%3*7} h 64`} stroke="#8adcf0" strokeWidth="2"/>)}</g>

      {/* roads */}
      {[276,486,676].map(y=><g key={y}><rect x="0" y={y-29} width="1240" height="58" fill="#273038"/><rect x="0" y={y-1} width="1240" height="2" fill="url(#roadDots)"/><rect x="0" y={y-36} width="1240" height="7" fill="#6d7a77" opacity=".42"/><rect x="0" y={y+29} width="1240" height="7" fill="#6d7a77" opacity=".42"/></g>)}
      <rect x="782" y="185" width="67" height="525" fill="#283139"/><rect x="814" y="185" width="3" height="525" fill="#d6ad43" opacity=".8"/>
      {[255,465,655].map(y=><g key={y}>{Array.from({length:7},(_,i)=><rect key={i} x={770+i*11} y={y} width="6" height="32" fill="#d7dfdc" opacity=".72"/>)}</g>)}

      {/* districts */}
      {DISTRICTS.map((d,i)=><DistrictBuilding key={d.name} d={d} selected={selected===d.name} health={districtHealth(d.name,econ)} view={view} night={night} index={i} onClick={()=>onSelect(d.name)}/>) }

      {/* parks, trees, street furniture */}
      {Array.from({length:38},(_,i)=>{
        const x=28+seeded(i+600)*1180;const y=[228,438,632][i%3]+seeded(i+700)*26;return <Tree key={i} x={x} y={y} scale={.75+seeded(i+800)*.35}/>;
      })}
      {Array.from({length:13},(_,i)=><g key={i} transform={`translate(${52+i*92} 700)`}><rect x="-1" y="-24" width="2" height="23" fill="#50606b"/><circle cy="-26" r="5" fill={night?'#ffe79b':'#a8bac1'} opacity={night?.95:.35} filter={night?'url(#glow)':''}/></g>)}

      {/* traffic: browser-native animation, no JS game loop */}
      <g className="traffic-layer">
        {traffic.slice(0,activeCars).map((v,i)=><Vehicle key={i} {...v}/>) }
      </g>
      <g className="people-layer">
        {people.slice(0,activePeople).map((p,i)=><Pedestrian key={i} {...p}/>) }
      </g>

      {construction&&<Construction x={1070} y={330}/>}      
      {bankQueue&&<Queue x={388} y={430}/>}      
      {stressed&&<Protest x={690} y={250}/>}      
      <Boat x={620} y={733} speed={Math.max(10,19-econ.exports/20)}/>
      <FactorySmoke x={734} y={319} amount={Math.max(.2,econ.emissions/130)}/>

      {pollution>0&&<rect x="0" y="145" width="1240" height="565" fill="#777767" opacity={pollution}/>}      
      {econ.macroRisk>65&&<rect width="1240" height="760" fill="#6b1720" opacity={Math.min(.08,(econ.macroRisk-65)/500)}/>}      
      {night&&<rect width="1240" height="760" fill="#04101b" opacity=".18"/>}
    </svg>
  </div>
}

function DistrictBuilding({d,selected,health,view,night,index,onClick}:{d:District;selected:boolean;health:number;view:CityView;night:boolean;index:number;onClick:()=>void}){
  const lens=view==='City'?d.accent:health>.68?'#50d996':health>.47?'#e1bb55':'#ef746e';
  const cols=Math.max(3,Math.floor(d.w/38)),rows=Math.max(2,Math.floor(d.h/34));
  return <g className={`district ${selected?'selected':''}`} onClick={onClick} style={{cursor:'pointer'}} filter="url(#softShadow)">
    <rect x={d.x+6} y={d.y+9} width={d.w} height={d.h} rx="10" fill="#071018" opacity=".45"/>
    <rect x={d.x} y={d.y} width={d.w} height={d.h} rx="10" fill="#132631" stroke={selected?'#d9f6ff':lens} strokeWidth={selected?3:1.4}/>
    <rect x={d.x} y={d.y} width={d.w} height="8" rx="8" fill={lens} opacity=".9"/>
    <path d={`M ${d.x+12} ${d.y} L ${d.x+d.w*.5} ${d.y-15} L ${d.x+d.w-12} ${d.y} Z`} fill="#0b1a24"/>
    {Array.from({length:rows*cols},(_,k)=>{const r=Math.floor(k/cols),c=k%cols;const wx=d.x+18+c*((d.w-36)/cols),wy=d.y+31+r*((d.h-46)/rows);const lit=night&&seeded(index*100+k)>.22;return <rect key={k} x={wx} y={wy} width={Math.max(10,(d.w-55)/cols)} height="7" rx="2" fill={lit?'#ffd985':'#7cb9c8'} opacity={lit?.88:.7}/>})}
    <text x={d.x+14} y={d.y+22} fill="#e5f2f7" fontSize="12" fontWeight="800" style={{pointerEvents:'none'}}>{d.name}</text>
    {d.kind==='hospital'&&<g fill="#f07a74"><rect x={d.x+d.w-40} y={d.y+18} width="8" height="28"/><rect x={d.x+d.w-50} y={d.y+28} width="28" height="8"/></g>}
    {d.kind==='finance'&&<text x={d.x+d.w-38} y={d.y+43} fill="#68d8ff" fontSize="30" fontWeight="900">$</text>}
    {d.kind==='tech'&&<circle cx={d.x+d.w-35} cy={d.y+31} r="9" fill="#4ee0c4" opacity=".85"/>}
    {d.kind==='energy'&&<WindTurbine x={d.x+d.w-52} y={d.y+65}/>}      
  </g>
}

function Vehicle({path,delay,dur,type,tone}:{path:string;delay:number;dur:number;type:string;tone:number}){
  const color=type==='taxi'?'#f1d35a':type==='bus'?'#d89a49':['#9ab2c2','#c97b6d','#738ea5','#8a9978','#aa8ba2'][tone];
  const w=type==='bus'?35:type==='bike'?13:22,h=type==='bus'?11:type==='bike'?5:9;
  return <g><animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" rotate="auto" path={path}/>
    {type==='bike'?<g stroke="#75d6ff" strokeWidth="1.4" fill="none"><circle cx="-5" cy="2" r="3"/><circle cx="5" cy="2" r="3"/><path d="M-5 2 L0 -3 L5 2 L0 2 Z"/></g>:<><ellipse cy="5" rx={w*.48} ry="3.2" fill="#000" opacity=".24"/><rect x={-w/2} y={-h/2} width={w} height={h} rx="3" fill={color}/><rect x={-w*.18} y={-h*.5} width={w*.32} height={h*.55} rx="1" fill="#173041"/><circle cx={-w*.28} cy={h*.52} r="1.7" fill="#12171a"/><circle cx={w*.28} cy={h*.52} r="1.7" fill="#12171a"/></>}
  </g>
}

function Pedestrian({path,delay,dur,tone}:{path:string;delay:number;dur:number;tone:number}){
  const shirt=['#4bb7d0','#e8a856','#83c983','#c987c4','#7f9fe4','#d2786b'][tone];
  const skin=['#f0bd8e','#c98f68','#e1ad7c'][tone%3];
  return <g><animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" rotate="auto" path={path}/>
    <ellipse cy="8" rx="4" ry="1.5" fill="#000" opacity=".28"/>
    <circle cy="-5" r="2.6" fill={skin}/><rect x="-2.7" y="-2" width="5.4" height="7.5" rx="2" fill={shirt}/><path d="M-1 5 L-3 10 M1 5 L3 10 M-2 -1 L-5 4 M2 -1 L5 4" stroke="#dbe8eb" strokeWidth="1.1" strokeLinecap="round"/>
  </g>
}

function Tree({x,y,scale}:{x:number;y:number;scale:number}){return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cy="7" rx="10" ry="3" fill="#07110d" opacity=".2"/><rect x="-2" y="-17" width="4" height="20" rx="1" fill="#5a402d"/><circle cy="-23" r="10" fill="#2f7651"/><circle cx="-8" cy="-18" r="8" fill="#3b8b60"/><circle cx="7" cy="-17" r="9" fill="#327b55"/></g>}
function WindTurbine({x,y}:{x:number;y:number}){return <g transform={`translate(${x} ${y})`} stroke="#b3d8d5" strokeWidth="2"><line y1="0" y2="45"/><g><animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="7s" repeatCount="indefinite"/><line x2="25"/><line x2="25" transform="rotate(120)"/><line x2="25" transform="rotate(240)"/></g></g>}
function Construction({x,y}:{x:number;y:number}){return <g transform={`translate(${x} ${y})`} stroke="#e3be61" strokeWidth="3" fill="none"><line x1="0" y1="0" x2="0" y2="98"/><line x1="0" y1="10" x2="70" y2="10"/><line x1="52" y1="10" x2="52" y2="58"><animate attributeName="y2" values="48;72;48" dur="5s" repeatCount="indefinite"/></line><rect x="45" y="58" width="14" height="8" fill="#c78f45" stroke="none"/></g>}
function Queue({x,y}:{x:number;y:number}){return <g transform={`translate(${x} ${y})`}>{Array.from({length:9},(_,i)=><g key={i} transform={`translate(${i*9} ${i%2*3})`}><circle cy="-5" r="2" fill="#e5ae85"/><rect x="-2" y="-2" width="4" height="7" rx="1" fill={i%2?'#7bbbcf':'#cf8b73'}/></g>)}</g>}
function Protest({x,y}:{x:number;y:number}){return <g transform={`translate(${x} ${y})`}>{Array.from({length:18},(_,i)=><g key={i} transform={`translate(${(i%6)*10} ${Math.floor(i/6)*9})`}><circle cy="-4" r="2" fill="#e2a879"/><rect x="-2" y="-1" width="4" height="6" fill={i%3===0?'#e6c35f':'#d47668'}/>{i%5===0&&<><line x1="3" y1="-7" x2="3" y2="-17" stroke="#dedede"/><rect x="3" y="-17" width="18" height="7" fill="#f2d873"/></>}</g>)}</g>}
function Boat({x,y,speed}:{x:number;y:number;speed:number}){return <g transform={`translate(${x} ${y})`}><animateTransform attributeName="transform" type="translate" values={`-120 ${y};1360 ${y}`} dur={`${speed}s`} repeatCount="indefinite"/><path d="M0 0 h70 l-12 12 h-48z" fill="#d6dde0"/><rect x="18" y="-13" width="28" height="14" rx="2" fill="#324b5a"/><rect x="22" y="-9" width="7" height="5" fill="#8fd4df"/><rect x="33" y="-9" width="7" height="5" fill="#8fd4df"/></g>}
function FactorySmoke({x,y,amount}:{x:number;y:number;amount:number}){return <g opacity={Math.min(.65,amount*.5)}>{Array.from({length:5},(_,i)=><circle key={i} cx={x+i*7} cy={y-i*12} r={6+i*1.5} fill="#a8aaa5"><animate attributeName="cy" values={`${y-i*12};${y-70-i*12}`} dur={`${5+i}s`} repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur={`${5+i}s`} repeatCount="indefinite"/></circle>)}</g>}

function districtHealth(name:string,e:EconomySnapshot){switch(name){case'CENTRAL BANK':return 1-Math.min(1,Math.abs(e.inflation-.03)/.08);case'TREASURY':return 1-Math.min(1,Math.max(0,e.debtRatio-.55)/.8);case'TECH PARK':return Math.min(1,e.technology/100);case'HOSPITAL':return 1-Math.min(1,e.poverty/.3);case'MARKET':return e.consumerConfidence;case'BANK HQ':return e.bankHealth;case'FACTORY':return e.businessConfidence;case'HOUSING':return Math.min(1,e.housingAffordability);case'UNIVERSITY':return Math.min(1,e.productivity/1.3);case'SME DISTRICT':return Math.min(1,e.businessConfidence*.65+Math.max(0,1-e.unemployment*6)*.35);case'PORT / TRADE':return Math.min(1,.55+e.growth*5);case'ENERGY':return e.energySecurity;default:return .5}}
