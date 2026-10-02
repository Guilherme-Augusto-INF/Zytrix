import test from 'node:test';import assert from 'node:assert/strict';
import {credentials,configure,PROJECT,BRANCH,AUTH} from '../configure-staging-google.mjs';
const fixture={client_id:'test.apps.googleusercontent.com',client_secret:'fixture-secret-only'};
function setup({branch=BRANCH,google=true,type='shared'}={}){
 const calls=[];let updated=false;
 const request=async(path,method='GET',body)=>{
  calls.push({path,method,body});
  if(method==='PATCH'){updated=true;return {};}
  if(path===`/projects/${PROJECT}`)return {project:{id:PROJECT}};
  if(path.endsWith('/auth/oauth_providers'))return {providers:google?[{id:'google',type:updated?'standard':type,client_id:updated?fixture.client_id:type==='shared'?null:'other.apps.googleusercontent.com'}]:[]};
  if(path.endsWith('/auth'))return {branch_id:branch,base_url:AUTH,db_name:'neondb'};
  return {branch:{id:branch,name:'staging'}};
 };
 return {request,calls,loadCredentials:async()=>credentials(fixture),probe:async()=>({clientId:fixture.client_id,redirectUri:AUTH+'/callback/google'})};
}
test('dry run never writes; explicit apply PATCHes only the existing pinned Google provider',async()=>{
 const s=setup();assert.equal((await configure(s)).status,'DRY_RUN');assert.equal(s.calls.filter(c=>c.method!=='GET').length,0);
 const r=await configure({...s,apply:true});assert.equal(r.status,'UPDATED');assert.equal(r.login,'NOT_VERIFIED');
 const writes=s.calls.filter(c=>c.method!=='GET');assert.equal(writes.length,1);assert.equal(writes[0].method,'PATCH');assert.equal(writes[0].path,`/projects/${PROJECT}/branches/${BRANCH}/auth/oauth_providers/google`);
 assert.doesNotMatch(JSON.stringify(r),/fixture-secret-only/);
});
test('wrong branch, absent provider and unexpected custom client stop before PATCH',async()=>{
 for(const options of [{branch:'production'},{google:false},{type:'standard'}]){
  const s=setup(options);await assert.rejects(configure({...s,apply:true}));assert.equal(s.calls.some(c=>c.method!=='GET'),false);
 }
});
test('Google downloaded web JSON is supported and malformed credentials are rejected safely',()=>{
 assert.deepEqual(credentials({web:fixture}),fixture);
 for(const value of [{client_id:'wrong',client_secret:'private-value'}, {client_id:fixture.client_id,client_secret:''}])assert.throws(()=>credentials(value),e=>e.message==='invalid_google_credentials');
});
test('a mismatched real OAuth client fails certification after PATCH rather than reporting success',async()=>{
 const s=setup();await assert.rejects(configure({...s,apply:true,probe:async()=>({clientId:'old'})}),e=>e.safeCode==='oauth_client_readback_failed_after_patch');
});
