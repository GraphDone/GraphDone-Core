import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {sqliteAuthStore} from '../packages/server/src/auth/sqlite-auth.js';
if(process.argv.includes('--child')){
 await sqliteAuthStore.initialize();const user=await sqliteAuthStore.findUserByEmailOrUsername('admin');const saved=JSON.parse(await readFile('data/bootstrap-admin.json','utf8'));assert.ok(await sqliteAuthStore.validatePassword(user!,saved.password));assert.equal(await sqliteAuthStore.findUserByEmailOrUsername('viewer'),null);assert.equal(user!.isEmailVerified,true);console.log(JSON.stringify({id:user!.id,length:saved.password.length}));process.exit(0);
}
const dir=await mkdtemp(join(tmpdir(),'graphdone-bootstrap-')),root=process.cwd();
try{
 const run=()=>{const r=spawnSync(resolve(root,'node_modules/.bin/tsx'),[resolve(root,'scripts/test-admin-bootstrap.mts'),'--child'],{cwd:dir,encoding:'utf8',env:{...process.env,NODE_ENV:'production',ADMIN_PASSWORD:'',ADMIN_EMAIL:'admin@graphdone.local'}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim().split('\n').pop()!);};
 const one=run(),two=run();assert.equal(one.id,two.id);assert.ok(one.length>=40);assert.equal((await stat(join(dir,'data/bootstrap-admin.json'))).mode&0o777,0o600);
 console.log('PASS: unique production admin password, private recovery file, login, no demo viewer, stable identity across restart.');
}finally{await rm(dir,{recursive:true,force:true});}
