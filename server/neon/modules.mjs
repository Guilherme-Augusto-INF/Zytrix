import {randomUUID} from 'node:crypto';
import {ApiError} from './platform.mjs';
import {safeImageUrl,safeStreamingUrl,safeSocialUrl} from '../../assets/js/security.js';
import {RESOLUTIONS,validateReport} from '../../assets/js/report-model.js';
const fail=(code,status=400)=>{throw new ApiError(code,status);};
const str=(v,max,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max?v:fail('invalid_input');
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail('invalid_input');
const rows=async(c,sql,args=[]) => (await c.query(sql,args)).rows;
const one=async(c,sql,args=[]) => (await rows(c,sql,args))[0]??null;
const uid=(c,value)=>one(c,'select id from public.identities where id::text=$1',[str(value,128,1)]);
const requestKey=v=>/^[A-Za-z0-9_-]{16,100}$/.test(v??'')?v:fail('invalid_request_key');

async function ownChannel(c,u,value) {
 const channel=await one(c,'select * from public.channels where public_id=$1 and deleted_at is null for update',[str(value,128,1)]);
 if(!channel||channel.owner_id!==u.id)fail('forbidden',403);return channel;
}
async function visibleChannel(c,u,value) {
 const channel=await one(c,"select * from public.channels where public_id=$1 and deleted_at is null and (visibility<>'private' or owner_id=$2)",[str(value,128,1),u?.id??null]);
 if(!channel)fail('channel_not_found',404);return channel;
}
export async function executeModules(c,identity,action,data,ctx) {
 const {actor,live,canModerate,executePlatform}=ctx;
 switch(action) {
 case 'policies.current': {
  const config=await one(c,'select scope,signup_enabled as "signupEnabled",reports_enabled as "reportsEnabled",terms_effective as "termsEffective",terms_version as "termsVersion",privacy_version as "privacyVersion",rules_version as "rulesVersion" from public.governance_config where singleton');
  return {config,policies:config?await rows(c,`select policy,version,scope,source_sha256 as "sourceSha256",document from public.policy_versions where (policy in ('terms','privacy') and version in($1,$2)) or (policy in ('community_guidelines','content_policy') and version=$3) order by policy`,[config.termsVersion,config.privacyVersion,config.rulesVersion]):[]};
 }
 case 'auth.logout': {
  if(!identity||identity.authProvider!=='neon'||!identity.sessionToken)fail('authentication_required',401);
  await c.query('select private.revoke_auth_session($1::uuid,$2)',[identity.subject,identity.sessionToken]);
  return {signedOut:true};
 }
 case 'viewer.count': {
  const u=identity?await actor(c,identity):null,l=await live(c,data.liveId,u);
  return await one(c,'select count(*)::int as count from private.live_viewer_sessions where live_id=$1 and expires_at>now()',[l.id]);
 }
 case 'follow.count': {
  const u=identity?await actor(c,identity):null,ch=await visibleChannel(c,u,data.channelId);
  return await one(c,'select count(*)::int as count from public.follows where channel_id=$1',[ch.id]);
 }
 case 'schedules.list': {
  const u=identity?await actor(c,identity):null;
  if(data.followingOnly&&!u)fail('authentication_required',401);
  return {schedules:await rows(c,`select coalesce(s.public_id,s.id::text) as id,ch.public_id as "channelId",s.title,s.description,
   s.starts_at as "startsAt",s.created_at as "createdAt" from public.live_schedules s join public.channels ch on ch.id=s.channel_id
   where ch.visibility='public' and ch.deleted_at is null and s.status='scheduled' and s.starts_at>now()
   and (not $1::boolean or exists(select 1 from public.follows f where f.channel_id=ch.id and f.follower_id=$2))
   order by s.starts_at,s.id limit 100`,[data.followingOnly===true,u?.id??null])};
 }
 case 'admin.chat-summary': {
  const u=await actor(c,identity,true);if(!u.admin)fail('forbidden',403);
  const count=await one(c,"select count(*)::int as messages from public.chat_messages where status='visible'");
  const chatPenalties=await rows(c,`select l.public_id as "streamId",l.title as "streamTitle",i.id::text as uid,b.kind as reason,b.expires_at as "expiresAt"
   from public.live_bans b join public.lives l on l.id=b.live_id join public.identities i on i.id=b.user_id
   where b.revoked_at is null and (b.expires_at is null or b.expires_at>now()) order by b.created_at desc,b.live_id,b.user_id limit 100`);
  return {...count,chatPenalties};
 }
 case 'auth.identity': {
  const u=await actor(c,identity);
  const accounts=await rows(c,'select "providerId" from neon_auth.account where "userId"=$1',[u.id]);
  const accepted=await one(c,'select 1 from public.policy_acceptances where user_id=$1 limit 1',[u.id]);
  return {uid:u.id,provider:accounts.some(a=>a.providerId==='google')?'google':'password',enrollmentRequired:!accepted};
 }
 case 'progress.get': {
  const u=await actor(c,identity);
  return {progress:await one(c,`select xp,watch_minutes as "watchMinutes",streak_days as "streakDays",last_active_day::text as "lastActiveDay",
    last_watch_reward_at as "lastWatchRewardAt" from public.user_progress where user_id=$1`,[u.id])};
 }
 case 'progress.record': {
  const u=await actor(c,identity),l=await live(c,data.liveId,u);
  if(l.status!=='live')return {skipped:true,reason:'live-not-active'};
  if(!await one(c,"select 1 from private.live_viewer_sessions where live_id=$1 and user_id=$2 and expires_at>now() and last_seen_at>now()-interval '2 minutes'",[l.id,u.id]))return {skipped:true,reason:'presence-required'};
  await c.query('insert into public.user_progress(user_id) values($1) on conflict do nothing',[u.id]);
  const updated=await c.query(`update public.user_progress set xp=xp+10,watch_minutes=watch_minutes+10,
    streak_days=case when last_active_day=(now() at time zone 'UTC')::date then greatest(1,streak_days)
    when last_active_day=(now() at time zone 'UTC')::date-1 then greatest(1,streak_days+1) else 1 end,
    last_active_day=(now() at time zone 'UTC')::date,last_live_id=$2,last_watch_reward_at=now(),updated_at=now()
    where user_id=$1 and (last_watch_reward_at is null or last_watch_reward_at<=now()-interval '9 minutes') returning xp`,[u.id,l.id]);
  return {skipped:!updated.rowCount,...await executeModules(c,identity,'progress.get',{},ctx)};
 }
 case 'attribution.set': {
  const u=await actor(c,identity);
  if(data.code===''){await c.query('delete from public.creator_attributions where user_id=$1',[u.id]);return {saved:true};}
  const code=str(data.code,24,3);
  const creator=await one(c,'select creator_id from public.creator_codes where code=$1',[code]);
  if(!creator||creator.creator_id===u.id)fail('invalid_creator');
  await c.query('insert into public.creator_attributions(user_id,creator_id,creator_code) values($1,$2,$3) on conflict(user_id) do update set creator_id=$2,creator_code=$3,updated_at=now()',[u.id,creator.creator_id,code]);
  return {saved:true};
 }
 case 'poll.vote': {
  const u=await actor(c,identity,true),l=await live(c,data.liveId,u);
  const poll=await one(c,"select * from public.polls where live_id=$1 and (public_id=$2 or id::text=$2) for update",[l.id,str(data.pollId,128,1)]);
  if(!poll||poll.status!=='active'||l.status!=='live')fail('poll_closed',409);
  const option=await one(c,'select id from public.poll_options where poll_id=$1 and position=$2',[poll.id,integer(data.optionIndex,0,3)]);
  if(!option)fail('invalid_option');
  const vote=await c.query('insert into public.poll_votes(poll_id,user_id,option_id) values($1,$2,$3) on conflict do nothing',[poll.id,u.id,option.id]);
  if(vote.rowCount)await c.query('update public.poll_options set vote_count=vote_count+1 where id=$1',[option.id]);
  return {voted:true,replayed:!vote.rowCount};
 }
 case 'promotion.claim': {
  const u=await actor(c,identity,true);
  const promotion=await one(c,'select * from public.coin_promotions where public_id=$1 or id::text=$1 for update',[str(data.promotionId,128,1)]);
  if(!promotion)fail('promotion_not_found',404);
  if(await one(c,'select 1 from public.promotion_claims where promotion_id=$1 and user_id=$2',[promotion.id,u.id]))return {claimed:true,replayed:true};
  if(!promotion.active||new Date(promotion.starts_at)>new Date()||new Date(promotion.ends_at)<=new Date()||promotion.claim_count>=promotion.max_claims)fail('promotion_unavailable',409);
  await c.query('insert into public.wallets(user_id) values($1) on conflict do nothing',[u.id]);
  await c.query('update public.wallets set balance=balance+$2 where user_id=$1',[u.id,promotion.amount]);
  const transaction=randomUUID();
  await c.query("insert into public.zy_coin_transactions(id,to_user_id,amount,type,status,promotion_id,idempotency_key) values($1,$2,$3,'promotion_claim','completed',$4,$5)",[transaction,u.id,promotion.amount,promotion.id,'promotion:'+promotion.id+':'+u.id]);
  await c.query('insert into public.promotion_claims(promotion_id,user_id,transaction_id,amount) values($1,$2,$3,$4)',[promotion.id,u.id,transaction,promotion.amount]);
  await c.query('update public.coin_promotions set claim_count=claim_count+1 where id=$1',[promotion.id]);return {claimed:true,replayed:false};
 }
 case 'reward.redeem': {
  const u=await actor(c,identity,true),l=await live(c,data.liveId,u);
  const key='reward:'+u.id+':'+requestKey(data.requestKey);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const reward=await one(c,'select * from public.rewards where channel_id=$1 and (public_id=$2 or id::text=$2) for update',[l.channel_id,str(data.rewardId,128,1)]);
  if(!reward)fail('reward_not_found',404);
  const old=await one(c,'select id,reward_id,live_id from public.zy_coin_transactions where idempotency_key=$1',[key]);
  if(old){if(old.reward_id!==reward.id||old.live_id!==l.id)fail('request_key_conflict',409);return {id:old.id,replayed:true};}
  if(!reward.active||reward.stock===0||l.owner_id===u.id||l.status!=='live')fail('reward_unavailable',409);
  await c.query('insert into public.wallets(user_id) values($1) on conflict do nothing',[l.owner_id]);
  await c.query('select user_id from public.wallets where user_id=any($1::uuid[]) order by user_id for update',[[u.id,l.owner_id]]);
  if(!(await c.query('update public.wallets set balance=balance-$2,total_sent=total_sent+$2 where user_id=$1 and balance>=$2',[u.id,reward.cost])).rowCount)fail('insufficient_balance',409);
  await c.query('update public.wallets set balance=balance+$2,total_received=total_received+$2 where user_id=$1',[l.owner_id,reward.cost]);
  const transaction=randomUUID();
  await c.query("insert into public.zy_coin_transactions(id,from_user_id,to_user_id,amount,type,live_id,reward_id,idempotency_key) values($1,$2,$3,$4,'reward_redeem',$5,$6,$7)",[transaction,u.id,l.owner_id,reward.cost,l.id,reward.id,key]);
  await c.query('insert into public.reward_redemptions(id,reward_id,channel_id,user_id,transaction_id,cost) values($1,$2,$3,$4,$1,$5)',[transaction,reward.id,l.channel_id,u.id,reward.cost]);
  if(reward.stock!==null)await c.query('update public.rewards set stock=stock-1 where id=$1',[reward.id]);return {id:transaction,replayed:false};
 }
 case 'reports.submit': {
  const u=await actor(c,identity,true),input=validateReport(data);
  const config=await one(c,"select 1 from public.governance_config where singleton and reports_enabled and rules_version='governance-1'");
  if(!config)fail('reports_disabled',409);
  let target,profile=null,stream=null,message=null;
  if(input.targetType==='profile'){target=await uid(c,input.targetId);profile=target?.id;if(!profile||!await one(c,'select 1 from public.profiles where user_id=$1',[profile]))fail('target_unavailable',404);}
  else{const l=await live(c,input.targetType==='chat'?input.contextId:input.targetId,u);target={id:l.owner_id};if(input.targetType==='stream')stream=l.id;
    else {const m=await one(c,"select id,sender_id from public.chat_messages where live_id=$1 and (public_id=$2 or id::text=$2) and status='visible'",[l.id,input.targetId]);if(!m)fail('target_unavailable',404);message=m.id;target={id:m.sender_id};}}
  if(target.id===u.id)fail('self_report');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['report:'+u.id]);
  const old=await one(c,"select id from public.reports where reporter_id=$1 and status='open' and (target_profile_id=$2 or target_live_id=$3 or target_chat_message_id=$4)",[u.id,profile,stream,message]);
  if(old)fail('report_already_open',409);
  if(await one(c,"select 1 from private.report_rate_limits where user_id=$1 and last_at>now()-interval '1 minute'",[u.id]))fail('rate_limited',429);
  const report=await one(c,`insert into public.reports(reporter_id,target_type,target_profile_id,target_live_id,target_chat_message_id,reason,description)
   values($1,$2,$3,$4,$5,$6,$7) returning id`,[u.id,input.targetType==='stream'?'live':input.targetType,profile,stream,message,input.reason,input.description]);
  await c.query('insert into private.report_rate_limits(user_id,last_at,last_report_id) values($1,now(),$2) on conflict(user_id) do update set last_at=now(),last_report_id=$2',[u.id,report.id]);return {id:report.id};
 }
 case 'reports.close': {
  const u=await actor(c,identity,true);if(!u.admin)fail('forbidden',403);if(!Object.hasOwn(RESOLUTIONS,data.resolution))fail('invalid_resolution');
  const report=await one(c,'select id,status from public.reports where public_id=$1 or id::text=$1 for update',[str(data.id,128,1)]);
  if(!report||report.status!=='open')fail('report_unavailable',409);
  await c.query("update public.reports set status='closed',resolution=$2,reviewed_at=now(),reviewed_by=$3 where id=$1",[report.id,data.resolution,u.id]);
  await c.query("insert into public.moderation_audit(report_id,action,resolution,moderator_id) values($1,'close_report',$2,$3)",[report.id,data.resolution,u.id]);return {closed:true};
 }
 case 'documents.read': return readDocument(c,identity,data,ctx);
 case 'documents.write': return writeDocument(c,identity,data,ctx);
 case 'documents.batch': {
  if(!Array.isArray(data.operations)||data.operations.length>30)fail('invalid_input');
  const result=[];for(const operation of data.operations)result.push(await writeDocument(c,identity,operation,ctx));return {results:result};
 }
 default: fail('unknown_action',404);
 }
}

