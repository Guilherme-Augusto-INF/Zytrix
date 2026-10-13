import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readBoundedBody,readJsonBody,assertJsonStructure,PLATFORM_BODY_BYTES,CHECKOUT_BODY_BYTES} from '../server/neon/request-body.mjs';
import platform,{config as platformConfig} from '../api/v1/platform.js';
import checkout,{config as checkoutConfig} from '../api/v1/checkout.js';

function request(body,headers={}){const req=Readable.from(body);req.headers={'content-type':'application/json',...headers};req.method='POST';return req;}
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
const invalid=e=>e.code==='invalid_input'&&e.status===400;
test('stream budgets reject declared and actual bytes before JSON parsing',async()=>{
 let consumed=false;
 await assert.rejects(readJsonBody({headers:{'content-length':'16385'},async *[Symbol.asyncIterator](){consumed=true;yield '{}';}},PLATFORM_BODY_BYTES),e=>e.status===413);
 assert.equal(consumed,false);
 let chunks=0;
 const req={headers:{},async *[Symbol.asyncIterator](){chunks++;yield Buffer.alloc(16384);chunks++;yield Buffer.alloc(1);assert.fail('reader continued after overflow');}};
 await assert.rejects(readJsonBody(req,PLATFORM_BODY_BYTES),e=>e.status===413);assert.equal(chunks,2);
 await assert.rejects(readJsonBody(request(['{"text":"'+ '🔥'.repeat(5000)+'"}']),PLATFORM_BODY_BYTES),e=>e.status===413);
 const bytes=Buffer.from('{"action":"catalogue"}');assert.deepEqual(await readBoundedBody(request([bytes.subarray(0,4),bytes.subarray(4)]),bytes.length),bytes);
});
test('malformed JSON, UTF-8, top-level arrays and invalid lengths fail safely',async()=>{
 for(const body of ['{','null','[]','true',Buffer.from([0xff])])await assert.rejects(readJsonBody(request([body]),PLATFORM_BODY_BYTES),invalid);
 for(const length of ['-1','1e4','2,3',['2']])await assert.rejects(readJsonBody(request(['{}'],{'content-length':length}),PLATFORM_BODY_BYTES),invalid);
});
test('structure guards accept existing batch, path and moderation contracts',async()=>{
 const operation={path:['lives','live','chatSettings','main'],operation:'set',data:{mode:'everyone',blockedWords:Array(40).fill('word')}};
 const body={action:'documents.batch',data:{operations:Array(30).fill(operation)}};
 const raw=JSON.stringify(body);assert.ok(Buffer.byteLength(raw)<PLATFORM_BODY_BYTES);
 assert.deepEqual(await readJsonBody(request([raw]),PLATFORM_BODY_BYTES),body);
 assert.deepEqual(await readJsonBody(request(['{"packageId":"zy100","requestKey":"fixture_request_key"}']),CHECKOUT_BODY_BYTES,{maxArray:0,maxDepth:2,maxKeys:8}),{packageId:'zy100',requestKey:'fixture_request_key'});
 for(const body of [{data:Array(41).fill(0)},Object.fromEntries(Array.from({length:65},(_,i)=>['k'+i,0]))])assert.throws(()=>assertJsonStructure(body),invalid);
 let deep={};for(let i=0;i<10;i++)deep={value:deep};assert.throws(()=>assertJsonStructure(deep),invalid);
 assert.throws(()=>assertJsonStructure({a:Array(40).fill(Array(40).fill(0)),b:Array(40).fill(Array(40).fill(0))}),invalid);
});
test('prototype keys, including escaped names and nested payloads, are rejected',async()=>{
 for(const key of ['__proto__','constructor','prototype','\\u005f\\u005fproto__'])await assert.rejects(readJsonBody(request(['{"data":{"'+key+'":{"isAdmin":true}}}']),PLATFORM_BODY_BYTES),invalid);
 assert.equal(({}).isAdmin,undefined);
});
test('HTTP handlers reject unsafe structures before auth, database or Stripe',async()=>{
 assert.equal(platformConfig.api.bodyParser,false);assert.equal(checkoutConfig.api.bodyParser,false);
 const old={DATABASE_URL:process.env.DATABASE_URL,ZYTRIX_NEON_AUTH_URL:process.env.ZYTRIX_NEON_AUTH_URL};
 process.env.DATABASE_URL='invalid-config-no-database';process.env.ZYTRIX_NEON_AUTH_URL='invalid-auth';
 try{
  for(const handler of [platform,checkout])for(const body of ['{"action":"me","data":{"list":['+Array(41).fill('0').join(',')+']}}','{"action":"me","data":{"__proto__":{"admin":true}}}','{']){
   const res=response();await handler(request([body]),res);assert.equal(res.code,400);assert.deepEqual(res.body,{error:'invalid_input'});
  }
  const res=response();await checkout(request([Buffer.alloc(CHECKOUT_BODY_BYTES+1)]),res);assert.equal(res.code,413);
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
