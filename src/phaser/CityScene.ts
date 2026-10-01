// @ts-nocheck
import Phaser from 'phaser';
import type { EconomySnapshot } from '../game/types';

export type CityView = 'City'|'Prosperity'|'Jobs'|'Risk';

type District = {name:string;x:number;y:number;w:number;h:number;kind:string;accent:number};
type Vehicle = {sprite:Phaser.GameObjects.Image;shadow:Phaser.GameObjects.Ellipse;axis:'h'|'v';lane:number;speed:number;targetSpeed:number;dir:1|-1;kind:'car'|'bus'|'taxi'|'bike'};
type Walker = {sprite:Phaser.GameObjects.Image;path:Phaser.Math.Vector2[];target:number;speed:number;phase:number};

const DISTRICTS:District[]=[
  {name:'CENTRAL BANK',x:.055,y:.07,w:.18,h:.16,kind:'bank',accent:0x56c7ef},
  {name:'TREASURY',x:.285,y:.07,w:.17,h:.16,kind:'treasury',accent:0xe1c97a},
  {name:'TECH PARK',x:.505,y:.06,w:.205,h:.18,kind:'tech',accent:0x55dfc4},
  {name:'HOSPITAL',x:.765,y:.07,w:.17,h:.17,kind:'hospital',accent:0xee7771},
  {name:'MARKET',x:.065,y:.365,w:.17,h:.13,kind:'market',accent:0xe3c666},
  {name:'BANK HQ',x:.29,y:.355,w:.17,h:.14,kind:'finance',accent:0x63ccf2},
  {name:'FACTORY',x:.505,y:.345,w:.205,h:.155,kind:'factory',accent:0xc98b63},
  {name:'HOUSING',x:.765,y:.345,w:.17,h:.16,kind:'housing',accent:0x8fa4d8},
  {name:'UNIVERSITY',x:.065,y:.60,w:.19,h:.12,kind:'university',accent:0xb8cad8},
  {name:'SME DISTRICT',x:.29,y:.59,w:.18,h:.13,kind:'sme',accent:0xe8a85e},
  {name:'PORT / TRADE',x:.52,y:.58,w:.20,h:.14,kind:'port',accent:0x6fc5df},
  {name:'ENERGY',x:.79,y:.58,w:.145,h:.145,kind:'energy',accent:0x88c6b4}
];

const seeded=(i:number)=>{const x=Math.sin(i*917.31)*43758.5453;return x-Math.floor(x)};

export default class CityScene extends Phaser.Scene {
  econ!:EconomySnapshot;
  view:CityView='City';
  focus=false;
  vehicles:Vehicle[]=[];
  walkers:Walker[]=[];
  districtGraphics!:Phaser.GameObjects.Graphics;
  atmosphere!:Phaser.GameObjects.Graphics;
  weatherGraphics!:Phaser.GameObjects.Graphics;
  worldW=1440;
  worldH=760;
  cityTime=0;
  trafficPhase=0;

  constructor(){ super('CityScene'); }

  init(data?:{econ?:EconomySnapshot;view?:CityView;focus?:boolean}){
    if(data?.econ)this.econ=data.econ; if(data?.view)this.view=data.view; if(typeof data?.focus==='boolean')this.focus=data.focus;
  }

  create(){
    this.cameras.main.setBackgroundColor('#08121a');
    this.createTextures();
    this.buildWorld();
    this.spawnTraffic();
    this.spawnWalkers();
    this.scale.on('resize',()=>this.fitCamera());
    this.fitCamera();
  }

  setEconomy(econ:EconomySnapshot){ this.econ=econ; this.repaintDistricts(); }
  setView(view:CityView){ this.view=view; this.repaintDistricts(); }
  setFocus(focus:boolean){ this.focus=focus; }

  private fitCamera(){
    const cam=this.cameras.main;
    const vw=this.scale.width, vh=this.scale.height;
    const zoom=Math.min(vw/this.worldW,vh/this.worldH);
    cam.setZoom(zoom);
    cam.centerOn(this.worldW/2,this.worldH/2);
  }