function pathOf(data) {
 if(!Array.isArray(data.path)||data.path.length>6||data.path.some(x=>typeof x!=='string'||!x||x.length>128||x.includes('/')))fail('invalid_path');return data.path;
}
// Explicit relational reads for the original screens. No arbitrary table, SQL or private UID queries.
async function readDocument(c,identity,data,ctx) {
 const path=pathOf(data),[kind,identifier,sub,child]=path;
 const u=identity?await ctx.actor(c,identity).catch(e=>{if(e.code==='profile_not_found')return null;throw e;}):null;
 const owned=value=>{if(!u||u.id!==value)fail('forbidden',403);};
 let list=[];
 if(kind==='profiles')list=await rows(c,`select i.id::text as id,i.id::text as uid,p.name,p.username,p.photo_url as "photoURL",p.bio,p.created_at as "createdAt",p.username_updated_at as "usernameUpdatedAt" from public.profiles p join public.identities i on i.id=p.user_id where not exists(select 1 from public.user_accounts a where a.user_id=p.user_id and a.deleted_at is not null) and ($1::text is null or i.id::text=$1) order by p.created_at desc,p.user_id limit 200`,[identifier??null]);
 else if(kind==='wallets'){if(!identifier){if(!u?.admin)fail('forbidden',403);list=await rows(c,'select i.id::text as id,w.balance::text,w.total_sent::text as "totalSent",w.total_received::text as "totalReceived" from public.wallets w join public.identities i on i.id=w.user_id order by w.updated_at desc,w.user_id limit 200');}else{owned(identifier);const result=await ctx.executePlatform(c,identity,'wallet.get',{});list=result.wallet?[{id:identifier,uid:identifier,...result.wallet,totalSent:result.wallet.total_sent,totalReceived:result.wallet.total_received}]:[];}}
 else if(kind==='admins'){if(!u)fail('authentication_required',401);list=await rows(c,'select i.id::text as id,active from public.admins a join public.identities i on i.id=a.user_id where ($1::text is null or i.id::text=$1) and (i.id=$2 or $3) order by i.id limit 100',[identifier??null,u.id,u.admin]);}
 else if(kind==='governance')list=await rows(c,`select 'config' as id,reports_enabled as "reportsEnabled",rules_version as "rulesVersion",terms_version as "termsVersion",privacy_version as "privacyVersion",terms_effective as "termsEffective",scope,signup_enabled as "signupEnabled" from public.governance_config where singleton`);
 else if(kind==='categories')list=(await ctx.executePlatform(c,identity,'categories.list',{})).categories.map(x=>({...x,id:x.id}));
 else if(kind==='users'){
  if(!sub){
   if(identifier){owned(identifier);list=await rows(c,`select user_id::text as id,user_id::text as uid,zytrix_id as "zytrixId",(select email from neon_auth."user" n where n.id=user_id) as email,(select case when exists(select 1 from neon_auth.account acc where acc."userId"=user_id and acc."providerId"='google') then 'google' else 'password' end) as provider,created_at as "createdAt" from public.user_accounts where user_id=$1`,[u.id]);}
   else {const lookup=data.constraints?.find(x=>x.type==='where'&&x.field==='zytrixId'&&x.op==='==');if(!u)fail('forbidden',403);if(lookup)list=await rows(c,'select user_id::text as id,user_id::text as uid,zytrix_id as "zytrixId" from public.user_accounts where zytrix_id=$1 limit 1',[str(lookup.value,128,1)]);else if(u.admin)list=await rows(c,`select a.user_id::text as id,a.user_id::text as uid,a.zytrix_id as "zytrixId",n.email,a.created_at as "createdAt" from public.user_accounts a join neon_auth."user" n on n.id=a.user_id order by a.created_at desc,a.user_id limit 200`);else fail('forbidden',403);}
  }else{
   owned(identifier);
   if(sub==='following')list=await rows(c,`select ch.public_id as id,ch.public_id as "channelId",f.followed_at as "followedAt" from public.follows f join public.channels ch on ch.id=f.channel_id where f.follower_id=$1 and ch.deleted_at is null order by f.followed_at desc,ch.id limit 200`,[u.id]);
   else if(sub==='progress'){const r=await executeModules(c,identity,'progress.get',{},ctx);list=r.progress?[{id:'main',...r.progress}]:[];}
   else if(sub==='notificationState')list=await rows(c,'select state_type as id,last_seen_at as "lastSeenAt",last_seen_at as "lastSupportSeenAt" from public.notification_states where user_id=$1',[u.id]);
   else if(sub==='watchHistory')list=(await ctx.executePlatform(c,identity,'discovery.context',{})).history.map(x=>({...x,streamId:x.id,watchedAt:x.watchedAt}));
   else if(sub==='preferences')list=[{id:'platform',...(await ctx.executePlatform(c,identity,'preferences.get',{})).preferences}];
   else fail('module_unavailable',501);
  }
 }
 else if(kind==='channels') {
  if(sub){const channel=await visibleChannel(c,u,identifier);
   if(['followers','members'].includes(sub)){if(sub==='members'&&channel.owner_id!==u?.id&&child!==u?.id)fail('forbidden',403);
    list=await rows(c,sub==='followers'?`select i.id::text as id,i.id::text as uid,f.followed_at as "followedAt" from public.follows f join public.identities i on i.id=f.follower_id where f.channel_id=$1 order by f.followed_at desc,i.id limit 200`:`select i.id::text as id,i.id::text as uid,m.created_at as "createdAt",jsonb_build_object('username',p.username,'photoURL',p.photo_url) as profile from public.channel_members m join public.identities i on i.id=m.user_id left join public.profiles p on p.user_id=m.user_id where m.channel_id=$1 and ($2 or i.id=$3) order by i.id limit 200`,[channel.id,...(sub==='members'?[channel.owner_id===u?.id,u?.id??null]:[])]);
   }else if(sub==='schedule')list=await rows(c,`select coalesce(public_id,id::text) as id,title,description,starts_at as "startsAt",created_at as "createdAt",status from public.live_schedules where channel_id=$1 and status='scheduled' order by starts_at,id limit 100`,[channel.id]);
   else if(sub==='rewards')list=await rows(c,`select coalesce(public_id,id::text) as id,title,description,cost,active,stock from public.rewards where channel_id=$1 and (active or $2) order by created_at desc,id limit 100`,[channel.id,channel.owner_id===u?.id]);
   else fail('module_unavailable',501);
  }else list=await rows(c,`select ch.public_id as id,i.id::text as "ownerUid",ch.name as "channelName",ch.description,ch.avatar_url as "avatarURL",ch.banner_url as "bannerURL",ch.category_id as "categoryId",ch.is_live as "isLive",l.public_id as "currentStreamId",ch.created_at as "createdAt" from public.channels ch join public.identities i on i.id=ch.owner_id left join public.lives l on l.id=ch.current_live_id where ch.deleted_at is null and (($1::text is null and ch.visibility='public') or (ch.public_id=$1 and (ch.visibility<>'private' or ch.owner_id=$2))) order by ch.is_live desc,ch.created_at desc,ch.id limit 200`,[identifier??null,u?.id??null]);
 }
 else if(kind==='channelProfiles'){const channel=await visibleChannel(c,u,identifier);list=await rows(c,'select $2::text as id,about,games,website,youtube,instagram,tiktok from public.channel_profiles where channel_id=$1',[channel.id,identifier]);}
 else if(kind==='streams'){
  if(!identifier){list=await rows(c,`select l.public_id as id,i.id::text as "streamerUid",ch.public_id as "channelId",l.title,l.description,l.category_id as "categoryId",l.playback_url as "playbackURL",l.thumbnail_url as "thumbnailURL",l.status,l.mature_content as "matureContent",l.started_at as "startedAt",l.ended_at as "endedAt",l.created_at as "createdAt",l.total_views as "totalViews",(select count(*)::int from private.live_viewer_sessions v where v.live_id=l.id and v.expires_at>now()) as "viewerCount" from public.lives l join public.channels ch on ch.id=l.channel_id join public.identities i on i.id=l.owner_id where l.deleted_at is null and ch.deleted_at is null and ((l.visibility='public' and ch.visibility='public') or l.owner_id=$1) order by l.created_at desc,l.id limit 200`,[u?.id??null]);}
  else {const l=await ctx.live(c,identifier,u);
   if(!sub){const result=await ctx.executePlatform(c,identity,'live.get',{liveId:identifier});list=[{...result.live,vodURL:l.vod_url,supportAlertSound:l.support_alert_sound,supportGoalLabel:l.support_goal_label,supportGoalCoins:l.support_goal_coins,supportAlertTheme:l.support_alert_theme,supportAlertMinCoins:l.support_alert_min_coins,supportAlertDurationMs:l.support_alert_duration_ms,totalViews:l.total_views,raidTargetStreamId:result.live.raidTargetStreamId??'',hostTargetStreamId:result.live.hostTargetStreamId??''}];}
   else if(sub==='chat'){list=(await ctx.executePlatform(c,identity,'chat.list',{liveId:identifier})).messages;}
   else if(sub==='chatSettings'||sub==='chatConfig'){list=await rows(c,`select 'main' as id,mode,slow_mode_seconds as "slowModeSeconds",allow_links as "allowLinks",block_excess_caps as "blockExcessCaps",blocked_words as "blockedWords",emergency_mode as "emergencyMode",coalesce(m.public_id,m.id::text) as "pinnedMessageId" from public.chat_settings s left join public.chat_messages m on m.id=s.pinned_message_id where s.live_id=$1`,[l.id]);}
   else if(sub==='chatBans'){if(!u)fail('authentication_required',401);if(child!==u.id&&!await ctx.canModerate(c,u,l))fail('forbidden',403);list=await rows(c,`select i.id::text as id,i.id::text as uid,b.kind as reason,b.created_at as "createdAt",b.expires_at as "expiresAt" from public.live_bans b join public.identities i on i.id=b.user_id where b.live_id=$1 and b.revoked_at is null and (b.expires_at is null or b.expires_at>now()) and ($2::text is null or i.id::text=$2) order by b.created_at desc,i.id limit 100`,[l.id,child??null]);}
   else if(sub==='moderators'){if(!u)fail('authentication_required',401);const owner=l.owner_id===u.id||u.admin;list=await rows(c,`select i.id::text as id,i.id::text as uid,jsonb_build_object('username',p.username,'photoURL',p.photo_url) as profile from public.live_moderators m join public.identities i on i.id=m.user_id left join public.profiles p on p.user_id=m.user_id where m.live_id=$1 and ($2 or i.id=$3) order by i.id limit 100`,[l.id,owner,u.id]);}
   else if(sub==='viewers'){if(!child&&(!u||!await ctx.canModerate(c,u,l)))fail('forbidden',403);if(child&&child!==u?.id)fail('forbidden',403);list=await rows(c,`select i.id::text as id,v.last_seen_at as "lastSeen" from private.live_viewer_sessions v join public.identities i on i.id=v.user_id where v.live_id=$1 and v.expires_at>now() and ($2::text is null or i.id::text=$2) order by v.last_seen_at desc,i.id limit 200`,[l.id,child??null]);}
   else if(sub==='reactions')list=await rows(c,`select r.id::text as id,r.emoji,r.created_at as "createdAt",i.id::text as uid from public.live_reactions r join public.identities i on i.id=r.user_id where r.live_id=$1 and r.expires_at>now() order by r.created_at desc,r.id limit 30`,[l.id]);
   else if(sub==='supportAlerts')list=await rows(c,`select t.transaction_id::text as id,t.transaction_id::text as "transactionId",i.id::text as "fromUid",t.amount::text,t.message,t.created_at as "createdAt" from public.support_alerts t join public.identities i on i.id=t.from_user_id where t.live_id=$1 and t.expires_at>now() order by t.created_at desc,t.transaction_id limit 100`,[l.id]);
   else if(sub==='polls'){const polls=await rows(c,'select coalesce(public_id,id::text) as id,id as internal,kind,question,status,created_at as "createdAt",result_option_id from public.polls where live_id=$1 order by created_at desc,id limit 10',[l.id]);const options=await rows(c,'select poll_id,id,position,label,vote_count from public.poll_options where poll_id=any($1::uuid[]) order by poll_id,position',[polls.map(x=>x.internal)]);list=polls.map(p=>{const out={...p};delete out.internal;delete out.result_option_id;out.resultIndex=null;for(const option of options.filter(o=>o.poll_id===p.internal)){out['option'+option.position]=option.label;out['count'+option.position]=option.vote_count;if(option.id===p.result_option_id)out.resultIndex=option.position;}return out;});}
   else fail('module_unavailable',501);
  }
 }
 else if(kind==='clips')list=await rows(c,`select coalesce(cl.public_id,cl.id::text) as id,cl.title,l.public_id as "streamId",s.id::text as "streamerUid",u.id as "creatorUid",cl.moment_seconds as "momentSeconds",cl.source_url as "sourceUrl",cl.thumbnail_url as "thumbnailURL",cl.mature_content as "matureContent",cl.created_at as "createdAt",ps.username as "streamerName",pc.username as "creatorName" from public.clips cl join public.lives l on l.id=cl.live_id join public.channels ch on ch.id=l.channel_id join public.identities s on s.id=cl.streamer_id join public.identities u on u.id=cl.creator_id left join public.profiles ps on ps.user_id=s.id left join public.profiles pc on pc.user_id=u.id where cl.deleted_at is null and l.deleted_at is null and ch.deleted_at is null and ((cl.visibility='public' and l.visibility='public' and ch.visibility='public') or cl.streamer_id=$1) order by cl.created_at desc,cl.id limit 80`,[u?.id??null]);
 else if(kind==='creatorCodes')list=await rows(c,'select code as id,code,i.id::text as "creatorUid" from public.creator_codes cc join public.identities i on i.id=cc.creator_id where ($1::text is null or code=$1) order by code limit 200',[identifier??null]);
 else if(kind==='zyCoinTransactions'){if(!u)fail('authentication_required',401);list=(await ctx.executePlatform(c,identity,'transactions.list',{})).transactions;}
 else if(kind==='coinPromotions'){
  if(sub==='claims'){if(!u||child!==u.id)fail('forbidden',403);list=await rows(c,'select $3::text as id,p.amount,p.created_at as "createdAt" from public.promotion_claims p join public.coin_promotions cp on cp.id=p.promotion_id where p.user_id=$1 and (cp.public_id=$2 or cp.id::text=$2)',[u.id,identifier,child]);}
  else list=await rows(c,'select coalesce(public_id,id::text) as id,title,description,amount,max_claims as "maxClaims",claim_count as "claimCount",active,starts_at as "startsAt",ends_at as "endsAt" from public.coin_promotions where active or $1 order by created_at desc,id limit 100',[u?.admin??false]);
 }
 else if(kind==='rewardRedemptions'){if(!u)fail('authentication_required',401);list=await rows(c,`select coalesce(r.public_id,r.id::text) as id,ch.public_id as "channelId",i.id::text as uid,r.cost,r.status,r.created_at as "createdAt",re.title as "rewardTitle" from public.reward_redemptions r join public.channels ch on ch.id=r.channel_id join public.identities i on i.id=r.user_id join public.rewards re on re.id=r.reward_id where r.user_id=$1 or ch.owner_id=$1 order by r.created_at desc,r.id limit 100`,[u.id]);}
 else if(kind==='reports'){if(!u)fail('authentication_required',401);list=await rows(c,`select coalesce(r.public_id,r.id::text) as id,i.id::text as "reporterUid",case when r.target_type='live' then 'stream' else r.target_type end as "targetType",coalesce(pi.id::text,l.public_id,m.public_id,m.id::text) as "targetId",coalesce(ml.public_id,'-') as "contextId",r.reason,r.description,r.status,r.resolution,r.created_at as "createdAt" from public.reports r join public.identities i on i.id=r.reporter_id left join public.identities pi on pi.id=r.target_profile_id left join public.lives l on l.id=r.target_live_id left join public.chat_messages m on m.id=r.target_chat_message_id left join public.lives ml on ml.id=m.live_id where r.reporter_id=$1 or $2 order by r.created_at desc,r.id limit 100`,[u.id,u.admin]);}
 else if(['moderationPenalties','moderationActions','zyCoinOrders'].includes(kind)){
  if(!u?.admin)fail('forbidden',403);
  if(kind==='moderationPenalties')list=await rows(c,`select i.id::text as id,i.id::text as uid,p.type,p.reason,p.active,p.expires_at as "expiresAt",p.created_at as "createdAt" from public.moderation_penalties p join public.identities i on i.id=p.user_id order by p.created_at desc,p.user_id limit 100`);
  else if(kind==='moderationActions')list=await rows(c,`select coalesce(m.public_id,m.id::text) as id,i.id::text as "targetUid",m.penalty_type as type,m.action,m.reason,m.created_at as "createdAt" from public.moderation_actions m join public.identities i on i.id=m.target_user_id order by m.created_at desc,m.id limit 100`);
  else list=await rows(c,`select coalesce(o.public_id,o.id::text) as id,i.id::text as uid,o.package_id as "packageId",o.coins,o.price_cents as "priceCents",o.status,o.mode,o.created_at as "createdAt" from public.zy_coin_orders o join public.identities i on i.id=o.user_id order by o.created_at desc,o.id limit 100`);
 }
 else fail('module_unavailable',501);
 // Filtering private rows happens above on the server, before adapting the original snapshot contract.
 const selected=path.length%2===0?list.filter(x=>String(x.id)===path.at(-1)):list;
 return {documents:selected};
}

