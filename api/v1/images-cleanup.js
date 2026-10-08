import {timingSafeEqual} from 'node:crypto';
import {platformPool} from '../../server/neon/platform-pool.mjs';
import {cleanupImages} from '../../server/neon/images.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const expected=Buffer.from('Bearer '+(process.env.CRON_SECRET??'')),received=Buffer.from(req.headers.authorization??'');
 if(req.method!=='GET'||!process.env.CRON_SECRET||expected.length!==received.length||!timingSafeEqual(expected,received))return res.status(401).json({error:'authentication_required'});
 try{return res.status(200).json({deleted:await cleanupImages(platformPool())});}catch{return res.status(503).json({error:'cleanup_unavailable'});}
}
