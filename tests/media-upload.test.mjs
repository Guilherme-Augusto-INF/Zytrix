import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_LIMITS, mediaStoragePath, validateImageCandidate } from '../assets/js/media-upload-policy.js';

test('local image upload accepts only supported image types and bounded sizes', () => {
  assert.equal(validateImageCandidate({ type:'image/jpeg', size:1234 },'profile').ok,true);
  assert.equal(validateImageCandidate({ type:'image/png', size:1234 },'thumbnail').ok,true);
  assert.equal(validateImageCandidate({ type:'image/svg+xml', size:1234 },'profile').code,'invalid-type');
  assert.equal(validateImageCandidate({ type:'image/webp', size:IMAGE_LIMITS.profile.inputBytes+1 },'profile').code,'file-too-large');
});

test('media paths are owner-scoped and deterministic', () => {
  assert.equal(mediaStoragePath({uid:'firebase_uid-123',kind:'profile'}),'public/profiles/firebase_uid-123/avatar.webp');
  assert.equal(mediaStoragePath({uid:'firebase_uid-123',kind:'thumbnail',streamId:'live_abc'}),'public/thumbnails/firebase_uid-123/live_abc/thumbnail.webp');
  assert.throws(()=>mediaStoragePath({uid:'../escape',kind:'profile'}),/invalid-owner/);
  assert.throws(()=>mediaStoragePath({uid:'good_uid',kind:'thumbnail',streamId:'../escape'}),/invalid-stream/);
});
