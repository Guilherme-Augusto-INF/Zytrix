import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new ApiError(code, status); };
const text = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max ? v : fail('invalid_input');
const id = value => text(value, 1, 128);
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(value) ? value : fail('invalid_request_key');
async function actor(c, identity, verified = false) {
  if (!identity) fail('authentication_required', 401);
  if (verified && !identity.emailVerified) fail('verified_email_required', 403);
  const r = await c.query(`select i.id, i.firebase_uid, exists(select 1 from public.admins a where a.user_id=i.id and a.active) as admin
    from public.identities i where i.firebase_uid=$1`, [identity.uid]);
  if (!r.rowCount) fail('account_not_migrated', 403);
  const user = r.rows[0];
  const penalty = await c.query(`select type from public.moderation_penalties where user_id=$1 and active
    and (expires_at is null or expires_at>now())`, [user.id]);
  if (penalty.rows.some(p => p.type === 'ban')) fail('account_restricted', 403);
  user.muted = penalty.rows.some(p => p.type === 'mute');
  return user;
}
async function live(c, firebaseId, user = null, lock = false) {
  const result = await c.query(`select l.*, c.visibility as channel_visibility, c.deleted_at as channel_deleted_at
    from public.lives l join public.channels c on c.id=l.channel_id where l.firebase_id=$1 and l.deleted_at is null
    ${lock ? 'for update of l' : ''}`, [id(firebaseId)]);
  if (!result.rowCount) fail('live_not_found', 404);
  const row = result.rows[0];
  if (row.channel_deleted_at || ((row.visibility === 'private' || row.channel_visibility === 'private')
    && !user?.admin && row.owner_id !== user?.id)) fail('live_not_found', 404);
  return row;
}
async function canModerate(c, user, row) {
  if (user.admin || row.owner_id === user.id) return true;
  return (await c.query('select 1 from public.live_moderators where live_id=$1 and user_id=$2', [row.id,user.id])).rowCount > 0;
}

