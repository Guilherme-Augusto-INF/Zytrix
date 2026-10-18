import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeHttpsUrl,
  safeStreamingUrl,
  safeSocialUrl,
  safeImageUrl,
  strongPassword
} from '../assets/js/security.js';

test('bloqueia protocolos executáveis e HTTP', () => {
  assert.equal(safeHttpsUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpsUrl('data:text/html,boom'), '');
  assert.equal(safeHttpsUrl('http://example.com'), '');
  assert.equal(safeHttpsUrl('https://example.com/path'), 'https://example.com/path');
});

test('streaming aceita somente Twitch/Kick/YouTube em HTTPS', () => {
  assert.equal(safeStreamingUrl('https://www.twitch.tv/example'), 'https://www.twitch.tv/example');
  assert.equal(safeStreamingUrl('https://kick.com/example'), 'https://kick.com/example');
  assert.equal(safeStreamingUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(safeStreamingUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(safeStreamingUrl('https://evil.example/twitch.tv/example'), '');
  assert.equal(safeStreamingUrl('https://twitch.tv.evil.example/example'), '');
  assert.equal(safeStreamingUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), '');
});

test('redes sociais respeitam allowlist de host', () => {
  assert.ok(safeSocialUrl('youtube', 'https://www.youtube.com/@zytrix'));
  assert.equal(safeSocialUrl('youtube', 'https://evil.example/@zytrix'), '');
  assert.ok(safeSocialUrl('instagram', 'https://instagram.com/zytrix'));
  assert.equal(safeSocialUrl('instagram', 'javascript:alert(1)'), '');
});

test('imagens ficam limitadas a CDNs conhecidas', () => {
  assert.ok(safeImageUrl('https://lh3.googleusercontent.com/a/example'));
  assert.ok(safeImageUrl('https://static-cdn.jtvnw.net/previews/example.jpg'));
  assert.ok(safeImageUrl('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'));
  assert.equal(safeImageUrl('https://tracker.example/pixel.png'), '');
});

test('senha exige 8 a 128 caracteres, incluindo letra e número', () => {
  for (const length of [7, 8, 9, 10, 128, 129]) {
    assert.equal(strongPassword('a'.repeat(length - 1) + '1'), length >= 8 && length <= 128, `length ${length}`);
    assert.equal(strongPassword('1'.repeat(length)), false, `no letter, length ${length}`);
    assert.equal(strongPassword('a'.repeat(length)), false, `no number, length ${length}`);
    assert.equal(strongPassword('!'.repeat(length)), false, `symbols, length ${length}`);
  }
  assert.equal(strongPassword('Ábcdefg1'), true);
  assert.equal(strongPassword('×÷123456'), false);
  assert.equal(strongPassword(''), false);
  assert.equal(strongPassword(), false);
});


test('URLs de imagem aceitas respeitam os mesmos hosts das allowlist de imagens', () => {
  assert.equal(safeImageUrl('https://untrusted.invalid/avatar.png'),'');
  assert.ok(safeImageUrl('https://images.kick.com/sample.jpg'));
  assert.equal(safeImageUrl('https://i.imgur.com/example.png'), '');
  assert.equal(safeImageUrl('https://example.com/photo.jpg'), '');
  assert.equal(safeImageUrl('http://lh3.googleusercontent.com/image.jpg'), '');
  assert.equal(safeImageUrl('javascript:alert(1)'), '');
});
