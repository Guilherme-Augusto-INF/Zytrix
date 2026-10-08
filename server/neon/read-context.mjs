// This allowlist is deliberately limited to actions which never mutate data.
// PostgreSQL READ ONLY independently enforces the contract.
const reads = new Set(['auth.identity','me','documents.read','progress.get',
  'preferences.get','categories.list','categories.followed','discovery.context',
  'live.feed','lives.list','live.get','profile.get','wallet.get','chat.list',
  'notifications.list','transactions.list','admin.overview','admin.chat-summary',
  'policies.current','viewer.count','follow.count','schedules.list']);
export const isReadAction = action => reads.has(action);
const contexts = new WeakMap();
export function readContext(client) {
  const scoped = {query: (sql, args) => client.query(sql, args)};
  contexts.set(scoped, new Map());
  return scoped;
}
export const actorReads = client => contexts.get(client);
