import {createBackendSource} from './backend-source.js';
import {guardProductionWrite} from './production-write-guard.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, EmailAuthProvider, signInWithPopup as legacy_signInWithPopup, reauthenticateWithPopup, reauthenticateWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword as legacy_createUserWithEmailAndPassword, sendEmailVerification as legacy_sendEmailVerification, sendPasswordResetEmail as legacy_sendPasswordResetEmail, signOut, deleteUser as legacy_deleteUser } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, collectionGroup, doc, getDoc, getDocs, setDoc as legacy_setDoc, updateDoc as legacy_updateDoc, deleteDoc as legacy_deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch as legacy_writeBatch, runTransaction as legacy_runTransaction, increment, Timestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const mutationSource=createBackendSource();
const setDoc=guardProductionWrite(mutationSource.staging,legacy_setDoc);
const updateDoc=guardProductionWrite(mutationSource.staging,legacy_updateDoc);
const deleteDoc=guardProductionWrite(mutationSource.staging,legacy_deleteDoc);
const runTransaction=guardProductionWrite(mutationSource.staging,legacy_runTransaction);
const createUserWithEmailAndPassword=guardProductionWrite(mutationSource.staging,legacy_createUserWithEmailAndPassword);
const deleteUser=guardProductionWrite(mutationSource.staging,legacy_deleteUser);
const sendEmailVerification=guardProductionWrite(mutationSource.staging,legacy_sendEmailVerification);
const sendPasswordResetEmail=guardProductionWrite(mutationSource.staging,legacy_sendPasswordResetEmail);
const signInWithPopup=guardProductionWrite(mutationSource.staging,legacy_signInWithPopup);
function writeBatch(...args){const batch=legacy_writeBatch(...args);const wrapper={};for(const method of ['set','update','delete'])wrapper[method]=(...values)=>{batch[method](...values);return wrapper;};wrapper.commit=guardProductionWrite(mutationSource.staging,()=>batch.commit());return wrapper;}

export const firebaseConfig = {
    apiKey: 'AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE',
    authDomain: 'zytrix-ca4f2.firebaseapp.com',
    projectId: 'zytrix-ca4f2',
    storageBucket: 'zytrix-ca4f2.firebasestorage.app',
    messagingSenderId: '538535719632',
    appId: '1:538535719632:web:b8a5de998ca8d1db00a4d5',
    measurementId: 'G-422Y8YEZYX'
};
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export { onAuthStateChanged, GoogleAuthProvider, EmailAuthProvider, signInWithPopup, reauthenticateWithPopup, reauthenticateWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, deleteUser, collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, runTransaction, increment, Timestamp };
export async function ensureWallet(uid) {
    const ref = doc(db, 'wallets', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { uid, balance: 0, totalSent: 0, totalReceived: 0, lastTransactionId: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    return ref;
}
export async function getProfile(uid) {
    const snap = await getDoc(doc(db, 'profiles', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export function normalize(text = '') {
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
export function mainCategory(categoryId = '') {
    return String(categoryId).split(' - ')[0].trim();
}
export function selectStream(live) {
    localStorage.setItem('zytrixSelectedStream', live.id);
    localStorage.setItem('zytrixSelectedStreamName', live.username || 'Streamer');
    localStorage.setItem('zytrixSelectedStreamTitle', live.title || 'Transmissão');
}
