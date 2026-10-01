import {auth} from './firebase.js';
import {createPlatformClient} from './staging-client.js';
import {createBackendSource} from './backend-source.js';
export const platformSource=createBackendSource();
const request=createPlatformClient(()=>auth.currentUser);
export const publicPlatform=request;
export async function financialAction(uid,action,data) {
  const slot='zytrix-request:'+uid+':'+action+':'+JSON.stringify(data);
  const requestKey=sessionStorage.getItem(slot)??crypto.randomUUID();sessionStorage.setItem(slot,requestKey);
  const result=await ownPlatform(uid,action,{...data,requestKey});
  sessionStorage.removeItem(slot);return result;
}
export async function ownPlatform(uid,action,data={}) {
  if(!uid||auth.currentUser?.uid!==uid)throw Error('authentication_required');
  const result=await request(action,data);
  if(auth.currentUser?.uid!==uid)throw Error('authentication_changed');
  return result;
}
