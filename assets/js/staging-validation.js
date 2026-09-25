import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { createPlatformClient } from './staging-client.js';
import { canRecoverProfile, recoveryPayload } from './staging-recovery.js';

const status = document.querySelector('#status');
const login = document.querySelector('#login');
const session = document.querySelector('#session');
const recoverySection = document.querySelector('#profile-recovery-section');
const recoveryForm = document.querySelector('#profile-recovery-form');
const recoveryHint = document.querySelector('#profile-recovery-hint');
const recoveryResult = document.querySelector('#profile-recovery-result');
const feedStatus = document.querySelector('#feed-status');
const feedList = document.querySelector('#feed-list');

let auth;
try {
  const response = await fetch('/api/v1/config', { cache: 'no-store' });
  if (!response.ok || (await response.json()).postgresStaging !== true) throw new Error('staging_disabled');
  auth = getAuth(initializeApp({
    apiKey: 'AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE',
    authDomain: 'zytrix-ca4f2.firebaseapp.com',
    projectId: 'zytrix-ca4f2'
  }, 'staging-validation'));
  const call = createPlatformClient(() => auth.currentUser);

  async function showFeed() {
    try {
      const result = await call('live.feed');
      if (!Array.isArray(result.lives)) throw new Error('invalid_feed');
      feedList.replaceChildren();
      for (const live of result.lives) {
        const item = document.createElement('li');
        item.textContent = `${live.username || 'Streamer'} — ${live.title || 'Transmissão'} (${Number(live.viewerCount) || 0} espectadores)`;
        feedList.append(item);
      }
      feedStatus.textContent = `Consulta PostgreSQL: ${result.lives.length} transmissões públicas.`;
    } catch {
      feedList.replaceChildren();
      feedStatus.textContent = 'Falha ao consultar o feed PostgreSQL (nenhum fallback para Firestore).';
    }
  }
  document.querySelector('#refresh-feed').addEventListener('click', showFeed);
  await showFeed();

  async function check() {
    recoverySection.hidden = true;
    recoveryForm.hidden = true;
    recoveryResult.textContent = '';
    try {
      const user = auth.currentUser;
      if (!user) return;
      const [me, wallet] = await Promise.all([call('me'), call('wallet.get')]);
      if (user !== auth.currentUser) return;
      document.querySelector('#account').textContent = me.account?.username
        ? 'Perfil: ' + me.account.username
        : 'Perfil ausente; não foi recriado automaticamente.';
      document.querySelector('#wallet').textContent = wallet.wallet
        ? 'Saldo: ' + wallet.wallet.balance + ' Zy Coins'
        : 'Carteira ausente; não foi criada.';
      status.textContent = 'Autenticação e leituras privadas no staging confirmadas.';
      if (me.account && !me.account.username) {
        recoverySection.hidden = false;
        recoveryForm.hidden = !canRecoverProfile(me.account, user.emailVerified);
        recoveryHint.textContent = user.emailVerified
          ? 'A criação é opcional e exige sua confirmação explícita.'
          : 'Confirme seu e-mail no Firebase antes de recuperar o perfil.';
      }
    } catch {
      status.textContent = 'Não foi possível confirmar as leituras. Nenhuma gravação foi realizada.';
    }
  }

  onAuthStateChanged(auth, user => {
    login.hidden = !!user;
    session.hidden = !user;
    recoverySection.hidden = true;
    recoveryForm.hidden = true;
    if (user) void check();
    else status.textContent = 'Entre para validar o acesso ao staging.';
  });
  login.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(login);
    try {
      await signInWithEmailAndPassword(auth, String(fields.get('email')), String(fields.get('password')));
      login.reset();
    } catch {
      status.textContent = 'Não foi possível entrar. Confira as credenciais da conta existente.';
    }
  });
  recoveryForm.addEventListener('submit', async event => {
    event.preventDefault();
    recoveryResult.textContent = '';
    const submit = recoveryForm.querySelector('button[type="submit"]');
    if (!auth.currentUser || !auth.currentUser.emailVerified || submit.disabled) return;
    const fields = new FormData(recoveryForm);
    let payload;
    try {
      payload = recoveryPayload(fields.get('username'), fields.get('bio'), fields.get('confirmRecovery') === 'on');
    } catch {
      recoveryResult.textContent = 'Confirme a operação e use um nome válido de 2 a 30 caracteres.';
      return;
    }
    submit.disabled = true;
    try {
      await call('profile.recover', payload); // Explicit opt-in only; never invoked by login/check.
      recoveryResult.textContent = 'Novo perfil criado no staging. Nenhum dado foi alterado no Firebase.';
      recoveryForm.reset();
      // Refresh the read-only account view and remove the recovery form.
      await check();
    } catch (error) {
      const message = {
        conflict: 'Este nome já está em uso. Escolha outro.',
        profile_already_exists: 'Esta conta já tem um perfil. Atualize a página.',
        reserved_username: 'Este nome é reservado. Escolha outro.',
        verified_email_required: 'Confirme seu e-mail antes de continuar.'
      };
      recoveryResult.textContent = message[error.code] || 'A recuperação falhou. Nenhum novo perfil foi confirmado.';
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelector('#refresh').addEventListener('click', check);
  document.querySelector('#logout').addEventListener('click', () => signOut(auth));
} catch {
  status.textContent = 'Esta validação só está disponível no ambiente staging configurado.';
  login.hidden = true;
  recoverySection.hidden = true;
}
