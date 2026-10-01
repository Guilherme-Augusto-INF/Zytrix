import test from 'node:test';import assert from 'node:assert/strict';import {linkVerifiedIdentity} from '../server/neon/auth-link.mjs';
const now=1900000000000,neon={authProvider:'neon',subject:'new',emailVerified:true,email:'equal@example.invalid'},proof={uid:'legacy',emailVerified:true,authTime:now/1000,email:'equal@example.invalid'};
test('linking requires two verified fresh identities; email equality does not authorize',async()=>{
 const db={query(){assert.fail('Database must not run');}},actor=()=>assert.fail('No actor');
 for(const p of [null,{...proof,emailVerified:false},{...proof,authTime:now/1000-301},{...proof,authTime:now/1000+31}])await assert.rejects(linkVerifiedIdentity(db,neon,p,actor,now),e=>e.code==='fresh_dual_proof_required');
 await assert.rejects(linkVerifiedIdentity(db,{...neon,emailVerified:false},proof,actor,now),e=>e.code==='verified_email_required');
});
test('link preserves internal identity, replays safely and rejects either-direction conflicts',async()=>{
 const existing={id:'internal',firebase_uid:'preserved'},actor=async()=>existing;
 let mappings=[];const db={async query(sql,args){if(sql.includes('from neon_auth'))return {rowCount:1,rows:[{}]};if(sql.includes('select subject'))return {rows:mappings};if(sql.startsWith('insert'))mappings=[{subject:args[0],user_id:args[1]}];return {rows:[],rowCount:1};}};
 assert.equal((await linkVerifiedIdentity(db,neon,proof,actor,now)).uid,'preserved');assert.equal((await linkVerifiedIdentity(db,neon,proof,actor,now)).linked,true);
 for(const map of [{subject:'other',user_id:'internal'},{subject:'new',user_id:'someone-else'}]){mappings=[map];await assert.rejects(linkVerifiedIdentity(db,neon,proof,actor,now),e=>e.code==='identity_conflict');}
});
test('managed account disabled during dual-proof verification cannot link',async()=>{
 const db={async query(){return {rowCount:0,rows:[]};}};
 await assert.rejects(linkVerifiedIdentity(db,neon,proof,async()=>({id:'internal'}),now),e=>e.code==='account_disabled');
});

test('Firebase enrollment proof rejects a revoked or disabled old identity',async()=>{
 const {readFile}=await import('node:fs/promises');const source=(await readFile(new URL('../server/neon/auth.mjs',import.meta.url),'utf8')).replace(/^import .+;\r?\n/gm,'').replaceAll('export async function','async function');
 let revoked=false;const verify=new Function('getApps','initializeApp','getAuth',source+';return verifyFirebaseToken;')(()=>[{name:'zytrix-token-verifier'}],()=>assert.fail('Unexpected app initialization'),()=>({async verifyIdToken(token,checkRevoked){assert.equal(checkRevoked,true);if(revoked)throw Error('auth/id-token-revoked');return {uid:'old-identity',email_verified:true,auth_time:1,exp:2,firebase:{sign_in_provider:'password'}};}}));
 assert.equal((await verify('proof')).uid,'old-identity');revoked=true;assert.equal(await verify('proof'),null);
});
