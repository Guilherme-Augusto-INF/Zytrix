import http from 'node:http';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {hashPassword} from 'better-auth/crypto';
import {createCandidateAuth} from '../server/auth/candidate.mjs';
import {authConnection,postgresAuthDatabase} from '../server/auth/runtime.mjs';
import {createAuthHandler} from '../api/auth/[...path].js';
import {createConfigHandler} from '../api/v1/config.js';
import platformHandler from '../api/v1/platform.js';
import {resolveSafePreviewPath} from './staging-static-path.mjs';
import {renderStaticLayout} from './static-layout.mjs';
process.loadEnvFile('.env.auth-db.local');
if(process.env.VERCEL_ENV==='production')throw Error('production_rehearsal_forbidden');
// Pin both credentials to the isolated branch before any connection or write.
for(const key of ['DATABASE_URL','ZYTRIX_AUTH_DATABASE_URL']){
 if(new URL(process.env[key]).hostname!=='ep-delicate-heart-b6qk9y0q-pooler.c-2.sa-east-1.aws.neon.tech')throw Error('isolated_test_branch_required');
}
process.env.ZYTRIX_AUTH_PROVIDER='better-auth';process.env.ZYTRIX_AUTH_ALLOW_LOCALHOST='true';
const pool=new pg.Pool({connectionString:authConnection(process.env.ZYTRIX_AUTH_DATABASE_URL),ssl:{rejectUnauthorized:true},max:3});
const before=(await pool.query('select id,password from zytrix_auth.account where password is not null order by id')).rows;
const fingerprint=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');const initial=fingerprint(before);
let auth,origin,otp,resetToken;
const authHandler=createAuthHandler(()=>auth),configHandler=createConfigHandler(()=>auth);
const root=process.cwd(),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 res.status=function(code){res.statusCode=code;return res;};res.json=function(body){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};res.setHeader('Cache-Control','no-store');
 const path=new URL(req.url,'http://localhost').pathname;
 try{
  if(path.startsWith('/api/auth/'))return await authHandler(req,res);
  if(path==='/api/v1/config')return configHandler(req,res);
  if(path==='/api/v1/platform') {let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>16384)return res.status(413).json({error:'request_too_large'});parts.push(chunk);}req.body=Buffer.concat(parts).toString('utf8');return await platformHandler(req,res);}
  const file=resolveSafePreviewPath(root,path==='/'?'/index.html':path);
  if(!file||!mime[extname(file)]||!(await stat(file)).isFile())return res.status(404).json({error:'not_found'});
  const text=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]);res.end(extname(file)==='.html'?renderStaticLayout(text.toString(),file.split(/[\\/]/).pop()):text);
 }catch{res.status(503).json({error:'test_service_unavailable'});}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;process.env.ZYTRIX_AUTH_ORIGIN=origin;
