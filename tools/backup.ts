import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, chmod, access, readdir, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function copyDatabase(source: string, destination: string) {
  try { await access(destination); throw new Error('El destino ya existe: no se sobrescribe.'); }
  catch(error) { if((error as NodeJS.ErrnoException).code !== 'ENOENT')throw error; }
  const db=new DatabaseSync(source,{readOnly:true});
  try {
    if(db.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok')throw Error('SQLite no pasa la comprobación de integridad.');
    await mkdir(dirname(destination),{recursive:true,mode:0o700});
    await backup(db,destination);await chmod(destination,0o600);
    const check=new DatabaseSync(destination,{readOnly:true});
    try {if(check.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok')throw Error('Copia inválida.');}finally{check.close();}
  }finally{db.close();}
}
export async function dailyBackup(source:string,directory:string) {
  const name=`michiratagame-backup-${new Date().toISOString().replaceAll(':','-')}.sqlite`;
  const target=join(directory,name);await copyDatabase(source,target);
  const files=(await readdir(directory)).filter(n=>/^michiratagame-backup-.*\.sqlite$/.test(n)).sort().reverse();
  for(const name of files.slice(14))await unlink(join(directory,name));
  return target;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv[2]==='--restore') {
    if(!process.argv[3] || !process.argv[4])throw Error('Uso: backup.ts --restore copia.sqlite destino-nuevo.sqlite');
    await copyDatabase(resolve(process.argv[3]),resolve(process.argv[4]));console.log('Restauración validada en un archivo nuevo.');
  } else {
    const data=resolve(process.env.MICHI_DATA_DIR??'data');
    console.log(await dailyBackup(join(data,'community.sqlite'),resolve(process.env.MICHI_BACKUP_DIR??join(data,'backups'))));
  }
}
