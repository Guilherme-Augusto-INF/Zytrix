import {ApiError} from './platform.mjs';
export async function linkVerifiedIdentity(c,identity,proof,actor,now=Date.now()){
 if(!identity||identity.authProvider!=='neon')throw new ApiError('authentication_required',401);
 if(!identity.emailVerified)throw new ApiError('verified_email_required',403);
 if(!proof||!proof.emailVerified||!Number.isFinite(proof.authTime)||proof.authTime>now/1000+30||now/1000-proof.authTime>300)throw new ApiError('fresh_dual_proof_required',403);
 const existing=await actor(c,proof,true);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['account:'+identity.subject]);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['link-account:'+existing.id]);
 if(!(await c.query('select id from neon_auth."user" where id=$1 and coalesce(banned,false)=false',[identity.subject])).rowCount)throw new ApiError('account_disabled',403);
 const mappings=(await c.query("select subject,user_id from private.external_auth_identities where provider='neon' and (subject=$1 or user_id=$2)",[identity.subject,existing.id])).rows;
 if(mappings.some(x=>x.subject!==identity.subject||x.user_id!==existing.id))throw new ApiError('identity_conflict',409);
 await c.query("insert into private.external_auth_identities(provider,subject,user_id) values('neon',$1,$2) on conflict do nothing",[identity.subject,existing.id]);
 return {uid:existing.firebase_uid,linked:true};
}
