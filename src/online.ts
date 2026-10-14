import { createUI } from './ui.ts';
import { createSound } from './sound.ts';
import { startCommunity } from './community.ts';
import { initialState, SKINS } from './game.ts';
import { freshPrestige, previewPrestige } from './prestige.ts';
import { efficiency } from './fatigue.ts';
import { penalized, rhythmBonus } from './rhythm.ts';
import type { Action, ServerGame } from '../server/game.ts';

export async function startOnlineGame() {
  const sound=createSound(localStorage);
  let state: ServerGame | undefined;
  let actions: Action[]=[];
  let pending: {requestId:string;revision?:number;playerId?:string;actions:Action[]} | undefined;
  let busy=false;
  let generation=0;
  const ui=createUI(document.querySelector<HTMLElement>('#app')!,{
    soundEnabled:sound.enabled,toggleSound:()=>sound.toggle(),
    click:()=>{
      if(!state || busy && actions.length>=16)return;
      const tap=actions.find(a=>a.type==='tap');
      if(tap?.type==='tap')tap.count=Math.min(10000,tap.count+1);
      else if(actions.length<16)actions.push({type:'tap',count:1});
    },
    buy:id=>enqueue({type:'buy',id}),skin:id=>enqueue({type:'skin',id}),super:id=>enqueue({type:'super',id}),
    prestige:()=>{
      if(!state)return;
      const preview=previewPrestige(state.game,state.prestige);
      if(preview.allowed.ok && confirm(`¿Renacer por ${preview.gains.bigotes} bigotes? Pierdes saldo y niveles, conservas skins y mejoras permanentes.`))enqueue({type:'prestige'});
    },
    reset:()=>ui.status('La partida validada se conserva en el servidor. Renace para empezar otra vuelta con premios.'),
  });
  ui.render(initialState(),freshPrestige());
  ui.status('Conectando con tu partida validada. El guardado local del demo se conserva aparte.');
  const community=startCommunity(document.querySelector<HTMLElement>('.game__header')!,()=>({points:0,bigotes:0,penalty:0}),undefined,()=>{generation++;actions=[];pending=undefined;state=undefined;void sync();});
  function enqueue(action:Action) { if(state&&actions.length<16)actions.push(action); }
  async function sync() {
    if(busy || document.hidden)return;
    busy=true;
    const requestedGeneration=generation;
    try {
      if(!pending) { pending={requestId:crypto.randomUUID(),...(state ? {revision:state.revision,playerId:state.playerId} : {}),actions};actions=[]; }
      const token=await community.accessToken();
      const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},body:JSON.stringify(pending),signal:AbortSignal.timeout(8000)});
      const data=await response.json();
      if(requestedGeneration!==generation)return;
      if(!response.ok && response.status!==409)throw Error(data.error??'No se pudo sincronizar.');
      const previous=state; state=data.state;pending=undefined;
      if(!state)throw Error('Respuesta de partida inválida.');
      ui.render(state.game,state.prestige);
      ui.fatigue(efficiency(state.fatigue),penalized(state.rhythm,state.updatedAt),rhythmBonus(state.rhythm,state.updatedAt)>1);
      if(response.status===409) {actions=[];ui.status('La partida cambió en otra sesión. Ya está sincronizada.');}
      else {ui.status('Partida validada · servidor. Sin conexión se pausa; el demo local se conserva.');}
      if(previous && state.game.points>previous.game.points && state.lastTap>previous.lastTap) {
        sound.play(1);ui.feedback(state.game.points-previous.game.points,'none',state.chain);
      }
      if(previous && state.prestige.runs>previous.prestige.runs)ui.celebrate('¡Renacimiento validado! Tus bigotes y mejoras se conservan.','jump');
      else if(previous && state.game.autoLevel>previous.game.autoLevel)ui.celebrate('¡Nueva trabajadora!','jump');
      else if(previous && state.game.clickLevel>previous.game.clickLevel)ui.celebrate('¡Mejora de clic!','face');
      else if(previous && state.game.ownedSkins.length>previous.game.ownedSkins.length)ui.celebrate(`¡${SKINS.find(s=>s.id===state!.game.equippedSkin)!.name} desbloqueada!`);
    } catch(error) {ui.status(`${error instanceof Error ? error.message : 'Sin conexión'}. Reintentando; no se conceden puntos sin validar.`);}
    finally {busy=false;}
  }
  await sync();setInterval(()=>void sync(),500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
}
