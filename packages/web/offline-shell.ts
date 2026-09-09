import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import { createHash } from 'node:crypto';
/** Precache the complete compiled shell, including lazy route chunks. Never
 * cache auth/API responses. A new worker waits for existing tabs to close. */
export function offlineShell() {
 return {name:'graphdone-offline-shell',closeBundle(){
  if(process.env.VITE_OFFLINE_SYNC!=='true')return;
  const root=resolve(__dirname,'dist');
  function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(resolve(dir,f.name)):[resolve(dir,f.name)]);}
  const files=walk(root).filter(f=>/\.(js|css|html|woff2?|png|svg|ico|webp)$/.test(f)&&!f.endsWith('/sw.js'));
  const revision=createHash('sha256');for(const f of files)revision.update(readFileSync(f));
  const key=`graphdone-shell-${revision.digest('hex').slice(0,16)}`;
  // Pages redirects /index.html to /. A redirected cached Response cannot
  // satisfy an offline navigation request with redirect mode 'manual'.
  const urls=files.map(f=>relative(root,f)==='index.html' ? '/' : '/'+relative(root,f));
  writeFileSync(resolve(root,'sw.js'),`
const CACHE=${JSON.stringify(key)},FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('graphdone-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||/^\\/(api|auth|health|config|mcp)(\\/|$)/.test(url.pathname))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{if(!response.ok)throw Error('Unavailable');return response;}).catch(()=>caches.open(CACHE).then(cache=>cache.match('/'))));return;
 }
 if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));
});
`);
 }};
}
