import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createNeonVerifier,AUTH_URL} from '../server/neon/neon-token.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const origin=new URL(AUTH_URL).origin,now=1900000000;
const jwk={...publicKey.export({format:'jwk'}),kid:'fixture'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=(patch={},header={})=>{const value=encode({alg:'EdDSA',kid:'fixture',...header})+'.'+encode({iss:origin,aud:origin,sub:'00000000-0000-4000-8000-000000000001',iat:now,exp:now+900,email:'test@example.invalid',emailVerified:true,...patch});return value+'.'+sign(null,Buffer.from(value),privateKey).toString('base64url');};
test('Neon requires valid signature, exact issuer/audience and a bounded unexpired token',async()=>{
 let requests=0;const verify=createNeonVerifier({now:()=>now*1000,fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({keys:[jwk]})};}});
 const identity=await verify(token());assert.equal(identity.authProvider,'neon');assert.equal(identity.emailVerified,true);
 for(const patch of [{iss:'https://evil.invalid'},{aud:'other'},{exp:now},{iat:now+60},{exp:now+2000},{banned:true},{nbf:now+1},{sub:''}])assert.equal(await verify(token(patch)),null);
 for(const header of [{alg:'none'},{alg:'HS256'},{crit:['custom']},{kid:'unknown'}])assert.equal(await verify(token({},header)),null);
 const good=token().split('.');good[1]=encode({sub:'attacker',iss:origin,aud:origin,iat:now,exp:now+900});assert.equal(await verify(good.join('.')),null);
 assert.equal(requests,1,'validating the same issuer reuses JWKS and unknown IDs cannot cause request storms');
});
test('unavailable JWKS and malformed tokens fail closed',async()=>{
 const verify=createNeonVerifier({now:()=>now*1000,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(await verify(token()),null);assert.equal(await verify('invalid'),null);assert.equal(await verify('x'.repeat(16001)),null);
});