auth=createCandidateAuth({database:postgresAuthDatabase(pool),baseURL:origin+'/api/auth',allowLocalhost:true,persistentRateLimit:true,secret:'isolated-local-integration-secret-20261018-not-production',google:{clientId:'integration-fixture',clientSecret:'integration-fixture'},sendVerificationOTP:async data=>{otp=data.otp;},sendResetPassword:async data=>{resetToken=data.token;}});
const jar=new Map(),results=[];
async function request(path,body,headers={}){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...headers},...(body?{body:JSON.stringify(body)}:{})});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('='),key=pair.slice(0,i);if(/Max-Age=0(?:;|$)/i.test(c))jar.delete(key);else jar.set(key,pair.slice(i+1));}return {status:r.status,value:await r.json()};}
const tag=randomUUID().slice(0,12),email='self-auth-'+tag+'@example.invalid',legacyEmail='legacy-'+tag+'@example.invalid',legacyId=randomUUID();
function pass(name){results.push(name);console.log('PASS: '+name);}
try{
 const legacyHash=await hashPassword('old');
 const fixtureClient=await pool.connect();try{await fixtureClient.query('begin');await fixtureClient.query('insert into zytrix_auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,$2,$3,true,now(),now())',[legacyId,'Legacy test fixture',legacyEmail]);
 await fixtureClient.query('insert into zytrix_auth.account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values($1,$2::text,\'credential\',$2::uuid,$3,now(),now())',[randomUUID(),legacyId,legacyHash]);await fixtureClient.query('commit');}catch(error){await fixtureClient.query('rollback');throw error;}finally{fixtureClient.release();}
 assert.equal((await request('/api/auth/sign-in/email',{email:legacyEmail,password:'old'})).status,200);
 assert.equal((await pool.query('select password from zytrix_auth.account where "userId"=$1',[legacyId])).rows[0].password,legacyHash);pass('legacy fixture login preserves UUID and hash');
 await request('/api/auth/sign-out',{});jar.clear();
 for(const password of ['Abc1234','abcdefgh','12345678','a'.repeat(128)+'1'])assert.equal((await request('/api/auth/sign-up/email',{name:'Integration fixture',email,password})).status,400);
 assert.equal((await request('/api/auth/sign-up/email',{name:'Integration fixture',email,password:'Abcd1234'})).status,200);pass('direct signup enforces 8/128 and composition in PostgreSQL');
 assert.equal((await request('/api/auth/email-otp/send-verification-otp',{email,type:'email-verification'})).status,200);assert.ok(otp);
 assert.equal((await request('/api/auth/email-otp/verify-email',{email,otp})).status,200);pass('OTP handler verifies fixture ownership; delivery is mocked');
 assert.equal((await request('/api/auth/sign-in/email',{email,password:'Abcd1234'})).status,200);
 const session=(await request('/api/auth/get-session')).value;const token=(await request('/api/auth/token')).value.token;assert.ok(token);
 const credentials={Authorization:'Bearer '+token,'X-Neon-Session':session.session.token};
 async function platform(action,data={},headers=credentials){return request('/api/v1/platform',{action,data},headers);}
 const identity=await platform('auth.identity');assert.equal(identity.status,200,JSON.stringify(identity));assert.equal(identity.value.uid,session.user.id);pass('JWT and live session authenticate actual platform API');
 const policies=(await platform('policies.current',{},{})).value.config;
 assert.equal((await platform('account.register',{username:'test_'+tag,acceptPolicies:true,termsVersion:policies.termsVersion,privacyVersion:policies.privacyVersion,rulesVersion:policies.rulesVersion})).status,200);pass('registration completes with the same identity and current policies');
 const wallet=await platform('wallet.get');assert.equal(wallet.status,200);assert.equal(Number(wallet.value.wallet?.balance??wallet.value.balance),0);pass('new identity has its own zero-balance wallet');
 assert.equal((await platform('wallet.get',{},{})).status,401);
 assert.equal((await platform('wallet.get',{}, {...credentials,'X-Neon-Session':'wrong-session-token'})).status,401);pass('anonymous and forged sessions cannot access private APIs');
 let current='Abcd1234';for(const next of ['Abcde1234','Abcdef1234','a'.repeat(127)+'1']){assert.equal((await request('/api/auth/change-password',{currentPassword:current,newPassword:next})).status,200);current=next;}
 for(const next of ['Abc1234','abcdefgh','12345678','a'.repeat(128)+'1'])assert.equal((await request('/api/auth/change-password',{currentPassword:current,newPassword:next})).status,400);pass('change password matrix reaches actual PostgreSQL handler');
 assert.equal((await request('/api/auth/request-password-reset',{email,redirectTo:origin+'/recuperar-senha.html'})).status,200);assert.ok(resetToken);
 for(const next of ['Abc1234','abcdefgh','12345678','a'.repeat(128)+'1'])assert.equal((await request('/api/auth/reset-password',{token:resetToken,newPassword:next})).status,400);
 assert.equal((await request('/api/auth/reset-password',{token:resetToken,newPassword:'Abcd1234'})).status,200);
 assert.equal((await request('/api/auth/sign-in/email',{email,password:'Abcd1234'})).status,200);pass('reset preserves the user ID and new credentials sign in');
 const finalSession=(await request('/api/auth/get-session')).value,finalToken=(await request('/api/auth/token')).value.token;
 const finalCredentials={Authorization:'Bearer '+finalToken,'X-Neon-Session':finalSession.session.token};
 assert.equal((await platform('auth.logout',{},finalCredentials)).status,200);
 assert.equal((await platform('wallet.get',{},finalCredentials)).status,401);pass('platform logout revokes the actual Auth session');
 const originalRows=(await pool.query('select id,password from zytrix_auth.account where id=any($1::uuid[]) order by id',[before.map(x=>x.id)])).rows;
 assert.equal(fingerprint(originalRows),initial);pass('all preexisting password hashes remain unchanged');
 await writeFile('.env.browser-fixture.local',JSON.stringify({origin,email,password:'Abcd1234',legacyEmail,legacyPassword:'old',pid:process.pid,results},null,2));
 console.log('BROWSER_READY '+origin+' pid='+process.pid);
 if(!process.argv.includes('--serve')){await new Promise(resolve=>server.close(resolve));await pool.end();}
}catch(error){console.error('INTEGRATION_FAILED',error.message);await new Promise(resolve=>server.close(resolve));await pool.end();process.exitCode=1;}
