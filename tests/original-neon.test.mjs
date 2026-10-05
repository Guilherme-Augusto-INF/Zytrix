import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {executePlatform} from '../server/neon/platform.mjs';
import vm from 'node:vm';
const noDb={query(){throw Error('Unexpected access');}};
test('disabled or deleted managed subjects cannot enroll or link using an unexpired token',async()=>{
 const missing={query:async()=>({rows:[],rowCount:0})};
 const identity={authProvider:'neon',subject:'00000000-0000-0000-0000-000000000001',emailVerified:true,email:'fixture@example.invalid'};
 for(const action of ['account.register','auth.identity','auth.link'])
  await assert.rejects(executePlatform(missing,identity,action,{}),e=>e.code==='account_disabled'&&e.status===403);
});
async function authAdapter(fetchImpl,platformImpl=async()=>({uid:'preserved',enrollmentRequired:false})){
 const stored=new Map(),redirects=[];
 const source=(await readFile(new URL('../assets/js/neon-browser.js',import.meta.url),'utf8'))
  .replace(/^import .*;$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:class|function|const))/g,'');
 const context=vm.createContext({console,AbortSignal,URL,atob,queueMicrotask,fetch:fetchImpl,
  localStorage:{getItem:()=>null,removeItem(){},setItem(){}},BroadcastChannel:undefined,location:{href:'https://staging.invalid/login.html',assign:value=>redirects.push(value)},sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
  createPlatformClient:()=>platformImpl,watchRealtime:()=>()=>{}});
 vm.runInContext(source+'\nglobalThis.adapter={auth,refreshSession,signInWithEmailAndPassword,createUserWithEmailAndPassword,authRequest,signOut,sendEmailVerification,sendPasswordResetEmail,linkGoogleAccount,confirmGoogleAccountLink};',context);
 context.adapter.stored=stored;context.adapter.redirects=redirects;
 return context.adapter;
}
const response=value=>({ok:true,json:async()=>value});
const authConfig=response({postgresStaging:true,authentication:'neon',neonAuthUrl:'https://staging.invalid/auth'});
test('parallel API reads share one JWT refresh and reuse the same unexpired session token',async()=>{
 let requests=0;const sub='fixture-subject',token='x.'+btoa(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+900}))+'.x';
 const adapter=await authAdapter(async url=>{if(url==='/api/v1/config')return authConfig;if(url.endsWith('/get-session'))return response({user:{id:sub,emailVerified:true},session:{token:'fixture-session'}});requests++;return response({token});});
 await adapter.refreshSession();const user=adapter.auth.currentUser;
 assert.deepEqual(await Promise.all([user.getIdToken(),user.getIdToken(),user.getIdToken()]),[token,token,token]);assert.equal(requests,1);
 assert.equal(await user.getIdToken(),token);assert.equal(requests,1);
});
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
 vm.runInContext(source+'\nloaded=true;globalThis.adapter={onSnapshot,doc,db};',context);
 const {onSnapshot,doc,db}=context.adapter;const stop=onSnapshot(doc(db,'streams','fixture','polls','stable'),snap=>delivered.push(snap.data().count0));
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(delivered,[0]);assert.equal(timers.size,1);
 value=1;const [id,poll]=timers.entries().next().value;timers.delete(id);await poll();
 assert.deepEqual(delivered,[0,1]);stop();assert.equal(timers.size,0);
});
test('public subscriptions wait for initial session and restart after account replacement',async()=>{
 const source=(await readFile(new URL('../assets/js/neon-browser.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:class|function|const))/g,'');
 let release,calls=0,delivered=0;const timers=new Map();let timerId=0;
 const context=vm.createContext({console,AbortSignal,URL,queueMicrotask,
  fetch:async url=>url==='/api/v1/config'?authConfig:new Promise(resolve=>{release=()=>resolve(response(null));}),
  setTimeout:fn=>{const key=++timerId;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key),
  createPlatformClient:()=>async()=>{calls++;return {documents:[{id:'public',username:'Streamer'}]};},watchRealtime:()=>()=>{},localStorage:{getItem:()=>null},BroadcastChannel:undefined});
 vm.runInContext(source+'\nglobalThis.stop=onSnapshot(doc(db,"profiles","public"),()=>globalThis.delivered());',Object.assign(context,{delivered:()=>delivered++}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(delivered,1);
 vm.runInContext('auth.currentUser={subject:"replacement",uid:"replacement"};notify();',context);await new Promise(resolve=>setImmediate(resolve));assert.equal(delivered,2);assert.equal(timers.size,1);
 context.stop();assert.equal(timers.size,0);
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

test('logout of a deleted or expired session clears the account without a false failure',async()=>{
 const a=await authAdapter(async url=>url==='/api/v1/config'?authConfig:{ok:false,status:401,json:async()=>({})},async()=>{throw Object.assign(Error('expired'),{code:'authentication_required'});});
 a.auth.currentUser={uid:'old'};await a.signOut();assert.equal(a.auth.currentUser,null);
});
test('logout does not hide an actual revocation service outage',async()=>{
 const a=await authAdapter(async url=>url==='/api/v1/config'?authConfig:response({}),async()=>{throw Object.assign(Error('unavailable'),{code:'service_unavailable'});});
 a.auth.currentUser={uid:'old'};await assert.rejects(a.signOut(),/unavailable/);assert.equal(a.auth.currentUser,null);
});


test('verification-required signup returns a pending account without inventing a session or enrolling',async()=>{
 let sessionReads=0,enrollments=0;
 const a=await authAdapter(async url=>{if(url==='/api/v1/config')return authConfig;if(url.endsWith('/sign-up/email'))return response({user:{id:'new',email:'fixture@example.invalid',emailVerified:false},token:null});sessionReads++;return response(null);},async()=>{enrollments++;});
 const result=await a.createUserWithEmailAndPassword(a.auth,'fixture@example.invalid','fixture-only');
 assert.equal(result.user.pendingVerification,true);assert.equal(result.user.email,'fixture@example.invalid');assert.equal(a.auth.currentUser,null);assert.equal(sessionReads,0);assert.equal(enrollments,0);assert.equal(result.user.getIdToken,undefined);
});

test('Google linking requires a fresh verified session and never uses implicit sign-in',async()=>{
 const calls=[];let actual='subject-a',verified=true;
 const a=await authAdapter(async(url,options)=>{if(url==='/api/v1/config')return authConfig;calls.push({url,body:options?.body&&JSON.parse(options.body)});return response(url.endsWith('/get-session')?{user:{id:actual,emailVerified:verified},session:{id:'session-a'}}:{url:'https://accounts.google.com/oauth'});});
 await assert.rejects(a.linkGoogleAccount(),/authentication_changed/);assert.equal(calls.length,0);
 a.auth.currentUser={subject:'subject-a',emailVerified:true};actual='subject-b';
 await assert.rejects(a.linkGoogleAccount(),/authentication_changed/);assert.equal(calls.some(x=>x.url.endsWith('/link-social')),false);
 actual='subject-a';verified=false;await assert.rejects(a.linkGoogleAccount(),/authentication_changed/);
 verified=true;await a.linkGoogleAccount();
 const link=calls.find(x=>x.url.endsWith('/link-social'));assert.equal(link.body.provider,'google');assert.equal(link.body.callbackURL,'https://staging.invalid/login.html?linked=google');assert.equal(link.body.email,undefined);assert.equal(link.body.userId,undefined);
 assert.equal(a.stored.get('zytrixNeonGoogleLinkSubject'),'subject-a');assert.equal(a.redirects.length,1);assert.equal(calls.some(x=>x.url.endsWith('/sign-in/social')),false);
});

test('Google callback marker cannot certify linking without matching session and server account',async()=>{
 let accounts=[];const a=await authAdapter(async url=>url==='/api/v1/config'?authConfig:response(url.endsWith('/get-session')?{user:{id:'subject-a',emailVerified:true},session:{id:'session-a'}}:accounts));
 a.auth.currentUser={subject:'subject-a',emailVerified:true};
 await assert.rejects(a.confirmGoogleAccountLink(),/authentication_changed/);
 a.stored.set('zytrixNeonGoogleLinkSubject','subject-b');await assert.rejects(a.confirmGoogleAccountLink(),/authentication_changed/);
 a.stored.set('zytrixNeonGoogleLinkSubject','subject-a');await assert.rejects(a.confirmGoogleAccountLink(),/google_link_not_confirmed/);
 accounts=[{providerId:'google',userId:'subject-b'}];await assert.rejects(a.confirmGoogleAccountLink(),/google_link_not_confirmed/);
 accounts=[{providerId:'google',userId:'subject-a'}];assert.equal(await a.confirmGoogleAccountLink(),true);assert.equal(a.stored.has('zytrixNeonGoogleLinkSubject'),false);
});

test('account replacement while Google link is starting prevents redirect or local certification',async()=>{
 let release;const a=await authAdapter(async url=>{if(url==='/api/v1/config')return authConfig;if(url.endsWith('/get-session'))return response({user:{id:'subject-a',emailVerified:true},session:{id:'session-a'}});return new Promise(resolve=>{release=()=>resolve(response({url:'https://accounts.google.com/oauth'}));});});
 a.auth.currentUser={subject:'subject-a',emailVerified:true};const pending=a.linkGoogleAccount();await new Promise(resolve=>setImmediate(resolve));a.auth.currentUser={subject:'subject-b',emailVerified:true};release();await assert.rejects(pending,/authentication_changed/);assert.equal(a.redirects.length,0);assert.equal(a.stored.size,0);
});

test('verification uses the configured managed method and neither mail request accepts explicit failure',async()=>{
 const calls=[];let failed=false;
 const a=await authAdapter(async(url,options)=>{if(url==='/api/v1/config')return authConfig;calls.push({url,body:JSON.parse(options.body)});return response(failed?{status:false,message:'private SMTP diagnostic'}:{status:true});});
 await a.sendEmailVerification({email:'fixture@example.invalid'});
 assert.equal(calls[0].url,'https://staging.invalid/auth/send-verification-email');
 assert.equal(calls[0].body.callbackURL,'https://staging.invalid/login.html');
 await a.sendPasswordResetEmail(a.auth,'fixture@example.invalid');
 assert.equal(calls[1].url,'https://staging.invalid/auth/request-password-reset');
 assert.equal(calls[1].body.redirectTo,'https://staging.invalid/recuperar-senha.html');
 failed=true;
 for(const request of [()=>a.sendEmailVerification({email:'fixture@example.invalid'}),()=>a.sendPasswordResetEmail(a.auth,'fixture@example.invalid')])await assert.rejects(request(),e=>e.code==='email_request_rejected'&&!e.message.includes('private'));
});

test('an expired reset callback explains recovery rather than blaming Google',async()=>{
 const {neonAuthMessage,verificationSender}=await import('../assets/js/neon-auth-errors.js');
 const source=(await readFile(new URL('../assets/js/neon-auth-page.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace('export function','function');
 const messages=[];
 const context=vm.createContext({URLSearchParams,location:{search:'?error=INVALID_TOKEN'},sessionStorage:{getItem:()=>null},document:{createElement:()=>({}),querySelector:()=>null},createPlatformClient:()=>()=>{},localRedirect:()=> 'index.html',auth:{},sendEmailVerification(){},sendPasswordResetEmail(){},verificationSender,neonAuthMessage,onAuthStateChanged(){},addEventListener(){},clearInterval});
 vm.runInContext(source+'\nglobalThis.init=initNeonAuthPage;',context);
 context.init({dataset:{mode:'reset'},insertAdjacentElement(){},addEventListener(){}},text=>messages.push(text));
 assert.match(messages[0],/link pode ter expirado/);assert.doesNotMatch(messages[0],/Google/);
});

test('provider failures preserve a safe code and Retry-After but never expose internal messages',async()=>{
 const a=await authAdapter(async url=>url==='/api/v1/config'?authConfig:{ok:false,status:429,headers:{get:()=> '120'},json:async()=>({code:'RATE_LIMIT',message:'private diagnostic'})});
 await assert.rejects(a.authRequest('email-otp/send-verification-otp',{}),e=>e.status===429&&e.retryAfter===120&&!e.message.includes('private'));
});

test('OTP request throttles concurrent clicks, failures and provider Retry-After',async()=>{
 const {verificationSender}=await import('../assets/js/neon-auth-errors.js');let now=0,calls=0,release;
 const sender=verificationSender(()=>{calls++;return calls===1?new Promise(resolve=>release=resolve):Promise.resolve();},()=>now);
 const pending=sender.request({email:'fixture@example.invalid'});await assert.rejects(sender.request({}),e=>e.status===429);assert.equal(calls,1);release();await pending;
 assert.equal(sender.remaining(),60);now=60000;await sender.request({});;assert.equal(calls,2)
});


test('provider rate limit extends resend wait and public messages distinguish auth stages',async()=>{
 const {verificationSender,neonAuthMessage}=await import('../assets/js/neon-auth-errors.js');let now=0;
 const sender=verificationSender(async()=>{throw Object.assign(Error('internal'),{status:429,retryAfter:120});},()=>now);
 await assert.rejects(sender.request({}));assert.equal(sender.remaining(),120);now=119000;await assert.rejects(sender.request({}),e=>e.status===429);
 assert.match(neonAuthMessage({code:'EMAIL_NOT_VERIFIED'}),/Verifique/);
 assert.match(neonAuthMessage({},'send'),/solicitar o código/);
 assert.match(neonAuthMessage({code:'OTP_EXPIRED'},'verify'),/inválido ou expirado/);
 assert.match(neonAuthMessage({},'reset'),/recuperação/);
 assert.match(neonAuthMessage({code:'account_not_linked'},'google'),/método usado no cadastro/);
 assert.doesNotMatch(neonAuthMessage({code:'private-provider-diagnostic'},'google'),/private-provider-diagnostic/);
 assert.doesNotMatch(neonAuthMessage({message:'secret diagnostic'},'register'),/secret/);
});
