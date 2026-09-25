import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { createPlatformClient } from './staging-client.js';
import { getStreamingEmbed } from './streaming.js';
import { safeStreamingUrl } from './security.js';

const status=document.querySelector('#status'),login=document.querySelector('#login');
const content=document.querySelector('#content'),navigation=document.querySelector('#navigation');
let auth,call,dispose=()=>{},generation=0;
const messages={authentication_required:'Entre para continuar.',verified_email_required:'Sua conta precisa ter e-mail verificado.',
  insufficient_balance:'Saldo insuficiente.',rate_limited:'Aguarde antes de enviar novamente.',profile_missing:'O perfil excluído não foi recriado.',
  conflict:'Este nome já está em uso.',forbidden:'Você não tem permissão para esta operação.',live_not_active:'Esta live não está ativa.',
  channel_already_live:'Seu canal já tem uma live ativa.',account_not_migrated:'Esta conta não faz parte da migração.',
  chat_restricted:'O envio está restrito para esta conta.',invalid_recipient:'Não é possível enviar este apoio.',
  invalid_playback_url:'Informe um endereço HTTPS válido de Twitch, Kick ou vídeo do YouTube.',channel_missing:'Salve seu canal primeiro.',username_cooldown:'Aguarde sete dias entre alterações do nome de usuário.'};
