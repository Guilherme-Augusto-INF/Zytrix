import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {executePlatform} from '../server/neon/platform.mjs';
import vm from 'node:vm';
const noDb={query(){throw Error('Unexpected access');}};
async function authAdapter(fetchImpl){
 const source=(await readFile(new URL('../assets/js/neon-browser.js',import.meta.url),'utf8'))
  .replace(/^import .*;$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:class|function|const))/g,'');
 const context=vm.createContext({console,AbortSignal,URL,atob,queueMicrotask,fetch:fetchImpl,
  localStorage:{getItem:()=>null,removeItem(){}},BroadcastChannel:undefined,
  createPlatformClient:()=>async()=>({uid:'preserved',enrollmentRequired:false}),watchRealtime:()=>()=>{}});
 vm.runInContext(source+'\nglobalThis.adapter={auth,refreshSession,signInWithEmailAndPassword};',context);
 return context.adapter;
}
const response=value=>({ok:true,json:async()=>value});
const authConfig=response({postgresStaging:true,authentication:'neon',neonAuthUrl:'https://staging.invalid/auth'});
test('changed managed-session subject clears the old account before sending a token',async()=>{
 const adapter=await authAdapter(async url=>url==='/api/v1/config'?authConfig:response(url.endsWith('/get-session')?{user:{id:'previous',emailVerified:true}}:{token:'x.'+btoa(JSON.stringify({sub:'other',exp:Math.floor(Date.now()/1000)+100}))+'.x'}));
 await adapter.refreshSession();const user=adapter.auth.currentUser;
 await assert.rejects(user.getIdToken(),/authentication_changed/);assert.equal(adapter.auth.currentUser,null);
});
test('successful sign-in replaces a still-pending previous session refresh',async()=>{
 let release,reads=0;
 const adapter=await authAdapter(async url=>{
  if(url==='/api/v1/config')return authConfig;
  if(url.endsWith('/sign-in/email'))return response({});
  if(++reads===1)return new Promise(resolve=>{release=()=>resolve(response({user:{id:'previous',emailVerified:true}}));});
  return response({user:{id:'new',emailVerified:true}});
 });
 const initial=adapter.refreshSession();await new Promise(resolve=>setImmediate(resolve));
 const login=adapter.signInWithEmailAndPassword(adapter.auth,'fixture@example.invalid','fixture-only');
 await new Promise(resolve=>setImmediate(resolve));release();await initial;
 assert.equal((await login).user.subject,'new');assert.equal(adapter.auth.currentUser.uid,'preserved');
});
test('remaining private module actions reject anonymous identities before querying',async()=>{
 for(const action of ['auth.identity','auth.link','progress.get','progress.record','attribution.set','poll.vote','promotion.claim','reward.redeem','reports.submit','reports.close','admin.chat-summary'])
  await assert.rejects(executePlatform(noDb,null,action,{}),e=>e.status===401);
});
test('original snapshots deliver changed fields with stable IDs and cancel their polling timer',async()=>{
 let value=0;const timers=new Map();let timerId=0;const delivered=[];
 const source=(await readFile(new URL('../assets/js/neon-browser.js',import.meta.url),'utf8'))
   .replace(/^import .*;$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:class|function|const))/g,'');
 const context=vm.createContext({console,AbortSignal,URL,crypto:{randomUUID:()=> 'fixture'},
  queueMicrotask,setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  createPlatformClient:()=>async()=>({documents:[{id:'stable',count0:value}]}),watchRealtime:()=>()=>{},
  localStorage:{getItem:()=>null},BroadcastChannel:undefined});
 vm.runInContext(source+'\nglobalThis.adapter={onSnapshot,doc,db};',context);
 const {onSnapshot,doc,db}=context.adapter;const stop=onSnapshot(doc(db,'streams','fixture','polls','stable'),snap=>delivered.push(snap.data().count0));
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(delivered,[0]);assert.equal(timers.size,1);
 value=1;const [id,poll]=timers.entries().next().value;timers.delete(id);await poll();
 assert.deepEqual(delivered,[0,1]);stop();assert.equal(timers.size,0);
});
test('original document adapter does not allow arbitrary private paths or client supplied identity',async()=>{
 await assert.rejects(executePlatform(noDb,null,'documents.read',{path:['wallets','victim']}),e=>e.status===403);
 await assert.rejects(executePlatform(noDb,null,'documents.read',{path:['private','external_auth_identities']}),e=>e.code==='module_not_migrated');
 await assert.rejects(executePlatform(noDb,null,'documents.read',{path:['users','victim']}),e=>e.status===403);
 await assert.rejects(executePlatform(noDb,null,'documents.read',{path:['../secrets']}),e=>e.code==='invalid_path');
 await assert.rejects(executePlatform(noDb,null,'documents.write',{path:['profiles','victim'],operation:'set',data:{uid:'admin'}}),e=>e.status===401);
});
test('Firebase SDK is lazy loaded only outside staging and Neon uses explicit server money actions',async()=>{
 const bridge=await readFile(new URL('../assets/js/firebase.js',import.meta.url),'utf8');
 assert.doesNotMatch(bridge,/gstatic|initializeApp|getFirestore/);assert.match(bridge,/source\.staging\(\)\)\?'\.\/neon-browser\.js':'\.\/firebase-legacy\.js'/);
 const neon=await readFile(new URL('../assets/js/neon-browser.js',import.meta.url),'utf8');
 assert.doesNotMatch(neon,/firebasejs|firestore/);assert.match(neon,/runTransaction\(\).*server_action_required/);
 const checkout=await readFile(new URL('../assets/js/pagamento.js',import.meta.url),'utf8');assert.match(checkout,/\/api\/v1\/checkout/);assert.match(checkout,/packageId:pack\.id,requestKey/);
});
