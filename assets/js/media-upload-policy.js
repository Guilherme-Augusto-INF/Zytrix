export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export const IMAGE_LIMITS = Object.freeze({
  profile: Object.freeze({ inputBytes: 8 * 1024 * 1024, outputBytes: 2 * 1024 * 1024, width: 1024, height: 1024, quality: 0.86 }),
  thumbnail: Object.freeze({ inputBytes: 12 * 1024 * 1024, outputBytes: 5 * 1024 * 1024, width: 1920, height: 1080, quality: 0.86 })
});

const ALLOWED_TYPES = new Set(IMAGE_ACCEPT.split(','));

const IMAGE_ERROR_CODES = new Set([
  'invalid-kind', 'missing-file', 'invalid-type', 'empty-file', 'file-too-large',
  'invalid-owner', 'invalid-stream', 'invalid-image', 'image-canvas-unavailable',
  'image-encode-failed', 'webp-unsupported', 'optimized-file-too-large',
  'upload-timeout', 'image-processing-timeout', 'download-url-timeout'
]);

export function isImageUploadError(error) {
  const code = String(error?.code || error?.message || '');
  return code.startsWith('storage/') || IMAGE_ERROR_CODES.has(code);
}

export function validateImageCandidate(file, kind = 'profile') {
  const limits = IMAGE_LIMITS[kind];
  if (!limits) return { ok: false, code: 'invalid-kind' };
  if (!file || typeof file !== 'object') return { ok: false, code: 'missing-file' };
  if (!ALLOWED_TYPES.has(String(file.type || '').toLowerCase())) return { ok: false, code: 'invalid-type' };
  const size = Number(file.size || 0);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, code: 'empty-file' };
  if (size > limits.inputBytes) return { ok: false, code: 'file-too-large' };
  return { ok: true, limits };
}

export function mediaStoragePath({ uid, kind, streamId = '' }) {
  const owner = String(uid || '').trim();
  if (!/^[A-Za-z0-9:_-]{3,160}$/.test(owner)) throw new Error('invalid-owner');
  if (kind === 'profile') return `public/profiles/${owner}/avatar.webp`;
  if (kind === 'thumbnail') {
    const live = String(streamId || '').trim();
    if (!/^[A-Za-z0-9:_-]{1,180}$/.test(live)) throw new Error('invalid-stream');
    return `public/thumbnails/${owner}/${live}/thumbnail.webp`;
  }
  throw new Error('invalid-kind');
}
