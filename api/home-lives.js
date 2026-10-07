export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.setHeader('Cache-Control', 'no-store');
    return response.status(405).json({ error: 'Método não permitido.' });
  }
  try {
    // No admin credentials: this fixed public query still uses Firestore Rules.
    const upstream = await fetch('https://firestore.googleapis.com/v1/projects/zytrix-ca4f2/databases/(default)/documents:runQuery', {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'streams' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'live' } } }
      } })
    });
    if (!upstream.ok) throw new Error('Catalogue unavailable');
    const rows = await upstream.json();
    if (!Array.isArray(rows)) throw new Error('Invalid catalogue');
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=5');
    return response.status(200).json(rows);
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({ error: 'Catálogo temporariamente indisponível.' });
  }
}
