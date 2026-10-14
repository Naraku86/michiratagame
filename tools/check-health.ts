const url=new URL(process.env.MICHI_HEALTH_URL??'http://127.0.0.1:4174/healthz');
if(url.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('El chequeo local requiere una dirección loopback HTTP.');
const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
const body=await response.json();
if(!response.ok || body.ok!==true || body.authoritative!==true)throw Error('El backend de producción no está saludable o no valida el progreso.');
console.log('Backend y SQLite saludables; progreso validado.');
export {};