async function writeDocument(c,identity,data,ctx) {
 const path=pathOf(data),[kind,identifier,sub,child]=path,patch=data.data??{};
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!['set','update','delete'].includes(data.operation))fail('invalid_input');
 const u=await ctx.actor(c,identity,true),deleting=data.operation==='delete';
 const owned=value=>{if(value!==u.id)fail('forbidden',403);};
 if(kind==='wallets'||kind==='zyCoinTransactions'||kind==='zyCoinOrders')fail('financial_action_required',403);
 if(kind==='profiles'){owned(identifier);if(deleting)fail('account_deletion_not_enabled',409);
  const old=await one(c,'select username,bio from public.profiles where user_id=$1',[u.id]);if(!old)fail('profile_missing',404);
  await ctx.executePlatform(c,identity,'profile.update',{username:patch.username??old.username,bio:patch.bio??old.bio,name:patch.name});
  if(patch.photoURL!==undefined){const url=str(patch.photoURL,2048);if(url&&!safeImageUrl(url))fail('invalid_photo_url');await c.query('update public.profiles set photo_url=$2 where user_id=$1',[u.id,url]);}return {saved:true};
 }
 if(kind==='users'){owned(identifier);if(sub==='notificationState')return ctx.executePlatform(c,identity,'notifications.seen',{type:child});fail('account_action_required',403);}
 if(kind==='channels') {
  owned(identifier);
  if(!sub){if(deleting)fail('channel_deletion_not_enabled',409);
   const old=await one(c,'select name,slug,description,visibility from public.channels where owner_id=$1 and deleted_at is null',[u.id]);
   if(!old){await ctx.executePlatform(c,identity,'channel.save',{name:patch.channelName??'Streamer',slug:'channel-'+u.id,description:patch.description??'',visibility:'public'});}
   else if(patch.channelName!==undefined||patch.description!==undefined)await ctx.executePlatform(c,identity,'channel.save',{name:patch.channelName??old.name,slug:old.slug,description:patch.description??old.description,visibility:old.visibility});
   const channel=await ownChannel(c,u,identifier);
   if(patch.categoryId!==undefined){const category=str(patch.categoryId,120,1);if(!await one(c,'select id from public.categories where active and (id=$1 or name=$1)',[category]))fail('invalid_category');await c.query('update public.channels set category_id=(select id from public.categories where active and (id=$2 or name=$2) order by id limit 1) where id=$1',[channel.id,category]);}
   for(const [name,column]of [['avatarURL','avatar_url'],['bannerURL','banner_url']])if(patch[name]!==undefined){const value=str(patch[name],2048);if(value&&!safeImageUrl(value))fail('invalid_image_url');await c.query(`update public.channels set ${column}=$2 where id=$1`,[channel.id,value]);}
   return {saved:true}; // Live state is changed only by live.state, which updates both tables atomically.
  }
  const channel=await ownChannel(c,u,identifier);
  if(sub==='members'){const target=await uid(c,child);if(!target||target.id===u.id)fail('invalid_target');if(deleting)await c.query('delete from public.channel_members where channel_id=$1 and user_id=$2',[channel.id,target.id]);else await c.query('insert into public.channel_members(channel_id,user_id,added_by) values($1,$2,$3) on conflict do nothing',[channel.id,target.id,u.id]);return {saved:true};}
  if(sub==='schedule'){
   if(deleting)await c.query("update public.live_schedules set status='cancelled',updated_at=now() where channel_id=$1 and (public_id=$2 or id::text=$2)",[channel.id,child]);
   else {const date=new Date(patch.startsAt?.iso??patch.startsAt);if(!Number.isFinite(date.getTime())||date<=new Date())fail('invalid_schedule');await c.query('insert into public.live_schedules(public_id,channel_id,title,description,starts_at) values($1,$2,$3,$4,$5) on conflict(public_id) do nothing',[child,channel.id,str(patch.title,80,1),str(patch.description??'',500),date]);}return {saved:true};
  }
  if(sub==='rewards'){
   const reward=await one(c,'select * from public.rewards where channel_id=$1 and (public_id=$2 or id::text=$2) for update',[channel.id,child]);
   if(reward){if(deleting||typeof patch.active==='boolean')await c.query('update public.rewards set active=$2,updated_at=now() where id=$1',[reward.id,deleting?false:patch.active]);}
   else if(!deleting)await c.query('insert into public.rewards(public_id,channel_id,title,description,cost,active) values($1,$2,$3,$4,$5,true)',[child,channel.id,str(patch.title,60,1),str(patch.description??'',160),integer(patch.cost,1,100000)]);
   return {saved:true};
  }
 }
 if(kind==='streams'){
  let l=await one(c,'select * from public.lives where public_id=$1 and deleted_at is null',[identifier]);
  if(!l&&!sub&&!deleting){const channel=await ownChannel(c,u,u.id);const playback=str(patch.playbackURL,2048,1);if(!safeStreamingUrl(playback))fail('invalid_playback_url');await c.query('insert into public.lives(public_id,channel_id,owner_id,title,description,playback_url) values($1,$2,$3,$4,$5,$6)',[identifier,channel.id,u.id,str(patch.title??'Live',120,1),str(patch.description??'',2000),playback]);l=await ctx.live(c,identifier,u);}
  else l=await ctx.live(c,identifier,u,true);
  if(!sub){if(l.owner_id!==u.id)fail('forbidden',403);if(deleting)fail('live_deletion_not_enabled',409);
   const fields={title:['title',120,1],description:['description',2000,0],thumbnailURL:['thumbnail_url',2048,0],playbackURL:['playback_url',2048,1],vodURL:['vod_url',2048,0],supportGoalLabel:['support_goal_label',60,0],supportAlertSound:['support_alert_sound',16,0],supportAlertTheme:['support_alert_theme',16,0]};
   for(const [name,[column,max,min]]of Object.entries(fields))if(patch[name]!==undefined){const value=str(patch[name],max,min);if((name==='playbackURL'||name==='vodURL')&&value&&!safeStreamingUrl(value))fail('invalid_playback_url');if(name==='thumbnailURL'&&value&&!safeImageUrl(value))fail('invalid_thumbnail_url');if(name==='supportAlertSound'&&!['coin','bell','pop','soft','none'].includes(value))fail('invalid_input');if(name==='supportAlertTheme'&&!['classic','minimal','celebrate','neon'].includes(value))fail('invalid_input');await c.query(`update public.lives set ${column}=$2 where id=$1`,[l.id,value]);}
   for(const [name,column,min,max]of [['supportGoalCoins','support_goal_coins',0,10000000],['supportAlertMinCoins','support_alert_min_coins',1,100000],['supportAlertDurationMs','support_alert_duration_ms',2500,10000]])if(patch[name]!==undefined)await c.query(`update public.lives set ${column}=$2 where id=$1`,[l.id,integer(patch[name],min,max)]);
   if(patch.matureContent!==undefined){if(typeof patch.matureContent!=='boolean')fail('invalid_input');await c.query('update public.lives set mature_content=$2 where id=$1',[l.id,patch.matureContent]);}
   if(patch.categoryId!==undefined){const category=str(patch.categoryId,120,1);if(!await one(c,'select id from public.categories where active and (id=$1 or name=$1)',[category]))fail('invalid_category');await c.query('update public.lives set category_id=(select id from public.categories where active and (id=$2 or name=$2) order by id limit 1) where id=$1',[l.id,category]);}
   for(const [name,column]of [['raidTargetStreamId','raid_target_live_id'],['hostTargetStreamId','host_target_live_id']])if(patch[name]!==undefined){const target=patch[name]?await ctx.live(c,patch[name],u):null;if(target?.id===l.id)fail('invalid_target');await c.query(`update public.lives set ${column}=$2 where id=$1`,[l.id,target?.id??null]);}
   if(patch.status==='live'||patch.status==='offline'||patch.status==='ended')await ctx.executePlatform(c,identity,'live.state',{liveId:identifier,status:patch.status==='live'?'live':'ended'});return {saved:true};
  }
  if(sub==='chat')return ctx.executePlatform(c,identity,deleting?'chat.delete':'chat.send',deleting?{liveId:identifier,messageId:child}:{liveId:identifier,text:patch.text,requestKey:child});
  if(sub==='chatBans')return ctx.executePlatform(c,identity,'chat.ban',{liveId:identifier,uid:child,kind:deleting?'revoke':patch.reason==='mute'?'mute':'ban',minutes:10,reason:''});
  if(sub==='chatConfig')return ctx.executePlatform(c,identity,'chat.pin',{liveId:identifier,messageId:deleting?null:patch.pinnedMessageId});
  if(sub==='viewers'){owned(child);return ctx.executePlatform(c,identity,deleting?'viewer.leave':'viewer.heartbeat',{liveId:identifier});}
  if(sub==='moderators'){if(l.owner_id!==u.id)fail('forbidden',403);const target=await uid(c,child);if(!target||target.id===u.id)fail('invalid_target');if(deleting)await c.query('delete from public.live_moderators where live_id=$1 and user_id=$2',[l.id,target.id]);else await c.query('insert into public.live_moderators(live_id,user_id,added_by) values($1,$2,$3) on conflict do nothing',[l.id,target.id,u.id]);return {saved:true};}
  if(sub==='chatSettings'){
   if(!await ctx.canModerate(c,u,l))fail('forbidden',403);
   if(!['everyone','followers','members'].includes(patch.mode)||!Array.isArray(patch.blockedWords)||patch.blockedWords.length>40)fail('invalid_input');
   for(const name of ['allowLinks','blockExcessCaps','emergencyMode'])if(typeof patch[name]!=='boolean')fail('invalid_input');
   const words=patch.blockedWords.map(x=>str(x,50,1));
   await c.query(`insert into public.chat_settings(live_id,mode,slow_mode_seconds,allow_links,block_excess_caps,blocked_words,emergency_mode,updated_by)
    values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(live_id) do update set mode=$2,slow_mode_seconds=$3,allow_links=$4,block_excess_caps=$5,blocked_words=$6,emergency_mode=$7,updated_by=$8,updated_at=now()`,[l.id,patch.mode,integer(patch.slowModeSeconds,0,120),patch.allowLinks,patch.blockExcessCaps,words,patch.emergencyMode,u.id]);return {saved:true};
  }
  if(sub==='polls'){
   if(!await ctx.canModerate(c,u,l))fail('forbidden',403);
   const poll=await one(c,'select * from public.polls where live_id=$1 and (public_id=$2 or id::text=$2) for update',[l.id,child]);
   if(poll){if(poll.status!=='active'||!['closed','resolved'].includes(patch.status))fail('poll_closed',409);let result=null;if(patch.status==='resolved'){result=(await one(c,'select id from public.poll_options where poll_id=$1 and position=$2',[poll.id,integer(patch.resultIndex,0,3)]))?.id;if(!result)fail('invalid_option');}await c.query('update public.polls set status=$2,result_option_id=$3,updated_at=now() where id=$1',[poll.id,patch.status,result]);}
   else{await c.query('select id from public.lives where id=$1 for update',[l.id]);if(await one(c,"select 1 from public.polls where live_id=$1 and status='active'",[l.id]))fail('poll_already_active',409);if(!['poll','prediction'].includes(patch.kind)||l.status!=='live')fail('invalid_input');const options=[0,1,2,3].map(x=>patch['option'+x]).filter(Boolean).map(x=>str(x,50,1));if(options.length<2)fail('invalid_input');const created=await one(c,'insert into public.polls(public_id,live_id,kind,question,created_by) values($1,$2,$3,$4,$5) returning id',[child,l.id,patch.kind,str(patch.question,100,1),u.id]);for(let i=0;i<options.length;i++)await c.query('insert into public.poll_options(poll_id,position,label) values($1,$2,$3)',[created.id,i,options[i]]);}return {saved:true};
  }
 }
 if(kind==='channelProfiles'){const channel=await ownChannel(c,u,identifier);if(deleting)fail('invalid_input');const urls=['website','youtube','instagram','tiktok'].map(name=>{const value=str(patch[name]??'',2048);if(value&&!safeSocialUrl(name,value))fail('invalid_social_url');return value;});await c.query('insert into public.channel_profiles(channel_id,about,games,website,youtube,instagram,tiktok) values($1,$2,$3,$4,$5,$6,$7) on conflict(channel_id) do update set about=$2,games=$3,website=$4,youtube=$5,instagram=$6,tiktok=$7,updated_at=now()',[channel.id,str(patch.about??'',800),str(patch.games??'',160),...urls]);return {saved:true};}
 if(kind==='clips'){
  if(deleting){const result=await c.query('update public.clips set deleted_at=now() where (public_id=$1 or id::text=$1) and (streamer_id=$2 or creator_id=$2)',[identifier,u.id]);if(!result.rowCount)fail('forbidden',403);return {deleted:true};}
  const l=await ctx.live(c,patch.streamId,u);if(l.status!=='live'&&!l.vod_url)fail('clip_unavailable',409);await c.query(`insert into public.clips(public_id,live_id,streamer_id,creator_id,title,moment_seconds,source_url,thumbnail_url,mature_content,visibility) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(public_id) do nothing`,[identifier,l.id,l.owner_id,u.id,str(patch.title,80,1),integer(patch.momentSeconds,0,864000),l.vod_url||l.playback_url,l.thumbnail_url,l.mature_content,l.visibility]);return {saved:true};
 }
  if(kind==='creatorCodes'){if(!/^[a-z0-9_-]{3,24}$/.test(identifier))fail('invalid_creator');if(deleting){await c.query('delete from public.creator_codes where code=$1 and creator_id=$2',[identifier,u.id]);}else{const saved=await c.query('insert into public.creator_codes(code,creator_id) values($1,$2) on conflict(code) do update set updated_at=now() where creator_codes.creator_id=$2',[identifier,u.id]);if(!saved.rowCount)fail('creator_code_conflict',409);}return {saved:true};}
 if(kind==='rewardRedemptions'){if(patch.status!=='fulfilled')fail('invalid_input');const result=await c.query(`update public.reward_redemptions r set status='fulfilled',fulfilled_by=$2,fulfilled_at=now() from public.channels ch where ch.id=r.channel_id and ch.owner_id=$2 and (r.public_id=$1 or r.id::text=$1) and r.status='pending_fulfillment'`,[identifier,u.id]);if(!result.rowCount)fail('forbidden',403);return {fulfilled:true};}
 if(kind==='coinPromotions'){
  if(!u.admin)fail('forbidden',403);
  const existing=await one(c,'select id from public.coin_promotions where public_id=$1 or id::text=$1 for update',[identifier]);
  if(existing){if(typeof patch.active!=='boolean')fail('invalid_input');await c.query('update public.coin_promotions set active=$2,updated_at=now() where id=$1',[existing.id,patch.active]);}
  else{const start=new Date(patch.startsAt?.iso??patch.startsAt),end=new Date(patch.endsAt?.iso??patch.endsAt);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)fail('invalid_input');await c.query('insert into public.coin_promotions(public_id,title,description,amount,max_claims,starts_at,ends_at,created_by) values($1,$2,$3,$4,$5,$6,$7,$8)',[identifier,str(patch.title,60,1),str(patch.description??'',160),integer(patch.amount,1,10000),integer(patch.maxClaims,1,100000),start,end,u.id]);}return {saved:true};
 }
 fail('module_unavailable',501);
}
