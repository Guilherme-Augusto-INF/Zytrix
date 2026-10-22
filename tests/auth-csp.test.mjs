import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const globalHeaders = vercel.headers.find(item => item.source === '/(.*)')?.headers || [];
const csp = globalHeaders.find(item => item.key === 'Content-Security-Policy')?.value || '';

test('registration and reset inputs use password limits 8 through 128',()=>{
 const html=readFileSync('registro.html','utf8');
 const input=html.match(/<input\b[^>]*id="register-password"[^>]*>/)?.[0];
 assert.ok(input);assert.match(input,/minlength="8"/);assert.match(input,/maxlength="128"/);
 const source=readFileSync('assets/js/neon-auth-page.js','utf8');
 const reset=source.match(/<input\b[^>]*id="new-password"[^>]*>/)?.[0];
 assert.ok(reset);assert.match(reset,/minlength="8"/);assert.match(reset,/maxlength="128"/);
 assert.doesNotMatch(source,/10 caracteres|minlength="10"/);
});

test('CSP libera o authDomain exato do Neon para o iframe de login', () => {
  assert.match(csp, /frame-src[^;]*https:\/\/ep-icy-night-b6fvg1ni\.neonauth\.c-2\.sa-east-1\.aws\.neon\.tech/);
  assert.match(csp, /connect-src[^;]*https:\/\/ep-icy-night-b6fvg1ni\.neonauth\.c-2\.sa-east-1\.aws\.neon\.tech/);
});

test('CSP mantém os domínios de autenticação restritos', () => {
  assert.equal(csp.includes('https://*.neonauth.c-2.sa-east-1.aws.neon.tech'), false);
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
