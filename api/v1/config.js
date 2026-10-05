import { platformEnabled } from '../../server/neon/platform-pool.mjs';
import {authBase} from '../../server/neon/neon-token.mjs';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
  const enabled=platformEnabled();
  if(process.env.VERCEL_ENV==='preview'&&(!enabled||!authBase()))return res.status(503).json({error:'staging_not_configured'});
  return res.status(200).json({postgresStaging:enabled,authentication:enabled&&authBase()?'neon':'firebase',neonAuthUrl:enabled?authBase():null});
}
