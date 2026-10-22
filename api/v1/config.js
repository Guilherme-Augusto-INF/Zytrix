import {platformEnabled} from '../../server/neon/platform-pool.mjs';
import {authProvider,publicAuthConfig} from '../../server/auth/provider.mjs';
import {selfAuth} from '../../server/auth/runtime.mjs';
export function createConfigHandler(getAuth=selfAuth){return function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 try{
  if(!platformEnabled())throw Error('not_configured');
  if(authProvider()==='better-auth')getAuth();
  return res.status(200).json({postgresEnabled:true,...publicAuthConfig()});
 }catch{return res.status(503).json({error:'auth_not_configured'});}
};}
export default createConfigHandler();
