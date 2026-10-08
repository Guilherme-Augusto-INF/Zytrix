import {randomUUID} from 'node:crypto';
import {put,del} from '@vercel/blob';
import {actor,ApiError} from './platform.mjs';
import {IMAGE_HOST,managedImageUrl} from '../../assets/js/image-policy.js';
import {optimizeImage} from './image-processing.mjs';
export const blobStorage={async put(key,bytes){return put(key,bytes,{access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'image/webp',cacheControlMaxAge:31536000});},async remove(key){await del(key);}};
export async function transaction(pool,fn){const c=await pool.connect();try{await c.query('begin');await c.query("set local lock_timeout='5s'");const result=await fn(c);await c.query('commit');return result;}catch(e){await c.query('rollback').catch(()=>{});throw e;}finally{c.release();}}
export async function imageTarget(c,identity,kind,liveId){
 const u=await actor(c,identity,true);
 if(kind==='profile'&&!liveId){if(!(await c.query('select 1 from public.profiles where user_id=$1',[u.id])).rowCount)throw new ApiError('profile_not_found',403);return {owner:u.id,live:null};}
 if(kind==='thumbnail'&&typeof liveId==='string'&&liveId.length<=128){const l=(await c.query(`select l.id from public.lives l join public.channels ch on ch.id=l.channel_id where l.public_id=$1 and l.owner_id=$2 and ch.owner_id=$2 and l.deleted_at is null and ch.deleted_at is null for update of l`,[liveId,u.id])).rows[0];if(!l)throw new ApiError('forbidden',403);return {owner:u.id,live:l.id};}
 throw new ApiError('invalid_input');
}
export async function cleanupImages(pool,storage=blobStorage,owner=null){
 let deleted=0;
 for(let i=0;i<25;i++){
  const done=await transaction(pool,async c=>{
   const row=(await c.query(`select id,object_key from private.image_assets where ($1::uuid is null or owner_id=$1) and (state='delete_pending' or (state='pending' and updated_at<now()-interval '15 minutes')) order by updated_at,id for update skip locked limit 1`,[owner])).rows[0];
   if(!row)return false;
   // Only server-generated keys from this store are deletable; never accept a browser URL.
   await storage.remove(row.object_key);
   await c.query("update private.image_assets set state='deleted',updated_at=now() where id=$1",[row.id]);return true;
  });if(!done)break;deleted++;
 }return deleted;
}
async function updateDerivedReferences(c,target,kind,url){
 const slot="select url from private.image_assets where owner_id=$1 and kind=$2 and live_id is not distinct from $3::uuid and state='active'";
 if(kind==='profile')await c.query(`select id from public.lives where owner_id=$1 and thumbnail_url in(${slot}) order by id for update`,[target.owner,kind,target.live]);
 // Clips and the original channel-creation flow can inherit an image reference.
 // Move those references atomically before removing the old object.
 await c.query(`update public.clips set thumbnail_url=$4 where streamer_id=$1 and thumbnail_url in(${slot})`,[target.owner,kind,target.live,url]);
 if(kind==='profile')await c.query(`update public.lives set thumbnail_url=$4 where owner_id=$1 and thumbnail_url in(${slot})`,[target.owner,kind,target.live,url]);
}
export async function replaceImage({pool,identity,kind,liveId=null,buffer,name,type,storage=blobStorage}){
 let image;
 const asset=await transaction(pool,async c=>{
  const target=await imageTarget(c,identity,kind,liveId);
  const rate=(await c.query("select count(*)::int n from private.image_assets where owner_id=$1 and created_at>now()-interval '1 hour'",[target.owner])).rows[0].n;
  if(rate>=10)throw new ApiError('image_rate_limited',429);
  const id=randomUUID(),key=`zytrix/${target.owner}/${id}.webp`,url=`https://${IMAGE_HOST}/${key}`;
  await c.query('insert into private.image_assets(id,owner_id,kind,live_id,object_key,url) values($1,$2,$3,$4,$5,$6)',[id,target.owner,kind,target.live,key,url]);return {id,key,url,...target};
 });
 try{
  image=await optimizeImage(buffer,{name,type,kind});
  const stored=await storage.put(asset.key,image.buffer);
  if(stored.url!==asset.url||!managedImageUrl(stored.url))throw Error('storage_configuration_mismatch');
  await transaction(pool,async c=>{
   await imageTarget(c,identity,kind,liveId);
   const pending=(await c.query("select 1 from private.image_assets where id=$1 and state='pending' for update",[asset.id])).rowCount;
   if(!pending)throw new ApiError('image_upload_expired',409);
   await updateDerivedReferences(c,asset,kind,asset.url);
   await c.query("update private.image_assets set state='delete_pending',updated_at=now() where owner_id=$1 and kind=$2 and live_id is not distinct from $3::uuid and state='active'",[asset.owner,kind,asset.live]);
   if(kind==='profile'){
    await c.query('update public.profiles set photo_url=$2 where user_id=$1',[asset.owner,asset.url]);
    await c.query('update public.channels set avatar_url=$2 where owner_id=$1 and deleted_at is null',[asset.owner,asset.url]);
   }else await c.query('update public.lives set thumbnail_url=$2 where id=$1 and owner_id=$3',[asset.live,asset.url,asset.owner]);
   await c.query("update private.image_assets set state='active',width=$2,height=$3,bytes=$4,sha256=$5,updated_at=now() where id=$1",[asset.id,image.width,image.height,image.bytes,image.sha256]);
  });
 }catch(e){await pool.query("update private.image_assets set state='delete_pending',updated_at=now() where id=$1 and state<>'active'",[asset.id]).catch(()=>{});await cleanupImages(pool,storage,asset.owner).catch(()=>{});throw e;}
 await cleanupImages(pool,storage,asset.owner).catch(()=>{});
 return {url:asset.url,width:image.width,height:image.height,bytes:image.bytes};
}
export async function removeImage({pool,identity,kind,liveId=null,storage=blobStorage}){
 const owner=await transaction(pool,async c=>{
  const target=await imageTarget(c,identity,kind,liveId);
  await updateDerivedReferences(c,target,kind,'');
  await c.query("update private.image_assets set state='delete_pending',updated_at=now() where owner_id=$1 and kind=$2 and live_id is not distinct from $3::uuid and state='active'",[target.owner,kind,target.live]);
  if(kind==='profile'){await c.query("update public.profiles set photo_url='' where user_id=$1",[target.owner]);await c.query("update public.channels set avatar_url='' where owner_id=$1 and deleted_at is null",[target.owner]);}
  else await c.query("update public.lives set thumbnail_url='' where id=$1 and owner_id=$2",[target.live,target.owner]);return target.owner;
 });await cleanupImages(pool,storage,owner).catch(()=>{});return {url:''};
}