function report(error){status.textContent=messages[error.code]??'Não foi possível concluir. Tente novamente.';}
function el(tag,text,attributes={}){const node=document.createElement(tag);if(text!=null)node.textContent=text;Object.assign(node,attributes);return node;}
function button(text,action){const node=el('button',text,{type:'button'});node.addEventListener('click',async()=>{node.disabled=true;try{await action();}catch(e){report(e);}finally{node.disabled=false;}});return node;}
function field(form,label,name,value='',type='text',required=true){const wrapper=el('label',label),input=el('input',null,{name,type,required});if(type==='checkbox')input.checked=!!value;else input.value=value??'';wrapper.append(input);form.append(wrapper);return input;}
function form(title,submit){const node=el('form');node.append(el('h2',title));node.addEventListener('submit',async event=>{event.preventDefault();const controls=[...node.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);try{await submit(new FormData(node));}catch(e){report(e);}finally{controls.forEach(b=>b.disabled=false);}});return node;}
function finish(form){form.append(el('button','Salvar',{type:'submit'}));return form;}
function safeLink(url,label){try{const parsed=new URL(url);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)return el('a',label,{href:parsed.href,target:'_blank',rel:'noopener noreferrer'});}catch{}return el('span','Endereço indisponível');}
async function page(name,liveId){dispose();dispose=()=>{};const current=++generation;content.replaceChildren();status.textContent='Carregando…';
 const root=el('div');content.append(root);
 try{if(name==='feed')await feed(root);else if(name==='categories')await categories(root);else if(name==='history')await history(root);else if(name==='account')await account(root);else if(name==='wallet')await wallet(root);else if(name==='creator')await creator(root);else if(name==='live')await watch(root,liveId,current);
 if(current===generation)status.textContent='Staging pronto.';}catch(e){if(current===generation)report(e);}
}
async function feed(root){const [feed,{preferences}]=await Promise.all([call('lives.list'),call('preferences.get')]);const lives=feed.lives.filter(l=>!l.matureContent||!(preferences.safeMode||preferences.hideMatureContent));root.append(el('h2','Ao vivo'));
 if(!lives.length)root.append(el('p','Nenhuma transmissão ao vivo.'));
 for(const live of lives){const card=el('section');card.append(el('h3',live.title),el('p',`${live.username??'Streamer'} · ${live.viewerCount??0} espectadores`),button('Assistir',()=>page('live',live.id)));root.append(card);}
}
async function account(root){const [{account:me},{preferences:p}]=await Promise.all([call('me'),call('preferences.get')]);
 if(me?.username){const profile=form('Meu perfil',async data=>{await call('profile.update',{username:data.get('username'),bio:data.get('bio')});status.textContent='Perfil salvo no staging.';});field(profile,'Nome de usuário','username',me.username).maxLength=30;field(profile,'Biografia','bio',me.bio,'text',false).maxLength=500;root.append(finish(profile));}
 else root.append(el('p','Perfil ausente. Ele não foi recriado automaticamente.'),el('a','Abrir recuperação opcional de perfil',{href:'/staging-validation.html'}));
 const prefs=form('Preferências',async()=>{const data={};for(const input of prefs.querySelectorAll('input'))data[input.name]=input.checked;await call('preferences.update',data);status.textContent='Preferências salvas.';});
 for(const [name,label]of Object.entries({hideMatureContent:'Ocultar conteúdo adulto',safeMode:'Modo seguro',allowReactions:'Permitir reações',compactAlerts:'Alertas compactos'}))field(prefs,label,name,p[name],'checkbox',false);
 root.append(finish(prefs));
}
async function categories(root){const [{categories:items},{categories:followed}]=await Promise.all([call('categories.list'),call('categories.followed')]);
 root.append(el('h2','Categorias'));if(!items.length)root.append(el('p','Nenhuma categoria disponível.'));
 for(const category of items){const following=followed.includes(category.id),card=el('section');card.append(el('h3',category.name),button(following?'Deixar de seguir':'Seguir',async()=>{await call('categories.follow',{categoryId:category.id,following:!following});await page('categories');}));root.append(card);}
}
async function history(root){const {history:items}=await call('discovery.context');root.append(el('h2','Histórico de visualização'));
 if(!items.length)root.append(el('p','Nenhuma transmissão disponível no seu histórico.'));
 for(const item of items){const card=el('section');card.append(el('h3',item.title),el('p',new Date(item.watchedAt).toLocaleString('pt-BR')),button('Abrir transmissão',()=>page('live',item.id)));root.append(card);}
}
async function wallet(root){const [{wallet:w},{transactions}]=await Promise.all([call('wallet.get'),call('transactions.list')]);root.append(el('h2','Zy Coins'));
 if(!w){root.append(el('p','Sua conta ainda não tem carteira.'),button('Criar carteira com saldo zero',async()=>{await call('wallet.ensure');await page('wallet');}));return;}
 root.append(el('p',`Saldo: ${w.balance} · Enviados: ${w.total_sent} · Recebidos: ${w.total_received}`));
 const list=el('ul');for(const item of transactions)list.append(el('li',`${new Date(item.createdAt).toLocaleString('pt-BR')} · ${item.type} · ${item.amount} · ${item.status}`));root.append(list);
}
async function creator(root){const {channel,lives}=await call('channel.mine');
 const editor=form('Meu canal',async data=>{await call('channel.save',Object.fromEntries(data));await page('creator');});
 field(editor,'Nome','name',channel?.name).maxLength=80;field(editor,'Endereço do canal (letras minúsculas, números e hífen)','slug',channel?.slug).pattern='[a-z0-9][a-z0-9-]{2,62}';field(editor,'Descrição','description',channel?.description,'text',false).maxLength=800;
 visibility(editor,channel?.visibility??'public');root.append(finish(editor));if(!channel)return;
 let requestKey=crypto.randomUUID(),previousPayload;
 const create=form('Preparar transmissão',async data=>{const payload={title:data.get('title'),description:data.get('description'),playbackURL:data.get('playbackURL'),visibility:data.get('visibility'),matureContent:data.has('matureContent')};
   const serialized=JSON.stringify(payload);if(previousPayload&&serialized!==previousPayload)requestKey=crypto.randomUUID();previousPayload=serialized;
   const result=await call('live.create',{...payload,requestKey});await page('live',result.id);});
 field(create,'Título','title').maxLength=120;field(create,'Descrição','description','','text',false).maxLength=2000;field(create,'Endereço HTTPS do player','playbackURL','','url');visibility(create,'public');field(create,'Conteúdo adulto','matureContent',false,'checkbox',false);root.append(finish(create));
 const list=el('section');list.append(el('h2','Minhas transmissões'));for(const live of lives)list.append(button(`${live.title} · ${live.status}`,()=>page('live',live.id)));root.append(list);
}
function visibility(form,value){const label=el('label','Visibilidade'),select=el('select',null,{name:'visibility'});for(const[v,t]of [['public','Pública'],['unlisted','Não listada'],['private','Privada']])select.append(el('option',t,{value:v,selected:v===value}));label.append(select);form.append(label);}
async function watch(root,liveId,current){const {live,permissions,channelId}=await call('live.get',{liveId});if(current!==generation)return;
 root.append(el('h2',live.title),el('p',live.description),el('p',`Estado: ${live.status}`),safeLink(live.playbackURL,'Abrir transmissão'));
 const player=safeStreamingUrl(live.playbackURL)&&getStreamingEmbed(live.playbackURL);
 if(player){const frame=el('iframe',null,{src:player.embedUrl,title:live.title,allow:'autoplay; fullscreen; picture-in-picture',allowFullscreen:true,referrerPolicy:'strict-origin-when-cross-origin'});frame.style.width='100%';frame.style.aspectRatio='16 / 9';root.append(frame);}
 if(permissions.owner){root.append(button(live.status==='live'?'Encerrar live':'Iniciar live',async()=>{await call('live.state',{liveId,status:live.status==='live'?'ended':'live'});await page('live',liveId);}));}
 else root.append(button('Seguir canal',async()=>{await call('follow.set',{channelId,following:true});status.textContent='Canal seguido.';}),button('Deixar de seguir',async()=>{await call('follow.set',{channelId,following:false});status.textContent='Você deixou de seguir o canal.';}));
 const chat=el('section');chat.append(el('h2','Chat'));const list=el('ol');chat.append(list);root.append(chat);
 const refresh=async()=>{const {messages}=await call('chat.list',{liveId});if(current!==generation)return;list.replaceChildren();for(const m of messages){const item=el('li');item.append(el('strong',m.username??'Usuário'),el('span',': '+m.text));if(permissions.moderator||m.uid===auth.currentUser?.uid)item.append(button('Excluir',async()=>{await call('chat.delete',{liveId,messageId:m.id});await refresh();}));list.append(item);}};
 await refresh();if(current!==generation)return;
 let active=true,timer;const poll=async()=>{if(!active)return;try{await refresh();if(active&&live.status==='live')await call('viewer.heartbeat',{liveId});}catch(e){if(active)report(e);}finally{if(active)timer=setTimeout(poll,15000);}};
 dispose=()=>{active=false;clearTimeout(timer);if(live.status==='live')call('viewer.leave',{liveId}).catch(()=>{});};timer=setTimeout(poll,15000);
 if(live.status!=='live')return;
 let chatKey=crypto.randomUUID(),chatText;
 const send=form('Enviar mensagem',async data=>{const text=data.get('text');if(chatText!==undefined&&chatText!==text)chatKey=crypto.randomUUID();chatText=text;await call('chat.send',{liveId,text,requestKey:chatKey});chatKey=crypto.randomUUID();chatText=undefined;send.reset();await refresh();});field(send,'Mensagem','text').maxLength=300;chat.append(finish(send));
 if(!permissions.owner){let supportKey=crypto.randomUUID(),supportPayload;
 const support=form('Enviar apoio em Zy Coins (staging)',async data=>{const payload={amount:Number(data.get('amount')),message:data.get('message')},serialized=JSON.stringify(payload);if(supportPayload&&supportPayload!==serialized)supportKey=crypto.randomUUID();supportPayload=serialized;
 await call('support.send',{liveId,...payload,requestKey:supportKey});supportKey=crypto.randomUUID();supportPayload=undefined;support.reset();status.textContent='Apoio enviado no staging.';});const amount=field(support,'Quantidade','amount','1','number');amount.min=1;amount.max=100000;amount.step=1;field(support,'Mensagem','message','','text',false).maxLength=120;root.append(finish(support));}
}
try{const response=await fetch('/api/v1/config',{cache:'no-store'});if(!response.ok||!(await response.json()).postgresStaging)throw Error('disabled');
 auth=getAuth(initializeApp({apiKey:'AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE',authDomain:'zytrix-ca4f2.firebaseapp.com',projectId:'zytrix-ca4f2'},'staging-validation'));
 call=createPlatformClient(()=>auth.currentUser);
 login.addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(login),submit=login.querySelector('button');submit.disabled=true;try{await signInWithEmailAndPassword(auth,data.get('email'),data.get('password'));login.reset();}catch{status.textContent='Não foi possível entrar com esta conta.';}finally{submit.disabled=false;}});
 document.querySelector('#logout').addEventListener('click',()=>signOut(auth).catch(report));navigation.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));
 onAuthStateChanged(auth,user=>{dispose();generation++;content.replaceChildren();navigation.hidden=!user;login.hidden=!!user;if(user)page('feed');else status.textContent='Entre com uma conta existente para testar.';});
 window.addEventListener('pagehide',()=>dispose());
}catch{status.textContent='Esta aplicação requer o ambiente staging configurado.';login.hidden=true;}
