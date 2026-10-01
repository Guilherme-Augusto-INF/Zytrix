import { storage, storageRef, uploadBytesResumable, getDownloadURL } from './firebase.js';
import { IMAGE_LIMITS, mediaStoragePath, validateImageCandidate } from './media-upload-policy.js';
export { IMAGE_ACCEPT, IMAGE_LIMITS, mediaStoragePath, validateImageCandidate } from './media-upload-policy.js';

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

function uploadWithTimeout(reference, blob, metadata, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(reference, blob, metadata);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      task.cancel();
      const error = new Error('upload-timeout');
      error.code = 'upload-timeout';
      reject(error);
    }, timeoutMs);

    task.on('state_changed',
      () => {},
      error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(task.snapshot.ref);
      }
    );
  });
}

function promiseWithTimeout(promise, timeoutMs, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      reject(error);
    }, timeoutMs);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

export async function uploadPublicImage({ uid, kind, streamId = '', file }) {
  const blob = await promiseWithTimeout(optimizeImage(file, kind), 12000, 'image-processing-timeout');
  const path = mediaStoragePath({ uid, kind, streamId });
  const reference = storageRef(storage, path);
  const uploadedRef = await uploadWithTimeout(reference, blob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=3600',
    customMetadata: { ownerUid: String(uid), kind }
  });
  return promiseWithTimeout(getDownloadURL(uploadedRef), 10000, 'download-url-timeout');
}

export function imageUploadMessage(error) {
  const code = String(error?.code || error?.message || '');
  if (code.includes('file-too-large')) return 'A imagem selecionada é grande demais.';
  if (code.includes('invalid-type')) return 'Use uma imagem JPG, PNG ou WebP.';
  if (code.includes('invalid-image')) return 'O arquivo não parece ser uma imagem válida.';
  if (code.includes('storage/unauthorized')) return 'Você não tem permissão para enviar esta imagem.';
  if (code.includes('storage/canceled')) return 'Envio cancelado.';
  if (code.includes('upload-timeout')) return 'O Firebase Storage não respondeu ao envio em 20 segundos. Verifique se o Storage está ativado e se as regras foram publicadas.';
  if (code.includes('image-processing-timeout')) return 'A imagem demorou demais para ser processada. Tente uma imagem menor.';
  if (code.includes('download-url-timeout')) return 'A imagem foi enviada, mas o Firebase não retornou a URL. Recarregue a página e tente novamente.';
  if (code.includes('storage/bucket-not-found')) return 'O bucket do Firebase Storage não foi encontrado. Confira a configuração do projeto.';
  if (code.includes('storage/project-not-found')) return 'O projeto do Firebase Storage não foi encontrado.';
  if (code.includes('storage/retry-limit-exceeded')) return 'O envio demorou demais. Tente novamente.';
  return 'Não foi possível enviar a imagem.';
}
