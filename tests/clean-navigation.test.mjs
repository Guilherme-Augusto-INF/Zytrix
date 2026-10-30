import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { normalizePageUrl, normalizeDocumentNavigation } from '../scripts/clean-navigation.mjs';

const htmlFiles = new Set(['index.html','login.html','perfil.html','usuario.html','faq.html']);

test('normalizes only real static pages without changing query strings and fragments', () => {
  assert.equal(normalizePageUrl('index.html',htmlFiles),'/');
  assert.equal(normalizePageUrl('/login.html?redirect=%2Fperfil#form',htmlFiles),'/login?redirect=%2Fperfil#form');
  assert.equal(normalizePageUrl('https://zytrix-lives.vercel.app/usuario.html?uid=123',htmlFiles),
    'https://zytrix-lives.vercel.app/usuario?uid=123');
  for (const unchanged of ['/api/v1/health.js','https://example.com/login.html','/missing.html',
    '#faq','/assets/js/login.html','/perfil','mailto:hello@example.com']) {
    assert.equal(normalizePageUrl(unchanged,htmlFiles),unchanged);
  }
});

test('rewrites HTML navigation, canonical links, Open Graph URLs and structured data only', () => {
  const input = '<a href="login.html?redirect=%2Fperfil">Entrar</a>' +
    '<a href="/api/v1/health.js">API</a>' +
    '<link rel="canonical" href="https://zytrix-lives.vercel.app/faq.html">' +
    '<meta property="og:url" content="https://zytrix-lives.vercel.app/faq.html">' +
    '<script type="application/ld+json">{"url":"https://zytrix-lives.vercel.app/faq.html#faq"}</script>' +
    '<script>const callback = "login.html";</script>';
  const output = normalizeDocumentNavigation(input,htmlFiles);
  assert.match(output,/href="\/login\?redirect=%2Fperfil"/);
  assert.match(output,/href="\/api\/v1\/health\.js"/);
  assert.match(output,/href="https:\/\/zytrix-lives\.vercel\.app\/faq"/);
  assert.match(output,/content="https:\/\/zytrix-lives\.vercel\.app\/faq"/);
  assert.match(output,/"url":"https:\/\/zytrix-lives\.vercel\.app\/faq#faq"/);
  assert.match(output,/const callback = "login\.html"/);
  assert.equal(normalizeDocumentNavigation(output,htmlFiles),output);
});

test('vercel configuration serves extensionless pages without redundant HTML rewrites or API rules', async () => {
  const cfg = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(cfg.cleanUrls,true);
  assert.equal(cfg.trailingSlash,false);
  assert.ok(!cfg.rewrites?.length);
  assert.deepEqual(cfg.redirects,[{source:'/index',destination:'/',permanent:true}]);
  assert.ok(cfg.crons.some(item=>item.path==='/api/v1/images-cleanup'));
  const currentPages = (await readdir(new URL('..',import.meta.url))).filter(p=>p.endsWith('.html'));
  for (const page of ['login.html','perfil.html','registro.html','admin.html','usuario.html']) {
    assert.ok(currentPages.includes(page),page);
  }
});
