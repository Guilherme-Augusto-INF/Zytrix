import {platformPool} from '../../server/neon/platform-pool.mjs';
import {ApiError} from '../../server/neon/platform.mjs';
import {sandboxStripe,fulfillSandboxEvent} from '../../server/neon/payments.mjs';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  let c;try{
    const {stripe}=sandboxStripe();const secret=process.env.STRIPE_WEBHOOK_SECRET;
    if(!secret?.startsWith('whsec_'))throw new ApiError('sandbox_not_configured',503);
    let raw=req.rawBody;
    if(!Buffer.isBuffer(raw)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>262144)throw new ApiError('body_too_large',413);chunks.push(Buffer.from(chunk));}raw=Buffer.concat(chunks);}
    if(raw.length>262144)throw new ApiError('body_too_large',413);
    let event;try{event=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],secret);}catch{throw new ApiError('invalid_signature',400);}
    c=await platformPool().connect();await c.query('begin');await c.query("set local lock_timeout='5s'");
    const result=await fulfillSandboxEvent(c,event);await c.query('commit');return res.status(200).json(result);
  }catch(e){if(c)await c.query('rollback').catch(()=>{});return res.status(e instanceof ApiError?e.status:503).json({error:e instanceof ApiError?e.code:'webhook_unavailable'});}finally{c?.release();}
}
