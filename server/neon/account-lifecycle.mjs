import {ApiError} from './platform.mjs';
// Caller owns the transaction. Retain internal IDs and all financial/moderation references.
export async function deleteAccount(c,identity,data) {
 if(!identity||identity.authProvider!=='neon')throw new ApiError('authentication_required',401);
 if(data.confirmation!=='EXCLUIR'||!/^[A-Za-z0-9_-]{16,100}$/.test(data.requestKey??''))throw new ApiError('invalid_input');
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['account:'+identity.subject]);
 const mapped=(await c.query(`select i.id,a.deleted_at from private.external_auth_identities e
 join public.identities i on i.id=e.user_id join public.user_accounts a on a.user_id=i.id
 where e.provider='neon' and e.subject=$1 for update of a`,[identity.subject])).rows[0];
 if(!mapped)throw new ApiError('account_not_migrated',404);
 if(mapped.deleted_at)return {deleted:true,replayed:true};
 if(!identity.emailVerified||!Number.isFinite(identity.sessionCreatedAt)||Date.now()-identity.sessionCreatedAt>300000||identity.sessionCreatedAt>Date.now()+30000)throw new ApiError('recent_login_required',403);
 const user=mapped.id;
 // Serialize with money operations. A deleted recipient cannot receive new support.
 await c.query('select id from public.lives where owner_id=$1 order by id for update',[user]);
 await c.query('select user_id from public.wallets where user_id=$1 for update',[user]);
 await c.query(`insert into private.account_deletion_evidence(user_id,entity_type,entity_id,evidence)
 select $1,'chat',id::text,to_jsonb(m) from public.chat_messages m where sender_id=$1
 on conflict do nothing`,[user]);
 await c.query('update public.user_accounts set disabled_at=now(),deleted_at=now(),email=$2 where user_id=$1',[user,'deleted-'+user+'@example.invalid']);
 await c.query('update public.profiles set username=$2,bio=\'\',photo_url=\'\' where user_id=$1',[user,'gone_'+user.replaceAll('-','').slice(0,24)]);
 await c.query("update public.lives set status=case when status='live' then 'ended' else status end,ended_at=coalesce(ended_at,now()),deleted_at=now(),visibility='private',title='Conteúdo removido',description='',playback_url='',thumbnail_url='',vod_url=null,raid_target_live_id=null,host_target_live_id=null where owner_id=$1",[user]);
 await c.query("update public.channels set deleted_at=now(),visibility='private',is_live=false,current_live_id=null,name='Conta excluída',description='',avatar_url='',banner_url='' where owner_id=$1",[user]);
 await c.query("update public.channel_profiles set about='',games='',website='',youtube='',instagram='',tiktok='' where channel_id in(select id from public.channels where owner_id=$1)",[user]);
 await c.query("update public.clips set deleted_at=coalesce(deleted_at,now()),visibility='private',title='Conteúdo removido',source_url='',thumbnail_url='',media_path=null where creator_id=$1 or streamer_id=$1",[user]);
 await c.query("update public.chat_messages set text='[conta excluída]',status='deleted_by_author',deleted_at=coalesce(deleted_at,now()) where sender_id=$1 and status<>'removed_by_moderator'",[user]);
 await c.query('update public.chat_settings set pinned_message_id=null where pinned_message_id in(select id from public.chat_messages where sender_id=$1)',[user]);
 await c.query("update public.live_schedules set status='cancelled',title='Conteúdo removido',description='' where channel_id in(select id from public.channels where owner_id=$1) and status='scheduled'",[user]);
 await c.query('update public.rewards set active=false where channel_id in(select id from public.channels where owner_id=$1)',[user]);
 await c.query("update public.polls set status='closed' where created_by=$1 and status='active'",[user]);
 await c.query('update public.coin_promotions set active=false where created_by=$1',[user]);
 await c.query('update public.admins set active=false,revoked_at=now() where user_id=$1',[user]);
 await c.query('delete from public.follows where follower_id=$1 or channel_id in(select id from public.channels where owner_id=$1)',[user]);
 for(const table of ['channel_members','live_moderators'])await c.query(`delete from public.${table} where user_id=$1`,[user]);
 await c.query('delete from public.creator_attributions where user_id=$1 or creator_id=$1',[user]);
 await c.query('delete from public.creator_codes where creator_id=$1',[user]);
 await c.query('delete from public.featured_streamers where channel_id in(select id from public.channels where owner_id=$1)',[user]);
 await c.query('delete from private.channel_private_data where channel_id in(select id from public.channels where owner_id=$1)',[user]);
 for(const table of ['user_preferences','notification_states','watch_history','user_progress','followed_categories','live_reactions'])await c.query(`delete from public.${table} where user_id=$1`,[user]);
 for(const table of ['live_viewer_sessions','live_unique_views','chat_rate_limits','reaction_rate_limits','report_rate_limits'])await c.query(`delete from private.${table} where user_id=$1`,[user]);
 await c.query("insert into private.account_deletions(user_id,request_key) values($1,$2)",[user,data.requestKey]);
 await c.query('select private.disable_auth_identity($1::uuid)',[identity.subject]);
 return {deleted:true,replayed:false};
}
