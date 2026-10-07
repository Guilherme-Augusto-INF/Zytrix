export function createBackendSource({setTimeoutImpl=globalThis.setTimeout,clearTimeoutImpl=globalThis.clearTimeout}={}) {
 function watch({neon,onData,onError=()=>{},pollMs=15000}){let closed=false,timer;async function poll(){try{const value=await neon();if(!closed)onData(value);}catch(e){if(!closed)onError(e);}finally{if(!closed)timer=setTimeoutImpl(poll,pollMs);}}const stop=()=>{closed=true;clearTimeoutImpl(timer);};stop.ready=poll();return stop;}
 return {watch};
}
