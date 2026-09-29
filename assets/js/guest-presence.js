// Separate Firebase app: invisible guest presence does not sign the visitor into
// the regular Zytrix account or grant access to chat, coins or user profiles.
// Requires the Anonymous provider to be enabled in Firebase Authentication.
import { firebaseConfig } from './firebase.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const APP_NAME = 'zytrix-presence-guest';
const app = getApps().find(item => item.name === APP_NAME)
  || initializeApp(firebaseConfig, APP_NAME);
const guestAuth = getAuth(app);
const guestDb = getFirestore(app);
let identityPromise = null;

export function getGuestPresenceIdentity() {
  if (!identityPromise) {
    identityPromise = (async () => {
      const user = await new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(guestAuth, value => {
          unsubscribe();
          resolve(value);
        }, reject);
      });
      const guest = user || (await signInAnonymously(guestAuth)).user;
      return { uid: guest.uid, db: guestDb };
    })().catch(error => {
      identityPromise = null;
      throw error;
    });
  }
  return identityPromise;
}
