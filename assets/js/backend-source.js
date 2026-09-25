// Choose one backend per page load. A staging failure never falls back to Firebase.
export function createBackendSource({fetchImpl=globalThis.fetch,setTimeoutImpl=globalThis.setTimeout,clearTimeoutImpl=globalThis.clearTimeout}={}) {
  let config;
  async function staging(){
    config??=(async()=>{const response=await fetchImpl('/api/v1/config',{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('backend_config_unavailable');const data=await response.json();
      if(typeof data.postgresStaging!=='boolean')throw Error('invalid_backend_config');return data.postgresStaging;})();
    return config;
  }
  async function run(neon,firebase){return (await staging())?neon():firebase();}
  function watch({neon,firebase,onData,onError=()=>{},pollMs=15000}){
    let closed=false,timer,unsubscribe=()=>{};
    async function poll(){try{const value=await neon();if(!closed)onData(value);}catch(e){if(!closed)onError(e);}finally{if(!closed)timer=setTimeoutImpl(poll,pollMs);}}
    const ready=(async()=>{try{const enabled=await staging();if(closed)return;if(enabled)await poll();else{unsubscribe=firebase(value=>{if(!closed)onData(value);},e=>{if(!closed)onError(e);})??(()=>{});if(closed)unsubscribe();}}catch(e){if(!closed)onError(e);}})();
    const stop=()=>{if(closed)return;closed=true;clearTimeoutImpl(timer);unsubscribe();};stop.ready=ready;return stop;
  }
  return {staging,run,watch};
}
