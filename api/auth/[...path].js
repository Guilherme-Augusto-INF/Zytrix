import {fromNodeHeaders} from 'better-auth/node';
import {authProvider,selfAuthURL} from '../../server/auth/provider.mjs';
import {selfAuth} from '../../server/auth/runtime.mjs';

export const config={api:{bodyParser:false},maxDuration:30};
const reads=new Set(['get-session','token','jwks','error','callback/google']);
const writes=new Set(['sign-up/email','sign-in/email','sign-in/social','sign-out','request-password-reset','reset-password','change-password','set-password','link-social','email-otp/send-verification-otp','email-otp/verify-email']);
export function createAuthHandler(getAuth=selfAuth) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try {
      if(authProvider()!=='better-auth')return res.status(404).json({error:'not_found'});
      const path=new URL(req.url,'http://localhost').pathname.replace(/^\/api\/auth\//,'');
      if(!((req.method==='GET'&&reads.has(path))||(req.method==='POST'&&writes.has(path))))return res.status(404).json({error:'not_found'});
      if(req.method==='POST'&&req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'cross_site_denied'});
      if(Number(req.headers['content-length']??0)>16384)return res.status(413).json({error:'request_too_large'});
      let body;
      if(req.method==='POST'){
        if(req.body!==undefined){body=Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));}
        else {const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)return res.status(413).json({error:'request_too_large'});parts.push(Buffer.from(chunk));}body=Buffer.concat(parts);}
        if(body.length>16384)return res.status(413).json({error:'request_too_large'});
      }
      const auth=getAuth();
      const advertisedOrigin=process.env.ZYTRIX_AUTH_ORIGIN;
      if(advertisedOrigin&&req.headers.origin&&req.headers.origin!==advertisedOrigin)return res.status(403).json({error:'origin_denied'});
      const parsed=new URL(req.url,'http://localhost');
      const url=new URL(parsed.pathname+parsed.search,selfAuthURL());
      const response=await auth.handler(new Request(url,{method:req.method,headers:fromNodeHeaders(req.headers),...(body?{body}:{} )}));
      res.statusCode=response.status;
      for(const [key,value] of response.headers)if(key.toLowerCase()!=='set-cookie'&&key.toLowerCase()!=='cache-control')res.setHeader(key,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch{
      if(!res.headersSent)return res.status(503).json({error:'authentication_unavailable'});
      if(!res.writableEnded)res.end();
    }
  };
}
export default createAuthHandler();
