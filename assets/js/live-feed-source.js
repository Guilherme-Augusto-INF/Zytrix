// Public live feed migration boundary.
// postgresStaging=true: the read-only Neon-backed platform API is the ONLY feed source.
// postgresStaging=false: preserve the current Firestore listener without altering production.
// Any unexpected config/API response fails closed instead of silently mixing databases.
export function watchPublicLiveFeed({
  subscribeFirebase,
  onData,
  onError,
  fetchImpl = globalThis.fetch,
  pollMs = 15000,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval
}) {
  let closed = false;
  let stopFirebase = () => {};
  let timer;
  let inFlight = false;
  let previousSnapshot = null;
  const safeData = rows => { if (!closed) onData(rows); };
  const safeError = error => { if (!closed) onError(error); };

  function normalize(rows) {
    if (!Array.isArray(rows)) throw new Error('invalid_live_feed');
    return rows.map(row => {
      if (!row || typeof row.id !== 'string' || !row.id
          || typeof row.streamerUid !== 'string' || !row.streamerUid) {
        throw new Error('invalid_live_row');
      }
      return {
        id: row.id, streamerUid: row.streamerUid,
        channelId: row.channelId || '', title: row.title || '',
        description: row.description || '', categoryId: row.categoryId || '',
        thumbnailURL: row.thumbnailURL || '', playbackURL: row.playbackURL || '',
        matureContent: row.matureContent === true,
        viewerCount: Math.max(0, Number(row.viewerCount) || 0),
        username: row.username || 'Streamer', photoURL: row.photoURL || '',
        createdAt: row.createdAt ?? null
      };
    });
  }
  async function request(url, options) {
    const response = await fetchImpl(url, {
      cache: 'no-store', signal: AbortSignal.timeout(8000), ...options
    });
    if (!response.ok) throw new Error('live_feed_unavailable');
    return response.json();
  }
  async function refresh() {
    if (closed || inFlight || (typeof document !== 'undefined' && document.hidden)) return;
    inFlight = true;
    try {
      const result = await request('/api/v1/platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'live.feed', data: {} })
      });
      const normalized = normalize(result?.lives);
      const fingerprint = JSON.stringify(normalized);
      if (!closed && fingerprint !== previousSnapshot) {
        previousSnapshot = fingerprint;
        safeData(normalized);
      }
    } catch (error) {
      safeError(error);
    } finally {
      inFlight = false;
    }
  }
  const onVisible = () => {
    if (typeof document !== 'undefined' && !document.hidden) void refresh();
  };
  const ready = (async () => {
    try {
      const config = await request('/api/v1/config');
      if (closed) return;
      if (config?.postgresStaging === true) {
        await refresh();
        if (!closed) {
          timer = setIntervalImpl(() => void refresh(), pollMs);
          if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
        }
      } else if (config?.postgresStaging === false) {
        stopFirebase = subscribeFirebase(safeData, safeError) || (() => {});
        if (closed) stopFirebase();
      } else {
        throw new Error('invalid_source_config');
      }
    } catch (error) {
      safeError(error);
    }
  })();
  const stop = () => {
    closed = true;
    if (timer !== undefined) clearIntervalImpl(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    stopFirebase();
  };
  stop.ready = ready; // Supports deterministic tests without altering runtime callers.
  return stop;
}
