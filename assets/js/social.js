import { platformSource, ownPlatform, publicPlatform } from './platform-backend.js';
import { db, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, limit, Timestamp } from './client.js';
export function selectedStreamId() {
    return new URLSearchParams(location.search).get('stream')
        || localStorage.getItem('zytrixSelectedStream')
        || '';
}
export async function isFollowing(uid, channelId) {
    if (!uid || !channelId)
        return false;
    const snap = await getDoc(doc(db, 'users', uid, 'following', channelId));
    return snap.exists();
}
export function watchFollowing(uid, callback, onError = console.error) {
    return onSnapshot(collection(db, 'users', uid, 'following'), snap => callback(new Set(snap.docs.map(item => item.id)), snap), onError);
}
function activePresenceCount(docs) {
    const threshold = Date.now() - 90000;
    return docs.filter(data => {
        const millis = data.lastSeen?.toMillis?.() || 0;
        return millis >= threshold;
    }).length;
}
export async function startViewerPresence(uid, streamId) {
    if (!uid || !streamId)
        return () => { };
    const presenceRef = doc(db, 'streams', streamId, 'viewers', uid);
    const existing = await getDoc(presenceRef);
    if (existing.exists()) {
        await updateDoc(presenceRef, { lastSeen: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 1000) });
    }
    else {
        await setDoc(presenceRef, {
            uid,
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 1000)
        });
    }
    const heartbeat = async () => {
        try {
            await updateDoc(presenceRef, { lastSeen: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 1000) });
        }
        catch (error) {
            console.warn('Não foi possível atualizar a presença do espectador.', error);
        }
    };
    const timer = setInterval(heartbeat, 30000);
    return () => {
        clearInterval(timer);
        deleteDoc(presenceRef).catch(() => { });
    };
}
export async function setFollowState(uid, channelId, following) {
    return (() => ownPlatform(uid, 'follow.set', { channelId, following }))();
}
export function watchActiveViewers(liveId, callback, onError) {
    return platformSource.watch({ neon: async () => (await publicPlatform('viewer.count', { liveId })).count,
        onData: callback, onError, pollMs: 15000 });
}
export function watchFollowerCount(channelId, callback, onError) {
    return platformSource.watch({ neon: async () => (await publicPlatform('follow.count', { channelId })).count,
        onData: callback, onError });
}
