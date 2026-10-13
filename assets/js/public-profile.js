import {auth,onAuthStateChanged} from './client.js';
import {createPlatformClient} from './staging-client.js';
import {publicPlatform} from './platform-backend.js';
import {header,footer,escapeHtml,escapeAttr} from './ui.js';
import {safeImageUrl} from './security.js';
import {publicProfileUrl} from './profile-url.js';
import {reportLink} from './report-link.js';
header();footer();
// Public content never waits for, or fails because of, a stale session.
const anonymous=createPlatformClient(()=>null),root=document.querySelector('#public-profile-root');
const params=new URLSearchParams(location.search),uid=params.getAll('uid').length===1?params.get('uid')?.toLowerCase():null;
let state=null,user=null,following=false,busy=false,sessionVersion=0,networkVersion=0;
const login='/login.html?redirect='+encodeURIComponent(publicProfileUrl(uid)||'/usuario.html');
const status=message=>{const node=root.querySelector('#public-status');if(node)node.textContent=message;};
function avatar(p,large=false){const src=safeImageUrl(p.photoURL),cls=large?'public-avatar':'avatar';return src?`<img class="${cls}" src="${escapeAttr(src)}" alt="Foto de ${escapeAttr(p.username)}" width="${large?112:34}" height="${large?112:34}" referrerpolicy="no-referrer">`:`<span class="${cls}" aria-hidden="true">${escapeHtml((p.username||'U').charAt(0).toUpperCase())}</span>`;}
function actions(){
 const button=root.querySelector('#public-follow'),manage=root.querySelector('#public-manage');
 if(!button)return;
 const own=user?.uid===uid;
 button.hidden=own||!state.channel;manage.hidden=!own;
 button.disabled=busy;button.setAttribute('aria-pressed',String(following));button.textContent=busy?'Salvando…':!user?'Entrar para seguir':following?'Deixar de seguir':'Seguir canal';
}
async function followState(){
 const version=++sessionVersion;following=false;actions();
 if(!user||!state?.channel||user.uid===uid)return;
 try{const result=await publicPlatform('discovery.context');if(version!==sessionVersion)return;following=result.following.includes(uid);actions();}
 catch{if(version===sessionVersion)status('Não foi possível confirmar se você segue este canal.');}
}
async function network(kind,offset=0){
 const version=++networkVersion,section=root.querySelector('#public-network');section.hidden=false;section.setAttribute('aria-busy','true');
 if(!offset)section.innerHTML=`<h2>${kind==='followers'?'Seguidores':'Canais seguidos'}</h2><p role="status">Carregando…</p>`;
 try{const result=await anonymous('profile.network',{uid,kind,offset});if(version!==networkVersion)return;
 const list=result.profiles.map(p=>`<a class="card profile-link" href="${escapeAttr(publicProfileUrl(p.uid))}">${avatar(p)}<span>${escapeHtml(p.name||p.username)}<br><span class="muted">@${escapeHtml(p.username)}</span></span></a>`).join('');
 if(!offset)section.innerHTML=`<h2>${kind==='followers'?'Seguidores':'Canais seguidos'}</h2><div class="public-network">${list||'<p>Nenhum perfil público disponível.</p>'}</div>`;
 else section.querySelector('.public-network').insertAdjacentHTML('beforeend',list);
 section.querySelector('button')?.remove();
 if(result.hasMore&&offset<1000){const more=document.createElement('button');more.className='btn';more.textContent='Ver mais';more.onclick=()=>network(kind,offset+20);section.append(more);}
 }catch{if(version===networkVersion)status('Não foi possível carregar a lista. Tente novamente.');}
 finally{if(version===networkVersion)section.setAttribute('aria-busy','false');}
}
async function load(){
 if(!publicProfileUrl(uid)){root.innerHTML='<div class="card panel"><h1>Perfil não encontrado</h1><p>Confira o endereço deste perfil.</p><a class="btn" href="/index.html">Voltar ao início</a></div>';root.setAttribute('aria-busy','false');return;}
 try{
 state=await anonymous('profile.public',{uid});
 if(!state.profile){root.innerHTML='<div class="card panel"><h1>Perfil indisponível</h1><p>Este perfil não existe ou não está disponível publicamente.</p><a class="btn" href="/index.html">Voltar ao início</a></div>';return;}
 const {profile:p,channel,stats}=state,live=Boolean(channel?.liveId),date=new Date(p.createdAt);
 document.title=`${p.name||p.username} (@${p.username}) — Zytrix`;
 const description=(p.bio||`Perfil público de ${p.username} na Zytrix.`).slice(0,160),canonical='https://zytrix-lives.vercel.app'+publicProfileUrl(uid);
 document.querySelector('meta[name="description"]').content=description;document.querySelector('meta[property="og:title"]').content=document.title;document.querySelector('meta[property="og:description"]').content=description;document.querySelector('meta[property="og:url"]').content=canonical;document.querySelector('link[rel="canonical"]').href=canonical;
 root.innerHTML=`<section class="card panel public-profile-head">${avatar(p,true)}<div class="public-profile-copy"><span class="${live?'status-live':'status-offline'}">${live?'● AO VIVO':'OFFLINE'}</span><h1>${escapeHtml(p.name||p.username)}</h1><div class="muted">@${escapeHtml(p.username)}</div><p class="public-bio">${escapeHtml(p.bio||'Este usuário ainda não adicionou uma biografia.')}</p><div class="public-actions" id="public-actions"><button class="btn btn-primary" id="public-follow" type="button" hidden>Seguir canal</button><a class="btn" id="public-manage" href="/perfil.html" hidden>Gerenciar minha conta</a><button class="btn" id="public-share" type="button">Copiar link</button>${live?`<a class="btn btn-primary" href="/live.html?stream=${encodeURIComponent(channel.liveId)}">Assistir à live</a>`:''}</div></div></section><p class="public-status" id="public-status" role="status" aria-live="polite"></p><div class="public-stats"><button class="card btn" id="show-followers"><strong id="follower-count">${Number(stats.followers).toLocaleString('pt-BR')}</strong>Seguidores</button><button class="card btn" id="show-following"><strong>${Number(stats.following).toLocaleString('pt-BR')}</strong>Canais seguidos</button>${!Number.isNaN(date.getTime())?`<div class="card"><strong>${date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'})}</strong>Na Zytrix desde</div>`:''}</div><section class="card panel"><h2>${channel?'Canal':'Sobre o usuário'}</h2><p>${escapeHtml(channel?.name||'Participante da comunidade Zytrix')}</p><p class="public-bio">${escapeHtml(channel?.description||'')}</p><p class="muted">${channel?(live?escapeHtml(channel.liveTitle||'Transmissão ao vivo'):'Este canal está offline.'):'Este usuário ainda não possui um canal público para seguir.'}</p></section><section class="card panel" id="public-network" hidden></section>`;
 actions();void followState();
 void reportLink(root.querySelector('#public-actions'),'profile',uid,'-','append');
 root.querySelector('#show-followers').onclick=()=>network('followers');root.querySelector('#show-following').onclick=()=>network('following');
 root.querySelector('#public-share').onclick=async()=>{try{await navigator.clipboard.writeText(new URL(publicProfileUrl(uid),location.origin).href);status('Link copiado.');}catch{status('Copie o endereço na barra do navegador para compartilhar.');}};
 root.querySelector('#public-follow').onclick=async()=>{
 if(busy)return;if(!user){location.href=login;return;}if(user.uid===uid||!state.channel)return;
 const owner=user.uid,version=sessionVersion,next=!following;busy=true;actions();status('');
 try{await publicPlatform('follow.set',{channelId:state.channel.id,following:next});if(owner!==user?.uid||version!==sessionVersion)return;following=next;status(next?'Você está seguindo este canal.':'Você deixou de seguir este canal.');const updated=await anonymous('profile.public',{uid});if(updated.profile)root.querySelector('#follower-count').textContent=updated.stats.followers.toLocaleString('pt-BR');}
 catch(error){status(error.status===401?'Sua sessão expirou. Entre novamente.':error.code==='verified_email_required'?'Verifique seu e-mail para seguir canais.':'Não foi possível salvar. Tente novamente.');void followState();}
 finally{busy=false;actions();}
 };
 }catch{root.innerHTML='<div class="card panel"><h1>Perfil temporariamente indisponível</h1><p>Não foi possível carregar os dados.</p><button class="btn" id="public-retry">Tentar novamente</button></div>';root.querySelector('#public-retry').onclick=load;}
 finally{root.setAttribute('aria-busy','false');}
}
onAuthStateChanged(auth,value=>{user=value;if(state?.profile)void followState();});
void load();
