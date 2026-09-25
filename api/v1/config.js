import { platformEnabled } from '../../server/neon/platform-pool.mjs';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
  return res.status(200).json({postgresStaging:platformEnabled(),authentication:'firebase'});
}
