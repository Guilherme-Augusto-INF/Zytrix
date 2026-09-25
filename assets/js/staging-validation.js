import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { createPlatformClient } from './staging-client.js';
const status=document.querySelector('#status'),form=document.querySelector('#login'),session=document.querySelector('#session');
let auth;
try{
 const config=await fetch('/api/v1/config',{cache:'no-store'}).then(r=>r.json());
 if(!config.postgresStaging)throw Error('disabled');
 auth=getAuth(initializeApp({apiKey:'AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE',authDomain:'zytrix-ca4f2.firebaseapp.com',projectId:'zytrix-ca4f2'},'staging-validation'));
 const call=createPlatformClient(()=>auth.currentUser);
 const feedStatus=document.querySelector('#feed-status');
 const feedList=document.querySelector('#feed-list');
 const showFeed=async()=>{
   try {
     const response=await call('live.feed');
     if(!Array.isArray(response.lives))throw Error('invalid_feed');
     feedList.replaceChildren();
     for(const live of response.lives) {
       const item=document.createElement('li');
       item.textContent=`${live.username || 'Streamer'} — ${live.title || 'Transmissão'} (${Number(live.viewerCount) || 0} espectadores)`;
       feedList.append(item);
     }
     feedStatus.textContent=`Consulta PostgreSQL: ${response.lives.length} transmissões públicas.`;
   } catch {feedStatus.textContent='Falha ao consultar o feed PostgreSQL (nenhum fallback para Firestore).';}
 };
 document.querySelector('#refresh-feed').addEventListener('click',showFeed);
 await showFeed();
 const check=async()=>{try{const [me,w]=await Promise.all([call('me'),call('wallet.get')]);document.querySelector('#account').textContent=me.account?.username?'Perfil: '+me.account.username:'Perfil ausente; não foi recriado.';document.querySelector('#wallet').textContent=w.wallet?'Saldo: '+w.wallet.balance+' Zy Coins':'Carteira ausente; não foi criada.';status.textContent='Autenticação e leituras privadas no staging confirmadas.';}catch{status.textContent='Não foi possível confirmar as leituras. Nenhuma gravação foi realizada.';}};
 onAuthStateChanged(auth,user=>{form.hidden=!!user;session.hidden=!user;if(user)check();else status.textContent='Entre para validar o acesso ao staging.';});
 form.addEventListener('submit',async event=>{event.preventDefault();const fields=new FormData(form);try{await signInWithEmailAndPassword(auth,String(fields.get('email')),String(fields.get('password')));form.reset();}catch{status.textContent='Não foi possível entrar. Confira as credenciais da conta existente.';}});
 document.querySelector('#refresh').addEventListener('click',check);document.querySelector('#logout').addEventListener('click',()=>signOut(auth));
}catch{status.textContent='Esta validação só está disponível no ambiente staging configurado.';form.hidden=true;}
