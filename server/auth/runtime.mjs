import pg from 'pg';
import nodemailer from 'nodemailer';
import {Kysely,PostgresDialect} from 'kysely';
import {kyselyAdapter} from '@better-auth/kysely-adapter';
import {createCandidateAuth} from './candidate.mjs';
import {authProvider,selfAuthURL,publicAuthConfig} from './provider.mjs';

let instance,pool;
export function postgresAuthDatabase(pool){return kyselyAdapter(new Kysely({dialect:new PostgresDialect({pool})}).withSchema('zytrix_auth'),{type:'postgres'});}
export function authConnection(value) {
  const url=new URL(value);
  if(url.protocol!=='postgresql:'||decodeURIComponent(url.username)!=='zytrix_auth_service'||!url.hostname.endsWith('.neon.tech')||url.pathname!=='/neondb'||!['require','verify-full'].includes(url.searchParams.get('sslmode')))throw Error('auth_database_configuration_invalid');
  for(const key of url.searchParams.keys())if(!['sslmode','channel_binding'].includes(key))throw Error('auth_database_configuration_invalid');
  url.search='';return url.href;
}
export function selfAuth() {
  if(authProvider()!=='better-auth')throw Error('self_auth_disabled');
  publicAuthConfig();
  if(instance)return instance;
  const required=['ZYTRIX_AUTH_DATABASE_URL','ZYTRIX_AUTH_SECRET','ZYTRIX_GOOGLE_CLIENT_ID','ZYTRIX_GOOGLE_CLIENT_SECRET','ZYTRIX_SMTP_HOST','ZYTRIX_SMTP_USER','ZYTRIX_SMTP_PASSWORD','ZYTRIX_SMTP_FROM'];
  if(required.some(key=>!process.env[key]))throw Error('self_auth_not_configured');
  const port=Number(process.env.ZYTRIX_SMTP_PORT??465);
  if(![465,587].includes(port))throw Error('smtp_port_invalid');
  const mail=nodemailer.createTransport({host:process.env.ZYTRIX_SMTP_HOST,port,secure:port===465,requireTLS:true,
    auth:{user:process.env.ZYTRIX_SMTP_USER,pass:process.env.ZYTRIX_SMTP_PASSWORD},tls:{rejectUnauthorized:true},
    disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false,connectionTimeout:10000,socketTimeout:15000});
  const send=(to,subject,text)=>mail.sendMail({from:process.env.ZYTRIX_SMTP_FROM,to,subject,text});
  pool??=new pg.Pool({connectionString:authConnection(process.env.ZYTRIX_AUTH_DATABASE_URL),ssl:{rejectUnauthorized:true},max:5,connectionTimeoutMillis:5000,statement_timeout:10000,idleTimeoutMillis:10000});
  instance=createCandidateAuth({database:postgresAuthDatabase(pool),baseURL:selfAuthURL(),secret:process.env.ZYTRIX_AUTH_SECRET,
    google:{clientId:process.env.ZYTRIX_GOOGLE_CLIENT_ID,clientSecret:process.env.ZYTRIX_GOOGLE_CLIENT_SECRET},
    persistentRateLimit:true,
    allowLocalhost:process.env.ZYTRIX_AUTH_ALLOW_LOCALHOST==='true',
    sendResetPassword:({user,url})=>send(user.email,'Redefinir senha Zytrix','Use este link para redefinir sua senha: '+url),
    sendVerificationOTP:({email,otp})=>send(email,'Código Zytrix','Seu código Zytrix é: '+otp)});
  return instance;
}
