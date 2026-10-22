import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {platformPool,platformEnabled} from './platform-pool.mjs';
import {publicProfile,profileUid,requireFriendlyProfileRoutes} from './public-profiles.mjs';
import {ApiError} from './platform.mjs';
import {allowProfileRead} from './profile-limits.mjs';
import {normalizePublicUsername,publicProfileUrl} from '../../assets/js/profile-url.js';
import {escapeHtml,escapeAttr} from '../../assets/js/html-escape.js';
import {renderStaticLayout} from '../../scripts/static-layout.mjs';

const ORIGIN='https://zytrix-lives.vercel.app';
export function profilePageSelector(rawUrl){
 const url=new URL(rawUrl,'https://zytrix.invalid');
 let segment;
 if(url.pathname.startsWith('/@'))segment=url.pathname.slice(2);
 else if(url.pathname.startsWith('/api/public-profile/'))segment=url.pathname.slice('/api/public-profile/'.length);
 if(segment!==undefined){
  let username;try{username=normalizePublicUsername(decodeURIComponent(segment));}catch{}
  if(!username)throw new ApiError('profile_not_found',404);
  // Identity is captured in the path, never a query parameter that can override a rewrite.
  return {data:{username},url,legacy:false};
 }
 if(!['/usuario','/usuario.html','/api/public-profile','/api/public-profile/'].includes(url.pathname))throw new ApiError('profile_not_found',404);
 if(url.searchParams.getAll('uid').length!==1||[...url.searchParams.keys()].some(key=>!['uid','_vercel_share'].includes(key)))throw new ApiError('profile_not_found',404);
 let uid;try{uid=profileUid(url.searchParams.get('uid'));}catch{throw new ApiError('profile_not_found',404);}
 return {data:{uid},url,legacy:true};
}
export function profileQueryNeedsCanonical(url,username){
 // Vercel preview protection and captured rewrite parameters are not app selectors.
 // Removing its share parameter causes a self-redirect on protected preview fetches.
 return [...url.searchParams].some(([key,value])=>key!=='_vercel_share'&&!(key==='username'&&normalizePublicUsername(value)===username));
}
export function renderProfileDocument(template,state){
 const p=state.profile,title=`${p.name||p.username} (@${p.username}) — Zytrix`;
 const description=(p.bio||`Perfil público de ${p.username} na Zytrix.`).slice(0,160),canonical=ORIGIN+publicProfileUrl(p.username);
 // Callback replacements keep user-controlled $&, $`, $' and $$ literal.
 let html=renderStaticLayout(template,'usuario.html').replace(/<title>[^<]*<\/title>/,()=>`<title>${escapeHtml(title)}</title>`);
 for(const [selector,value]of [['name="description"',description],['property="og:title"',title],['property="og:description"',description],['property="og:url"',canonical]])html=html.replace(new RegExp('<meta '+selector+' content="[^"]*">'),()=>`<meta ${selector} content="${escapeAttr(value)}">`);
 html=html.replace(/<link rel="canonical" href="[^"]*">/,()=>`<link rel="canonical" href="${escapeAttr(canonical)}">`);
 if(p.photoURL)html=html.replace('</head>',()=>`<meta property="og:image" content="${escapeAttr(p.photoURL)}"></head>`);
 html=html.replace('<div class="state" role="status">Carregando perfil público…</div>',()=>`<div class="state" role="status"><h1>${escapeHtml(p.name||p.username)}</h1><p>@${escapeHtml(p.username)}</p><p>${escapeHtml(p.bio||'Perfil público na Zytrix.')}</p></div>`);
 // Public projection only. Escape script terminators, even though this is inert JSON.
 const json=JSON.stringify(state).replace(/[<>&\u2028\u2029]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
 return html.replace('<script type="module" src="/assets/js/public-profile.js">',()=>`<script type="application/json" id="public-profile-data">${json}</script><script type="module" src="/assets/js/public-profile.js">`);
}
export function createProfilePageHandler({pool=platformPool,enabled=platformEnabled,allow=allowProfileRead,template=()=>readFile(join(process.cwd(),'usuario.html'),'utf8')}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, follow');res.setHeader('Content-Type','text/html; charset=utf-8');
  const finish=(status,html)=>res.status(status).end(req.method==='HEAD'?'':html);
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return finish(405,'Método não permitido.');}
  let c;
  try{
   const selector=profilePageSelector(req.url);
   const source=req.headers['x-vercel-forwarded-for']??req.socket?.remoteAddress??'anonymous';
   if(!allow(typeof source==='string'?source.split(',')[0].trim():'anonymous')){res.setHeader('Retry-After','60');throw new ApiError('rate_limited',429);}
   if(!enabled())throw new ApiError('profile_unavailable',503);
   c=await pool().connect();await c.query('begin read only');await c.query("set local lock_timeout='5s'");
   if(selector.legacy)await requireFriendlyProfileRoutes(c);
   const state=await publicProfile(c,selector.data);await c.query('commit');
   if(!state.profile)throw new ApiError('profile_not_found',404);
   const canonical=publicProfileUrl(state.profile.username);
   if(selector.legacy||(selector.url.pathname.startsWith('/@')&&(selector.url.pathname!==canonical||profileQueryNeedsCanonical(selector.url,selector.data.username)))){
    // Temporary, uncacheable: a username may change later; legacy UUID is stable.
    res.setHeader('Location',canonical);return finish(307,'');
   }
   return finish(200,renderProfileDocument(await template(),state));
  }catch(error){
   if(c)await c.query('rollback').catch(()=>{});
   const status=error instanceof ApiError?error.status:503;
   return finish(status,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Perfil indisponível — Zytrix</title><h1>Perfil indisponível</h1><p>${status===404?'Este perfil não existe ou não está disponível publicamente.':status===429?'Aguarde antes de consultar mais perfis.':'Tente novamente mais tarde.'}</p><a href="/index.html">Voltar ao início</a></html>`);
  }finally{c?.release();}
 };
}
