import {test} from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {copyDatabase,dailyBackup} from './backup.ts';
test('online WAL backup restores verified progress and refuses to replace an existing database',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'michi-backup-'));const source=join(dir,'source.sqlite');
 const db=new DatabaseSync(source);db.exec("PRAGMA journal_mode=WAL; CREATE TABLE games(id TEXT,state TEXT); INSERT INTO games VALUES ('one','preserved')");
 try{const copy=await dailyBackup(source,join(dir,'backups'));const target=join(dir,'restored.sqlite');await copyDatabase(copy,target);const check=new DatabaseSync(target);assert.equal(check.prepare('SELECT state FROM games').get()!.state,'preserved');check.close();await assert.rejects(copyDatabase(copy,source),/no se sobrescribe/);}finally{db.close();await rm(dir,{recursive:true,force:true});}
});
