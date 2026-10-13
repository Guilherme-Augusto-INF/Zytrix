import {ApiError} from './platform.mjs';
import {safeImageUrl} from '../../assets/js/security.js';
// Fixed SQL fragments only: never interpolate request input into SQL.
export const activeProfileFilter = column => `exists(select 1 from public.user_accounts pa join neon_auth."user" pn on pn.id=pa.user_id where pa.user_id=${column} and pa.deleted_at is null and pa.disabled_at is null and not coalesce(pn.banned,false)) and not exists(select 1 from public.moderation_penalties pp where pp.user_id=${column} and pp.type='ban' and pp.active and (pp.expires_at is null or pp.expires_at>now()))`;
export function profileUid(value) {
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new ApiError('invalid_uid');
 return value.toLowerCase();
}
export const publicFields = p => ({uid:p.uid,name:p.name,username:p.username,photoURL:safeImageUrl(p.photoURL),bio:p.bio,createdAt:p.createdAt});
export async function publicProfile(c,data) {
 const uid=profileUid(data.uid);
 const p=(await c.query(`select p.user_id::text as uid,p.name,p.username,p.photo_url as "photoURL",p.bio,p.created_at as "createdAt" from public.profiles p where p.user_id=$1::uuid and ${activeProfileFilter('p.user_id')}`,[uid])).rows[0];
 if(!p)return {profile:null};
 const channel=(await c.query(`select c.public_id as id,c.name,c.description,l.public_id as "liveId",l.title as "liveTitle" from public.channels c left join public.lives l on l.id=c.current_live_id and l.owner_id=c.owner_id and l.channel_id=c.id and l.status='live' and l.deleted_at is null and l.visibility='public' where c.owner_id=$1::uuid and c.visibility='public' and c.deleted_at is null and c.public_id is not null`,[uid])).rows[0]??null;
 const stats=(await c.query(`select (select count(*)::int from public.follows f join public.channels ch on ch.id=f.channel_id where ch.owner_id=$1::uuid and ch.visibility='public' and ch.deleted_at is null and ${activeProfileFilter('f.follower_id')}) as followers,(select count(*)::int from public.follows f join public.channels ch on ch.id=f.channel_id where f.follower_id=$1::uuid and ch.visibility='public' and ch.deleted_at is null and ${activeProfileFilter('ch.owner_id')}) as following`,[uid])).rows[0];
 return {profile:publicFields(p),channel,stats};
}
export async function publicNetwork(c,data) {
 const uid=profileUid(data.uid),kind=data.kind;
 if(!['followers','following'].includes(kind))throw new ApiError('invalid_input');
 const offset=data.offset??0;
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000)throw new ApiError('invalid_input');
 const available=(await c.query(`select 1 from public.profiles p where p.user_id=$1::uuid and ${activeProfileFilter('p.user_id')}`,[uid])).rows.length>0;
 if(!available)return {profiles:[],hasMore:false};
 const target=kind==='followers'?'f.follower_id':'ch.owner_id';
 const predicate=kind==='followers'?'ch.owner_id=$1::uuid':'f.follower_id=$1::uuid';
 const profiles=(await c.query(`select p.user_id::text as uid,p.name,p.username,p.photo_url as "photoURL",p.bio,p.created_at as "createdAt" from public.follows f join public.channels ch on ch.id=f.channel_id join public.profiles p on p.user_id=${target} where ${predicate} and ch.visibility='public' and ch.deleted_at is null and ${activeProfileFilter('p.user_id')} order by f.followed_at desc,p.user_id limit 21 offset $2`,[uid,offset])).rows;
 return {profiles:profiles.slice(0,20).map(publicFields),hasMore:profiles.length>20};
}
