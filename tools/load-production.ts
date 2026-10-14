// Isolated loopback benchmark: never use live identities or a public URL.
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createApp} from '../server/app.ts';
const dir=await mkdtemp(join(tmpdir(),'michi-production-load-'));
const server=createApp(join(dir,'test.sqlite'),dir,Date.now,{}, {enabled:false},undefined,true);
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();if(!address||typeof address==='string')throw Error('No local listener');const base=`http://127.0.0.1:${address.port}`;
const players=Array.from({length:100},(_,i)=>({cookie:'',id:'',revision:0,ip:`10.0.0.${i+1}`}));
const durations:number[]=[];let requests=0;
async function request(p:typeof players[number],bootstrap=false){
 const start=performance.now();const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:p.cookie,'CF-Connecting-IP':p.ip},body:JSON.stringify({requestId:randomUUID(),...(bootstrap?{}:{revision:p.revision,playerId:p.id}),actions:bootstrap?[]:[{type:'tap',count:2}]})});
 assert.equal(response.status,200);p.cookie=response.headers.get('set-cookie')?.split(';')[0]??p.cookie;const {state}=await response.json();p.revision=state.revision;p.id=state.playerId;requests++;durations.push(performance.now()-start);
}
async function round(bootstrap=false){for(let i=0;i<players.length;i+=10)await Promise.all(players.slice(i,i+10).map(p=>request(p,bootstrap)));}
try{
 await round(true);const start=performance.now();
 for(let i=0;i<20;i++){const tick=performance.now();await round();await new Promise(resolve=>setTimeout(resolve,Math.max(0,500-(performance.now()-tick))));}
 durations.sort((a,b)=>a-b);console.log(JSON.stringify({players:100,requests,failed:0,seconds:+((performance.now()-start)/1000).toFixed(2),p95ms:+durations[Math.floor(durations.length*.95)].toFixed(2),rssCombinedMiB:Math.round(process.memoryUsage().rss/1024/1024)}));
}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(dir,{recursive:true,force:true});}