// Caller wraps each action in a transaction. Money and chat values are derived on the server.
export async function executePlatform(c, identity, action, data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalid_input');
  switch (action) {
    case 'live.feed': {
      // Public feed is deliberately sourced from the restricted SQL view.
      // No identity lookup, no raw table access and no arbitrary client filters.
      if (Object.keys(data).length) fail('invalid_input');
      const result=await c.query(`select firebase_id as "id", streamer_uid as "streamerUid",
        channel_id as "channelId", title, description, category_id as "categoryId",
        thumbnail_url as "thumbnailURL", playback_url as "playbackURL",
        mature_content as "matureContent", created_at as "createdAt",
        viewer_count as "viewerCount", username, photo_url as "photoURL"
        from public.live_feed
        order by viewer_count desc, created_at desc, postgres_id limit 80`);
      return {lives: result.rows};
    }
    case 'live.get': {
      const u=identity?await actor(c,identity):null;const l=await live(c,data.liveId,u);
      const owner=(await c.query('select firebase_uid from public.identities where id=$1',[l.owner_id])).rows[0];
      return {live:{id:l.firebase_id,title:l.title,description:l.description,status:l.status,streamerUid:owner.firebase_uid,
        categoryId:l.category_id,playbackURL:l.playback_url,thumbnailURL:l.thumbnail_url,matureContent:l.mature_content,
        createdAt:l.created_at,startedAt:l.started_at,endedAt:l.ended_at}};
    }
    case 'live.state': {
      const u=await actor(c,identity,true);const l=await live(c,data.liveId,u,true);
      if(l.owner_id!==u.id&&!u.admin)fail('forbidden',403);
      if(!['live','ended'].includes(data.status))fail('invalid_status');
      await c.query('select id from public.channels where id=$1 for update',[l.channel_id]);
      if(data.status==='live'){
        if((await c.query("select 1 from public.lives where channel_id=$1 and status='live' and id<>$2 and deleted_at is null",[l.channel_id,l.id])).rowCount)fail('channel_already_live',409);
        await c.query("update public.lives set status='live',started_at=case when status='live' then started_at else now() end,ended_at=null where id=$1",[l.id]);
        await c.query('update public.channels set is_live=true,current_live_id=$2 where id=$1',[l.channel_id,l.id]);
      }else{
        await c.query("update public.lives set status='ended',ended_at=coalesce(ended_at,now()) where id=$1",[l.id]);
        await c.query('update public.channels set is_live=false,current_live_id=null where id=$1 and current_live_id=$2',[l.channel_id,l.id]);
      }
      return {status:data.status};
    }
    case 'viewer.heartbeat': {
      const u=await actor(c,identity);const l=await live(c,data.liveId,u);if(l.status!=='live')fail('live_not_active',409);
      await c.query("insert into private.live_viewer_sessions(live_id,user_id,expires_at) values($1,$2,now()+interval '90 seconds') on conflict(live_id,user_id) do update set last_seen_at=now(),expires_at=now()+interval '90 seconds'",[l.id,u.id]);
      const unique=await c.query('insert into private.live_unique_views(live_id,user_id) values($1,$2) on conflict do nothing',[l.id,u.id]);
      if(unique.rowCount)await c.query('update public.lives set total_views=total_views+1 where id=$1',[l.id]);
      await c.query('insert into public.watch_history(user_id,live_id) values($1,$2) on conflict(user_id,live_id) do update set last_watched_at=now()',[u.id,l.id]);
      return {active:true};
    }
    case 'viewer.leave': {
      const u=await actor(c,identity);const l=await live(c,data.liveId,u);
      await c.query('delete from private.live_viewer_sessions where live_id=$1 and user_id=$2',[l.id,u.id]);return {active:false};
    }
    case 'preferences.get':
    case 'preferences.update': {
      const u=await actor(c,identity);
      if(action==='preferences.update'){
        for(const field of ['hideMatureContent','safeMode','allowReactions','compactAlerts'])if(typeof data[field]!=='boolean')fail('invalid_input');
        await c.query(`insert into public.user_preferences(user_id,hide_mature_content,safe_mode,allow_reactions,compact_alerts) values($1,$2,$3,$4,$5)
          on conflict(user_id) do update set hide_mature_content=$2,safe_mode=$3,allow_reactions=$4,compact_alerts=$5,updated_at=now()`,[u.id,data.hideMatureContent,data.safeMode,data.allowReactions,data.compactAlerts]);
      }
      const row=(await c.query('select hide_mature_content as "hideMatureContent",safe_mode as "safeMode",allow_reactions as "allowReactions",compact_alerts as "compactAlerts" from public.user_preferences where user_id=$1',[u.id])).rows[0];
      return {preferences:row??{hideMatureContent:false,safeMode:true,allowReactions:true,compactAlerts:false}};
    }
    case 'notifications.seen': {
      const u=await actor(c,identity);if(!['zycoins','platform'].includes(data.type))fail('invalid_input');
      await c.query('insert into public.notification_states(user_id,state_type,last_seen_at) values($1,$2,now()) on conflict(user_id,state_type) do update set last_seen_at=now(),updated_at=now()',[u.id,data.type]);return {seen:true};
    }
    case 'transactions.list': {
      const u=await actor(c,identity);const r=await c.query(`select t.id,t.type,t.status,t.amount::text,t.message,t.created_at as "createdAt",f.firebase_uid as "fromUid",i.firebase_uid as "toUid"
        from public.zy_coin_transactions t left join public.identities f on f.id=t.from_user_id left join public.identities i on i.id=t.to_user_id
        where t.from_user_id=$1 or t.to_user_id=$1 order by t.created_at desc,t.id limit 100`,[u.id]);return {transactions:r.rows};
    }
    case 'chat.pin': {
      const u=await actor(c,identity,true);const l=await live(c,data.liveId,u);if(!await canModerate(c,u,l))fail('forbidden',403);
      let message=null;if(data.messageId!==null){message=(await c.query("select id from public.chat_messages where live_id=$1 and status='visible' and (id::text=$2 or firebase_id=$2)",[l.id,id(data.messageId)])).rows[0]?.id;if(!message)fail('message_not_found',404);}
      await c.query('insert into public.chat_settings(live_id,pinned_message_id,updated_by) values($1,$2,$3) on conflict(live_id) do update set pinned_message_id=$2,updated_by=$3,updated_at=now()',[l.id,message,u.id]);return {pinned:message};
    }
    case 'chat.ban': {
      const u=await actor(c,identity,true);const l=await live(c,data.liveId,u);if(!await canModerate(c,u,l))fail('forbidden',403);
      const target=(await c.query('select id from public.identities where firebase_uid=$1',[id(data.uid)])).rows[0];
      if(!target||target.id===u.id||target.id===l.owner_id)fail('invalid_target');
      if(!u.admin&&(await c.query('select 1 from public.admins where user_id=$1 and active',[target.id])).rowCount)fail('forbidden',403);
      if(!['mute','ban','revoke'].includes(data.kind))fail('invalid_input');
      if(data.kind==='revoke')await c.query('update public.live_bans set revoked_at=now(),revoked_by=$3 where live_id=$1 and user_id=$2',[l.id,target.id,u.id]);
      else{
        const minutes=data.kind==='mute'?data.minutes:null;if(data.kind==='mute'&&(!Number.isInteger(minutes)||minutes<1||minutes>1440))fail('invalid_duration');
        await c.query(`insert into public.live_bans(live_id,user_id,kind,reason,banned_by,expires_at) values($1,$2,$3,$4,$5,case when $6::int is null then null else now()+($6*interval '1 minute') end)
          on conflict(live_id,user_id) do update set kind=excluded.kind,reason=excluded.reason,banned_by=excluded.banned_by,created_at=now(),expires_at=excluded.expires_at,revoked_at=null,revoked_by=null`,[l.id,target.id,data.kind,text(data.reason??'',0,500),u.id,minutes]);
      }return {updated:true};
    }
    case 'reaction.send': {
      const u=await actor(c,identity,true);if(u.muted)fail('chat_restricted',403);const l=await live(c,data.liveId,u);if(l.status!=='live')fail('live_not_active',409);
      if(!['❤️','😂','🔥','👏','😮'].includes(data.emoji))fail('invalid_reaction');
      if((await c.query('select 1 from public.live_bans where live_id=$1 and user_id=$2 and revoked_at is null and (expires_at is null or expires_at>now())',[l.id,u.id])).rowCount)fail('chat_restricted',403);
      await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['reaction:'+l.id+':'+u.id]);
      if((await c.query("select 1 from public.live_reactions where live_id=$1 and user_id=$2 and created_at>now()-interval '2 seconds'",[l.id,u.id])).rowCount)fail('rate_limited',429);
      await c.query("insert into public.live_reactions(live_id,user_id,emoji,expires_at) values($1,$2,$3,now()+interval '10 minutes')",[l.id,u.id,data.emoji]);return {sent:true};
    }
    case 'profile.get': {
      const r = await c.query(`select i.firebase_uid as uid,p.username,p.photo_url as "photoURL",p.bio,p.created_at as "createdAt"
        from public.profiles p join public.identities i on i.id=p.user_id where i.firebase_uid=$1`, [id(data.uid)]);
      return { profile:r.rows[0]??null };
    }
    case 'me': {
      const u=await actor(c,identity);
      const r=await c.query(`select a.zytrix_id as "zytrixId",a.email,a.provider,p.username,p.photo_url as "photoURL",p.bio
        from public.user_accounts a left join public.profiles p on p.user_id=a.user_id where a.user_id=$1`,[u.id]);
      return { account:r.rows[0]??null,admin:u.admin };
    }
    case 'profile.recover': {
      // Explicit recovery for the owner of an Auth account without a profile.
      // Never infer old usernames/bios or create a profile during ordinary login.
      const u=await actor(c,identity,true);
      const username=text(data.username,2,30);
      if (!/^[A-Za-z0-9_.-]+$/.test(username)) fail('invalid_username');
      const bio=text(data.bio??'',0,500);
      if ((await c.query('select 1 from private.reserved_usernames where username_key=lower($1)',[username])).rowCount) fail('reserved_username');
      // Lock this user's identity to serialize concurrent profile recovery.
      await c.query('select id from public.identities where id=$1 for update',[u.id]);
      if (!(await c.query('select 1 from public.user_accounts where user_id=$1',[u.id])).rowCount)
        fail('account_missing',404);
      if ((await c.query('select 1 from public.profiles where user_id=$1',[u.id])).rowCount)
        fail('profile_already_exists',409);
      const created=await c.query(`insert into public.profiles(user_id,firebase_uid,username,bio)
        values($1,$2,$3,$4) on conflict do nothing returning username,bio`,
        [u.id,u.firebase_uid,username,bio]);
      if (!created.rowCount) fail('username_unavailable',409);
      return {profile:created.rows[0],recovered:true};
    }
    case 'profile.update': {
      const u=await actor(c,identity,true);
      const username=text(data.username,2,30);
      if (!/^[A-Za-z0-9_.-]+$/.test(username)) fail('invalid_username');
      const bio=text(data.bio??'',0,500);
      if ((await c.query('select 1 from private.reserved_usernames where username_key=lower($1)',[username])).rowCount) fail('reserved_username');
      const existing=await c.query('select username from public.profiles where user_id=$1 for update',[u.id]);
      if (!existing.rowCount) fail('profile_missing',404);
      if (existing.rows[0].username === username) {
        const changed=await c.query('update public.profiles set bio=$2 where user_id=$1 returning username,bio',[u.id,bio]);
        return {profile:changed.rows[0]};
      }
      // Apply the seven-day username change cooldown on the server, not in JavaScript.
      const changed=await c.query(`update public.profiles set username=$2,bio=$3,username_updated_at=now()
        where user_id=$1 and username_updated_at<=now()-interval '7 days' returning username,bio`,[u.id,username,bio]);
      if (!changed.rowCount) fail('username_cooldown',409);
      return {profile:changed.rows[0]};
    }
    case 'wallet.get':
    case 'wallet.ensure': {
      const u=await actor(c,identity,action==='wallet.ensure');
      if(action==='wallet.ensure') await c.query('insert into public.wallets(user_id) values($1) on conflict do nothing',[u.id]);
      const r=await c.query('select balance::text,total_sent::text,total_received::text from public.wallets where user_id=$1',[u.id]);
      return {wallet:r.rows[0]??null};
    }
    case 'chat.list': {
      const u=identity?await actor(c,identity):null;const l=await live(c,data.liveId,u);
      const r=await c.query(`select coalesce(m.firebase_id,m.id::text) as id,i.firebase_uid as uid,m.text,m.created_at as "createdAt",p.username,p.photo_url as "photoURL"
        from public.chat_messages m join public.identities i on i.id=m.sender_id left join public.profiles p on p.user_id=i.id
        where m.live_id=$1 and m.status='visible' order by m.created_at desc,m.id desc limit 100`,[l.id]);
      return {messages:r.rows.reverse()};
    }
    case 'chat.send': {
      const u=await actor(c,identity,true);if(u.muted)fail('chat_restricted',403);
      const l=await live(c,data.liveId,u);if(l.status!=='live')fail('live_not_active',409);
      const message=text(data.text?.trim(),1,300);const requestKey=key(data.requestKey);
      await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['chat:'+l.id+':'+u.id]);
      const duplicate=await c.query('select id,sender_id,text from public.chat_messages where live_id=$1 and firebase_id=$2',[l.id,requestKey]);
      if(duplicate.rowCount){if(duplicate.rows[0].sender_id!==u.id||duplicate.rows[0].text!==message)fail('request_key_conflict',409);return {id:duplicate.rows[0].id};}
      if((await c.query(`select 1 from public.live_bans where live_id=$1 and user_id=$2 and revoked_at is null and (expires_at is null or expires_at>now())`,[l.id,u.id])).rowCount)fail('chat_restricted',403);
      const s=(await c.query('select * from public.chat_settings where live_id=$1',[l.id])).rows[0];const moderator=await canModerate(c,u,l);
      if(!moderator&&s?.emergency_mode)fail('chat_restricted',403);
      if(!moderator&&s?.mode==='followers'&&!(await c.query('select 1 from public.follows where channel_id=$1 and follower_id=$2',[l.channel_id,u.id])).rowCount)fail('followers_only',403);
      if(!moderator&&s?.mode==='members'&&!(await c.query('select 1 from public.channel_members where channel_id=$1 and user_id=$2',[l.channel_id,u.id])).rowCount)fail('members_only',403);
      if(!moderator&&!s?.allow_links&&/(https?:\/\/|www\.)/i.test(message))fail('links_disabled');
      if(!moderator&&(s?.blocked_words??[]).some(w=>w&&message.toLowerCase().includes(w.toLowerCase())))fail('blocked_word');
      if(!moderator&&s?.block_excess_caps&&message.length>12&&message===message.toUpperCase()&&/[A-Z]/.test(message))fail('excess_caps');
      const seconds=moderator?1:Math.max(2,s?.slow_mode_seconds??0);
      if((await c.query("select 1 from public.chat_messages where live_id=$1 and sender_id=$2 and created_at>now()-($3*interval '1 second')",[l.id,u.id,seconds])).rowCount)fail('rate_limited',429);
      const r=await c.query('insert into public.chat_messages(firebase_id,live_id,sender_id,text) values($1,$2,$3,$4) returning id',[requestKey,l.id,u.id,message]);return {id:r.rows[0].id};
    }
    case 'chat.delete': {
      const u=await actor(c,identity,true);const l=await live(c,data.liveId,u);
      const m=(await c.query('select * from public.chat_messages where live_id=$1 and (firebase_id=$2 or id::text=$2) for update',[l.id,id(data.messageId)])).rows[0];
      if(!m)fail('message_not_found',404);
      if(m.sender_id!==u.id&&!await canModerate(c,u,l))fail('forbidden',403);
      if(m.sender_id!==u.id&&!u.admin&&(await c.query('select 1 from public.admins where user_id=$1 and active',[m.sender_id])).rowCount)fail('forbidden',403);
      await c.query('update public.chat_messages set status=$2,deleted_at=now(),deleted_by=$3 where id=$1',[m.id,m.sender_id===u.id?'deleted_by_author':'removed_by_moderator',u.id]);return {deleted:true};
    }
    case 'support.send': {
      const u=await actor(c,identity,true);const l=await live(c,data.liveId,u,true);
      const amount=data.amount;if(!Number.isSafeInteger(amount)||amount<1||amount>100000)fail('invalid_amount');
      const message=text(data.message??'',0,120);const requestKey='support:'+u.id+':'+key(data.requestKey);
      await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[requestKey]);
      const old=(await c.query('select id,amount,live_id,message from public.zy_coin_transactions where idempotency_key=$1',[requestKey])).rows[0];
      if(old){if(BigInt(old.amount)!==BigInt(amount)||old.live_id!==l.id||(old.message??'')!==message)fail('request_key_conflict',409);return {id:old.id,replayed:true};}
      if(l.status!=='live'||l.owner_id===u.id)fail('invalid_recipient',409);
      await c.query('insert into public.wallets(user_id) values($1) on conflict do nothing',[l.owner_id]);
      await c.query('select user_id from public.wallets where user_id=any($1::uuid[]) order by user_id for update',[[u.id,l.owner_id]]);
      const debit=await c.query('update public.wallets set balance=balance-$2,total_sent=total_sent+$2 where user_id=$1 and balance>=$2',[u.id,amount]);
      if(debit.rowCount!==1)fail('insufficient_balance',409);
      await c.query('update public.wallets set balance=balance+$2,total_received=total_received+$2 where user_id=$1',[l.owner_id,amount]);
      const transaction=randomUUID();
      await c.query(`insert into public.zy_coin_transactions(id,from_user_id,to_user_id,amount,type,status,live_id,idempotency_key,message)
        values($1,$2,$3,$4,'stream_support','completed',$5,$6,$7)`,[transaction,u.id,l.owner_id,amount,l.id,requestKey,message]);
      await c.query("insert into public.support_alerts(transaction_id,live_id,from_user_id,amount,message,expires_at) values($1,$2,$3,$4,$5,now()+interval '24 hours')",[transaction,l.id,u.id,amount,message]);return {id:transaction,replayed:false};
    }
    case 'follow.set': {
      const u=await actor(c,identity,true);if(typeof data.following!=='boolean')fail('invalid_input');
      const row=(await c.query("select id,owner_id from public.channels where firebase_id=$1 and deleted_at is null and visibility='public'",[id(data.channelId)])).rows[0];if(!row||row.owner_id===u.id)fail('invalid_channel');
      if(data.following)await c.query('insert into public.follows(follower_id,channel_id) values($1,$2) on conflict do nothing',[u.id,row.id]);
      else await c.query('delete from public.follows where follower_id=$1 and channel_id=$2',[u.id,row.id]);return {following:data.following};
    }
    default: fail('unknown_action',404);
  }
}
