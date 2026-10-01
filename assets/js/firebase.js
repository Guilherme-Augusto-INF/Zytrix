import {createBackendSource} from './backend-source.js';
// Load exactly one backend. An unavailable staging configuration fails closed.
const source=createBackendSource();
const backend=await import((await source.staging())?'./neon-browser.js':'./firebase-legacy.js');
export const {firebaseConfig,app,auth,db,googleProvider,onAuthStateChanged,GoogleAuthProvider,EmailAuthProvider,signInWithPopup,reauthenticateWithPopup,reauthenticateWithCredential,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,deleteUser,collection,collectionGroup,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,where,orderBy,limit,onSnapshot,serverTimestamp,writeBatch,runTransaction,increment,Timestamp,ensureWallet,getProfile,normalize,mainCategory,selectStream}=backend;