  private createTextures(){
    const make=(key:string,w:number,h:number,draw:(g:Phaser.GameObjects.Graphics)=>void)=>{
      if(this.textures.exists(key)) return;
      const g=this.add.graphics(); draw(g); g.generateTexture(key,w,h); g.destroy();
    };
    make('car',34,16,g=>{g.fillStyle(0x9db6c7);g.fillRoundedRect(2,3,30,10,4);g.fillStyle(0x1a2b36);g.fillRect(10,2,11,6);g.fillStyle(0x101417);g.fillCircle(9,14,2.2);g.fillCircle(25,14,2.2);g.fillStyle(0xf4db85);g.fillRect(29,6,3,3)});
    make('taxi',34,16,g=>{g.fillStyle(0xf0cf55);g.fillRoundedRect(2,3,30,10,4);g.fillStyle(0x1a2b36);g.fillRect(10,2,11,6);g.fillStyle(0x101417);g.fillCircle(9,14,2.2);g.fillCircle(25,14,2.2);g.fillStyle(0x3d3d35);g.fillRect(14,0,7,2)});
    make('bus',52,20,g=>{g.fillStyle(0xd49a46);g.fillRoundedRect(1,2,50,14,4);g.fillStyle(0x18313f);for(let i=0;i<5;i++)g.fillRect(7+i*8,4,6,6);g.fillStyle(0x101417);g.fillCircle(11,18,2.6);g.fillCircle(40,18,2.6)});
    make('bike',18,12,g=>{g.lineStyle(1.4,0x81d8ff);g.strokeCircle(4,8,3);g.strokeCircle(14,8,3);g.lineBetween(4,8,9,4);g.lineBetween(9,4,14,8);g.lineBetween(9,4,10,8);g.lineBetween(10,8,4,8)});
    make('personA',14,24,g=>{g.fillStyle(0x251a16,.35);g.fillEllipse(7,22,8,3);g.fillStyle(0xf0bd8e);g.fillCircle(7,5,3);g.fillStyle(0x4fb9d2);g.fillRoundedRect(4,8,6,8,2);g.lineStyle(1.6,0xd6e8ef);g.lineBetween(5,15,3,22);g.lineBetween(9,15,11,22);g.lineBetween(4,10,1.5,15);g.lineBetween(10,10,12.5,15)});
    make('personB',14,24,g=>{g.fillStyle(0x251a16,.35);g.fillEllipse(7,22,8,3);g.fillStyle(0xc98f68);g.fillCircle(7,5,3);g.fillStyle(0xe7a857);g.fillRoundedRect(4,8,6,8,2);g.lineStyle(1.6,0xe7d7c5);g.lineBetween(5,15,2.5,21);g.lineBetween(9,15,11.5,21);g.lineBetween(4,10,1.5,14);g.lineBetween(10,10,12.5,14)});
    make('tree',28,40,g=>{g.fillStyle(0x593f2d);g.fillRect(12,22,4,14);g.fillStyle(0x2d714d);g.fillCircle(10,18,8);g.fillCircle(18,17,9);g.fillCircle(14,10,9);g.fillStyle(0x3f8a5f);g.fillCircle(10,11,4)});
    make('lamp',10,34,g=>{g.fillStyle(0x42505b);g.fillRect(4,7,2,25);g.fillStyle(0xf8e7a6);g.fillCircle(5,6,4)});
  }

