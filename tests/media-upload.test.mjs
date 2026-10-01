import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_LIMITS, mediaStoragePath, validateImageCandidate, isImageUploadError } from '../assets/js/media-upload-policy.js';
import { optimizeImage } from '../assets/js/image-processing.js';

test('local image upload accepts only supported image types and bounded sizes', () => {
  assert.equal(validateImageCandidate({ type:'image/jpeg', size:1234 },'profile').ok,true);
  assert.equal(validateImageCandidate({ type:'image/png', size:1234 },'thumbnail').ok,true);
  assert.equal(validateImageCandidate({ type:'image/svg+xml', size:1234 },'profile').code,'invalid-type');
  assert.equal(validateImageCandidate({ type:'image/webp', size:IMAGE_LIMITS.profile.inputBytes+1 },'profile').code,'file-too-large');
});

function imageRuntime(t, { type = 'image/webp', size = 100, context = true, decodeError = false } = {}) {
  const previous = ['document', 'createImageBitmap'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const state = { closed: false };
  globalThis.createImageBitmap = async () => {
    if (decodeError) throw new DOMException('Invalid image data', 'InvalidStateError');
    return { width: 4000, height: 3000, close() { state.closed = true; } };
  };
  globalThis.document = { createElement() {
    const canvas = {
      getContext() { return context ? { drawImage() {} } : null; },
      toBlob(callback, requestedType) { state.requestedType = requestedType; callback(new Blob([new Uint8Array(size)], { type })); }
    };
    state.canvas = canvas;
    return canvas;
  } };
  return state;
}

test('JPG avatar and PNG thumbnail request WebP with aspect ratio and per-kind dimensions', async t => {
  const state = imageRuntime(t);
  const avatar = await optimizeImage({ type: 'image/jpeg', size: 200 }, 'profile');
  assert.equal(avatar.type, 'image/webp');
  assert.equal(state.requestedType, 'image/webp');
  assert.deepEqual([state.canvas.width, state.canvas.height], [1024, 768]);
  assert.equal(state.closed, true);
  const thumbnail = await optimizeImage({ type: 'image/png', size: 200 }, 'thumbnail');
  assert.equal(thumbnail.type, 'image/webp');
  assert.deepEqual([state.canvas.width, state.canvas.height], [1440, 1080]);
});

test('browser PNG fallback cannot be uploaded mislabeled as WebP', async t => {
  const state = imageRuntime(t, { type: 'image/png' });
  await assert.rejects(optimizeImage({ type: 'image/jpeg', size: 200 }), { code: 'webp-unsupported' });
  assert.equal(state.closed, true);
});

test('corrupted image gets a recognized upload error instead of a generic browser error', async t => {
  imageRuntime(t, { decodeError: true });
  await assert.rejects(optimizeImage({ type: 'image/png', size: 200 }), error => error.code === 'invalid-image' && isImageUploadError(error));
});

test('decoded bitmap is released when canvas creation fails', async t => {
  const state = imageRuntime(t, { context: false });
  await assert.rejects(optimizeImage({ type: 'image/png', size: 200 }), { code: 'image-canvas-unavailable' });
  assert.equal(state.closed, true);
});

test('encoded output is still bounded after resizing', async t => {
  imageRuntime(t, { size: IMAGE_LIMITS.profile.outputBytes + 1 });
  await assert.rejects(optimizeImage({ type: 'image/png', size: 200 }), { code: 'optimized-file-too-large' });
});

test('profile/live handlers can distinguish upload timeouts from Firestore errors', () => {
  for (const code of ['upload-timeout', 'image-processing-timeout', 'download-url-timeout', 'storage/bucket-not-found', 'storage/unauthorized']) {
    assert.equal(isImageUploadError({ code }), true, code);
  }
  assert.equal(isImageUploadError({ code: 'permission-denied' }), false);
  assert.equal(isImageUploadError({ code: 'unavailable' }), false);
});

test('media paths are owner-scoped and deterministic', () => {
  assert.equal(mediaStoragePath({uid:'firebase_uid-123',kind:'profile'}),'public/profiles/firebase_uid-123/avatar.webp');
  assert.equal(mediaStoragePath({uid:'firebase_uid-123',kind:'thumbnail',streamId:'live_abc'}),'public/thumbnails/firebase_uid-123/live_abc/thumbnail.webp');
  assert.throws(()=>mediaStoragePath({uid:'../escape',kind:'profile'}),/invalid-owner/);
  assert.throws(()=>mediaStoragePath({uid:'good_uid',kind:'thumbnail',streamId:'../escape'}),/invalid-stream/);
});
