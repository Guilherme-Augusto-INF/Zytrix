import { validateImageCandidate } from './media-upload-policy.js';

function imageError(code, cause) {
  return Object.assign(new Error(code, { cause }), { code });
}

function imageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(imageError('invalid-image')); };
    image.src = url;
  });
}

async function decodeImage(file) {
  try {
    return typeof createImageBitmap === 'function'
      ? await createImageBitmap(file)
      : await imageElementFromFile(file);
  } catch (cause) {
    throw imageError('invalid-image', cause);
  }
}

export async function optimizeImage(file, kind = 'profile') {
  const validation = validateImageCandidate(file, kind);
  if (!validation.ok) throw imageError(validation.code);
  const { limits } = validation;
  const decoded = await decodeImage(file);
  try {
    const sourceWidth = Number(decoded.width || decoded.naturalWidth || 0);
    const sourceHeight = Number(decoded.height || decoded.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) throw imageError('invalid-image');
    const scale = Math.min(1, limits.width / sourceWidth, limits.height / sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw imageError('image-canvas-unavailable');
    context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(imageError('image-encode-failed')), 'image/webp', limits.quality);
    });
    // Browsers can fall back to PNG when the requested encoder is unavailable.
    // Never label those bytes as WebP when sending them to Storage.
    if (blob.type !== 'image/webp') throw imageError('webp-unsupported');
    if (!blob.size) throw imageError('image-encode-failed');
    if (blob.size > limits.outputBytes) throw imageError('optimized-file-too-large');
    return blob;
  } finally {
    decoded.close?.();
  }
}
