import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const globalHeaders = vercel.headers.find(item => item.source === '/(.*)')?.headers || [];
const csp = globalHeaders.find(item => item.key === 'Content-Security-Policy')?.value || '';

test('CSP libera o authDomain exato do Firebase para o iframe de login', () => {
  assert.match(csp, /frame-src[^;]*https:\/\/zytrix-ca4f2\.firebaseapp\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/zytrix-ca4f2\.firebaseapp\.com/);
});

test('CSP continua restrita e não libera firebaseapp.com globalmente', () => {
  assert.equal(csp.includes('https://*.firebaseapp.com'), false);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});


test('auth forms fail closed before asynchronous backend initialization and never use GET for credentials',()=>{
 for(const name of ['login.html','registro.html','recuperar-senha.html']){
  const html=readFileSync(name,'utf8');assert.match(html,/<form method="post"[^>]*data-auth-form/);
  const buttons=[...html.matchAll(/<button\b[^>]*>/g)].map(x=>x[0]);assert.ok(buttons.length>0);assert.ok(buttons.every(x=>/data-auth-pending/.test(x)&&/\bdisabled\b/.test(x)));
 }
 const source=readFileSync('assets/js/auth-pages.js','utf8');assert.ok(source.lastIndexOf('button.disabled=false')>source.lastIndexOf("addEventListener('click'"));
 assert.match(readFileSync('sair.html','utf8'),/id="logout-btn" disabled/);
});
