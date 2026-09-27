import {authenticate} from '../../server/neon/auth.mjs';
import {platformPool} from '../../server/neon/platform-pool.mjs';
import {ApiError} from '../../server/neon/platform.mjs';
import {sandboxStripe,prepareOrder} from '../../server/neon/payments.mjs';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return res.status(415).json({error:'json_required'});
  if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'cross_site_denied'});
  let c;
  try{
    const {stripe,origin}=sandboxStripe();let data;try{data=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw new ApiError('invalid_input');}
    if(!data||typeof data!=='object'||Buffer.byteLength(JSON.stringify(data))>4096)throw new ApiError('invalid_input');
    const identity=await authenticate(req);c=await platformPool().connect();await c.query('begin');
    const order=await prepareOrder(c,identity,data);await c.query('commit');
    const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],
      line_items:[{price_data:{currency:'brl',unit_amount:order.price_cents,product_data:{name:`${order.coins} Zy Coins · sandbox`}},quantity:1}],
      client_reference_id:order.id,metadata:{zytrixOrderId:order.id},success_url:origin+'/staging.html?payment=complete',cancel_url:origin+'/staging.html?payment=cancelled'},
      {idempotencyKey:order.idempotency_key});
    if(session.livemode!==false||!session.url?.startsWith('https://checkout.stripe.com/'))throw new ApiError('invalid_sandbox_session',503);
    await c.query('update public.zy_coin_orders set provider_reference=$2 where id=$1 and status=$3',[order.id,session.id,'pending']);
    return res.status(200).json({url:session.url,sandbox:true});
  }catch(e){if(c)await c.query('rollback').catch(()=>{});return res.status(e instanceof ApiError?e.status:503).json({error:e instanceof ApiError?e.code:'checkout_unavailable'});}finally{c?.release();}
}
