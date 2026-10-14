import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { initialState, buySkin, equipSkin, SKINS, type Skin, type Upgrade } from '../src/game.ts';
import { freshPrestige, prestigeAdvance, prestigeTap, prestigeBuy, prestige, buySuper, SUPER_IDS, type SuperId } from '../src/prestige.ts';
import { freshFatigue, settleFatigue, recordTap, efficiency } from '../src/fatigue.ts';
import { freshRhythm, settleRhythm, rhythmTap, penalized, rhythmBonus, decayPoints } from '../src/rhythm.ts';

export type Action = { type: 'tap'; count: number } | { type: 'buy'; id: Upgrade } | { type: 'skin'; id: Skin } | { type: 'super'; id: SuperId } | { type: 'prestige' };
export function validActions(actions: unknown): actions is Action[] {
  return Array.isArray(actions) && actions.length <= 16 && actions.every(a => {
    if (!a || typeof a !== 'object') return false;
    switch(a.type) {
      case 'tap': return Number.isInteger(a.count) && a.count >= 1 && a.count <= 10000;
      case 'buy': return a.id === 'click' || a.id === 'auto';
      case 'skin': return SKINS.some(s=>s.id === a.id);
      case 'super': return SUPER_IDS.includes(a.id);
      case 'prestige': return true;
      default: return false;
    }
  }) && actions.filter(a=>a.type === 'tap').length <= 1;
}
export function freshServerGame(now: number) {
  return { game: initialState(), prestige: freshPrestige(), fatigue: freshFatigue(now), rhythm: freshRhythm(now),
    record: 0, penalty: 0, chain: 0, lastTap: 0, updatedAt: now, revision: 0, requestId: '', playerId: '' };
}
export type ServerGame = ReturnType<typeof freshServerGame>;
// No offline accrual: only short intervals between foreground heartbeats produce.
export function stepGame(previous: ServerGame, actions: Action[], now: number, roll = () => randomInt(1_000_000) / 1_000_000): ServerGame {
  const s = structuredClone(previous);
  now = Math.max(now, s.updatedAt);
  const elapsed = now - s.updatedAt;
  const seconds = elapsed <= 2000 ? elapsed / 1000 : 0;
  s.rhythm = settleRhythm(s.rhythm, now);
  s.fatigue = settleFatigue(s.fatigue, now);
  if (penalized(s.rhythm, now)) {
    s.game.points = decayPoints(s.game.points, seconds);
    const ranked = Math.max(0, s.record * (1 + Math.min(25,s.prestige.claimed)/100) - s.penalty);
    s.penalty += ranked - decayPoints(ranked, seconds);
  } else {
    const next = prestigeAdvance(s.game, s.prestige, seconds); s.game = next.game; s.prestige = next.prestige;
  }
  s.record = Math.max(s.record, s.game.points);
  for(const action of actions) {
    if(action.type === 'tap') {
      // Reward at most 64 taps per request and spread only over elapsed SERVER time.
      const counted = Math.min(action.count,64);
      const start = now - Math.min(elapsed,1000);
      for(let i=0;i<counted;i++) {
        const at = start + (now-start)*(i+1)/counted;
        s.rhythm = rhythmTap(s.rhythm, at); s.fatigue = recordTap(s.fatigue, at);
        if (penalized(s.rhythm,at)) continue;
        s.chain = at-s.lastTap<=1500 ? s.chain+1 : 1; s.lastTap=at;
        const next = prestigeTap(s.game,s.prestige,s.chain,roll(),efficiency(s.fatigue),rhythmBonus(s.rhythm,at));
        s.game=next.game;s.prestige=next.prestige;s.record=Math.max(s.record,s.game.points);
      }
      if(action.count>counted) {
        s.rhythm.count=Math.min(1e6,s.rhythm.count+action.count-counted);
        s.fatigue.heat=Math.min(1e6,s.fatigue.heat+action.count-counted);
      }
    } else if(action.type==='buy')s.game=prestigeBuy(s.game,s.prestige,action.id);
    else if(action.type==='skin') { s.game=buySkin(s.game,action.id);s.game=equipSkin(s.game,action.id);s.chain=0;s.lastTap=0; }
    else if(action.type==='super')s.prestige=buySuper(s.prestige,action.id);
    else { const next=prestige(s.game,s.prestige);s.game=next.game;s.prestige=next.prestige;s.chain=0;s.lastTap=0; }
  }
  s.updatedAt=now;s.revision++;return s;
}
export function createGameStore(db: DatabaseSync) {
  db.exec('CREATE TABLE IF NOT EXISTS games (player_id TEXT PRIMARY KEY REFERENCES players(id), state TEXT NOT NULL)');
  const get=db.prepare('SELECT state FROM games WHERE player_id = ?');
  const put=db.prepare('INSERT INTO games(player_id,state) VALUES (?,?) ON CONFLICT(player_id) DO UPDATE SET state=excluded.state');
  return {
    read(id: string): ServerGame | undefined { const row=get.get(id);return row ? JSON.parse(String(row.state)) : undefined; },
    apply(id: string, body: {requestId: string; revision?: number; playerId?: string; actions: Action[]}, now: number) {
      const row=get.get(id);const state: ServerGame=row ? JSON.parse(String(row.state)) : {...freshServerGame(now),playerId:id};
      if(body.requestId===state.requestId)return {status:200,state};
      if ((body.playerId && body.playerId!==id) || (body.actions.length && body.revision!==state.revision) || (body.revision!==undefined && body.revision!==state.revision))return {status:409,state};
      const next=stepGame(state,body.actions,now);next.requestId=body.requestId;
      put.run(id,JSON.stringify(next));return {status:200,state:next};
    }
  };
}
