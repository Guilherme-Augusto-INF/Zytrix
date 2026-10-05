import {createPublicKey, verify} from 'node:crypto';

export const STAGING_AUTH_URL = 'https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth';
// Pin the already provisioned staging service; never use an issuer from the token.
export function authBase() {
  const value = process.env.ZYTRIX_NEON_AUTH_URL;
  if (!value || value !== STAGING_AUTH_URL || process.env.VERCEL_ENV === 'production') return null;
  return value;
}
export function createNeonVerifier({baseUrl=STAGING_AUTH_URL, fetchImpl=fetch, now=()=>Date.now()}={}) {
  let keys, expires=0, pending, lastRefresh=0;
  async function refresh() {
    if (pending) return pending;
    pending=(async()=>{
      const response=await fetchImpl(`${baseUrl}/.well-known/jwks.json`,{signal:AbortSignal.timeout(5000),redirect:'error'});
      if (!response.ok) throw Error('jwks_unavailable');
      const data=await response.json();
      if (!Array.isArray(data.keys) || data.keys.length>20) throw Error('invalid_jwks');
      keys=data.keys; expires=now()+300000;lastRefresh=now();
    })();
    try {await pending;} finally {pending=null;}
  }
  return async token=>{
    try {
      if(typeof token!=='string'||token.length>16000)return null;
      const parts=token.split('.');if(parts.length!==3)return null;
      const header=JSON.parse(Buffer.from(parts[0],'base64url'));
      const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
      if(header.alg!=='EdDSA'||typeof header.kid!=='string'||header.kid.length>128||header.crit)return null;
      const time=Math.floor(now()/1000),origin=new URL(baseUrl).origin;
      if(claims.iss!==origin||!(claims.aud===origin||(Array.isArray(claims.aud)&&claims.aud.includes(origin))))return null;
      if(!Number.isInteger(claims.exp)||claims.exp<=time||!Number.isInteger(claims.iat)||claims.iat<0||claims.exp<=claims.iat||claims.iat>time+30||claims.exp-claims.iat>930)return null;
      if(claims.nbf!=null&&(!Number.isFinite(claims.nbf)||claims.nbf>time))return null;
      if(typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128)return null;
      if(!keys||expires<=now())await refresh();
      let jwk=keys.find(k=>k.kid===header.kid&&k.kty==='OKP'&&k.crv==='Ed25519');
      if(!jwk&&now()-lastRefresh>=30000){await refresh();jwk=keys.find(k=>k.kid===header.kid&&k.kty==='OKP'&&k.crv==='Ed25519');}
      if(!jwk||!verify(null,Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))return null;
      if(claims.banned===true)return null;
      return {uid:claims.sub,subject:claims.sub,authProvider:'neon',email:typeof claims.email==='string'?claims.email:null,
        emailVerified:claims.emailVerified===true,expiresAt:claims.exp,authTime:claims.iat,provider:null};
    } catch {return null;}
  };
}
export const verifyNeonToken=createNeonVerifier();
