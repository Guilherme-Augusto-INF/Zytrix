import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderStaticLayout } from '../scripts/static-layout.mjs';

const fixture = '<!doctype html><html><head><title>Teste</title></head><body><main>OK</main></body></html>';
test('GTM consent boot is injected on all full HTML documents without inline scripts', () => {
  const html = renderStaticLayout(fixture, 'faq.html');
  assert.match(html, /<script src="\/assets\/js\/gtm-consent\.js" defer><\/script>/);
  assert.match(html, /data-zytrix-gtm-consent rel="stylesheet" href="\/assets\/css\/gtm-consent\.css"/);
  assert.equal((html.match(/gtm-consent\.js/g) || []).length, 1);
  assert.ok(html.indexOf('gtm-consent.js') < html.indexOf('</head>'));
  assert.ok(!html.includes('googletagmanager.com/gtm.js'));
});
test('GTM consent boot is idempotent in the layout', () => {
  const once = renderStaticLayout(fixture, 'faq.html');
  assert.equal(renderStaticLayout(once, 'faq.html'), once);
});
test('basic consent gate and restrictive ad consent are present', () => {
  const source = readFileSync('assets/js/gtm-consent.js', 'utf8');
  assert.match(source, /GTM-M44CGG92/);
  assert.match(source, /ad_storage: 'denied'/);
  assert.match(source, /ad_user_data: 'denied'/);
  assert.match(source, /ad_personalization: 'denied'/);
  assert.match(source, /if \(choice === 'accepted'\) enableMetrics\(\)/);
  assert.match(source, /if \(active\) return/);
  assert.match(source, /location\.reload\(\)/);
});
test('CSP permits GTM without allowing general inline JavaScript', () => {
  const cfg = JSON.parse(readFileSync('vercel.json','utf8'));
  const csp = cfg.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com https:\/\/www\.googletagmanager\.com/);
  assert.ok(!csp.includes("script-src 'unsafe-inline'"));
});
