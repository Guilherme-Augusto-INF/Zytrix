import {readFile,realpath} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

export const PROJECT='soft-water-98807259',BRANCH='br-wispy-scene-b6325si6';
export const AUTH='https://ep-ancient-recipe-b65mlsad.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth';
const ORIGIN='https://zytrix-web-git-feat-neon-postg-f6f98a-guilhermeaugusto2525-1431.vercel.app';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const PREFIX=`/projects/${PROJECT}/branches/${BRANCH}`;
const fail=code=>{throw Object.assign(Error(code),{safeCode:code});};

export function credentials(value){
 const v=value?.web??value;
 if(!v||typeof v.client_id!=='string'||! /^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(v.client_id)||typeof v.client_secret!=='string'||v.client_secret.length<8||v.client_secret.length>4096||/\s/.test(v.client_secret))fail('invalid_google_credentials');
 return {client_id:v.client_id,client_secret:v.client_secret};
}
export function validateTarget(project,branch,auth){
 if(project?.project?.id!==PROJECT||branch?.branch?.id!==BRANCH||branch.branch.name!=='staging'||auth?.branch_id!==BRANCH||auth.base_url!==AUTH||auth.db_name!=='neondb')fail('staging_target_mismatch');
}
async function privateFile(path){
 const file=await realpath(path),root=await realpath(ROOT),r=relative(root,file);
 if(!r||(!r.startsWith('..')&&!isAbsolute(r)))fail('credentials_must_be_outside_repository');
 if((await readFile(file)).length>65536)fail('credentials_file_too_large');
 return credentials(JSON.parse(await readFile(file,'utf8')));
}

// No shell, no secret arguments, no raw CLI output/errors written to logs.
export function cliRequest(entry,args,body){
 return new Promise((resolveResult,reject)=>{
  const env={...process.env};delete env.DEBUG;delete env.NEON_DEBUG;
  const child=spawn(process.execPath,[entry,...args],{env,stdio:['pipe','pipe','pipe'],windowsHide:true});
  let output='',size=0;
  const timer=setTimeout(()=>{child.kill();reject(Object.assign(Error('cli_timeout'),{safeCode:'cli_timeout'}));},30000);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>1048576)child.kill();else output+=chunk;});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
  child.on('error',()=>{clearTimeout(timer);reject(Object.assign(Error('cli_unavailable'),{safeCode:'cli_unavailable'}));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0||size>1048576)return reject(Object.assign(Error('cli_request_failed'),{safeCode:'cli_request_failed'}));try{resolveResult(JSON.parse(output));}catch{reject(Object.assign(Error('cli_invalid_response'),{safeCode:'cli_invalid_response'}));}});
  child.stdin.end(body===undefined?'':JSON.stringify(body));
 });
}

export async function configure({request,loadCredentials,apply=false,probe}){
 const project=await request(`/projects/${PROJECT}`),branch=await request(PREFIX),auth=await request(PREFIX+'/auth');
 validateTarget(project,branch,auth);
 const providers=await request(PREFIX+'/auth/oauth_providers'),google=providers?.providers?.find(p=>p.id==='google');
 if(!google)fail('existing_google_provider_required');
 const secret=await loadCredentials();
 if(google.type!=='shared'&&google.client_id!==secret.client_id)fail('unexpected_existing_google_client');
 if(!apply)return {status:'DRY_RUN',project:PROJECT,branch:BRANCH,existingType:google.type,clientId:secret.client_id};
 await request(PREFIX+'/auth/oauth_providers/google','PATCH',secret);
 const after=await request(PREFIX+'/auth/oauth_providers');
 const updated=after?.providers?.find(p=>p.id==='google');
 if(updated?.client_id!==secret.client_id||updated.type==='shared')fail('provider_readback_failed_after_patch');
 const observed=await probe();
 if(observed.clientId!==secret.client_id)fail('oauth_client_readback_failed_after_patch');
 return {status:'UPDATED',project:PROJECT,branch:BRANCH,...observed,login:'NOT_VERIFIED'};
}
export async function probeOAuth(){
 const r=await fetch(AUTH+'/sign-in/social',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({provider:'google',callbackURL:ORIGIN+'/login.html'}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)fail('oauth_probe_failed');let url=(await r.json()).url;
 for(let i=0;i<4;i++){
  const u=new URL(url);
  if(u.origin==='https://accounts.google.com'){
   const redirectUri=u.searchParams.get('redirect_uri');
   if(![AUTH+'/callback/google','https://neonauth.c-2.sa-east-1.aws.neon.tech/auth/oauth/callback/google'].includes(redirectUri))fail('unexpected_oauth_callback');
   return {clientId:u.searchParams.get('client_id'),redirectUri};
  }
  if(u.protocol!=='https:'||!(u.hostname===new URL(AUTH).hostname||u.hostname==='neonauth.c-2.sa-east-1.aws.neon.tech'))fail('unexpected_oauth_redirect_host');
  const next=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(15000)}),location=next.headers.get('location');
  if(!location)fail('oauth_redirect_absent');url=new URL(location,u).href;
 }
 fail('oauth_redirect_limit');
}

async function main(){
 const args=process.argv.slice(2),entry=args[args.indexOf('--cli-entry')+1],file=args[args.indexOf('--credentials-file')+1];
 if(!args.includes('--cli-entry')||!args.includes('--credentials-file')||!entry||!file)fail('usage_cli_entry_and_private_credentials_file_required');
 const packageRoot=resolve(dirname(await realpath(entry)),'..'),pkg=JSON.parse(await readFile(resolve(packageRoot,'package.json'),'utf8'));
 if(pkg.name!=='neon'||pkg.version!=='7.0.2'||resolve(entry)!==resolve(packageRoot,'dist/cli.js'))fail('verified_neon_cli_7_0_2_required');
 const run=(a,b)=>cliRequest(entry,a,b);
 if(!process.env.NEON_API_KEY){const profiles=await run(['profile','list','--output','json']);if(!profiles.some(p=>p.active==='*'&&p.account&&p.account!=='-'))fail('neon_cli_login_required');}
 const request=(path,method='GET',body)=>run(['api',path,'--method',method,'--output','json',...(body?['--data','-']:[])],body);
 const result=await configure({request,loadCredentials:()=>privateFile(file),apply:args.includes('--apply'),probe:probeOAuth});
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){main().catch(error=>{console.error(JSON.stringify({status:'STOPPED',code:error.safeCode??'private_operation_failed'}));process.exitCode=1;});}
