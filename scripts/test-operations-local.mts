import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {operationsApi} from '../packages/server/src/operations-api.js';
import {sqliteAuthStore} from '../packages/server/src/auth/sqlite-auth.js';
import {generateToken} from '../packages/server/src/utils/auth.js';
import assert from 'node:assert/strict';
const operationsContract=async(call:any,identity:any)=>{const receipt=await call('/feedback','POST',{id:'core-functional-smoke-report',kind:'idea',title:'A helpful improvement',body:'Let us keep working together.',context:''},identity.user);assert.equal(receipt.status,201);const inbox=await call('/reports','GET',undefined,identity.admin);assert.equal(inbox.status,200);assert.equal(inbox.body.reports.length,1);console.log('PASS Core feedback receipt and administrator inbox');};
const dir=await mkdtemp(join(tmpdir(),'graphdone-ops-core-'));process.chdir(dir);process.env.NODE_ENV='test';
await sqliteAuthStore.initialize();
const admin=await sqliteAuthStore.findUserByEmailOrUsername('admin');
const users=[];for(const name of ['person','other'])users.push(await sqliteAuthStore.createUser({email:name+'@operations.invalid',username:name,name,password:'local-fixture-only-strong',role:'USER'}));
const identity={admin:generateToken(admin!.id,admin!.email,'ADMIN'),user:generateToken(users[0].id,users[0].email,'USER'),other:generateToken(users[1].id,users[1].email,'USER'),forgedAdmin:generateToken(users[0].id,users[0].email,'ADMIN')};
const app=express();app.use('/api/ops',operationsApi);const server=app.listen(0,'127.0.0.1');await new Promise<void>(ok=>server.once('listening',ok));
const address=server.address() as any;
try{await operationsContract(async(path:string,method='GET',body?:unknown,token?:string)=>{const r=await fetch(`http://127.0.0.1:${address.port}/api/ops`+path,{method,headers:{'Content-Type':'application/json',...token?{Authorization:'Bearer '+token}:{}},...body?{body:JSON.stringify(body)}:{}});return {status:r.status,body:await r.json()};},identity);}finally{server.close();await rm(dir,{recursive:true,force:true});}
process.exit(0);
