import { decode } from './lib.mjs';

// Explicitly scoped to the rule approved by the user. Never modifies source rows.
export function resolveApprovedUsername(rows, authUsers) {
  const profiles = rows.filter(r => /^profiles\/[^/]+$/.test(r.path));
  const key = r => String(decode(r.data).username ?? '').trim().toLowerCase();
  const group = profiles.filter(r => key(r) === 'prendedor');
  if (group.length !== 2) throw new Error('Approved resolution requires exactly two matching profiles');
  if (profiles.some(r => key(r) === 'prendedor-2')) throw new Error('Proposed username is already occupied');
  const dated = group.map(r => {
    const matches = authUsers.filter(u => (u.uid ?? u.localId) === r.path.split('/')[1]);
    if (matches.length !== 1 || typeof matches[0].createdAt !== 'string') throw new Error('Unique Auth creation evidence required');
    const created = Date.parse(matches[0].createdAt);
    if (!Number.isFinite(created) || created <= 0) throw new Error('Invalid Auth creation evidence');
    return { row: r, created };
  }).sort((a,b) => a.created - b.created);
  if (dated[0].created === dated[1].created) throw new Error('Tied Auth creation dates require review');
  const renamedPath = dated[1].row.path;
  return {
    rows: rows.map(r => r.path === renamedPath ? { ...r, data: { ...r.data, username: 'prendedor-2' } } : r),
    audit: { rule: 'oldest-auth-keeps-prendedor', renamedPath, retainedPath: dated[0].row.path,
      originalUsername: decode(dated[1].row.data).username, destinationUsername: 'prendedor-2' }
  };
}
