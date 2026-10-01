// @ts-nocheck
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import CityScene, { type CityView } from '../phaser/CityScene';
import type { EconomySnapshot } from '../game/types';

export default function PhaserCity({econ,focus,view,onSelect}:{econ:EconomySnapshot;focus:boolean;view:CityView;onSelect:(name:string|null)=>void}){
  const host=useRef<HTMLDivElement>(null);
  const game=useRef<Phaser.Game|null>(null);
  const sceneRef=useRef<CityScene|null>(null);

  useEffect(()=>{
    if(!host.current) return;
    const scene=new CityScene();scene.econ=econ;scene.view=view;scene.focus=focus;sceneRef.current=scene;
    const g=new Phaser.Game({
      type:Phaser.AUTO,
      parent:host.current,
      backgroundColor:'#08121a',
      transparent:false,
      antialias:true,
      render:{antialias:true,pixelArt:false},
      scale:{mode:Phaser.Scale.RESIZE,width:Math.max(1,host.current.clientWidth),height:Math.max(1,host.current.clientHeight)},
      scene:[scene]
    });
    game.current=g;
    const select=(name:string)=>onSelect(name);g.events.on('district-select',select);
    return()=>{g.events.off('district-select',select);g.destroy(true);game.current=null;sceneRef.current=null};
  },[]);

  useEffect(()=>{const scene=sceneRef.current;if(scene?.scene.isActive()){scene.setEconomy(econ);scene.setView(view);scene.setFocus(focus)}},[econ,focus,view]);
  return <div className="phaser-city" ref={host}/>;
}

export type { CityView } from '../phaser/CityScene';