import {betterAuth} from 'better-auth';
import {admin, emailOTP, jwt, organization} from 'better-auth/plugins';
import {passwordPolicyHook} from './password-policy-hook.mjs';

// Shared factory for the opt-in server and isolated integration tests.
// Supply a database adapter and explicit delivery/provider settings.
export function createCandidateAuth({database, baseURL, secret, google, sendResetPassword, sendVerificationOTP, persistentRateLimit=false, allowLocalhost=false}) {
  const url=new URL(baseURL);
  const local=allowLocalhost&&process.env.VERCEL_ENV!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
  if((url.protocol!=='https:'&&!local) || url.username || url.password || url.search || url.hash)
    throw Error('candidate_auth_origin_required');
  if(!database || typeof secret!=='string' || secret.length<32 || !google?.clientId || !google?.clientSecret
    || typeof sendResetPassword!=='function' || typeof sendVerificationOTP!=='function')
    throw Error('candidate_auth_configuration_incomplete');
  return betterAuth({
    database, baseURL, secret,
    trustedOrigins:[url.origin],
    advanced:{database:{generateId:'uuid'}},
    ...(persistentRateLimit?{rateLimit:{storage:'database'}}:{}),
    emailAndPassword:{enabled:true,minPasswordLength:8,maxPasswordLength:128,
      requireEmailVerification:true,autoSignIn:false,sendResetPassword},
    emailVerification:{sendOnSignUp:false,sendOnSignIn:false,autoSignInAfterVerification:true},
    socialProviders:{google},
    hooks:{before:passwordPolicyHook()},
    plugins:[
      emailOTP({sendVerificationOTP,overrideDefaultEmailVerification:true,sendVerificationOnSignUp:false}),
      admin(),
      jwt({jwt:{issuer:url.origin,audience:url.origin,expirationTime:'15m'}}),
      organization({organizationLimit:10,membershipLimit:100,creatorRole:'owner'})
    ]
  });
}
