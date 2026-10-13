import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagedClient} from '../scripts/neon-managed-client.mjs';

test('official managed SDK preserves session tokens and auth request contracts',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname.replace('/neondb/auth','');
  calls.push({path,method:options.method,credentials:options.credentials,body:options.body?JSON.parse(options.body):null});
  if(path==='/get-session')return Response.json({user:{id:'fixture-user'},session:{token:'revocable-session-fixture',expiresAt:'2030-01-01T00:00:00Z'}},{headers:{'set-auth-jwt':'header.payload.signature'}});
  return Response.json({status:true});
 };
 try{
  const client=createManagedClient('https://auth.example.test/neondb/auth');
  const session=await client.getSession();assert.equal(session.data.session.token,'revocable-session-fixture');
  await client.signIn.email({email:'fixture@example.test',password:'fixture-password'});
  await client.signUp.email({email:'fixture@example.test',password:'fixture-password',name:'Fixture'});
  await client.signIn.social({provider:'google',callbackURL:'https://app.example.test/',disableRedirect:true});
  await client.requestPasswordReset({email:'fixture@example.test',redirectTo:'https://app.example.test/reset'});
  await client.emailOtp.sendVerificationOtp({email:'fixture@example.test',type:'email-verification'});
  await client.emailOtp.verifyEmail({email:'fixture@example.test',otp:'123456'});
  await client.signOut();
  assert.deepEqual(calls.map(x=>x.path),['/get-session','/sign-in/email','/sign-up/email','/sign-in/social','/request-password-reset','/email-otp/send-verification-otp','/email-otp/verify-email','/sign-out']);
  assert.ok(calls.every(x=>x.credentials==='include'));
  assert.ok(calls.slice(1).every(x=>x.method==='POST'));
  assert.equal(calls[3].body.provider,'google');
 }finally{globalThis.fetch=original;}
});
test('managed SDK reports provider failure without inventing a session',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({code:'SERVICE_UNAVAILABLE',message:'fixture outage'},{status:503});
 try{await assert.rejects(createManagedClient('https://unavailable.example.test/neondb/auth').getSession(),error=>error.status===503);}
 finally{globalThis.fetch=original;}
});
