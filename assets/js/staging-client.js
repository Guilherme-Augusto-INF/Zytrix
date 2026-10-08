const pendingReads = new Map();
const readActions = new Set(['documents.read','progress.get','preferences.get','categories.followed','auth.identity','discovery.context']);
export function createPlatformClient(getUser) {
    return function platform(action, data = {}) {
        const user = getUser();
        const owner = user?.uid;
        const session = user?.sessionToken;
        const requestKey = readActions.has(action) ? JSON.stringify([owner,session,action,data]) : null;
        let request = requestKey && pendingReads.get(requestKey);
        if (!request) {
        request = (async () => {
        const token = user ? await user.getIdToken() : null;
        const response = await fetch('/api/v1/platform', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(user?.sessionToken ? { 'X-Neon-Session': user.sessionToken } : {}) }, body: JSON.stringify({ action, data }), credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok) {
            const error = new Error(result.error ?? 'service_unavailable');
            error.code = result.error;
            error.status = response.status;
            throw error;
        }
        return result;
        })();
        if (requestKey) {
            pendingReads.set(requestKey,request);
            const clear = () => { if(pendingReads.get(requestKey)===request) pendingReads.delete(requestKey); };
            request.then(clear,clear);
        }
        }
        return request.then(result => {
            if (getUser()?.uid !== owner || getUser()?.sessionToken !== session)
                throw Object.assign(new Error('authentication_changed'), { code: 'authentication_changed' });
            return result;
        });
    };
}
