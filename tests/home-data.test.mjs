import test from 'node:test';import assert from 'node:assert/strict';
test('homepage distinguishes empty public feed from failed/invalid responses',async()=>{
 const original=globalThis.fetch;
 try{for(const [response,expected] of [[{ok:true,json:async()=>({lives:[]})},[]],[{ok:true,json:async()=>({lives:[{id:'a',viewerCount:81}]})},[{id:'a',viewerCount:81}]],[{ok:false},null],[{ok:true,json:async()=>({})},null]]){
  globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/home-lives');assert.equal(options.credentials,'same-origin');return response;};
  const {initialLives}=await import('../assets/js/home-data.js?case='+Math.random());assert.deepEqual(await initialLives,expected);
 }}finally{globalThis.fetch=original;}
});
