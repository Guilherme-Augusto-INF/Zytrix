import {authenticate} from '../../server/neon/auth.mjs';
import {platformEnabled,platformPool} from '../../server/neon/platform-pool.mjs';
import {executePlatform,ApiError} from '../../server/neon/platform.mjs';
import {acquireRealtime} from '../../server/neon/sse-limits.mjs';
import {readContext} from '../../server/neon/read-context.mjs';
export const config={maxDuration:30};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 if(!platformEnabled())return res.status(503).json({error:'neon_not_configured'});
 const identity=await authenticate(req);if(!identity)return res.status(401).json({error:'authentication_required'});
 if(!Number.isFinite(identity.expiresAt)||identity.expiresAt*1000<=Date.now())return res.status(401).json({error:'authentication_required'});
 const liveId=new URL(req.url,'http://localhost').searchParams.get('liveId');
 if(liveId&&(liveId.length>128||liveId.length<1))return res.status(400).json({error:'invalid_input'});
 const releaseSlot=acquireRealtime(identity.subject??identity.uid);if(!releaseSlot)return res.status(429).json({error:'realtime_limit'});
 let closed=false,wake;const close=()=>{closed=true;wake?.();};res.on('close',close);
 let sent=false,previous;const deadline=Math.min(Date.now()+20000,identity.expiresAt?identity.expiresAt*1000:Infinity);
 try{while(!closed&&Date.now()<deadline){let c;let snapshot;
   try{c=await platformPool().connect();await c.query('begin read only');
     if(identity.authProvider==='neon'&&!(await c.query('select private.active_auth_session($1::uuid,$2) as active',[identity.subject,identity.sessionToken])).rows[0]?.active)throw new ApiError('authentication_required',401);
     const scoped=readContext(c);
     snapshot=liveId?{...(await executePlatform(scoped,identity,'live.get',{liveId})),...(await executePlatform(scoped,identity,'chat.list',{liveId}))}:await executePlatform(scoped,identity,'notifications.list');
     await c.query('commit');
   }catch(e){if(c)await c.query('rollback').catch(()=>{});throw e;}finally{c?.release();}
   if(closed)break;
   if(!sent){res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();sent=true;}
   const json=JSON.stringify(snapshot);if(json!==previous){if(!res.write('event: snapshot\ndata: '+json+'\n\n'))break;previous=json;}else if(!res.write(': heartbeat\n\n'))break;
   await new Promise(resolve=>{const timer=setTimeout(()=>{wake=null;resolve();},2000);wake=()=>{clearTimeout(timer);wake=null;resolve();};});
 }}catch(e){if(!closed){if(sent)res.write('event: error\ndata: {"error":"realtime_unavailable"}\n\n');else return res.status(e instanceof ApiError?e.status:503).json({error:e instanceof ApiError?e.code:'realtime_unavailable'});}}
 finally{releaseSlot();res.removeListener('close',close);if(!res.writableEnded)res.end();}
}
