import { platformEnabled } from '../../server/neon/platform-pool.mjs';
import {authBase} from '../../server/neon/neon-token.mjs';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
  const enabled=platformEnabled();
  return res.status(200).json({postgresStaging:enabled,authentication:enabled&&authBase()?'neon':'firebase',neonAuthUrl:enabled?authBase():null});
}
