import { storage, storageRef, uploadBytesResumable, getDownloadURL } from './firebase.js';
import { mediaStoragePath } from './media-upload-policy.js';
import { optimizeImage } from './image-processing.js';
export { optimizeImage } from './image-processing.js';
export { isImageUploadError } from './media-upload-policy.js';
export { IMAGE_ACCEPT, IMAGE_LIMITS, mediaStoragePath, validateImageCandidate } from './media-upload-policy.js';

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
  if (code.includes('empty-file') || code.includes('missing-file')) return 'Selecione um arquivo de imagem válido.';
  if (code.includes('webp-unsupported')) return 'Seu navegador não conseguiu converter a imagem. Atualize o navegador ou use a opção de URL.';
  if (code.includes('image-canvas-unavailable') || code.includes('image-encode-failed')) return 'Não foi possível converter a imagem. Tente outro arquivo ou navegador.';
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
