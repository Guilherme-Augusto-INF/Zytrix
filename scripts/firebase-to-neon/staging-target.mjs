// Verified in Neon Console: soft-water-98807259 / staging / br-wispy-scene-b6325si6.
export const stagingHost = 'ep-ancient-recipe-b65mlsad.c-2.sa-east-1.aws.neon.tech';
export function validateStagingUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid local staging connection'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== stagingHost
      || url.pathname !== '/neondb' || (url.port && url.port !== '5432')) {
    throw new Error('Connection does not match the verified staging endpoint');
  }
  const allowed = new Set(['sslmode','channel_binding']);
  for (const key of url.searchParams.keys()) if (!allowed.has(key)) throw new Error('Unexpected connection option');
  if (!['require','verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error('Verified TLS is required');
  if (!url.username || !url.password) throw new Error('Connection credentials are missing');
  // pg SSL options supplied explicitly: do not let URL sslmode override certificate validation.
  url.search = '';
  return url.toString();
}
