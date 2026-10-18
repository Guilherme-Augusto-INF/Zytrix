import {betterAuth} from 'better-auth';
import {admin, emailOTP, jwt, organization} from 'better-auth/plugins';
import {passwordPolicyHook} from './password-policy-hook.mjs';

// Rehearsal factory, deliberately not connected to any application route.
// Supply an isolated database adapter and explicit delivery/provider settings.
export function createCandidateAuth({database, baseURL, secret, google, sendResetPassword, sendVerificationOTP}) {
  const url=new URL(baseURL);
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)
    throw Error('candidate_auth_origin_required');
  if(!database || typeof secret!=='string' || secret.length<32 || !google?.clientId || !google?.clientSecret
    || typeof sendResetPassword!=='function' || typeof sendVerificationOTP!=='function')
    throw Error('candidate_auth_configuration_incomplete');
  return betterAuth({
    database, baseURL, secret,
    trustedOrigins:[url.origin],
    advanced:{database:{generateId:'uuid'}},
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
