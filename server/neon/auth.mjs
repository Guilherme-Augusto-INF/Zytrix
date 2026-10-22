import {authBase,verifyNeonToken,createNeonVerifier} from './neon-token.mjs';
import {platformPool} from './platform-pool.mjs';
import {authProvider,selfAuthURL,sessionFunction} from '../auth/provider.mjs';
export function createAuthenticator({getPool=platformPool,fetchImpl=fetch}={}){
let ownVerifier,ownURL;
return async function authenticate(req){
 const bearer=req.headers.authorization,session=req.headers['x-neon-session'];
 if(typeof bearer!=='string'||!/^Bearer [^\s]{1,16000}$/.test(bearer)||typeof session!=='string'||session.length<16||session.length>512)return null;
 try{
  let verifier=verifyNeonToken;
  if(authProvider()==='better-auth'){
   const url=selfAuthURL();if(ownURL!==url){ownURL=url;ownVerifier=createNeonVerifier({baseUrl:url,jwksPath:'/jwks',provider:'better-auth',fetchImpl});}verifier=ownVerifier;
  }else if(!authBase())return null;
  const identity=await verifier(bearer.slice(7));if(!identity)return null;
  const result=await getPool().query(`select ${sessionFunction()}($1::uuid,$2) as created_at`,[identity.subject,session]);if(!result.rows[0]?.created_at)return null;return {...identity,sessionToken:session,sessionCreatedAt:new Date(result.rows[0].created_at).getTime()};
 }catch{return null;}
};}
export const authenticate=createAuthenticator();
