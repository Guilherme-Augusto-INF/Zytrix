import { platformSource, ownPlatform } from './platform-backend.js';
import { auth, db, doc, collection, getDoc, runTransaction, serverTimestamp } from './client.js';
import { validateReport, reportKey, targetPath, RESOLUTIONS } from './report-model.js';
export async function reportAvailability() {
    const s = await getDoc(doc(db, 'governance', 'config'));
    return s.exists() && s.data().reportsEnabled === true && s.data().rulesVersion === 'governance-1';
}
export async function submitReport(input) {
    return (async () => (await ownPlatform(auth.currentUser?.uid, 'reports.submit', validateReport(input))).id)();
}
export async function closeReport(id, resolution) {
    return (() => ownPlatform(auth.currentUser?.uid, 'reports.close', { id, resolution }))();
}
