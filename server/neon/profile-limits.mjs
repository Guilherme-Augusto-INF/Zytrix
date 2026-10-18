import {createHash} from 'node:crypto';
export function createProfileLimiter({limit=120,windowMs=60000,maximum=2048,clock=Date.now}={}) {
 const buckets=new Map();
 return subject=>{
  const now=clock();for(const [key,value]of buckets)if(value.until<=now)buckets.delete(key);
  const key=createHash('sha256').update(String(subject).slice(0,256)).digest('hex');
  let bucket=buckets.get(key);
  if(!bucket){if(buckets.size>=maximum)return false;bucket={count:0,until:now+windowMs};buckets.set(key,bucket);}
  if(bucket.count>=limit)return false;bucket.count++;return true;
 };
}
// Per process only; global distributed quotas belong at the Vercel edge.
export const allowProfileRead=createProfileLimiter();
export function isPublicProfileRead(body){return ['profile.public','profile.network','profile.search','profile.get'].includes(body.action)||(body.action==='documents.read'&&body.data?.path?.[0]==='profiles');}
