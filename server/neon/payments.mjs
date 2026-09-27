import Stripe from 'stripe';
import {randomUUID} from 'node:crypto';
import {actor,ApiError} from './platform.mjs';
import {platformEnabled} from './platform-pool.mjs';

export const PACKAGES=Object.freeze({zy100:{coins:100,cents:490},zy500:{coins:500,cents:1490},zy1200:{coins:1200,cents:2990},zy2500:{coins:2500,cents:4990}});
export function sandboxConfig(env=process.env){
  if(env.VERCEL_ENV==='production'||env.ZYTRIX_STRIPE_SANDBOX!=='true'||!/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY??''))throw new ApiError('sandbox_not_configured',503);
  let origin;try{origin=new URL(env.ZYTRIX_STAGING_ORIGIN);}catch{throw new ApiError('sandbox_not_configured',503);}
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!(origin.protocol==='https:'||(origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname))))throw new ApiError('sandbox_not_configured',503);
  return {key:env.STRIPE_SECRET_KEY,origin:origin.origin};
}
export function sandboxStripe(){if(!platformEnabled())throw new ApiError('staging_disabled',503);const config=sandboxConfig();return {stripe:new Stripe(config.key,{maxNetworkRetries:2,timeout:15000}),origin:config.origin};}
export async function prepareOrder(c,identity,data){
  const u=await actor(c,identity,true);const pack=Object.hasOwn(PACKAGES,data.packageId)?PACKAGES[data.packageId]:null;
  if(!pack||!/^[A-Za-z0-9_-]{16,100}$/.test(data.requestKey??''))throw new ApiError('invalid_input');
  const requestKey='sandbox-checkout:'+u.id+':'+data.requestKey;
  await c.query(`insert into public.zy_coin_orders(user_id,package_id,coins,price_cents,payment_method,mode,idempotency_key)
    values($1,$2,$3,$4,'card','payment_provider',$5) on conflict(idempotency_key) do nothing`,[u.id,data.packageId,pack.coins,pack.cents,requestKey]);
  const order=(await c.query('select * from public.zy_coin_orders where idempotency_key=$1',[requestKey])).rows[0];
  if(order.package_id!==data.packageId)throw new ApiError('request_key_conflict',409);
  if(order.status!=='pending')throw new ApiError('order_not_pending',409);
  return order;
}
// Called only after Stripe verifies the raw-body webhook signature. Caller owns transaction.
export async function fulfillSandboxEvent(c,event){
  if(event.livemode!==false)throw new ApiError('live_payment_denied',403);
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return {ignored:true};
  const session=event.data?.object;
  if(session?.livemode!==false||session.mode!=='payment'||session.payment_status!=='paid')return {ignored:true};
  const orderId=session.metadata?.zytrixOrderId;
  if(!/^[a-f0-9-]{36}$/i.test(orderId??'')||typeof event.id!=='string'||!event.id.startsWith('evt_'))throw new ApiError('invalid_event');
  const order=(await c.query('select * from public.zy_coin_orders where id=$1 for update',[orderId])).rows[0];
  if(!order||!order.idempotency_key.startsWith('sandbox-checkout:')||order.mode!=='payment_provider')throw new ApiError('order_not_found',404);
  if(order.provider_reference!==session.id||session.currency!=='brl'||session.amount_total!==order.price_cents||session.client_reference_id!==order.id)throw new ApiError('payment_mismatch',409);
  if(order.status==='paid')return {replayed:true};
  if(order.status!=='pending')throw new ApiError('order_not_pending',409);
  await c.query('insert into public.wallets(user_id) values($1) on conflict do nothing',[order.user_id]);
  await c.query('update public.wallets set balance=balance+$2 where user_id=$1',[order.user_id,order.coins]);
  await c.query(`insert into public.zy_coin_transactions(id,to_user_id,amount,type,status,order_id,idempotency_key,reference,metadata)
    values($1,$2,$3,'purchase','completed',$4,$5,$6,'{"sandbox":true}')`,[randomUUID(),order.user_id,order.coins,order.id,'sandbox-purchase:'+order.id,session.id]);
  await c.query("update public.zy_coin_orders set status='paid',paid_at=now() where id=$1",[order.id]);
  await c.query('insert into private.payment_events(event_id,order_id,event_type) values($1,$2,$3)',[event.id,order.id,event.type]);
  return {credited:true};
}
