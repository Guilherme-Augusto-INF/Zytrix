// Run from the repository: node tests/fixtures/chat-report-actions-browser.mjs /absolute/output.html
// This isolated UI fixture never connects to Neon or submits reports.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const output = process.argv[2];
if (!output) throw new Error('Specify a scratch output HTML path');
const css = await readFile('assets/css/styles.css', 'utf8') + await readFile('assets/css/chat-report-actions.css', 'utf8');
const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
import { createChatReportActions } from './assets/js/chat-report-actions.js';
const root = document.querySelector('#fixture');
let calls = 0;
const controller = createChatReportActions(root, () => { calls++; return true; });
const uid = '5f2da840-1097-469d-b442-10d089153186';
let sequence = 0;
function add(role = '') {
 const article = document.createElement('article'); article.className = 'chat-message';
 const avatar = document.createElement('a'); avatar.href = '/usuario.html?uid=' + uid; avatar.textContent = 'G'; avatar.className='chat-avatar';
 const body = document.createElement('div'); body.className='chat-message-body';
 const meta = document.createElement('div'); meta.className='chat-message-meta';
 const name = document.createElement('a'); name.className='profile-link'; name.href=avatar.href; name.textContent='guilherme_augusto_nome_longo_' + role;
 const time = document.createElement('span'); time.textContent='14:40'; meta.append(name,time);
 const text=document.createElement('div'); text.className='chat-message-text'; text.textContent=role+' Live todo dia das 12:00 até às 18:00. <img src=x onerror=alert(1)> '+ 'mensagem longa '.repeat(8);
 body.append(meta,text); article.append(avatar,body); root.append(article);
 controller.add(article,'message-'+(++sequence),uid,uid); return article;
}
add('ADM'); add('STREAMER'); add('USUÁRIO');
document.querySelector('#add').onclick=()=>add('NOVA');
document.querySelector('#refresh').onclick=()=>{controller.beforeRender();root.replaceChildren();sequence=0;add('ADM');add('STREAMER');add('USUÁRIO');};
document.querySelector('#tests').onclick=async()=>{
 const results=[];const check=(name,ok)=>results.push((ok?'PASS ':'FAIL ')+name);
 await Promise.resolve();const buttons=[...root.querySelectorAll('.chat-report-trigger')];
 check('availability cached',calls===1);check('controller reused',createChatReportActions(root,()=>false)===controller);
 check('one trigger per message',buttons.length===root.children.length);
 check('no injected HTML',!root.querySelector('img'));
 buttons[0].click();check('menu opens and ARIA expanded',buttons[0].getAttribute('aria-expanded')==='true'&&!document.querySelector('.chat-report-menu').hidden);
 check('menu focus',document.activeElement.getAttribute('role')==='menuitem');
 buttons[1].click();check('only one menu',buttons[0].getAttribute('aria-expanded')==='false'&&buttons[1].getAttribute('aria-expanded')==='true');
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check('Escape restores focus',document.activeElement===buttons[1]&&buttons[1].getAttribute('aria-expanded')==='false');
 buttons[0].click();document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));check('outside closes',document.querySelector('.chat-report-menu').hidden);
 buttons[0].focus();buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));check('keyboard opens',document.activeElement.getAttribute('role')==='menuitem');
 const first=document.activeElement;first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));check('keyboard navigates',document.activeElement!==first);
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));check('Tab closes',document.querySelector('.chat-report-menu').hidden);
 controller.beforeRender();const old=root.firstElementChild;old.remove();sequence=0;add('ADM');await Promise.resolve();await Promise.resolve();check('rerender restores focus',document.activeElement.className==='chat-report-trigger'&&document.activeElement!==buttons[0]);
 check('no horizontal overflow',document.documentElement.scrollWidth<=innerWidth);
 check('actions do not use global btn',!document.querySelector('.chat-report-menu .btn'));
 document.querySelector('#results').textContent=results.join('\\n');
};
` }, bundle: true, write: false, format: 'iife' });
const frame = `<html lang="pt-BR"><meta charset="UTF-8"><style>${css}</style><body style="padding:16px"><h2>Chat — fixture isolada</h2><p>Sem dados gravados / sem envio de denúncia</p><button id="tests">Executar verificações</button> <button id="add">Nova mensagem</button> <button id="refresh">Atualizar mensagens</button><pre id="results"></pre><section id="fixture" class="chat-messages" style="max-height:500px;margin-top:16px"></section><script>${result.outputFiles[0].text}</script></body></html>`;
await writeFile(output, `<html lang="pt-BR"><meta charset="UTF-8"><title>QA ações do chat</title><body style="background:#080e18;color:white;font-family:sans-serif"><h1>QA — desktop e viewport móvel</h1><iframe title="Desktop" width="870" height="780" srcdoc="${frame.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></iframe><iframe title="Mobile" width="390" height="780" srcdoc="${frame.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></iframe></body></html>`);
