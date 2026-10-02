import {authBase,verifyNeonToken} from './neon-token.mjs';
import {platformPool} from './platform-pool.mjs';

export async function authenticate(req) {
  const value = req.headers.authorization;
  if (typeof value !== 'string' || !/^Bearer [^\s]{1,16000}$/.test(value)) return null;
  if (authBase()) {
    const identity=await verifyNeonToken(value.slice(7));
    const sessionToken=req.headers['x-neon-session'];
    if(!identity||typeof sessionToken!=='string'||sessionToken.length<16||sessionToken.length>512)return null;
    try {
      const result=await platformPool().query('select private.active_auth_session($1::uuid,$2) as created_at',[identity.subject,sessionToken]);
      if(!result.rows[0]?.created_at)return null;
      return {...identity,sessionToken,sessionCreatedAt:new Date(result.rows[0].created_at).getTime()};
    } catch {return null;}
  }
  if (process.env.ZYTRIX_AUTH_PROVIDER === 'neon' || process.env.ZYTRIX_NEON_AUTH_URL) return null;
  return verifyFirebaseToken(value.slice(7));
}
export async function verifyFirebaseToken(value, loadAdmin = async () => {
  const [app, auth] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/auth')]);
  return { ...app, ...auth };
}) {
  // Do not accept emulator tokens in a deployed application.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('auth_configuration_invalid');
  try {
    // Load the temporary Firebase bridge only when dual proof actually needs it.
    // Its CommonJS dependencies must not prevent Neon-only functions from starting.
    const { getApps, initializeApp, getAuth } = await loadAdmin();
    const app = getApps().find(app => app.name === 'zytrix-token-verifier')
      ?? initializeApp({ projectId: 'zytrix-ca4f2' }, 'zytrix-token-verifier');
    // Signature/issuer/audience/expiry plus revocation and disabled-user status.
    // The enrollment bridge fails closed without authorized Auth read credentials.
    const token = await getAuth(app).verifyIdToken(value,true);
    return { uid: token.uid, emailVerified: token.email_verified === true,
      authTime: token.auth_time,expiresAt:token.exp, email: token.email ?? null,
      provider:token.firebase?.sign_in_provider==='google.com'?'google':token.firebase?.sign_in_provider==='password'?'password':null };
  } catch { return null; }
}
