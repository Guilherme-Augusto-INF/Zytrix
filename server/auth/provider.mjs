import {authBase} from '../neon/neon-token.mjs';

export function authProvider() {
  const provider=process.env.ZYTRIX_AUTH_PROVIDER??'neon';
  if(!['neon','better-auth'].includes(provider))throw Error('auth_provider_invalid');
  return provider;
}
export function selfAuthURL() {
  const url=new URL(process.env.ZYTRIX_AUTH_ORIGIN);
  const local=process.env.VERCEL_ENV!=='production'&&process.env.ZYTRIX_AUTH_ALLOW_LOCALHOST==='true'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
  if((url.protocol!=='https:'&&!local)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('auth_origin_invalid');
  return url.origin+'/api/auth';
}
export function authUserTable(){return authProvider()==='better-auth'?'zytrix_auth."user"':'neon_auth."user"';}
export function authAccountTable(){return authProvider()==='better-auth'?'zytrix_auth.account':'neon_auth.account';}
export function sessionFunction(kind='active') {
  const names={active:['active_auth_session','active_better_auth_session'],revoke:['revoke_auth_session','revoke_better_auth_session'],disable:['disable_auth_identity','disable_better_auth_identity']};
  if(!Object.hasOwn(names,kind))throw Error('auth_function_invalid');
  return 'private.'+names[kind][authProvider()==='better-auth'?1:0];
}
export function expectedAuthProvider(identity){return identity?.authProvider===authProvider();}
export function publicAuthConfig(){
  if(authProvider()==='neon'){
    const url=authBase();if(!url)throw Error('neon_auth_not_configured');
    return {authentication:'neon',neonAuthUrl:url};
  }
  if(process.env.VERCEL_ENV==='production'&&process.env.ZYTRIX_MANAGED_AUTH_RETIRED!=='true')throw Error('auth_cutover_not_confirmed');
  return {authentication:'better-auth',authUrl:selfAuthURL()};
}
