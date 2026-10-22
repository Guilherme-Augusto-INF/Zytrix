import {createAuthMiddleware, APIError} from 'better-auth/api';
import {strongPassword} from '../../assets/js/security.js';

// For a self-hosted Better Auth server only. The managed Neon SDK cannot install
// this hook. No current application route imports or enables this module.
export function passwordPolicyHook() {
  return createAuthMiddleware(async context => {
    const field = context.path === '/sign-up/email' || (context.path === '/admin/create-user' && context.body?.password !== undefined) ? 'password'
      : ['/reset-password', '/change-password', '/set-password', '/admin/set-user-password'].includes(context.path) ? 'newPassword'
      : context.path === '/email-otp/reset-password' ? 'password' : null;
    if (field && (typeof context.body?.[field] !== 'string' || !strongPassword(context.body[field]))) {
      throw new APIError('BAD_REQUEST', {
        code: 'INVALID_PASSWORD_POLICY',
        message: 'Use uma senha de 8 a 128 caracteres, incluindo pelo menos uma letra e um número.'
      });
    }
  });
}
