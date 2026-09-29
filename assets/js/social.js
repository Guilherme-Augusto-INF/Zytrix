import {
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  limit,
  Timestamp
} from './firebase.js';

export function selectedStreamId() {
  return new URLSearchParams(location.search).get('stream')
    || localStorage.getItem('zytrixSelectedStream')
    || '';
}

export async function isFollowing(uid, channelId) {
  if (!uid || !channelId) return false;
  const snap = await getDoc(doc(db, 'users', uid, 'following', channelId));
  return snap.exists();
}

export async function setFollowState(uid, channelId, follow) {
  if (!uid || !channelId || uid === channelId) return;

  const followingRef = doc(db, 'users', uid, 'following', channelId);
  const followerRef = doc(db, 'channels', channelId, 'followers', uid);

  if (follow) {
    const [followingSnap, followerSnap] = await Promise.all([
      getDoc(followingRef),
      getDoc(followerRef)
    ]);

    // Repara um estado antigo/incompleto antes de criar o par de documentos.
    if (!followingSnap.exists() && followerSnap.exists()) {
      await deleteDoc(followerRef);
    }

    const batch = writeBatch(db);
    batch.set(followingRef, {
      channelId,
      followedAt: serverTimestamp()
    });
    batch.set(followerRef, {
      uid,
      followedAt: serverTimestamp()
    });
    await batch.commit();
    return;
  }

  const batch = writeBatch(db);
  batch.delete(followingRef);
  batch.delete(followerRef);
  await batch.commit();
}

export function watchFollowing(uid, callback, onError = console.error) {
  return onSnapshot(
    collection(db, 'users', uid, 'following'),
    snap => callback(new Set(snap.docs.map(item => item.id)), snap),
    onError
  );
}

export function watchFollowerCount(channelId, callback, onError = console.error) {
  return onSnapshot(
    query(collection(db, 'channels', channelId, 'followers'), limit(1001)),
    snap => callback(snap.size),
    onError
  );
}

function activePresenceCount(docs) {
  const threshold = Date.now() - 90_000;
  return docs.filter(data => {
    const millis = data.lastSeen?.toMillis?.() || 0;
    return millis >= threshold;
  }).length;
}

export function watchActiveViewers(streamId, callback, onError = console.error) {
  let cached = [];

  const recalculate = () => callback(activePresenceCount(cached));

  const unsubscribe = onSnapshot(
    query(collection(db, 'streams', streamId, 'viewers'), limit(5001)),
    snap => {
      cached = snap.docs.map(item => item.data());
      recalculate();
    },
    onError
  );

  const timer = setInterval(recalculate, 30_000);

  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}

// Each signed-in account counts once per live. A server-validated Firestore
// transaction couples the presence document with the publicly visible count.
// Sudden browser/network termination still needs a server-side expiry sweeper.
export async function startViewerPresence(uid, streamId) {
  if (!uid || !streamId) return async () => {};

  const streamRef = doc(db, 'streams', streamId);
  const presenceRef = doc(db, 'streams', streamId, 'livePresence', uid);
  // Legacy presence remains for watch-progress and creator dashboard features.
  const legacyRef = doc(db, 'streams', streamId, 'viewers', uid);
  let active = true;
  let stopped = false;

  const expiry = () => Timestamp.fromMillis(Date.now() + 2 * 60 * 1000);

  await runTransaction(db, async tx => {
    const [streamSnap, presenceSnap, legacySnap] = await Promise.all([
      tx.get(streamRef), tx.get(presenceRef), tx.get(legacyRef)
    ]);
    if (!streamSnap.exists() || streamSnap.data().status !== 'live'
        || streamSnap.data().streamerUid === uid) {
      active = false;
      return;
    }
    if (presenceSnap.exists()) {
      tx.update(presenceRef, { lastSeen: serverTimestamp(), expiresAt: expiry() });
    } else {
      tx.set(presenceRef, {
        uid, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), expiresAt: expiry()
      });
      tx.update(streamRef, { viewerCount: Math.max(0, Number(streamSnap.data().viewerCount || 0)) + 1 });
    }
    if (legacySnap.exists()) {
      tx.update(legacyRef, { lastSeen: serverTimestamp(), expiresAt: expiry() });
    } else {
      tx.set(legacyRef, {
        uid, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), expiresAt: expiry()
      });
    }
  });

  if (!active) return async () => {};

  const heartbeat = async () => {
    if (stopped) return;
    try {
      await Promise.all([
        updateDoc(presenceRef, { lastSeen: serverTimestamp(), expiresAt: expiry() }),
        updateDoc(legacyRef, { lastSeen: serverTimestamp(), expiresAt: expiry() })
      ]);
    } catch (error) {
      console.warn('Não foi possível renovar a presença.', error);
    }
  };

  const timer = setInterval(heartbeat, 30_000);

  return async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    try {
      await runTransaction(db, async tx => {
        const [streamSnap, presenceSnap, legacySnap] = await Promise.all([
          tx.get(streamRef), tx.get(presenceRef), tx.get(legacyRef)
        ]);
        if (!presenceSnap.exists()) return;
        if (streamSnap.exists() && Number(streamSnap.data().viewerCount || 0) > 0) {
          tx.update(streamRef, {
            viewerCount: Number(streamSnap.data().viewerCount) - 1
          });
          tx.delete(presenceRef);
          if (legacySnap.exists()) tx.delete(legacyRef);
        }
      });
    } catch (error) {
      // For an abrupt disconnect, a trusted expiry job must reconcile stale
      // presence; never fake a successful decrement from the browser.
      console.warn('A presença não pôde ser encerrada imediatamente.', error);
    }
  };
}
