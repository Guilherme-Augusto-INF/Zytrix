import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export async function authenticate(req) {
  const value = req.headers.authorization;
  if (typeof value !== 'string' || !/^Bearer [^\s]{1,16000}$/.test(value)) return null;
  // Do not accept emulator tokens in a deployed application.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('auth_configuration_invalid');
  const app = getApps().find(app => app.name === 'zytrix-token-verifier')
    ?? initializeApp({ projectId: 'zytrix-ca4f2' }, 'zytrix-token-verifier');
  try {
    // Signature, expiration, issuer and audience are checked by the Admin SDK.
    const token = await getAuth(app).verifyIdToken(value.slice(7));
    return { uid: token.uid, emailVerified: token.email_verified === true,
      authTime: token.auth_time, email: token.email ?? null };
  } catch { return null; }
}
