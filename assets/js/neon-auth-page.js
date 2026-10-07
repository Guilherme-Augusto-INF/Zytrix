import {auth,onAuthStateChanged,authRequest,refreshSession,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,signInWithPopup,sendPasswordResetEmail} from './neon-browser.js';
import {createPlatformClient} from './staging-client.js';
import {strongPassword,localRedirect} from './security.js';
import {neonAuthMessage,verificationSender} from './neon-auth-errors.js';
export function initNeonAuthPage(form,show){
 if(!form)return;
 const mode=form.dataset.mode,platform=createPlatformClient(()=>auth.currentUser),extra=document.createElement('section');form.insertAdjacentElement('afterend',extra);
 const sender=verificationSender(sendEmailVerification),resetSender=verificationSender(user=>sendPasswordResetEmail(auth,user.email));
 const params=new URLSearchParams(location.search),destination=localRedirect(params.get('redirect'),'index.html');let submitting=false,timer;
 globalThis.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 async function finish(user){
  if(!user)return;
  extra.replaceChildren();clearInterval(timer);
  if(!user.emailVerified){
   const verify=document.createElement('form');verify.innerHTML='<h2>Verifique seu e-mail</h2><label>Código<input class="input" name="otp" autocomplete="one-time-code" required></label><button class="btn btn-primary">Verificar</button><button type="button" class="btn" data-resend>Solicitar código</button>';extra.append(verify);
   const resend=verify.querySelector('[data-resend]');let busy=false;const update=()=>{resend.disabled=busy||sender.remaining()>0;resend.textContent=sender.remaining()?`Solicitar em ${sender.remaining()}s`:'Solicitar código';};timer=setInterval(update,1000);update();
   resend.onclick=async()=>{busy=true;update();try{await sender.request(user);show('Código solicitado. Confira sua caixa de entrada e spam.','ok');}catch(e){show(neonAuthMessage(e,'send'));}finally{busy=false;update();}};
   verify.onsubmit=async e=>{e.preventDefault();const button=verify.querySelector('button');button.disabled=true;try{await authRequest('email-otp/verify-email',{email:user.email,otp:String(new FormData(verify).get('otp'))});localStorage.removeItem('zytrixNeonSignedOut');await refreshSession();if(auth.currentUser?.emailVerified)await finish(auth.currentUser);else{extra.replaceChildren();show('E-mail verificado. Entre para continuar.','ok');}}catch(error){show(neonAuthMessage(error,'verify'));}finally{button.disabled=false;}};
   return;
  }
  if(!user.enrollmentRequired){location.assign(destination);return;}
  const complete=document.createElement('form');complete.innerHTML='<h2>Concluir cadastro</h2><label>Username<input class="input" name="username" minlength="2" maxlength="30" pattern="[A-Za-z0-9_.-]{2,30}" required></label><label><input name="accept" type="checkbox" required> Estou ciente de que este produto está em desenvolvimento e de que suas políticas são minutas. Consulte os <a href="/termos">Termos</a> e a <a href="/privacidade">Privacidade</a>.</label><button class="btn btn-primary">Continuar</button>';complete.elements.username.value=sessionStorage.getItem('zytrixSignupUsername')??'';extra.append(complete);
  complete.onsubmit=async e=>{e.preventDefault();const button=complete.querySelector('button');button.disabled=true;try{const fields=new FormData(complete),config=(await platform('policies.current')).config;await platform('account.register',{username:String(fields.get('username')).trim(),acceptPolicies:fields.get('accept')==='on',termsVersion:config.termsVersion,privacyVersion:config.privacyVersion,rulesVersion:config.rulesVersion});sessionStorage.removeItem('zytrixSignupUsername');await refreshSession();location.assign(destination);}catch{show('Não foi possível salvar o username. Confira o nome e tente novamente.');}finally{button.disabled=false;}};
 }
 form.addEventListener('submit',async e=>{e.preventDefault();if(submitting)return;submitting=true;const button=form.querySelector('button:not([type="button"])');if(button)button.disabled=true;const fields=new FormData(form),email=String(fields.get('email')??'').trim(),password=String(fields.get('password')??'');let step=mode;
  try{
   if(mode==='login')await finish((await signInWithEmailAndPassword(auth,email,password)).user);
   if(mode==='register'){const username=String(fields.get('username')??'').trim();if(!/^[A-Za-z0-9_.-]{2,30}$/.test(username)||!strongPassword(password))throw Error('invalid_signup');sessionStorage.setItem('zytrixSignupUsername',username);const result=await createUserWithEmailAndPassword(auth,email,password);await finish(result.user);try{await sender.request(result.user);show('Conta criada. Verifique o código enviado ao seu e-mail.','ok');}catch(error){show('Conta criada. '+neonAuthMessage(error,'send'));}}
   if(mode==='reset'){const token=params.get('token');if(token){step='password';if(!strongPassword(password))throw Error('invalid_signup');await authRequest('reset-password',{token,newPassword:password});show('Senha atualizada. Voltando ao login.','ok');setTimeout(()=>location.assign('login.html'),1200);}else{await resetSender.request({email});show('Se existir uma conta elegível, enviaremos as instruções de recuperação.','ok');}}
  }catch(error){if(mode==='login'&&error.code==='EMAIL_NOT_VERIFIED')await finish({email,emailVerified:false});show(error.message==='invalid_signup'?'Use um username válido e senha com 10 caracteres, letra e número.':neonAuthMessage(error,step));}finally{submitting=false;if(button)button.disabled=false;if(form.elements.password)form.elements.password.value='';}
 });
 if(mode==='reset'&&params.has('token')){form.elements.email.required=false;form.elements.email.closest('.form-group')?.setAttribute('hidden','');const input=document.createElement('input');Object.assign(input,{name:'password',type:'password',className:'input',autocomplete:'new-password',required:true,placeholder:'Nova senha'});form.prepend(input);}
 document.querySelector('#google-login')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await signInWithPopup();}catch(error){if(error.message!=='oauth_redirect')show(neonAuthMessage(error,'google'));}finally{button.disabled=false;}});
 if(params.has('error'))show(neonAuthMessage({code:params.get('error')},mode==='reset'?'password':'google'));
 onAuthStateChanged(auth,user=>{if(mode!=='reset')void finish(user).catch(error=>show(neonAuthMessage(error)));});
}
