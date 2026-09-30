import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

let env;
const bytes = (size = 32) => new Uint8Array(size).fill(1);

before(async () => {
  assert.match(process.env.FIREBASE_STORAGE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
  env = await initializeTestEnvironment({
    projectId: 'demo-zytrix-governance',
    storage: { rules: readFileSync('firebase/storage.rules', 'utf8') }
  });
});

after(async () => env?.cleanup());

test('profile image can only be written by its owner as WebP', async () => {
  const ownerRef = ref(env.authenticatedContext('alice').storage(), 'public/profiles/alice/avatar.webp');
  const attackerRef = ref(env.authenticatedContext('mallory').storage(), 'public/profiles/alice/avatar.webp');
  await assertSucceeds(uploadBytes(ownerRef, bytes(), { contentType: 'image/webp' }));
  await assertFails(uploadBytes(attackerRef, bytes(), { contentType: 'image/webp' }));
});

test('thumbnail path is owner scoped and rejects unsupported content', async () => {
  const storage = env.authenticatedContext('alice').storage();
  await assertSucceeds(uploadBytes(ref(storage, 'public/thumbnails/alice/live1/thumbnail.webp'), bytes(), { contentType: 'image/webp' }));
  await assertFails(uploadBytes(ref(storage, 'public/thumbnails/alice/live2/thumbnail.webp'), bytes(), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(storage, 'private/alice/file.webp'), bytes(), { contentType: 'image/webp' }));
});

test('published profile images are readable without authentication', async () => {
  const path = 'public/profiles/public-reader/avatar.webp';
  await assertSucceeds(uploadBytes(ref(env.authenticatedContext('public-reader').storage(), path), bytes(), { contentType: 'image/webp' }));
  const data = await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  assert.equal(data.byteLength, 32);
});

test('profile output size is capped by Storage rules', async () => {
  const target = ref(env.authenticatedContext('large-user').storage(), 'public/profiles/large-user/avatar.webp');
  await assertFails(uploadBytes(target, bytes(2 * 1024 * 1024 + 1), { contentType: 'image/webp' }));
});
