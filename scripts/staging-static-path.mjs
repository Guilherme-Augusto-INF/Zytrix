import { resolve, sep } from 'node:path';

// The local preview serves one HTML file and *only* the assets subtree.
// Do not permit decoding encoded separators to turn an assets request into an
// arbitrary repository file (such as api, server, SQL or credential paths).
export function resolveSafePreviewPath(root, pathname) {
  if (typeof pathname !== 'string') return null;
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\\0')
      || decoded.includes('//')) return null;
  if (decoded === '/') decoded = '/staging-validation.html';
  if (decoded === '/staging-validation.html') return resolve(root,'staging-validation.html');
  if (!decoded.startsWith('/assets/')) return null;
  const assetsRoot = resolve(root,'assets');
  const candidate = resolve(root,'.' + decoded);
  return candidate.startsWith(assetsRoot + sep) ? candidate : null;
}
