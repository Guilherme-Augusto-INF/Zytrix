// Public messages deliberately omit provider payloads, addresses and internal details.
export function neonAuthMessage(error, step='login') {
 if(error?.message==='authentication_changed')return 'A sessão mudou ou expirou. Entre novamente antes de vincular sua conta.';
 if(error?.message==='google_link_not_confirmed')return 'A vinculação Google ainda não foi confirmada. Entre pelo método original e tente novamente.';
 if(step==='google'&&error?.code==='account_already_linked_to_different_user')return 'Este acesso Google já está vinculado a outra conta. Entre com a conta correspondente; as contas não foram unidas.';
 if(step==='google'&&error?.code==='account_not_linked')return 'Esta conta ainda não está vinculada ao Google. Entre pelo método usado no cadastro. A vinculação precisa confirmar as duas identidades.';
 if(error?.status===429)return 'Muitas tentativas. Aguarde antes de tentar novamente.';
 if(error?.code==='EMAIL_NOT_VERIFIED')return 'Verifique seu e-mail antes de entrar. Você pode solicitar outro código abaixo.';
 if(['INVALID_OTP','OTP_EXPIRED','TOO_MANY_ATTEMPTS','INVALID_VERIFICATION_CODE'].includes(error?.code))return 'Código inválido ou expirado. Confira o código ou solicite outro.';
 if(step==='send')return 'Não foi possível solicitar o código. Sua conta pode estar criada; tente o reenvio após aguardar.';
 if(step==='verify')return 'Não foi possível verificar o e-mail. Confira o código e tente novamente.';
 if(step==='reset')return 'Não foi possível solicitar a recuperação. Tente novamente em instantes.';
 if(step==='google')return 'Não foi possível entrar com Google. Tente novamente; se o erro continuar, a configuração do staging precisa ser revisada.';
 if(['USER_ALREADY_EXISTS','USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'].includes(error?.code))return 'Não foi possível concluir o cadastro. Tente entrar ou recuperar sua conta; se faltar verificação, solicite outro código.';
 if(step==='register')return 'Não foi possível criar a conta. Confira os dados e tente novamente.';
 if(step==='password')return 'Não foi possível atualizar a senha. O link pode ter expirado; solicite uma nova recuperação.';
 if(error?.code==='authentication_unavailable'||error?.name==='TypeError'||error?.name==='TimeoutError')return 'Não foi possível conectar à autenticação. Verifique a rede e tente novamente.';
 return 'E-mail ou senha inválidos, ou acesso indisponível. Confira os dados e tente novamente.';
}
// UI throttling complements the provider's server-side rate limit.
export function verificationSender(send,now=()=>Date.now()) {
 let next=0,busy=false;
 return {remaining:()=>Math.max(0,Math.ceil((next-now())/1000)),async request(user){
  if(busy||now()<next)throw Object.assign(Error('otp_cooldown'),{status:429});
  busy=true;next=now()+60000;
  try{await send(user);}catch(error){if(error.status===429)next=now()+Math.min(3600,Math.max(60,Number(error.retryAfter)||60))*1000;throw error;}
  finally{busy=false;}
 }};
}
