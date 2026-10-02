export async function consumeEvents(body,onSnapshot,signal){
 const reader=body.getReader(),decoder=new TextDecoder();let pending='';
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{while(!signal.aborted){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});
   if(pending.length>262144)throw Error('event_too_large');let end;
   while((end=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);
     const lines=block.split('\n'),type=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
     const data=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
     if(type==='snapshot'&&data&&!signal.aborted)onSnapshot(JSON.parse(data));
     if(type==='error')throw Error('realtime_unavailable');
   }
 }}finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function watchRealtime({getUser,liveId,onSnapshot,onError=()=>{},fetchImpl=globalThis.fetch}){
 const controller=new AbortController();let stopped=false,timer,delay=500;
 async function connect(){if(stopped)return;try{const user=getUser();if(!user)throw Error('authentication_required');const token=await user.getIdToken();if(stopped)return;
   const response=await fetchImpl('/api/v1/events'+(liveId?'?liveId='+encodeURIComponent(liveId):''),{headers:{Authorization:'Bearer '+token,...(user.sessionToken?{'X-Neon-Session':user.sessionToken}:{})},cache:'no-store',signal:controller.signal});
   if(response.status===401||response.status===403){stopped=true;throw Error('authentication_required');}
   if(!response.ok||!response.body)throw Error('realtime_unavailable');delay=500;
   await consumeEvents(response.body,data=>{if(getUser()?.uid!==user.uid)throw Error('authentication_changed');if(!stopped)onSnapshot(data);},controller.signal);
 }catch(e){if(e.message==='authentication_changed'){stopped=true;controller.abort();}if(!stopped){onError(e);delay=Math.min(delay*2,30000);}}finally{if(!stopped)timer=setTimeout(connect,delay);}}
 void connect();return ()=>{stopped=true;clearTimeout(timer);controller.abort();};
}
