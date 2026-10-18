import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function harness(request){
 const button={hidden:true,disabled:false,textContent:'',setAttribute(){}},manage={hidden:true},message={textContent:''};
 const root={querySelector:s=>({'#public-follow':button,'#public-manage':manage,'#public-status':message}[s])};
 const source=readFileSync(new URL('../assets/js/public-profile.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').replace(/^import .*;\n/gm,'').replace("onAuthStateChanged(auth,value=>{user=value;if(state?.profile)void followState();});\nvoid load();",'');
 const context=vm.createContext({URLSearchParams,document:{querySelector:()=>root},location:{pathname:'/@streamer',search:''},header(){},footer(){},createPlatformClient:()=>()=>{},publicProfileUrl:()=>'/@streamer',profileRouteUsername:()=> 'streamer',publicPlatform:request});
 vm.runInContext(source+'\nglobalThis.prepare=(value)=>{uid="12345678-1234-4234-8234-123456789012";state={profile:{},channel:{id:"channel"}};user=value;};globalThis.check=followState;',context);return {context,button,message};
}
test('follow waits for authoritative state and does not act on failed state reads',async()=>{
 let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;}));h.context.prepare({uid:'other'});const pending=h.context.check();assert.equal(h.button.disabled,true);assert.equal(h.button.textContent,'Verificando…');finish({following:[]});await pending;assert.equal(h.button.disabled,false);assert.equal(h.button.textContent,'Seguir canal');
 const failed=harness(()=>Promise.reject(Error('session_expired')));failed.context.prepare({uid:'other'});await failed.context.check();assert.equal(failed.button.disabled,true);assert.match(failed.message.textContent,/Não foi possível confirmar/);
});
test('account switching discards stale following results',async()=>{
 let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;}));h.context.prepare({uid:'other'});const pending=h.context.check();h.context.prepare(null);await h.context.check();finish({following:['12345678-1234-4234-8234-123456789012']});await pending;assert.equal(h.button.textContent,'Entrar para seguir');assert.equal(h.button.disabled,false);
});
