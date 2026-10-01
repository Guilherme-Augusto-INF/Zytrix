import {auth,onAuthStateChanged,authRequest,refreshSession,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,signInWithPopup,sendPasswordResetEmail} from './neon-browser.js';
import {createPlatformClient} from './staging-client.js';
import {strongPassword,localRedirect} from './security.js';
const platform=createPlatformClient(()=>auth.currentUser);
export function initNeonAuthPage(form,show) {
 const mode=form?.dataset.mode;
 const extra=document.createElement('section');form?.insertAdjacentElement('afterend',extra);
 let username=sessionStorage.getItem('zytrixNeonEnrollmentName')??'';
 const destination=localRedirect(new URLSearchParams(location.search).get('redirect'),'index.html');
 async function finish(user) {
  if(!user?.enrollmentRequired){location.assign(destination);return;}
  extra.replaceChildren();
  const title=document.createElement('h2');title.textContent='Concluir sua conta no staging';extra.append(title);
  if(!user.emailVerified){
   const verify=document.createElement('form');verify.innerHTML='<label>Código de verificação enviado ao seu e-mail<input name="otp" class="input" autocomplete="one-time-code" required></label><button class="btn btn-primary">Verificar e-mail</button><button class="btn" type="button" data-resend>Enviar código</button>';
   verify.querySelector('[data-resend]').onclick=async()=>{try{await sendEmailVerification(user);show('Código enviado.','ok');}catch{show('Não foi possível enviar o código.');}};
   verify.onsubmit=async e=>{e.preventDefault();try{await authRequest('email-otp/verify-email',{email:user.email,otp:new FormData(verify).get('otp')});await refreshSession();await finish(auth.currentUser);}catch{show('Código inválido ou expirado.');}};
   extra.append(verify);return;
  }
  const enrollment=document.createElement('form');enrollment.innerHTML='<label>Nome público<input class="input" name="username" minlength="2" maxlength="30" required></label><label><input type="checkbox" name="accept" required> Aceito testar exclusivamente no staging as minutas dos <a href="/termos">Termos</a>, da <a href="/privacidade">Privacidade</a> e das <a href="/diretrizes-da-comunidade">Diretrizes</a>. Esta configuração não libera cadastros em produção.</label><p>Se já possui uma conta Zytrix, vincule-a abaixo para preservar seu perfil e carteira.</p><button class="btn btn-primary">Criar novo perfil</button>';
  enrollment.elements.username.value=username;
  enrollment.onsubmit=async e=>{e.preventDefault();try{const fields=new FormData(enrollment),config=(await platform('documents.read',{path:['governance','config']})).documents[0];await platform('account.register',{username:String(fields.get('username')).trim(),acceptPolicies:fields.get('accept')==='on',stagingConsent:fields.get('accept')==='on',termsVersion:config?.termsVersion,privacyVersion:config?.privacyVersion,rulesVersion:config?.rulesVersion});sessionStorage.removeItem('zytrixNeonEnrollmentName');await refreshSession();location.assign(destination);}catch(error){show(error.code==='dual_proof_enrollment_required'?'Sua conta existente exige vinculação com o login anterior.':'Não foi possível criar o perfil. Confira as políticas e o nome escolhido.');}};
  const link=document.createElement('form');link.innerHTML='<h3>Vincular sua conta Zytrix existente</h3><label>E-mail do login anterior<input class="input" name="email" type="email" autocomplete="username"></label><label>Senha do login anterior<input class="input" name="password" type="password" autocomplete="current-password"></label><button class="btn">Comprovar e vincular</button><button class="btn" type="button" data-google>Comprovar com Google</button>';
  async function linkToken(token){await platform('auth.link',{firebaseToken:token});await refreshSession();location.assign(destination);}
  link.onsubmit=async e=>{e.preventDefault();const fd=new FormData(link);try{const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fd.get('email'),password:fd.get('password'),returnSecureToken:true}),signal:AbortSignal.timeout(15000)});const proof=await response.json();if(!response.ok||!proof.idToken)throw Error('proof_required');await linkToken(proof.idToken);}catch{show('Não foi possível comprovar e vincular as duas contas.');}finally{link.elements.password.value='';}};
  link.querySelector('[data-google]').onclick=async()=>{try{const apps=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),sdk=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');const app=apps.getApps().find(x=>x.name==='enrollment-proof')??apps.initializeApp({apiKey:'AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE',authDomain:'zytrix-ca4f2.firebaseapp.com',projectId:'zytrix-ca4f2'},'enrollment-proof');const bridge=sdk.getAuth(app);await sdk.setPersistence(bridge,sdk.inMemoryPersistence);const result=await sdk.signInWithPopup(bridge,new sdk.GoogleAuthProvider());try{await linkToken(await result.user.getIdToken(true));}finally{await sdk.signOut(bridge);}}catch{show('Não foi possível comprovar sua conta anterior com Google.');}};
  extra.append(enrollment,link);
 }
 form?.addEventListener('submit',async e=>{e.preventDefault();const fields=new FormData(form);try{
  const email=String(fields.get('email')??''),password=String(fields.get('password')??'');
  if(mode==='login'){const result=await signInWithEmailAndPassword(auth,email,password);await finish(result.user);}
  if(mode==='register'){username=String(fields.get('username')??'').trim();if(!/^[A-Za-z0-9_.-]{2,30}$/.test(username)||!strongPassword(password))throw Error('invalid_signup');sessionStorage.setItem('zytrixNeonEnrollmentName',username);const result=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(result.user);await finish(result.user);}
  if(mode==='reset'){const token=new URLSearchParams(location.search).get('token');if(token){if(!strongPassword(password))throw Error('invalid_password');await authRequest('reset-password',{token,newPassword:password});show('Senha atualizada. Entre novamente.','ok');}else{await sendPasswordResetEmail(auth,email).catch(()=>{});show('Se existir uma conta, enviaremos as instruções de recuperação.','ok');}}
 }catch(error){show(error.message==='invalid_signup'?'Use um nome válido e senha com pelo menos 10 caracteres, letra e número.':'Não foi possível autenticar. Confira os dados e a verificação de e-mail.');}finally{if(form.elements.password)form.elements.password.value='';}});
 if(mode==='reset'&&new URLSearchParams(location.search).has('token')){form.elements.email.required=false;form.elements.email.closest('.form-group')?.setAttribute('hidden','');const field=document.createElement('input');field.name='password';field.type='password';field.className='input';field.autocomplete='new-password';field.required=true;field.placeholder='Nova senha';form.prepend(field);}
 document.querySelector('#google-login')?.addEventListener('click',()=>signInWithPopup().catch(e=>{if(e.message!=='oauth_redirect')show('Login Google indisponível.');}));
 onAuthStateChanged(auth,user=>{if(user&&mode!=='reset')void finish(user);});
}
