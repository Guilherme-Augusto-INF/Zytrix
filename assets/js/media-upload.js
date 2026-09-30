import { storage, storageRef, uploadBytes, getDownloadURL } from './firebase.js';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export const IMAGE_LIMITS = Object.freeze({
  profile: Object.freeze({ inputBytes: 8 * 1024 * 1024, outputBytes: 2 * 1024 * 1024, width: 1024, height: 1024, quality: 0.86 }),
  thumbnail: Object.freeze({ inputBytes: 12 * 1024 * 1024, outputBytes: 5 * 1024 * 1024, width: 1920, height: 1080, quality: 0.86 })
});

const ALLOWED_TYPES = new Set(IMAGE_ACCEPT.split(','));

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

function imageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid-image')); };
    image.src = url;
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return imageElementFromFile(file);
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('image-encode-failed')), type, quality);
  });
}

export async function optimizeImage(file, kind = 'profile') {
  const validation = validateImageCandidate(file, kind);
  if (!validation.ok) {
    const error = new Error(validation.code);
    error.code = validation.code;
    throw error;
  }
  const { limits } = validation;
  const decoded = await decodeImage(file);
  const sourceWidth = Number(decoded.width || decoded.naturalWidth || 0);
  const sourceHeight = Number(decoded.height || decoded.naturalHeight || 0);
  if (!sourceWidth || !sourceHeight) throw new Error('invalid-image');

  const scale = Math.min(1, limits.width / sourceWidth, limits.height / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('image-canvas-unavailable');
  context.drawImage(decoded, 0, 0, width, height);
  decoded.close?.();

  const blob = await canvasBlob(canvas, 'image/webp', limits.quality);
  if (blob.size > limits.outputBytes) {
    const error = new Error('optimized-file-too-large');
    error.code = 'optimized-file-too-large';
    throw error;
  }
  return blob;
}

export async function uploadPublicImage({ uid, kind, streamId = '', file }) {
  const blob = await optimizeImage(file, kind);
  const path = mediaStoragePath({ uid, kind, streamId });
  const reference = storageRef(storage, path);
  await uploadBytes(reference, blob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=3600',
    customMetadata: { ownerUid: String(uid), kind }
  });
  return getDownloadURL(reference);
}

export function imageUploadMessage(error) {
  const code = String(error?.code || error?.message || '');
  if (code.includes('file-too-large')) return 'A imagem selecionada é grande demais.';
  if (code.includes('invalid-type')) return 'Use uma imagem JPG, PNG ou WebP.';
  if (code.includes('invalid-image')) return 'O arquivo não parece ser uma imagem válida.';
  if (code.includes('storage/unauthorized')) return 'Você não tem permissão para enviar esta imagem.';
  if (code.includes('storage/canceled')) return 'Envio cancelado.';
  if (code.includes('storage/retry-limit-exceeded')) return 'O envio demorou demais. Tente novamente.';
  return 'Não foi possível enviar a imagem.';
}