  private buildWorld(){
    const g=this.add.graphics();
    g.fillGradientStyle(0x172d43,0x172d43,0x0d2438,0x0d2438,1);g.fillRect(0,0,this.worldW,190);
    // distant skyline
    for(let i=0;i<34;i++){const w=18+seeded(i)*35,h=35+seeded(i+70)*90,x=i*44-10;g.fillStyle(0x183247,.55);g.fillRect(x,190-h,w,h);}
    // ground
    g.fillStyle(0x244f3d);g.fillRect(0,190,this.worldW,500);
    // water
    g.fillStyle(0x0d455b);g.fillRect(0,690,this.worldW,70);g.fillStyle(0x1a718a,.35);for(let i=0;i<16;i++)g.fillRect(i*95,704+(i%3)*8,58,2);
    // roads
    const ys=[238,395,560,650];
    ys.forEach(y=>{g.fillStyle(0x273039);g.fillRect(0,y-31,this.worldW,62);g.fillStyle(0x121a20);g.fillRect(0,y-2,this.worldW,4);for(let x=15;x<this.worldW;x+=48){g.fillStyle(0xd6ac45,.8);g.fillRect(x,y-1,24,2)}});
    g.fillStyle(0x283139);g.fillRect(789,190,72,500);g.fillStyle(0x11191f);g.fillRect(823,190,4,500);for(let y=205;y<690;y+=48){g.fillStyle(0xd6ac45,.8);g.fillRect(824,y,2,24)}
    // sidewalks and crosswalks
    ys.forEach(y=>{g.fillStyle(0x7b8987,.38);g.fillRect(0,y-38,this.worldW,7);g.fillRect(0,y+31,this.worldW,7)});
    g.fillStyle(0xb9c8c5,.62);for(let i=0;i<8;i++){g.fillRect(775+i*8,365,4,28);g.fillRect(775+i*8,535,4,28)}
    // promenade
    g.fillStyle(0x6c7d75,.42);g.fillRect(0,672,this.worldW,18);
    // trees
    for(let i=0;i<36;i++){const x=35+seeded(i+250)*1360;const y=[190,330,505,620][i%4]+seeded(i+330)*26;this.add.image(x,y,'tree').setScale(.75+seeded(i+410)*.25).setDepth(4)}
    for(let i=0;i<18;i++){const x=45+i*75;this.add.image(x,667,'lamp').setScale(.8).setDepth(5)}

    this.districtGraphics=this.add.graphics().setDepth(2);
    this.repaintDistricts();
    this.buildDistrictLabels();
    this.buildDistrictInteractivity();
    this.atmosphere=this.add.graphics().setDepth(20);
    this.weatherGraphics=this.add.graphics().setDepth(21);
  }

