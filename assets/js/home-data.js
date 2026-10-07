// Start the public catalogue request independently of the Firebase SDK graph.
// Unauthenticated REST reads use the same Firestore Security Rules as the SDK.
export const initialLives = fetch('https://firestore.googleapis.com/v1/projects/zytrix-ca4f2/databases/(default)/documents:runQuery', {
  method: 'POST',
  credentials: 'omit',
  cache: 'no-store',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'streams' }],
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'live' } } }
  } })
}).then(async response => {
  if (!response.ok) return null;
  const rows = await response.json();
  if (!Array.isArray(rows)) return null;
  return rows.filter(row => row.document).map(({ document }) => ({
    id: document.name.split('/').pop(),
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key,
      value.stringValue ?? value.booleanValue ?? value.integerValue ?? value.doubleValue ?? null
    ]))
  }));
}).catch(() => null);
