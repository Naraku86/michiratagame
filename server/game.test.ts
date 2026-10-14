import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createGameStore, freshServerGame, stepGame, validActions } from './game.ts';

test('server owns rewards, costs, randomness, prestige and a bounded tap workload',()=>{
 let state=freshServerGame(0);
 state=stepGame(state,[{type:'buy',id:'auto'},{type:'skin',id:'magica'},{type:'prestige'}],500,()=>.5);
 assert.equal(state.game.autoLevel,0);assert.equal(state.game.equippedSkin,'original');assert.equal(state.prestige.runs,0);
 state=stepGame(state,[{type:'tap',count:10000}],1000,()=>.5);
 assert.ok(state.game.points<=64);assert.ok(state.fatigue.heat>9000);assert.equal(state.rhythm.count,10000);
 for(let i=2;i<=14;i++)state=stepGame(state,[{type:'tap',count:10000}],i*1000,()=>.5);
 const before=state.game.points;state=stepGame(state,[{type:'tap',count:10000}],15000,()=>.5);
 assert.ok(state.game.points<=before);assert.ok(state.game.points>=0);
 const offline=stepGame({...freshServerGame(0),game:{...freshServerGame(0).game,autoLevel:100}},[],3600000);
 assert.equal(offline.game.points,0);
 assert.equal(validActions([{type:'tap',count:10001}]),false);
 assert.equal(validActions([{type:'tap',count:1},{type:'tap',count:1}]),false);
 assert.equal(validActions([{type:'skin',id:'__proto__'}]),false);
});
test('duplicate retries do not pay twice; stale sessions cannot overwrite newer progress',()=>{
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE players(id TEXT PRIMARY KEY); INSERT INTO players VALUES ('one'),('two')");const store=createGameStore(db);
 const first=store.apply('one',{requestId:randomUUID(),actions:[]},1000);
 const body={requestId:randomUUID(),revision:first.state.revision,actions:[{type:'tap' as const,count:4}]};
 const next=store.apply('one',body,1500);assert.equal(next.status,200);
 assert.deepEqual(store.apply('one',body,1600),next);
 assert.equal(store.apply('one',{...body,requestId:randomUUID()},1700).status,409);
 assert.equal(store.apply('two',{...body,playerId:'one',requestId:randomUUID()},1700).status,409);
 assert.equal(store.read('one')!.game.points,next.state.game.points);db.close();
});