  private repaintDistricts(){
    if(!this.districtGraphics||!this.econ) return;
    const g=this.districtGraphics;g.clear();
    DISTRICTS.forEach((d,idx)=>{
      const x=d.x*this.worldW,y=d.y*this.worldH,w=d.w*this.worldW,h=d.h*this.worldH;
      const health=this.districtHealth(d.name);
      const tint=this.view==='City'?d.accent:this.lensColor(health);
      g.fillStyle(0x061018,.42);g.fillRoundedRect(x+8,y+13,w,h,10);
      g.fillStyle(tint,.26);g.fillRoundedRect(x,y,w,h,10);
      g.fillStyle(0x132631,.96);g.fillRoundedRect(x+6,y+5,w-12,h-10,8);
      g.fillStyle(tint,.78);g.fillRect(x+6,y+5,w-12,5);
      // roof and facade bands
      g.fillStyle(0x0c1b25,.92);g.fillTriangle(x+8,y+5,x+w*.5,y-14,x+w-8,y+5);
      // windows
      const cols=Math.max(3,Math.floor(w/34)),rows=Math.max(2,Math.floor(h/30));
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const on=seeded(idx*100+r*cols+c)>.25;
        g.fillStyle(on?0x83c7d7:0x203a46,on?.72:.45);g.fillRoundedRect(x+18+c*((w-36)/cols),y+30+r*((h-48)/rows),Math.max(8,(w-58)/cols),7,2);
      }
      // iconic cues
      if(d.kind==='hospital'){g.fillStyle(0xee6b64);g.fillRect(x+w-40,y+17,8,25);g.fillRect(x+w-48,y+25,24,8)}
      if(d.kind==='finance'){g.fillStyle(0x55d5ff);g.fillRect(x+w-42,y+20,5,24);g.fillRect(x+w-50,y+29,21,5)}
      if(d.kind==='energy'){g.lineStyle(3,0xa8d9d2,.9);g.lineBetween(x+w*.62,y+18,x+w*.62,y+h-12);for(let k=0;k<3;k++){const a=k*Math.PI*2/3;g.lineBetween(x+w*.62,y+18,x+w*.62+Math.cos(a)*22,y+18+Math.sin(a)*22)}}
    });
  }


  private buildDistrictInteractivity(){
    DISTRICTS.forEach(d=>{
      const x=d.x*this.worldW,y=d.y*this.worldH,w=d.w*this.worldW,h=d.h*this.worldH;
      const zone=this.add.zone(x+w/2,y+h/2,w,h).setOrigin(.5).setInteractive({useHandCursor:true});
      zone.setDepth(7);zone.on('pointerdown',()=>this.game.events.emit('district-select',d.name));
    });
  }

  private buildDistrictLabels(){
    DISTRICTS.forEach(d=>{
      const x=(d.x+.015)*this.worldW,y=(d.y+.02)*this.worldH;
      this.add.text(x,y,d.name,{fontFamily:'Inter, system-ui',fontSize:'14px',fontStyle:'700',color:'#d6e8f2',stroke:'#071018',strokeThickness:3}).setDepth(6).setAlpha(.92);
    });
  }

  private lensColor(v:number){ if(v>.68)return 0x4edb91;if(v>.47)return 0xe2bd58;return 0xf06e68; }
  private districtHealth(name:string){const e=this.econ;if(!e)return .5;switch(name){case'CENTRAL BANK':return 1-Math.min(1,Math.abs(e.inflation-.03)/.08);case'TREASURY':return 1-Math.min(1,Math.max(0,e.debtRatio-.55)/.8);case'TECH PARK':return Math.min(1,e.technology/100);case'HOSPITAL':return 1-Math.min(1,e.poverty/.3);case'MARKET':return e.consumerConfidence;case'BANK HQ':return e.bankHealth;case'FACTORY':return e.businessConfidence;case'HOUSING':return Math.min(1,e.housingAffordability);case'UNIVERSITY':return Math.min(1,e.productivity/1.3);case'SME DISTRICT':return Math.min(1,e.businessConfidence*.65+Math.max(0,1-e.unemployment*6)*.35);case'PORT / TRADE':return Math.min(1,.55+e.growth*5);case'ENERGY':return e.energySecurity;default:return .5}}

  private spawnTraffic(){
    const roadYs=[238,395,560,650];
    for(let i=0;i<58;i++){
      const vertical=i%7===0;
      const kind:Vehicle['kind']=i%13===0?'bus':i%9===0?'taxi':i%6===0?'bike':'car';
      const key=kind==='bus'?'bus':kind==='taxi'?'taxi':kind==='bike'?'bike':'car';
      const sprite=this.add.image(vertical?807:seeded(i)*this.worldW,vertical?190+seeded(i+9)*500:roadYs[i%4]+(i%2?8:-8),key).setDepth(10);
      if(vertical)sprite.setRotation(Math.PI/2);
      const shadow=this.add.ellipse(sprite.x,sprite.y+6,kind==='bus'?44:kind==='bike'?13:28,6,0x000000,.25).setDepth(9);
      this.vehicles.push({sprite,shadow,axis:vertical?'v':'h',lane:vertical?i%2:i%4,speed:32+seeded(i+50)*25,targetSpeed:45,dir:(i%2?1:-1) as 1|-1,kind});
    }
  }

  private spawnWalkers(){
    const loops=[
      [[90,204],[330,204],[330,340],[90,340]],[[430,204],[720,204],[720,340],[430,340]],[[900,204],[1330,204],[1330,340],[900,340]],
      [[90,420],[330,420],[330,535],[90,535]],[[430,420],[720,420],[720,535],[430,535]],[[900,420],[1330,420],[1330,535],[900,535]],
      [[90,585],[330,585],[330,638],[90,638]],[[430,585],[720,585],[720,638],[430,638]],[[900,585],[1330,585],[1330,638],[900,638]]
    ];
    for(let i=0;i<90;i++){
      const pts=loops[i%loops.length].map(p=>new Phaser.Math.Vector2(p[0],p[1]));
      const sprite=this.add.image(pts[0].x+seeded(i+5)*30,pts[0].y,'person'+(i%2?'A':'B')).setDepth(12).setScale(.72+seeded(i+30)*.18);
      this.walkers.push({sprite,path:pts,target:1,speed:22+seeded(i+70)*18,phase:seeded(i+100)*Math.PI*2});
    }
  }

  update(_time:number,delta:number){
    if(!this.econ) return;
    const dt=Math.min(.033,delta/1000);this.cityTime+=dt;this.trafficPhase=(this.trafficPhase+dt)%10;
    this.updateTraffic(dt);this.updateWalkers(dt);this.drawAtmosphere();
  }

  private updateTraffic(dt:number){
    const eastGreen=this.trafficPhase<5.2;
    const speedMacro=Phaser.Math.Clamp(.82+this.econ.growth*3-(this.econ.fci-50)*.004,.5,1.2);
    const roadYs=[238,395,560,650];
    for(const v of this.vehicles){
      const free=(v.kind==='bus'?45:v.kind==='bike'?32:62)*speedMacro;
      let headway=999,red=false;
      const stopX=790,stopY=395;
      if(v.axis==='h'){
        v.sprite.y=roadYs[v.lane%4]+(v.lane%2?8:-8);
        const dist=v.dir>0?stopX-v.sprite.x:v.sprite.x-stopX;
        red=!eastGreen&&dist>0&&dist<92;
        for(const u of this.vehicles){if(u===v||u.axis!=='h'||u.lane!==v.lane||u.dir!==v.dir)continue;const d=v.dir>0?u.sprite.x-v.sprite.x:v.sprite.x-u.sprite.x;if(d>0&&d<headway)headway=d}
      }else{
        v.sprite.x=807+(v.lane%2?9:-9);
        const dist=v.dir>0?stopY-v.sprite.y:v.sprite.y-stopY;
        red=eastGreen&&dist>0&&dist<84;
        for(const u of this.vehicles){if(u===v||u.axis!=='v'||u.lane!==v.lane||u.dir!==v.dir)continue;const d=v.dir>0?u.sprite.y-v.sprite.y:v.sprite.y-u.sprite.y;if(d>0&&d<headway)headway=d}
      }
      const follow=headway<32?0:headway<64?(headway-32)/32:1;
      v.targetSpeed=red?0:free*follow;
      v.speed=Phaser.Math.Linear(v.speed,v.targetSpeed,Phaser.Math.Clamp(dt*(v.targetSpeed<v.speed?5.5:2.1),0,1));
      const move=v.dir*v.speed*dt;
      if(v.axis==='h'){v.sprite.x+=move;if(v.sprite.x>this.worldW+70)v.sprite.x=-70;if(v.sprite.x<-70)v.sprite.x=this.worldW+70;v.sprite.setFlipX(v.dir<0)}
      else{v.sprite.y+=move;if(v.sprite.y>700)v.sprite.y=185;if(v.sprite.y<185)v.sprite.y=700;v.sprite.setFlipX(v.dir<0)}
      v.shadow.setPosition(v.sprite.x,v.sprite.y+7);
    }
  }

  private updateWalkers(dt:number){
    const active=Math.floor(55+Phaser.Math.Clamp(this.econ.growth*300,-12,18));
    this.walkers.forEach((w,i)=>{
      w.sprite.setVisible(i<active); if(i>=active)return;
      const target=w.path[w.target];const dx=target.x-w.sprite.x,dy=target.y-w.sprite.y,dist=Math.hypot(dx,dy);
      if(dist<5){w.target=(w.target+1)%w.path.length;return;}
      const sp=w.speed*(.85+this.econ.approval*.25);w.sprite.x+=dx/dist*sp*dt;w.sprite.y+=dy/dist*sp*dt;
      w.phase+=dt*7;w.sprite.y+=Math.sin(w.phase)*.09;w.sprite.setFlipX(dx<0);
    });
  }

  private drawAtmosphere(){
    const g=this.atmosphere;g.clear();
    const night=((this.cityTime*.6+8)%24<6)||((this.cityTime*.6+8)%24>19);
    if(night){g.fillStyle(0x02101e,.38);g.fillRect(0,0,this.worldW,this.worldH);for(let i=0;i<20;i++){g.fillStyle(0xffe9a5,.10);g.fillCircle(40+i*72,655,18)}}
    if(this.econ.emissions>115){g.fillStyle(0x817f6c,Phaser.Math.Clamp((this.econ.emissions-115)/500,0,.12));g.fillRect(0,160,this.worldW,520)}
    if(this.econ.macroRisk>60){g.fillStyle(0x8b1e2d,Phaser.Math.Clamp((this.econ.macroRisk-60)/700,0,.08));g.fillRect(0,0,this.worldW,this.worldH)}
    // signal lights
    g.fillStyle(this.trafficPhase<5.2?0x45e48a:0xff6464);g.fillCircle(775,368,6);g.fillStyle(this.trafficPhase<5.2?0xff6464:0x45e48a);g.fillCircle(850,420,6);
    // subtle port water shimmer
    for(let i=0;i<7;i++){g.fillStyle(0x6ed7ff,.07);g.fillRect((this.cityTime*25+i*210)%this.worldW,710+i*5,75,2)}
  }
}