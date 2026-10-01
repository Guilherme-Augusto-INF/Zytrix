// Compatibility with the original V1 screens; these functions never load Firebase.
import {createPlatformClient} from './staging-client.js';
import {watchRealtime} from './realtime-client.js';
export const app=null,db=Object.freeze({backend:'neon'}),googleProvider={providerId:'google.com'};
export const auth={currentUser:null};
export class GoogleAuthProvider {}
export const EmailAuthProvider={credential:(email,password)=>({email,password})};
export const firebaseConfig=null;
const listeners=new Set();let configPromise,refreshPromise,generation=0,loaded=false;
const changes=globalThis.BroadcastChannel?new BroadcastChannel('zytrix-neon-session'):null;
const platform=createPlatformClient(()=>auth.currentUser);
async function config(){return configPromise??=fetch('/api/v1/config',{cache:'no-store'}).then(async r=>{const c=await r.json();if(!r.ok||!c.postgresStaging||c.authentication!=='neon'||!c.neonAuthUrl)throw Error('neon_auth_not_configured');return c;});}
export async function authRequest(path,body) {
 const c=await config();const response=await fetch(c.neonAuthUrl+'/'+path,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const value=await response.json();if(!response.ok)throw Object.assign(Error('authentication_failed'),{code:value.code??'authentication_failed',status:response.status});return value;
}
function notify(){for(const cb of listeners)cb(auth.currentUser);}
export async function refreshSession(){
 if(localStorage.getItem('zytrixNeonSignedOut')){auth.currentUser=null;const initial=!loaded;loaded=true;if(initial)notify();return null;}
 if(refreshPromise)return refreshPromise;
 const version=generation;
 refreshPromise=(async()=>{const session=await authRequest('get-session');if(version!==generation)return;
  if(!session?.user||session.user.banned){const changed=!!auth.currentUser||!loaded;auth.currentUser=null;loaded=true;if(changed)notify();return null;}
  const previous=auth.currentUser;
  const subject=session.user.id;
  const candidate={uid:'neon:'+subject,subject,email:session.user.email,emailVerified:session.user.emailVerified===true,
   displayName:session.user.name,photoURL:session.user.image??'',providerData:[],enrollmentRequired:true,
   async getIdToken(){if(auth.currentUser?.subject!==subject)throw Error('authentication_changed');let token;try{token=await authRequest('token');}catch(error){if(error.status===401&&auth.currentUser?.subject===subject){generation++;auth.currentUser=null;notify();}throw error;}if(auth.currentUser?.subject!==subject||!token?.token)throw Error('authentication_required');
    // Client check only prevents mixed account UI; the server independently verifies the signature/claims.
    let claims;try{claims=JSON.parse(atob(token.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw Error('invalid_session_token');}
    if(claims.sub!==subject||claims.exp*1000<=Date.now()){generation++;auth.currentUser=null;notify();throw Error('authentication_changed');}return token.token;},
   async reload(){const current=await refreshSession();if(current?.subject===subject)Object.assign(this,current);}};
  auth.currentUser=candidate;
  const result=await platform('auth.identity');if(version!==generation)return;
  candidate.uid=result.uid??candidate.uid;candidate.enrollmentRequired=result.enrollmentRequired===true;
  candidate.providerData=result.provider?[{providerId:result.provider==='google'?'google.com':'password'}]:[];
  const changed=!loaded||previous?.uid!==candidate.uid||previous?.emailVerified!==candidate.emailVerified;
  loaded=true;if(changed)notify();return candidate;
 })().catch(error=>{if(version===generation){auth.currentUser=null;notify();}throw error;}).finally(()=>{refreshPromise=null;});
 return refreshPromise;
}
export function onAuthStateChanged(_auth,callback){listeners.add(callback);if(loaded)queueMicrotask(()=>{if(listeners.has(callback))callback(auth.currentUser);});else void refreshSession().catch(()=>{});return()=>listeners.delete(callback);}
async function replaceSession(path,data){generation++;await authRequest(path,data);generation++;await refreshPromise?.catch(()=>{});localStorage.removeItem('zytrixNeonSignedOut');await refreshSession();changes?.postMessage('changed');return {user:auth.currentUser};}
export async function signInWithEmailAndPassword(_auth,email,password){return replaceSession('sign-in/email',{email,password});}
export async function createUserWithEmailAndPassword(_auth,email,password){return replaceSession('sign-up/email',{email,password,name:email.split('@')[0]});}
export async function signInWithPopup(){const result=await authRequest('sign-in/social',{provider:'google',callbackURL:new URL('login.html',location.href).href});if(result.url){localStorage.removeItem('zytrixNeonSignedOut');location.assign(result.url);}throw Error('oauth_redirect');}
export async function signOut(){generation++;localStorage.setItem('zytrixNeonSignedOut','true');auth.currentUser=null;loaded=true;notify();changes?.postMessage('changed');await authRequest('sign-out',{});}
export async function sendEmailVerification(user){await authRequest('email-otp/send-verification-otp',{email:user.email,type:'email-verification'});}
export async function sendPasswordResetEmail(_auth,email){await authRequest('request-password-reset',{email,redirectTo:new URL('recuperar-senha.html',location.href).href});}
export async function reauthenticateWithCredential(_user,credential){return signInWithEmailAndPassword(auth,credential.email,credential.password);}
export const reauthenticateWithPopup=signInWithPopup;
export async function deleteUser(){throw Error('account_deletion_not_enabled');}
changes?.addEventListener('message',()=>{generation++;auth.currentUser=null;location.reload();});
globalThis.addEventListener?.('focus',()=>{void refreshSession().catch(()=>{});});

export class Timestamp {
 constructor(value){this.iso=new Date(value).toISOString();this.seconds=Math.floor(new Date(value).getTime()/1000);}
 toDate(){return new Date(this.iso);}toMillis(){return this.toDate().getTime();}
 static fromMillis(value){return new Timestamp(value);}static fromDate(value){return new Timestamp(value);}static now(){return new Timestamp(Date.now());}
}
export const serverTimestamp=()=>null,increment=value=>({increment:value});
function reference(type,base,parts){const path=base===db?parts:[...base.path,...parts];return {type,path,id:path.at(-1),constraints:[]};}
export const collection=(base,...parts)=>reference('collection',base,parts);
export function doc(base,...parts){return reference('document',base,parts.length?parts:[crypto.randomUUID()]);}
export function collectionGroup(){throw Error('collection_group_not_migrated');}
export const where=(field,op,value)=>({type:'where',field,op,value});
export const orderBy=(field,direction='asc')=>({type:'orderBy',field,direction});
export const limit=count=>({type:'limit',count});
export const query=(ref,...constraints)=>({...ref,constraints});
function hydrate(value,key=''){
 if(value===null||value===undefined)return value;
 if(Array.isArray(value))return value.map(x=>hydrate(x));
 if(typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hydrate(v,k)]));
 if(typeof value==='string'&&(/At$/.test(key)||key==='lastSeen')&&/^\d{4}-\d{2}-\d{2}T/.test(value))return new Timestamp(value);
 return value;
}
const comparable=value=>value?.toMillis?.()??value;
function snapshot(ref,documents){
 let values=documents.map(value=>hydrate(value));
 for(const constraint of ref.constraints??[])if(constraint.type==='where')values=values.filter(v=>constraint.op==='=='?v[constraint.field]===constraint.value:constraint.op==='in'?constraint.value.includes(v[constraint.field]):false);
 const sort=(ref.constraints??[]).filter(x=>x.type==='orderBy');if(sort.length)values.sort((a,b)=>{for(const s of sort){const av=comparable(a[s.field]),bv=comparable(b[s.field]);const cmp=av<bv?-1:av>bv?1:0;if(cmp)return s.direction==='desc'?-cmp:cmp;}return String(a.id).localeCompare(String(b.id));});
 const cap=(ref.constraints??[]).find(x=>x.type==='limit')?.count;if(cap)values=values.slice(0,cap);
 const single=value=>({id:value?.id??ref.id,ref:doc(db,...ref.path.slice(0,ref.type==='document'?-1:undefined),value?.id??ref.id),exists:()=>!!value,data:()=>value});
 if(ref.type==='document')return single(values[0]);
 const docs=values.map(single);return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn),docChanges:()=>docs.map(d=>({type:'added',doc:d}))};
}
export async function getDoc(ref){return snapshot(ref,(await platform('documents.read',{path:ref.path,constraints:ref.constraints})).documents);}
export const getDocs=getDoc;
const subscriptions=new Map(),transports=new Map();
function liveTransport(owner,liveId,receive,onError){
 const key=owner+':'+liveId;let transport=transports.get(key);
 if(!transport){transport={clients:new Set()};transports.set(key,transport);
  transport.stop=watchRealtime({getUser:()=>auth.currentUser,liveId,onSnapshot:value=>{transport.last=value;for(const client of transport.clients)client.receive(value);},onError:error=>{for(const client of transport.clients)client.onError(error);}});
 }
 const client={receive,onError};transport.clients.add(client);
 if(transport.last)queueMicrotask(()=>{if(transport.clients.has(client))receive(transport.last);});
 return()=>{transport.clients.delete(client);if(!transport.clients.size){transport.stop();transports.delete(key);}};
}
export function onSnapshot(ref,callback,onError=console.error){
 const owner=auth.currentUser?.subject??null,key=JSON.stringify([owner,ref]);
 let state=subscriptions.get(key);
 if(!state){
  state={clients:new Set(),closed:false,previousIds:new Set()};subscriptions.set(key,state);
  const errors=error=>{if(!state.closed)for(const client of state.clients)client.onError(error);};
  const receive=value=>{
   if(state.closed||(auth.currentUser?.subject??null)!==owner)return;
   const serialized=JSON.stringify(value.docs?value.docs.map(d=>[d.id,d.data()]):[value.id,value.data()]);if(serialized===state.signature)return;state.signature=serialized;
   if(value.docs){const added=value.docs.filter(d=>!state.previousIds.has(d.id));state.previousIds.clear();value.docs.forEach(d=>state.previousIds.add(d.id));value.docChanges=()=>added.map(doc=>({type:'added',doc}));}
   state.last=value;for(const client of state.clients)client.callback(value);
  };
  let stop=()=>{};
  async function poll(){if(state.closed)return;try{receive(await getDoc(ref));}catch(error){errors(error);}finally{if(!state.closed)state.timer=setTimeout(poll,15000);}}
  if(owner&&ref.path[0]==='streams'&&(ref.path.length===2||ref.path[2]==='chat')){
   stop=liveTransport(owner,ref.path[1],data=>receive(snapshot(ref,ref.path[2]==='chat'?data.messages:[data.live])),errors);
  }else queueMicrotask(poll);
  const changed=()=>{if((auth.currentUser?.subject??null)!==owner)state.cancel();};listeners.add(changed);
  state.cancel=()=>{state.closed=true;clearTimeout(state.timer);stop();listeners.delete(changed);subscriptions.delete(key);};
 }
 const client={callback,onError};state.clients.add(client);
 if(state.last)queueMicrotask(()=>{if(state.clients.has(client))callback(state.last);});
 return()=>{state.clients.delete(client);if(!state.clients.size)state.cancel();};
}
const write=(ref,operation,data={})=>platform('documents.write',{path:ref.path,operation,data});
export const setDoc=(ref,data)=>write(ref,'set',data),updateDoc=(ref,data)=>write(ref,'update',data),deleteDoc=ref=>write(ref,'delete');
export function writeBatch(){const operations=[];const batch={};for(const method of ['set','update','delete'])batch[method]=(ref,data={})=>{operations.push({path:ref.path,operation:method,data});return batch;};batch.commit=()=>platform('documents.batch',{operations});return batch;}
export async function runTransaction(){throw Error('server_action_required');}
export async function ensureWallet(uid){if(auth.currentUser?.uid!==uid)throw Error('authentication_required');await platform('wallet.ensure');return doc(db,'wallets',uid);}
export async function getProfile(uid){const s=await getDoc(doc(db,'profiles',uid));return s.exists()?{id:s.id,...s.data()}:null;}
export function normalize(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
export const mainCategory=value=>String(value??'').split(' - ')[0].trim();
export function selectStream(live){localStorage.setItem('zytrixSelectedStream',live.id);localStorage.setItem('zytrixSelectedStreamName',live.username||'Streamer');localStorage.setItem('zytrixSelectedStreamTitle',live.title||'Transmissão');}
