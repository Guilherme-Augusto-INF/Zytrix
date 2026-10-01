export const TABLES=new Set('identities firebase_user_map user_accounts profiles admins categories channels channel_profiles channel_private_data lives follows channel_members live_moderators live_schedules rewards creator_codes user_preferences notification_states watch_history user_progress followed_categories creator_attributions chat_messages chat_settings live_bans live_reactions polls poll_options poll_votes wallets zy_coin_orders coin_promotions zy_coin_transactions support_alerts promotion_claims reward_redemptions clips moderation_penalties moderation_actions governance_config reports moderation_audit policy_acceptances featured_streamers'.split(' '));
export const PRIVATE=new Set(['firebase_user_map','channel_private_data']);
export const SAFE_APPLY=new Set(['follows','followed_categories','channel_profiles','user_preferences','watch_history','live_schedules']);
export function identifier(value){if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Error('Invalid identifier');return '"'+value+'"';}
export function brokenReferences(source,destination,foreignKeys){
 const failures=[];
 for(const fk of foreignKeys){if(!source[fk.child])continue;
  const parents=new Set([...(source[fk.parent]??[]),...(destination[fk.parent]??[])].map(r=>JSON.stringify(fk.parentColumns.map(k=>r[k]))));
  for(const row of source[fk.child]){const values=fk.columns.map(k=>row[k]);if(values.some(x=>x==null))continue;if(!parents.has(JSON.stringify(values)))failures.push({table:fk.child,columns:fk.columns,values,parent:fk.parent});}
 }return failures;
}
const canonical=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))||((typeof a==='number'||typeof a==='bigint')&&String(a)===String(b))||((typeof b==='number'||typeof b==='bigint')&&String(a)===String(b));
const stamp=row=>Math.max(0,...['updated_at','last_login_at','last_watched_at','username_updated_at','created_at'].map(k=>Date.parse(row[k])||0));
export function diffRows(table,source,destination,keys){
 if(!TABLES.has(table)||!keys.length)throw Error('Unreviewed table');
 for(const row of source)if(keys.some(k=>row[k]==null))throw Error('Missing source primary key');
 const key=row=>JSON.stringify(keys.map(k=>row[k]));
 const old=new Map(destination.map(r=>[key(r),r]));
 if(old.size!==destination.length||new Set(source.map(key)).size!==source.length)throw Error('Duplicate identity/key');
 const result={sourceCount:source.length,destinationCount:destination.length,new:[],changed:[],removed:[],conflicts:[],plan:[]};
 for(const row of source){const k=key(row),current=old.get(k),where=Object.fromEntries(keys.map(x=>[x,row[x]]));
  if(!current){result.new.push(where);if(SAFE_APPLY.has(table))result.plan.push({kind:'insert',row,where});else result.conflicts.push({key:where,reason:'sensitive_or_unreviewed_insert'});continue;}
  old.delete(k);const fields=Object.keys(row).filter(x=>!equal(row[x],current[x]));if(!fields.length)continue;
  const item={key:where,fields};result.changed.push(item);
  if(!SAFE_APPLY.has(table)||!stamp(row)||stamp(row)<=stamp(current))result.conflicts.push({...item,reason:!SAFE_APPLY.has(table)?'protected_data':stamp(current)>stamp(row)?'destination_newer':'unproven_source_version'});
  else result.plan.push({kind:'update',row,where});
 }
 result.removed=[...old.values()].map(row=>Object.fromEntries(keys.map(x=>[x,row[x]])));
 return result;
}
