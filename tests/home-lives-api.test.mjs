import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/home-lives.js';

test('endpoint limita a consulta pública, cacheia sucesso por 5 s e não cacheia falhas', async () => {
  const originalFetch = globalThis.fetch;
  const rows = [{ readTime: '2026-10-07T00:00:00Z' }];
  try {
    for (const scenario of ['ok', 'denied', 'offline', 'invalid', 'post']) {
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        ++calls;
        assert.match(url, /\/projects\/zytrix-ca4f2\/.+:runQuery$/);
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.cache, 'no-store');
        assert.deepEqual(JSON.parse(options.body), { structuredQuery: {
          from: [{ collectionId: 'streams' }],
          where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'live' } } }
        } });
        if (scenario === 'offline') throw new Error('network');
        return { ok: scenario !== 'denied', json: async () => scenario === 'invalid' ? {} : rows };
      };
      const response = {
        headers: {}, setHeader(key, value) { this.headers[key] = value; },
        status(code) { this.code = code; return this; }, json(body) { this.body = body; }
      };
      await handler({ method: scenario === 'post' ? 'POST' : 'GET', url: '/api/home-lives?collection=users', headers: { authorization: 'ignored' } }, response);
      assert.equal(calls, scenario === 'post' ? 0 : 1);
      assert.equal(response.code, scenario === 'ok' ? 200 : scenario === 'post' ? 405 : 503);
      assert.equal(response.headers['Cache-Control'], scenario === 'ok' ? 'public, max-age=0, s-maxage=5, stale-while-revalidate=5' : 'no-store');
      if (scenario === 'ok') assert.deepEqual(response.body, rows);
      else assert.equal(response.body.error.includes('network'), false);
    }
  } finally { globalThis.fetch = originalFetch; }
});
