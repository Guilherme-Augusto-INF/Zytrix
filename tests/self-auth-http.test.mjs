import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {memoryAdapter} from 'better-auth/adapters/memory';
import {createCandidateAuth} from '../server/auth/candidate.mjs';
import {createAuthHandler} from '../api/auth/[...path].js';
import {createConfigHandler} from '../api/v1/config.js';
import {createAuthenticator} from '../server/neon/auth.mjs';

test('HTTP adapter: signup, OTP, cookies, JWT, private identity, expiration, logout and rejection boundaries',async()=>{
 const previous={...process.env},db={user:[],account:[],session:[],verification:[],jwks:[]};let otp,origin,auth;
 process.env.ZYTRIX_AUTH_PROVIDER='better-auth';process.env.ZYTRIX_AUTH_ALLOW_LOCALHOST='true';process.env.DATABASE_URL='fixture';delete process.env.VERCEL_ENV;
 const api=createAuthHandler(()=>auth),configuration=createConfigHandler(()=>auth);
 const server=http.createServer(async(req,res)=>{
  res.status=function(code){res.statusCode=code;return res;};res.json=function(body){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};
  if(req.url==='/api/v1/config')return configuration(req,res);
  await api(req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;process.env.ZYTRIX_AUTH_ORIGIN=origin;
 auth=createCandidateAuth({database:memoryAdapter(db),baseURL:origin+'/api/auth',allowLocalhost:true,secret:'http-fixture-only-secret-12345678901234567890',google:{clientId:'fixture',clientSecret:'fixture'},sendResetPassword:async()=>{},sendVerificationOTP:async data=>{otp=data.otp;}});
 const jar=new Map();
 async function request(path,body,headers={}){
  const cookies=[...jar].map(([k,v])=>k+'='+v).join('; ');
  const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(cookies?{Cookie:cookies}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(';')[0],index=pair.indexOf('='),key=pair.slice(0,index);if(/Max-Age=0(?:;|$)/i.test(cookie))jar.delete(key);else jar.set(key,pair.slice(index+1));}
  return {status:r.status,value:await r.json(),headers:r.headers};
 }
 try{
  const config=await request('/api/v1/config');assert.equal(config.value.authentication,'better-auth');assert.equal(config.value.authUrl,origin+'/api/auth');assert.equal(config.headers.get('cache-control'),'no-store');assert.equal(Object.keys(config.value).some(k=>/secret|password/i.test(k)),false);
  for(const password of ['Abc1234','abcdefgh','12345678','a'.repeat(128)+'1'])assert.equal((await request('/api/auth/sign-up/email',{email:'http@example.invalid',name:'HTTP fixture',password})).status,400);
  assert.equal(db.user.length,0);
  assert.equal((await request('/api/auth/sign-up/email',{email:'http@example.invalid',name:'HTTP fixture',password:'Abcd1234'})).status,200);
  assert.equal((await request('/api/auth/sign-in/email',{email:'http@example.invalid',password:'Abcd1234'})).status,403);
  assert.equal((await request('/api/auth/email-otp/send-verification-otp',{email:'http@example.invalid',type:'email-verification'})).status,200);assert.ok(otp);
  assert.equal((await request('/api/auth/email-otp/verify-email',{email:'http@example.invalid',otp})).status,200);
  const login=await request('/api/auth/sign-in/email',{email:'http@example.invalid',password:'Abcd1234'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/i);
  const session=(await request('/api/auth/get-session')).value;assert.equal(session.user.emailVerified,true);
  const token=(await request('/api/auth/token')).value.token;assert.ok(token);
  const authenticate=createAuthenticator({getPool:()=>({query:async(sql,[id,token])=>{
   assert.match(sql,/private\.active_better_auth_session/);
   const row=db.session.find(s=>s.userId===id&&s.token===token&&new Date(s.expiresAt)>new Date());
   return {rows:row?[{created_at:row.createdAt}]:[]};
  }})});
  const req={headers:{authorization:'Bearer '+token,'x-neon-session':session.session.token}};
  const identity=await authenticate(req);assert.equal(identity.subject,session.user.id);assert.equal(identity.authProvider,'better-auth');assert.equal(identity.emailVerified,true);
  assert.equal(await authenticate({headers:{...req.headers,'x-neon-session':'wrong-session-token'}}),null);
  const row=db.session.find(s=>s.token===session.session.token),expires=row.expiresAt;row.expiresAt=new Date(0);assert.equal(await authenticate(req),null);row.expiresAt=expires;
  assert.equal((await request('/api/auth/change-password',{currentPassword:'Abcd1234',newPassword:'abcdefgh'})).status,400);
  const social=await request('/api/auth/sign-in/social',{provider:'google',callbackURL:origin+'/login.html',disableRedirect:true});assert.equal(social.status,200);assert.equal(new URL(social.value.url).hostname,'accounts.google.com');assert.equal(new URL(social.value.url).searchParams.get('redirect_uri'),origin+'/api/auth/callback/google');
  assert.equal((await request('/api/auth/sign-in/email',{email:'http@example.invalid',password:'Abcd1234'},{Origin:'https://untrusted.invalid'})).status,403);
  assert.equal((await request('/api/auth/admin/create-user',{name:'bad'})).status,404);
  assert.equal((await request('/api/auth/sign-in/email',{padding:'x'.repeat(17000)})).status,413);
  const streamed=await new Promise((resolve,reject)=>{const req=http.request(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.write('x'.repeat(8000));req.end('x'.repeat(9000));});assert.equal(streamed,413);
  assert.equal((await request('/api/auth/sign-out',{})).status,200);assert.equal(await authenticate(req),null);
  process.env.VERCEL_ENV='production';delete process.env.ZYTRIX_MANAGED_AUTH_RETIRED;assert.equal((await request('/api/v1/config')).status,503);delete process.env.VERCEL_ENV;
  process.env.ZYTRIX_AUTH_PROVIDER='neon';assert.equal((await request('/api/auth/get-session')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
});
