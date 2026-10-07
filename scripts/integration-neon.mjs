import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {AUTH_URL} from '../server/neon/neon-token.mjs';
const url=(await readFile(process.env.NEON_TEST_ADMIN_FILE,'utf8')).trim();
const parsed=new URL(url); parsed.search='';
const admin=new pg.Client({connectionString:parsed.href,ssl:{rejectUnauthorized:true}});await admin.connect();
const origin='http://127.0.0.1:5502',base=process.env.NEON_TEST_APP_URL||origin;
let previewCookie='';
if(process.env.NEON_TEST_ACCESS_URL_FILE){let current=(await readFile(process.env.NEON_TEST_ACCESS_URL_FILE,'utf8')).trim();const jar=new Map();for(let i=0;i<4;i++){if(new URL(current).origin!==base)throw Error('unexpected_preview_access_origin');const r=await fetch(current,{redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}});for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');jar.set(k,v.join('='));}if(r.status<300||r.status>=400)break;current=new URL(r.headers.get('location'),current).href;}previewCookie=[...jar].map(([k,v])=>k+'='+v).join('; ');}
const fixture='fixture-'+randomUUID(),password='Test-'+randomUUID()+'9',email=fixture+'@example.invalid';
let uid; const cookies=new Map();let jwt,session;
async function auth(path,body){const r=await fetch(AUTH_URL+'/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},...(body?{body:JSON.stringify(body)}:{})});for(const c of r.headers.getSetCookie()){const [k,...v]=c.split(';')[0].split('=');cookies.set(k,v.join('='));}return {status:r.status,value:await r.json()};}
async function api(action,data={},credential=true){const r=await fetch(base+'/api/v1/platform',{method:'POST',headers:{'Content-Type':'application/json',...(previewCookie?{Cookie:previewCookie}:{}),...(credential?{Authorization:'Bearer '+jwt,'X-Neon-Session':session}:{})},body:JSON.stringify({action,data})});return {status:r.status,value:await r.json()};}
try{
 const signup=await auth('sign-up/email',{email,password,name:'Disposable test'});assert.equal(signup.status,200,JSON.stringify(signup.value));uid=signup.value.user.id;
 const counts=(await admin.query('select (select count(*) from public.profiles where user_id=$1) profiles,(select count(*) from public.wallets where user_id=$1) wallets',[uid])).rows[0];assert.equal(Number(counts.profiles),1);assert.equal(Number(counts.wallets),1);console.log('PASS: signup provisions profile and wallet using Auth UUID');
 await auth('sign-up/email',{email,password,name:'Duplicate'});assert.equal(Number((await admin.query('select count(*) from neon_auth."user" where email=$1',[email])).rows[0].count),1);console.log('PASS: duplicate signup creates no second user');
 // Fixture verification simulates successful email ownership; delivery is a separate smoke check.
 await admin.query('update neon_auth."user" set "emailVerified"=true where id=$1',[uid]);
 assert.equal((await auth('sign-in/email',{email,password})).status,200);
 const get=await auth('get-session');assert.equal(get.value.user.id,uid);session=get.value.session.token;jwt=(await auth('token')).value.token;
 const identity=await api('auth.identity');assert.equal(identity.status,200,JSON.stringify(identity));assert.equal(identity.value.enrollmentRequired,true);console.log('PASS: real login, session, JWT and registration state');
 const policy=(await api('policies.current',{},false)).value.config;
 const registration={username:fixture.slice(0,29),acceptPolicies:true,termsVersion:policy.termsVersion,privacyVersion:policy.privacyVersion,rulesVersion:policy.rulesVersion};
 const repeated=await Promise.all([api('account.register',registration),api('account.register',registration)]);assert.ok(repeated.every(r=>r.status===200),JSON.stringify(repeated));assert.equal((await api('auth.identity')).value.enrollmentRequired,false);console.log('PASS: concurrent registration is idempotent');
 assert.equal((await api('profile.update',{username:registration.username,bio:'Integration test',name:'Nome público'})).status,200);
 assert.equal((await api('profile.get',{uid},false)).value.profile.name,'Nome público');
 assert.equal((await api('documents.write',{path:['profiles',uid],operation:'update',data:{photoURL:'https://lh3.googleusercontent.com/a/default-user',bio:'Integration test',name:'Nome atualizado'}})).status,200);
 assert.equal((await api('profile.get',{uid},false)).value.profile.bio,'Integration test');
 assert.equal((await api('profile.update',{username:'other-'+fixture.slice(-15),bio:''})).status,409);
 assert.equal((await api('profile.update',{username:registration.username,bio:''},false)).status,401);
 assert.equal((await api('documents.write',{path:['profiles',randomUUID()],operation:'update',data:{bio:'BOLA'}})).status,403);
 assert.equal((await api('documents.write',{path:['wallets',uid],operation:'update',data:{balance:999999}})).status,403);
 assert.equal((await api('wallet.get',{},false)).status,401);
 assert.equal((await api('profile.update',{username:registration.username,bio:'x'.repeat(501)})).status,400);console.log('PASS: public profile, own update, cooldown, anonymous/private denial, BOLA, balance spoof and invalid payload');
 await admin.query('begin');
 try{
  await admin.query('update public.wallets set balance=balance+100 where user_id=$1',[uid]);
  const transaction=(await admin.query("insert into public.zy_coin_transactions(to_user_id,amount,type,idempotency_key)values($1,100,'admin_adjustment',$2)returning id",[uid,fixture])).rows[0].id;
  await admin.query('set constraints all immediate');
  assert.equal(Number((await admin.query('select balance from public.wallet_balances where user_id=$1',[uid])).rows[0].balance),100);
  await admin.query('savepoint immutable_test');
  await assert.rejects(admin.query('update public.zy_coin_transactions set amount=999 where id=$1',[transaction]),/ledger_is_immutable/);await admin.query('rollback to savepoint immutable_test');
  await admin.query('savepoint balance_test');await assert.rejects(admin.query('update public.wallets set balance=999 where user_id=$1',[uid]),/wallet_ledger_mismatch/);await admin.query('rollback to savepoint balance_test');
  console.log('PASS: ledger-derived balance, immutable entries and database rejects unbacked balance edits');
 }finally{await admin.query('rollback');}
 const validSession=session;session=randomUUID();assert.equal((await api('me')).status,401);session=validSession;
 await admin.query('update neon_auth.session set "expiresAt"=now()-interval \'1 second\' where token=$1',[session]);assert.equal((await api('me')).status,401);
 await admin.query('update neon_auth.session set "expiresAt"=now()+interval \'1 day\' where token=$1',[session]);
 const logout=await api('auth.logout');assert.equal(logout.status,200);assert.equal((await api('me')).status,401);console.log('PASS: mismatched/expired sessions and logout immediately revoke old JWT/session');
 console.log('Email verification in this test was simulated; delivery and OAuth are tested separately.');
}finally{
 if(uid){await admin.query('delete from public.policy_acceptances where user_id=$1',[uid]);await admin.query('delete from public.wallets where user_id=$1',[uid]);await admin.query('delete from public.identities where id=$1',[uid]);await admin.query('delete from neon_auth."user" where id=$1',[uid]);}
 await admin.end();
}
