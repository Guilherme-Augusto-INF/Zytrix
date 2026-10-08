import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import pg from 'pg';import sharp from 'sharp';
import {replaceImage,removeImage,cleanupImages,transaction,imageTarget} from '../server/neon/images.mjs';import {executePlatform} from '../server/neon/platform.mjs';import {IMAGE_HOST} from '../assets/js/image-policy.js';
test('images: restricted PostgreSQL role, non-admin ownership, replacement, deletion, failures and concurrency',{skip:!process.env.IMAGE_TEST_DATABASE_URL_FILE},async()=>{
 const url=new URL((await readFile(process.env.IMAGE_TEST_DATABASE_URL_FILE,'utf8')).trim());assert.ok(!url.hostname.startsWith('ep-icy-night-b6fvg1ni'));url.search='';const pool=new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:4});
 const subject='5f2da840-1097-469d-b442-10d089153186',identity={subject,authProvider:'neon',emailVerified:true},files=new Map();let failDelete=false;
 const storage={async put(key,bytes){files.set(key,bytes);return {url:`https://${IMAGE_HOST}/${key}`};},async remove(key){if(failDelete)throw Error('storage temporarily unavailable');files.delete(key);}};
 const buffer=await sharp({create:{width:640,height:480,channels:3,background:'#334455'}}).png().toBuffer(),base={pool,identity,buffer,name:'test.png',type:'image/png',storage};
 try{
 assert.equal((await pool.query('select current_user')).rows[0].current_user,'zytrix_runtime');assert.equal((await pool.query('select 1 from public.admins where user_id=$1 and active',[subject])).rowCount,0);
 await assert.rejects(transaction(pool,c=>imageTarget(c,null,'profile',null)),e=>e.status===401);
 await assert.rejects(replaceImage({...base,kind:'thumbnail',liveId:'another-owner'}),e=>e.status===403);
 await assert.rejects(replaceImage({...base,identity:{...identity,emailVerified:false},kind:'profile'}),e=>e.status===403);
 const first=await replaceImage({...base,kind:'profile'});assert.equal(files.size,1);assert.equal((await pool.query('select photo_url from public.profiles where user_id=$1',[subject])).rows[0].photo_url,first.url);
 const second=await replaceImage({...base,kind:'profile'});assert.notEqual(first.url,second.url);assert.equal(files.size,1);
 await assert.rejects(transaction(pool,c=>executePlatform(c,identity,'documents.write',{path:['profiles',subject],operation:'update',data:{photoURL:first.url}})),e=>e.code==='image_action_required');
 await assert.rejects(transaction(pool,c=>executePlatform(c,identity,'documents.write',{path:['profiles','00000000-0000-4000-8000-000000000000'],operation:'update',data:{photoURL:second.url}})),e=>e.status===403);
 const thumb=await replaceImage({...base,kind:'thumbnail',liveId:subject});assert.equal((await pool.query('select thumbnail_url from public.lives where public_id=$1',[subject])).rows[0].thumbnail_url,thumb.url);assert.equal(files.size,2);
 await transaction(pool,c=>executePlatform(c,identity,'documents.write',{path:['clips','image-test-clip'],operation:'set',data:{streamId:subject,title:'Image reference test',momentSeconds:0}}));
 const newerThumb=await replaceImage({...base,kind:'thumbnail',liveId:subject});assert.equal((await pool.query("select thumbnail_url from public.clips where public_id='image-test-clip'")).rows[0].thumbnail_url,newerThumb.url);
 await assert.rejects(replaceImage({...base,kind:'profile',storage:{...storage,put:async()=>{throw Error('storage failure');}}}),/storage failure/);assert.equal((await pool.query('select photo_url from public.profiles where user_id=$1',[subject])).rows[0].photo_url,second.url);
 failDelete=true;await removeImage({...base,kind:'profile'});assert.equal((await pool.query('select photo_url from public.profiles where user_id=$1',[subject])).rows[0].photo_url,'');assert.ok((await pool.query("select 1 from private.image_assets where state='delete_pending'")).rowCount>0);
 failDelete=false;await cleanupImages(pool,storage);assert.equal(files.size,1);
 await Promise.all([replaceImage({...base,kind:'profile'}),replaceImage({...base,kind:'profile'})]);assert.equal((await pool.query("select 1 from private.image_assets where kind='profile' and state='active'")).rowCount,1);assert.equal(files.size,2);
 await removeImage({...base,kind:'profile'});await removeImage({...base,kind:'thumbnail',liveId:subject});assert.equal(files.size,0);assert.equal((await pool.query("select 1 from private.image_assets where state<>'deleted'")).rowCount,0);
 for(let i=0;i<4;i++)try{await replaceImage({...base,kind:'profile',buffer:Buffer.from('invalid')});}catch(e){assert.ok(['invalid_image','image_rate_limited'].includes(e.code));}
 await assert.rejects(replaceImage({...base,kind:'profile'}),e=>e.status===429);
 }finally{await pool.end();}
});
