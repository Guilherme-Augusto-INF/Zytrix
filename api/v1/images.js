import {authenticate} from '../../server/neon/auth.mjs';
import {platformPool,platformEnabled} from '../../server/neon/platform-pool.mjs';
import {ApiError} from '../../server/neon/platform.mjs';
import {imageTarget,transaction,replaceImage,removeImage} from '../../server/neon/images.mjs';
import {MAX_IMAGE_BYTES} from '../../assets/js/image-policy.js';
export const config={api:{bodyParser:false},maxDuration:60};
export async function readImageBody(req){
 if(Number(req.headers['content-length'])>MAX_IMAGE_BYTES)throw new ApiError('image_too_large',413);
 if(Buffer.isBuffer(req.body)){if(req.body.length>MAX_IMAGE_BYTES)throw new ApiError('image_too_large',413);return req.body;}
 if(Buffer.isBuffer(req.rawBody)){if(req.rawBody.length>MAX_IMAGE_BYTES)throw new ApiError('image_too_large',413);return req.rawBody;}
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_IMAGE_BYTES)throw new ApiError('image_too_large',413);chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['POST','DELETE'].includes(req.method)){res.setHeader('Allow','POST, DELETE');return res.status(405).json({error:'method_not_allowed'});}
 if(!platformEnabled()||!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({error:'image_storage_unavailable'});
 if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'cross_site_denied'});
 try{
  const identity=await authenticate(req);if(!identity)throw new ApiError('authentication_required',401);
  const url=new URL(req.url,'https://zytrix.invalid');
  if([...url.searchParams.keys()].some(x=>!['kind','liveId'].includes(x)||url.searchParams.getAll(x).length!==1))throw new ApiError('invalid_input');
  const kind=url.searchParams.get('kind'),liveId=url.searchParams.get('liveId'),pool=platformPool();
  await transaction(pool,c=>imageTarget(c,identity,kind,liveId));
  const options={pool,identity,kind,liveId};
  const result=req.method==='DELETE'?await removeImage(options):await replaceImage({...options,buffer:await readImageBody(req),name:decodeURIComponent(req.headers['x-image-name']??''),type:req.headers['content-type']??''});
  return res.status(200).json(result);
 }catch(e){if(!(e instanceof ApiError))console.error(JSON.stringify({event:'image_operation_failed',code:typeof e.code==='string'?e.code:'storage_or_decode_error'}));return res.status(e instanceof ApiError?e.status:503).json({error:e instanceof ApiError?e.code:'image_storage_unavailable'});}
}
