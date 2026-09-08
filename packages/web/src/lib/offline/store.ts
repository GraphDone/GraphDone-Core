import { Account, emptyAccount } from './model';
let database:Promise<IDBDatabase>|undefined;
function open() {
 return database ||= new Promise((resolve,reject)=>{
  const request=indexedDB.open('graphdone-offline',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('accounts');
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
  request.onerror=()=>{database=undefined;reject(Error('Local storage is unavailable. Your change has not been saved.'));};
  request.onblocked=()=>reject(Error('Close older GraphDone tabs to upgrade local storage.'));
 });
}
export const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('graphdone-offline'):null;
export async function readAccount(owner:string):Promise<Account> {
 const db=await open();return new Promise((resolve,reject)=>{
  const r=db.transaction('accounts').objectStore('accounts').get(owner);r.onsuccess=()=>resolve(r.result||emptyAccount());r.onerror=()=>reject(r.error);
 });
}
/** Read/modify/write in ONE transaction: simultaneous tabs never lose edits.
 * A mutation is acknowledged only after transaction completion, not put success. */
export async function editAccount<T>(owner:string,edit:(a:Account)=>T):Promise<T> {
 const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('accounts','readwrite',{durability:'strict'}),store=tx.objectStore('accounts');let value:T;
  const r=store.get(owner);
  r.onsuccess=()=>{try{const account=r.result||emptyAccount();value=edit(account);store.put(account,owner);}catch(e){tx.abort();reject(e);}};
  tx.oncomplete=()=>{channel?.postMessage(owner);window.dispatchEvent(new CustomEvent('graphdone-local-change',{detail:owner}));resolve(value);};
  tx.onabort=tx.onerror=()=>reject(Error('Local storage could not save this change. Free device space or export your work before closing.'));
 });
}
