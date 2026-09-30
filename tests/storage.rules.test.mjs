import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

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

for (const [kind, path, maximum] of [
  ['profile', 'public/profiles/security-owner/avatar.webp', 2 * 1024 * 1024],
  ['thumbnail', 'public/thumbnails/security-owner/live/thumbnail.webp', 5 * 1024 * 1024]
]) {
  test(`${kind}: public read, owner update/delete, attacker and anonymous denial, exact size boundary`, async () => {
    const owner = ref(env.authenticatedContext('security-owner').storage(), path);
    const attacker = ref(env.authenticatedContext('security-attacker').storage(), path);
    const anonymous = ref(env.unauthenticatedContext().storage(), path);
    await assertSucceeds(uploadBytes(owner, bytes(maximum), { contentType: 'image/webp' }));
    await assertFails(uploadBytes(owner, bytes(maximum + 1), { contentType: 'image/webp' }));
    await assertFails(uploadBytes(owner, bytes(0), { contentType: 'image/webp' }));
    await assertFails(uploadBytes(owner, bytes(), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(attacker, bytes(), { contentType: 'image/webp' }));
    await assertFails(uploadBytes(anonymous, bytes(), { contentType: 'image/webp' }));
    await assertFails(deleteObject(attacker));
    await assertFails(deleteObject(anonymous));
    await assertSucceeds(uploadBytes(owner, bytes(), { contentType: 'image/webp' }));
    assert.equal((await assertSucceeds(getBytes(anonymous))).byteLength, 32);
    await assertSucceeds(deleteObject(owner));
  });
}

test('all other paths deny reads and writes even to an authenticated user', async () => {
  const paths = ['private/security-owner/file.webp', 'public/profiles/security-owner/other.webp', 'public/thumbnails/security-owner/live/other.webp'];
  await env.withSecurityRulesDisabled(async context => {
    for (const path of paths) await uploadBytes(ref(context.storage(), path), bytes(), { contentType: 'image/webp' });
  });
  for (const path of paths) {
    const owner = ref(env.authenticatedContext('security-owner').storage(), path);
    await assertFails(getBytes(owner));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
    await assertFails(uploadBytes(owner, bytes(), { contentType: 'image/webp' }));
    await assertFails(deleteObject(owner));
  }
});
