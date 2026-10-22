import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryAdapter} from 'better-auth/adapters/memory';
import {hashPassword} from 'better-auth/crypto';
import {createCandidateAuth} from '../server/auth/candidate.mjs';

const origin='https://auth-rehearsal.example.invalid';
const cases=[
  ['7','Abc1234',false],['8','Abcd1234',true],['9','Abcde1234',true],
  ['10','Abcdef1234',true],['letters','abcdefgh',false],['digits','12345678',false],
  ['symbols','!!!!!!!!',false],['128','a'.repeat(127)+'1',true],['129','a'.repeat(128)+'1',false]
];

async function fixture() {
  const id=randomUUID(),date=new Date(),passwordHash=await hashPassword('old');
  const db={user:[{id,name:'Existing fixture',email:'legacy@example.invalid',emailVerified:true,createdAt:date,updatedAt:date}],
    account:[{id:randomUUID(),accountId:id,userId:id,providerId:'credential',password:passwordHash,createdAt:date,updatedAt:date},
      {id:randomUUID(),accountId:'google-fixture',userId:id,providerId:'google',createdAt:date,updatedAt:date}],
    session:[],verification:[]};
  let resetToken,otp;
  const auth=createCandidateAuth({baseURL:origin,secret:'local-test-only-secret-not-for-deployment-123456789',database:memoryAdapter(db),
    google:{clientId:'local-fixture-only',clientSecret:'local-fixture-only'},
    sendResetPassword:async data=>{resetToken=data.token;},sendVerificationOTP:async data=>{otp=data.otp;}});
  async function request(path,body,cookie='') {
    const r=await auth.handler(new Request(origin+'/api/auth/'+path,{method:'POST',headers:{'content-type':'application/json',origin,...(cookie?{cookie}:{})},body:JSON.stringify(body)}));
    return {status:r.status,value:await r.json(),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};
  }
  return {id,db,passwordHash,request,resetToken:()=>resetToken,otp:()=>otp};
}

test('self-hosted signup rejects invalid passwords before creating users',async()=>{
  const f=await fixture();
  for(const [label,password,valid] of cases) {
    const before=f.db.user.length;
    const result=await f.request('sign-up/email',{name:'Fixture',email:`signup-${label}@example.invalid`,password});
    assert.equal(result.status,valid?200:400,label);
    assert.equal(f.db.user.length,before+(valid?1:0));
    if(!valid)assert.equal(result.value.code,'INVALID_PASSWORD_POLICY');
  }
});

test('imported IDs, password hashes and Google links survive startup and legacy sign-in',async()=>{
  const f=await fixture(),users=structuredClone(f.db.user),accounts=structuredClone(f.db.account);
  const result=await f.request('sign-in/email',{email:'legacy@example.invalid',password:'old'});
  assert.equal(result.status,200);assert.equal(result.value.user.id,f.id);
  assert.deepEqual(f.db.user,users);assert.deepEqual(f.db.account,accounts);
  assert.equal(f.db.account.find(x=>x.providerId==='credential').password,f.passwordHash);
});

test('self-hosted change-password enforces the matrix without changing invalid credentials or links',async()=>{
  const f=await fixture(),google=structuredClone(f.db.account.find(x=>x.providerId==='google'));
  let password='old',login=await f.request('sign-in/email',{email:'legacy@example.invalid',password});
  for(const [label,newPassword,valid] of cases) {
    const before=f.db.account.find(x=>x.providerId==='credential').password;
    const result=await f.request('change-password',{currentPassword:password,newPassword},login.cookie);
    assert.equal(result.status,valid?200:400,label);
    if(valid)password=newPassword;
    else assert.equal(f.db.account.find(x=>x.providerId==='credential').password,before);
    login=await f.request('sign-in/email',{email:'legacy@example.invalid',password});
    assert.equal(login.status,200);assert.equal(login.value.user.id,f.id);
    assert.deepEqual(f.db.account.find(x=>x.providerId==='google'),google);
  }
});

test('self-hosted token reset enforces the matrix and verifies login with the resulting password',async()=>{
  const f=await fixture();let password='old';
  for(const [label,newPassword,valid] of cases) {
    assert.equal((await f.request('request-password-reset',{email:'legacy@example.invalid',redirectTo:origin+'/recuperar-senha.html'})).status,200);
    assert.ok(f.resetToken());const before=f.db.account.find(x=>x.providerId==='credential').password;
    const result=await f.request('reset-password',{token:f.resetToken(),newPassword});
    assert.equal(result.status,valid?200:400,label);
    if(valid)password=newPassword;
    else assert.equal(f.db.account.find(x=>x.providerId==='credential').password,before);
    const login=await f.request('sign-in/email',{email:'legacy@example.invalid',password});
    assert.equal(login.status,200);assert.equal(login.value.user.id,f.id);
  }
});

test('OTP password reset cannot bypass the server composition hook',async()=>{
  const f=await fixture();
  assert.equal((await f.request('email-otp/request-password-reset',{email:'legacy@example.invalid'})).status,200);
  assert.ok(f.otp());
  for(const password of ['abcdefgh','12345678','Abc1234']) {
    const result=await f.request('email-otp/reset-password',{email:'legacy@example.invalid',otp:f.otp(),password});
    assert.equal(result.status,400);assert.equal(result.value.code,'INVALID_PASSWORD_POLICY');
    assert.equal(f.db.account.find(x=>x.providerId==='credential').password,f.passwordHash);
  }
  assert.equal((await f.request('email-otp/reset-password',{email:'legacy@example.invalid',otp:f.otp(),password:'Abcd1234'})).status,200);
  assert.equal((await f.request('sign-in/email',{email:'legacy@example.invalid',password:'Abcd1234'})).status,200);
});

test('administrative credential writes cannot bypass composition while passwordless creation remains possible',async()=>{
  const f=await fixture();f.db.user[0].role='admin';
  const login=await f.request('sign-in/email',{email:'legacy@example.invalid',password:'old'});
  assert.equal(login.status,200);
  for(const password of ['abcdefgh','12345678','Abc1234']) {
    const created=await f.request('admin/create-user',{name:'Fixture',email:'admin-created@example.invalid',password},login.cookie);
    assert.equal(created.status,400);assert.equal(created.value.code,'INVALID_PASSWORD_POLICY');
    const changed=await f.request('admin/set-user-password',{userId:f.id,newPassword:password},login.cookie);
    assert.equal(changed.status,400);assert.equal(changed.value.code,'INVALID_PASSWORD_POLICY');
    assert.equal(f.db.account.find(x=>x.providerId==='credential').password,f.passwordHash);
  }
  assert.equal((await f.request('admin/create-user',{name:'Passwordless fixture',email:'passwordless@example.invalid'},login.cookie)).status,200);
  assert.equal((await f.request('admin/set-user-password',{userId:f.id,newPassword:'Abcd1234'},login.cookie)).status,200);
  assert.equal((await f.request('sign-in/email',{email:'legacy@example.invalid',password:'Abcd1234'})).status,200);
});
