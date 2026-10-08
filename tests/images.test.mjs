import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {Readable} from 'node:stream';
import {optimizeImage} from '../server/neon/image-processing.mjs';import {MAX_IMAGE_BYTES,managedImageUrl,IMAGE_HOST} from '../assets/js/image-policy.js';import handler,{readImageBody} from '../api/v1/images.js';
test('JPEG/PNG/WebP decode, crop, resize and strip private metadata',async()=>{
 for(const format of ['jpeg','png','webp'])for(const kind of ['profile','thumbnail']){
 const input=await sharp({create:{width:300,height:200,channels:3,background:'#663399'}})[format]().withMetadata({exif:{IFD0:{Artist:'private photographer'}}}).toBuffer();
 const result=await optimizeImage(input,{name:'photo.'+(format==='jpeg'?'jpg':format),type:'image/'+format,kind});const meta=await sharp(result.buffer).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,kind==='profile'?512:1280);assert.equal(meta.height,kind==='profile'?512:720);assert.equal(meta.exif,undefined);assert.ok(result.bytes<=614400);assert.match(result.sha256,/^[a-f0-9]{64}$/);
 }
});
test('rejects forged MIME, corrupt, animated, SVG, extension, pixels and size',async()=>{
 const png=await sharp({create:{width:10,height:10,channels:3,background:'#111111'}}).png().toBuffer();
 const cases=[[png,'fake.jpg','image/jpeg'],[png,'fake.svg','image/png'],[Buffer.from('<svg/>'),'a.png','image/png'],[png.subarray(0,20),'a.png','image/png'],[Buffer.alloc(MAX_IMAGE_BYTES+1),'a.png','image/png'],[await sharp({create:{width:4001,height:4000,channels:3,background:'#111111'}}).png().toBuffer(),'a.png','image/png'],[await sharp(Buffer.concat([Buffer.alloc(300,0),Buffer.alloc(300,255)]),{raw:{width:10,height:20,channels:3,pageHeight:10}}).webp({loop:0,delay:[100,100]}).toBuffer(),'a.webp','image/webp']];
 for(const [buffer,name,type]of cases)await assert.rejects(optimizeImage(buffer,{name,type,kind:'profile'}),e=>[413,415].includes(e.status));
});
test('streamed request limits cannot be bypassed with missing content-length',async()=>{
 const req=Readable.from([Buffer.alloc(MAX_IMAGE_BYTES),Buffer.alloc(1)]);req.headers={};await assert.rejects(readImageBody(req),e=>e.status===413);
 const ok=Readable.from([Buffer.from('hello')]);ok.headers={};assert.equal((await readImageBody(ok)).toString(),'hello');
});
test('managed image URL excludes other stores, paths, credentials and queries',()=>{
 const good=`https://${IMAGE_HOST}/zytrix/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp`;assert.ok(managedImageUrl(good));
 for(const url of [good+'?x=1',good+'#x',good.replace('https:','http:'),good.replace(IMAGE_HOST,'evil.example'),good.replace('/zytrix/','/other/')])assert.equal(managedImageUrl(url),false);
});
test('image endpoint denies anonymous and cross-site calls',async()=>{
 const old={DATABASE_URL:process.env.DATABASE_URL,BLOB_READ_WRITE_TOKEN:process.env.BLOB_READ_WRITE_TOKEN,ZYTRIX_NEON_AUTH_URL:process.env.ZYTRIX_NEON_AUTH_URL};Object.assign(process.env,{DATABASE_URL:'postgresql://invalid',BLOB_READ_WRITE_TOKEN:'test',ZYTRIX_NEON_AUTH_URL:'https://example.neonauth.neon.tech'});
 try{for(const [headers,status]of [[{},401],[{'sec-fetch-site':'cross-site'},403]]){const res={setHeader(){},status(x){this.code=x;return this;},json(x){this.body=x;return this;}};await handler({method:'POST',url:'/api/v1/images?kind=profile',headers},res);assert.equal(res.code,status);}}
 finally{for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
