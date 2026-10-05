import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagedClient} from '../scripts/neon-managed-client.mjs';
import {neonAuthMessage} from '../assets/js/neon-auth-errors.js';

test('official managed client exchanges OAuth verifier with fresh session and removes it only on success',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,location:globalThis.location,history:globalThis.history,fetch:globalThis.fetch};
 const calls=[],cleaned=[];let valid=false;
 globalThis.window=globalThis;
 globalThis.document={};
 globalThis.location={href:'https://preview.invalid/login.html?linked=google&neon_auth_session_verifier=fixture-only',search:'?linked=google&neon_auth_session_verifier=fixture-only'};
 globalThis.history={state:null,replaceState:(_state,_title,url)=>cleaned.push(url)};
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json(valid?{user:{id:'fixture'},session:{token:'fixture'}}:null);};
 try{
  const client=createManagedClient('https://auth.invalid/auth');
  const request=()=>client.$fetch('/get-session',{method:'GET',credentials:'include',cache:'no-store',headers:{'X-Force-Fetch':'true'}});
  await request();assert.equal(cleaned.length,0);
  valid=true;const result=await request();assert.equal(result.data.user.id,'fixture');
  assert.equal(calls.length,2);for(const call of calls){assert.equal(new URL(call.url).searchParams.get('neon_auth_session_verifier'),'fixture-only');assert.equal(call.options.credentials,'include');}
  assert.equal(cleaned.length,1);assert.equal(new URL(cleaned[0]).search,'?linked=google');
 }finally{Object.assign(globalThis,previous);}
});

test('OAuth state error explains retry without certifying a link or exposing provider data',()=>{
 const message=neonAuthMessage({code:'state_mismatch',message:'private provider diagnostic'},'google');
 assert.match(message,/Sua conta não foi vinculada/);assert.doesNotMatch(message,/private|state_mismatch/);
});
