import express,{Router} from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {OperationsService,OPS_SCHEMA,OpsDatabase} from '@graphdone/core/dist/operations.js';
import {extractUserFromToken} from './middleware/auth.js';
import {sqliteAuthStore} from './auth/sqlite-auth.js';
export class SQLiteOperationsDatabase implements OpsDatabase {
 private db:sqlite3.Database;
 readonly ready:Promise<void>;
 constructor(filename=join(process.cwd(),'data','operations.db')) {
  if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
  this.db=new sqlite3.Database(filename);
  this.ready=(async()=>{for(const sql of OPS_SCHEMA)await this.run(sql);if(filename!==':memory:')chmodSync(filename,0o600);})();
 }
 all(sql:string,args:unknown[]=[]):Promise<any[]>{return new Promise((resolve,reject)=>this.db.all(sql,args,(e,rows)=>e?reject(e):resolve(rows)));}
 run(sql:string,args:unknown[]=[]):Promise<{changes:number}>{return new Promise((resolve,reject)=>this.db.run(sql,args,function(e){e?reject(e):resolve({changes:this.changes});}));}
 close():Promise<void>{return new Promise((resolve,reject)=>this.db.close(e=>e?reject(e):resolve()));}
}
let database:SQLiteOperationsDatabase|undefined;
const hash=async(s:string)=>createHash('sha256').update(s).digest('hex');
export const operationsApi=Router();
operationsApi.use(cors(),express.json({limit:'32kb'}),rateLimit({windowMs:60000,limit:60}));
operationsApi.all('*',async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try {
  database||=new SQLiteOperationsDatabase();await database.ready;
  const user=async(id:string)=>{const u=await sqliteAuthStore.findUserById(id);return u?.isActive?{id:u.id,role:u.role,name:u.name}:null;};
  const bearer=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]||'';
  let identity= !bearer?{id:'public:'+await hash(req.ip||'unknown'),role:'GUEST'}:null;
  if(bearer&&!bearer.startsWith('gd_ops_')){const claims=extractUserFromToken(req.headers.authorization);if(claims)identity=claims.role==='GUEST'?{id:'public:'+await hash(req.ip||'unknown'),role:'GUEST'}:await user(claims.userId);}
  const service=new OperationsService({db:database,hash,random:randomUUID,user,usage:async()=>({hosted:false,message:'Self-hosted storage has no GraphDone service quota. Monitor your own disk and server resources.'}),userCount:()=>sqliteAuthStore.getUserCount()});
  const q=Object.fromEntries(Object.entries(req.query).filter(([,v])=>typeof v==='string')) as Record<string,string>;
  const result=await service.handle(req.method,req.path,q,req.body,identity,bearer);
  return res.status(result.status).json(result.body);
 }catch{return res.status(503).json({error:'Feedback service is temporarily unavailable. Your draft is retained.'});}
});
