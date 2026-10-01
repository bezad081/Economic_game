// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import CityScene, { type CityView } from '../phaser/CityScene';
import type { EconomySnapshot } from '../game/types';

export default function PhaserCity({econ,focus,view,onSelect}:{econ:EconomySnapshot;focus:boolean;view:CityView;onSelect:(name:string|null)=>void}){
  const host=useRef<HTMLDivElement>(null);
  const game=useRef<Phaser.Game|null>(null);
  const sceneRef=useRef<CityScene|null>(null);
  const latest=useRef({econ,focus,view,onSelect});
  latest.current={econ,focus,view,onSelect};
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    if(!host.current) return;
    let disposed=false;
    let g:Phaser.Game|null=null;
    try{
      const scene=new CityScene();
      scene.econ=latest.current.econ;
      scene.view=latest.current.view;
      scene.focus=latest.current.focus;
      sceneRef.current=scene;
      g=new Phaser.Game({
        // Canvas is deliberately used here. It is much more stable on GitHub Pages
        // and avoids browser/GPU WebGL context-loss blank screens.
        type:Phaser.CANVAS,
        parent:host.current,
        backgroundColor:'#08121a',
        transparent:false,
        antialias:true,
        roundPixels:false,
        fps:{target:60,min:30,forceSetTimeOut:false},
        scale:{
          mode:Phaser.Scale.RESIZE,
          autoCenter:Phaser.Scale.CENTER_BOTH,
          width:Math.max(320,host.current.clientWidth||960),
          height:Math.max(260,host.current.clientHeight||540)
        },
        scene:[scene]
      });
      game.current=g;
      const select=(name:string)=>latest.current.onSelect(name);
      g.events.on('district-select',select);
      const onBlur=()=>g?.loop?.sleep();
      const onFocus=()=>g?.loop?.wake();
      window.addEventListener('blur',onBlur);
      window.addEventListener('focus',onFocus);
      return()=>{
        disposed=true;
        window.removeEventListener('blur',onBlur);
        window.removeEventListener('focus',onFocus);
        try{g?.events.off('district-select',select);g?.destroy(true)}catch{}
        game.current=null;sceneRef.current=null;
      };
    }catch(err){
      console.error('MACROSTATE city renderer failed',err);
      if(!disposed)setFailed(true);
      try{g?.destroy(true)}catch{}
    }
  },[]);

  useEffect(()=>{
    const scene=sceneRef.current;
    try{
      if(scene && scene.sys && scene.sys.isActive()){
        scene.setEconomy(econ);
        scene.setView(view);
        scene.setFocus(focus);
      }
    }catch(err){
      console.error('MACROSTATE city update failed',err);
      setFailed(true);
    }
  },[econ,focus,view]);

  if(failed) return <div className="phaser-city-fallback"><b>City renderer paused</b><span>The economy is still running. Refresh once to restart the city renderer.</span></div>;
  return <div className="phaser-city" ref={host}/>;
}

export type { CityView } from '../phaser/CityScene';
