import { authenticate } from '../../server/neon/auth.mjs';
import { platformEnabled, platformPool } from '../../server/neon/platform-pool.mjs';
import { ApiError, executePlatform } from '../../server/neon/platform.mjs';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
  if(!platformEnabled())return res.status(503).json({error:'staging_disabled'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return res.status(415).json({error:'json_required'});
  if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'cross_site_denied'});
  let client;
  try {
    let body;
    try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw new ApiError('invalid_input');}
    if(!body||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body),'utf8')>16384||typeof body.action!=='string'||body.action.length>64)throw new ApiError('invalid_input');
    const identity=await authenticate(req);
    client=await platformPool().connect();
    await client.query('begin');
    await client.query("set local lock_timeout='5s'");
    const result=await executePlatform(client,identity,body.action,body.data);
    await client.query('commit');return res.status(200).json(result);
  } catch(e) {
    if(client)await client.query('rollback').catch(()=>{});
    const status=e instanceof ApiError?e.status:e.code==='23505'?409:503;
    return res.status(status).json({error:e instanceof ApiError?e.code:e.code==='23505'?'conflict':'service_unavailable'});
  } finally {client?.release();}
}
