import {authBase,verifyNeonToken} from './neon-token.mjs';
import {platformPool} from './platform-pool.mjs';
export async function authenticate(req){
 const bearer=req.headers.authorization,session=req.headers['x-neon-session'];
 if(!authBase()||typeof bearer!=='string'||!/^Bearer [^\s]{1,16000}$/.test(bearer)||typeof session!=='string'||session.length<16||session.length>512)return null;
 const identity=await verifyNeonToken(bearer.slice(7));if(!identity)return null;
 try{const result=await platformPool().query('select private.active_auth_session($1::uuid,$2) as created_at',[identity.subject,session]);if(!result.rows[0]?.created_at)return null;return {...identity,sessionToken:session,sessionCreatedAt:new Date(result.rows[0].created_at).getTime()};}catch{return null;}
}
