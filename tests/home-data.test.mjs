import test from 'node:test';
import assert from 'node:assert/strict';

test('consulta inicial preserva tipos, distingue vazio de falha e usa somente acesso público', async () => {
  const originalFetch = globalThis.fetch;
  const rows = [{ document: { name: 'projects/p/databases/(default)/documents/streams/live-id', fields: {
    streamerUid: { stringValue: 'streamer-id' },
    viewerCount: { integerValue: '81' },
    matureContent: { booleanValue: false },
    status: { stringValue: 'live' }
  } } }];
  const cases = [
    { response: { ok: true, json: async () => rows }, expected: [{ id: 'live-id', streamerUid: 'streamer-id', viewerCount: '81', matureContent: false, status: 'live' }] },
    { response: { ok: true, json: async () => [{ readTime: '2026-10-07T00:00:00Z' }] }, expected: [] },
    { response: { ok: false }, expected: null },
    { response: { ok: true, json: async () => ({ error: 'invalid' }) }, expected: null },
    { response: { ok: true, json: async () => { throw new Error('bad JSON'); } }, expected: null },
    { error: new Error('offline'), expected: null }
  ];
  try {
    for (const [index, scenario] of cases.entries()) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, '/api/home-lives');
        assert.equal(options.credentials, 'same-origin');
        assert.equal(options.headers, undefined);
        if (scenario.error) throw scenario.error;
        return scenario.response;
      };
      const { initialLives } = await import(`../assets/js/home-data.js?case=${index}`);
      assert.deepEqual(await initialLives, scenario.expected);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
