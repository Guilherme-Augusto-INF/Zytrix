import { auth, db, googleProvider, onAuthStateChanged, EmailAuthProvider, reauthenticateWithPopup, reauthenticateWithCredential, deleteUser, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, updateDoc, query, collection, collectionGroup, where, limit, serverTimestamp, writeBatch } from './firebase.js';
import { header, footer, escapeHtml, escapeAttr } from './ui.js';
import { parseStreamingSource, streamingPlatformLabel } from './streaming.js';
import { safeImageUrl } from './security.js';
import { IMAGE_ACCEPT, uploadPublicImage, imageUploadMessage, isImageUploadError } from './media-upload.js';
header();
footer();
const root = document.querySelector('#profile-root');
let user = null;
let profile = null;
let account = null;
let wallet = null;
let channel = null;
let stream = null;
let walletUnsubscribe = null;
let creatingChannel = false;
function dateText(timestamp) {
    try {
        return timestamp?.toDate?.().toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }) || 'Data indisponível';
    }
    catch {
        return 'Data indisponível';
    }
}
async function findStream(uid) {
    const streamQuery = query(collection(db, 'streams'), where('streamerUid', '==', uid), limit(1));
    const result = await getDocs(streamQuery);
    if (result.empty) {
        return null;
    }
    return {
        id: result.docs[0].id,
        ...result.docs[0].data()
    };
}
async function load() {
    const [profileSnap, accountSnap, walletSnap, channelSnap] = await Promise.all([
        getDoc(doc(db, 'profiles', user.uid)),
        getDoc(doc(db, 'users', user.uid)),
        getDoc(doc(db, 'wallets', user.uid)),
        getDoc(doc(db, 'channels', user.uid))
    ]);
    // Older accounts may have lost a profile document during prior migrations.
    // Keep channel setup available instead of trapping them on a blank profile.
    profile = profileSnap.exists() ? profileSnap.data() : {
        username: user.displayName || 'Streamer',
        photoURL: safeImageUrl(user.photoURL || ''),
        bio: ''
    };
    account = accountSnap.exists() ? accountSnap.data() : {
        zytrixId: `ZY-${user.uid.slice(0, 10).toUpperCase()}`,
        createdAt: null
    };
    wallet = walletSnap.exists() ? walletSnap.data() : null;
    channel = channelSnap.exists() ? channelSnap.data() : null;
    stream = channel ? await findStream(user.uid) : null;
    render();
    if (walletUnsubscribe) {
        walletUnsubscribe();
        walletUnsubscribe = null;
    }
    walletUnsubscribe = onSnapshot(doc(db, 'wallets', user.uid), snapshot => {
        if (!snapshot.exists()) {
            return;
        }
        wallet = snapshot.data();
        const balanceElement = document.querySelector('#wallet-balance');
        if (balanceElement) {
            balanceElement.textContent = Number(wallet.balance || 0).toLocaleString('pt-BR');
        }
    }, error => {
        console.error('Erro ao acompanhar saldo:', error);
    });
}
function render() {
    const initials = (profile.username || 'U').charAt(0).toUpperCase();
    const streamSource = parseStreamingSource(stream?.playbackURL || '');
    const platformLabel = streamSource
        ? streamingPlatformLabel(streamSource.platform)
        : 'Não vinculada';
    root.innerHTML = `
    <div class="card panel">
      <h1 style="text-align:center;margin-top:0">Perfil</h1>

      <div class="profile-grid">
        <div>
          ${profile.photoURL
        ? `<img class="profile-photo" src="${escapeAttr(profile.photoURL)}" alt="Foto de ${escapeAttr(profile.username || 'usuário')}">`
        : `<div class="profile-photo" style="display:grid;place-items:center;font-size:42px;color:#334155">${escapeHtml(initials)}</div>`}

          <button id="edit-toggle" class="btn" style="width:140px;margin-top:8px">
            Editar perfil
          </button>
        </div>

        <div class="info-list">
          <div class="info-row">
            <strong>Nome</strong>
            <span>${escapeHtml(profile.username || '')}</span>
          </div>

          <div class="info-row">
            <strong>ID</strong>
            <span>${escapeHtml(account.zytrixId || user.uid)}</span>
          </div>

          <div class="info-row">
            <strong>Membro desde</strong>
            <span>${dateText(account.createdAt)}</span>
          </div>

          <div class="info-row">
            <strong>E-mail</strong>
            <span>
              ${escapeHtml(user.email || '')}
              ${user.emailVerified ? '✓' : '(não verificado)'}
            </span>
          </div>

          <div class="info-row">
            <strong>Zy Coins</strong>
            <span class="coin-pill">
              ◈ <span id="wallet-balance">${Number(wallet?.balance || 0).toLocaleString('pt-BR')}</span>
            </span>
          </div>

          <div class="info-row">
            <strong>Bio</strong>
            <span>${escapeHtml(profile.bio || 'Nenhuma descrição adicionada.')}</span>
          </div>
        </div>
      </div>

      <div id="edit-area" class="hidden" style="margin-top:18px">
        <div class="form-group">
          <label for="edit-name">Nome</label>
          <input
            id="edit-name"
            class="input"
            maxlength="30"
            value="${escapeAttr(profile.username || '')}"
          >
        </div>

        <div class="form-group">
          <label for="edit-photo">URL da foto</label>
          <input
            id="edit-photo"
            class="input"
            type="url"
            maxlength="2048"
            autocomplete="url"
            placeholder="https://lh3.googleusercontent.com/..."
            value="${escapeAttr(profile.photoURL || '')}"
          >
          <small class="muted">Use uma URL HTTPS direta de imagem pública de um provedor compatível. Não cole o link da página de perfil.</small>
        </div>

        <div class="form-group">
          <label for="edit-photo-file">Ou enviar uma foto do computador</label>
          <input
            id="edit-photo-file"
            class="input file-input"
            type="file"
            accept="${IMAGE_ACCEPT}"
          >
          <small class="muted">JPG, PNG ou WebP. A Zytrix redimensiona e converte a imagem antes do envio. Limite do arquivo original: 8 MB.</small>
        </div>

        <div class="form-group">
          <label for="edit-bio">Bio</label>
          <textarea
            id="edit-bio"
            class="input textarea"
            maxlength="500"
          >${escapeHtml(profile.bio || '')}</textarea>
        </div>

        <button id="save-profile" class="btn btn-primary">
          Salvar alterações
        </button>

        <div id="profile-msg"></div>
      </div>
    </div>

    <div class="card panel" style="margin-top:16px">
      <div class="eyebrow">Streamer</div>

      ${channel
        ? `
          <h2>Seu canal está pronto</h2>

          <p class="muted">
            Status:
            <span class="${stream?.status === 'live' ? 'status-live' : 'status-offline'}">
              ${stream?.status === 'live' ? 'AO VIVO' : 'OFFLINE'}
            </span>
          </p>

          <div class="stream-source-summary">
            <span class="platform-badge platform-${streamSource?.platform || 'unknown'}">
              ${escapeHtml(platformLabel)}
            </span>

            ${streamSource
            ? `<a href="${escapeAttr(streamSource.canonicalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(streamSource.canonicalUrl)}</a>`
            : '<span class="muted">Nenhum canal de transmissão válido vinculado.</span>'}
          </div>

          <p class="muted" style="margin-top:10px">
            Você pode trocar entre YouTube, Twitch e Kick no painel de configuração da live.
          </p>

          ${stream
            ? `<a class="btn btn-primary" href="config-live.html">Configurar live</a>`
            : `<p class="muted">O canal existe, mas sua transmissão não foi encontrada. Vincule novamente seu canal para recuperar a configuração.</p>
               <div class="form-group"><label for="stream-url">Link do YouTube, Twitch ou Kick</label><input id="stream-url" class="input" type="url" autocomplete="url" placeholder="https://www.twitch.tv/seu_canal"></div>
               <button id="be-streamer" class="btn btn-primary">Recuperar minha live</button>
               <div id="streamer-msg" role="status" aria-live="polite"></div>`}
        `
        : `
          <h2>Você deseja fazer lives?</h2>

          <p class="muted">
            Vincule uma live do YouTube ou um canal da Twitch/Kick para criar seu canal na Zytrix.
          </p>

          <div class="form-group">
            <label for="stream-url">Link do YouTube, Twitch ou Kick</label>
            <input
              id="stream-url"
              class="input"
              placeholder="https://youtube.com/watch?v=... | twitch.tv/... | kick.com/..."
              autocomplete="url"
            >
            <small class="muted">
              Para Twitch/Kick, use o link do canal. Para YouTube, use o link de uma live ou vídeo (watch?v=, live/ ou youtu.be).
            </small>
          </div>

          <button id="be-streamer" class="btn btn-primary">
            Criar meu canal
          </button>

          <div id="streamer-msg" role="status" aria-live="polite"></div>
        `}
    </div>

    <div class="card panel" style="margin-top:16px;border-color:#7f1d1d">
      <div class="eyebrow">Configurações da conta</div>
      <h2>Excluir conta</h2>
      <p class="muted">
        Exclui sua conta de autenticação e os dados principais do perfil na Zytrix. Registros necessários para segurança, moderação e histórico de transações podem ser preservados quando aplicável.
      </p>
      <button id="delete-account" class="btn btn-danger">Excluir minha conta</button>
      <div id="delete-account-msg"></div>
    </div>

    <div style="margin-top:16px">
      <a class="btn btn-danger" href="sair.html">Sair da conta</a>
    </div>
  `;
    document.querySelector('#edit-toggle').onclick = () => {
        document.querySelector('#edit-area').classList.toggle('hidden');
    };
    document.querySelector('#save-profile').onclick = saveProfile;
    document.querySelector('#delete-account').onclick = deleteAccount;
    if (!channel || !stream) {
        document.querySelector('#be-streamer')?.addEventListener('click', createStreamer);
    }
}
async function saveProfile() {
    const message = document.querySelector('#profile-msg');
    const button = document.querySelector('#save-profile');
    const name = document.querySelector('#edit-name').value.trim();
    const rawPhoto = document.querySelector('#edit-photo').value.trim();
    const photoFile = document.querySelector('#edit-photo-file')?.files?.[0] || null;
    let photoURL = safeImageUrl(rawPhoto);
    const bio = document.querySelector('#edit-bio').value.trim();
    if (name.length < 2 || name.length > 30) {
        message.textContent = 'O nome deve ter de 2 a 30 caracteres.';
        return;
    }
    if (!photoFile && rawPhoto && !photoURL) {
        message.textContent = 'URL da foto não permitida. Use uma imagem HTTPS de Google, Twitch, Kick, YouTube ou Firebase Storage. Links comuns de páginas ou arquivos privados não funcionam.';
        return;
    }
    if (bio.length > 500) {
        message.textContent = 'A bio deve ter até 500 caracteres.';
        return;
    }
    // A name change is separate from the image change: show the cooldown
    // immediately instead of silently failing the entire profile update.
    const originalName = profile?.username || '';
    const changedName = name !== originalName;
    if (changedName) {
        const changedAt = profile?.usernameUpdatedAt?.toMillis?.();
        if (changedAt && Date.now() < changedAt + 7 * 24 * 60 * 60 * 1000) {
            const allowed = new Date(changedAt + 7 * 24 * 60 * 60 * 1000);
            message.textContent = 'Você poderá alterar o nome a partir de ' + allowed.toLocaleDateString('pt-BR') + '. Para atualizar só a foto, mantenha o nome anterior.';
            return;
        }
    }

    button.disabled = true;
    message.textContent = 'Salvando perfil...';
    try {
        if (photoFile) {
            message.textContent = 'Otimizando e enviando a foto...';
            photoURL = await uploadPublicImage({ uid: user.uid, kind: 'profile', file: photoFile });
        }
        const profileRef = doc(db, 'profiles', user.uid);
        const data = { photoURL, bio };
        if (changedName) {
            data.username = name;
            data.usernameUpdatedAt = serverTimestamp();
        }
        const latestProfile = await getDoc(profileRef);
        if (!latestProfile.exists()) {
            // Repair an older account with a missing profile document.
            await setDoc(profileRef, {
                uid: user.uid,
                username: name,
                photoURL,
                bio,
                createdAt: serverTimestamp(),
                usernameUpdatedAt: serverTimestamp()
            });
        } else {
            await updateDoc(profileRef, data);
        }

        // The homepage obtains its channel metadata independently of profiles.
        // Image and name changes should propagate to existing channels too.
        try {
            const channelRef = doc(db, 'channels', user.uid);
            const channelSnap = await getDoc(channelRef);
            if (channelSnap.exists()) {
                const channelUpdate = { avatarURL: photoURL };
                if (changedName) channelUpdate.channelName = name;
                await updateDoc(channelRef, channelUpdate);
            }
        } catch (syncError) {
            console.warn('Perfil atualizado, mas não foi possível sincronizar a foto do canal.', syncError);
        }
        await load();
        const editArea = document.querySelector('#edit-area');
        if (editArea) editArea.classList.remove('hidden');
        const success = document.querySelector('#profile-msg');
        if (success) success.innerHTML = '<div class="message ok">Foto e dados de perfil salvos com sucesso.</div>';
    } catch (error) {
        console.error('Falha ao atualizar perfil:', error);
        message.textContent = isImageUploadError(error)
            ? imageUploadMessage(error)
            : error?.code === 'permission-denied'
                ? 'Alteração recusada. Confira o domínio da imagem e, se estiver alterando o nome, respeite o intervalo de 7 dias.'
                : error?.code === 'unavailable'
                    ? 'Sem conexão com o banco. Tente novamente.'
                    : 'Não foi possível atualizar o perfil. Tente novamente.';
    } finally {
        if (button.isConnected) button.disabled = false;
    }
}

async function createStreamer() {
    if (creatingChannel || !user) return;
    const message = document.querySelector('#streamer-msg');
    const input = document.querySelector('#stream-url');
    const button = document.querySelector('#be-streamer');
    if (!message || !input || !button) return;

    const source = parseStreamingSource(input.value);
    if (!source) {
        message.innerHTML = '<div class="message err">Informe um link válido: canal da Twitch/Kick ou uma live/vídeo do YouTube.</div>';
        input.focus();
        return;
    }

    creatingChannel = true;
    button.disabled = true;
    message.textContent = 'Validando sua conta e configurando canal...';
    try {
        // Firestore stream CREATE requires a verified Firebase ID token. Reload
        // both the Auth user and token so newly verified users can continue.
        await user.reload();
        await user.getIdToken(true);
        if (!user.emailVerified) {
            message.innerHTML = '<div class="message err">Verifique seu e-mail antes de criar a transmissão. Depois, clique novamente neste botão.</div>';
            return;
        }

        const channelRef = doc(db, 'channels', user.uid);
        const channelSnap = await getDoc(channelRef);
        const existingChannel = channelSnap.exists() ? channelSnap.data() : null;
        // First try the stored stream ID; fallback to historical streams.
        let existingStream = null;
        if (existingChannel?.currentStreamId) {
            const snap = await getDoc(doc(db, 'streams', existingChannel.currentStreamId));
            if (snap.exists() && snap.data().streamerUid === user.uid) {
                existingStream = { id: snap.id, ...snap.data() };
            }
        }
        if (!existingStream) existingStream = await findStream(user.uid);
        const streamId = existingStream?.id || user.uid;
        const batch = writeBatch(db);

        if (!existingChannel) {
            // Only create the channel if absent. Never reset a user's followers
            // or channel metadata while repairing an orphan stream.
            batch.set(channelRef, {
                ownerUid: user.uid,
                channelName: String(profile?.username || user.displayName || 'Streamer').slice(0, 30),
                description: String(profile?.bio || '').slice(0, 500),
                avatarURL: safeImageUrl(profile?.photoURL || ''),
                bannerURL: '',
                categoryId: existingStream?.categoryId || 'Just Chatting',
                isLive: existingStream?.status === 'live',
                currentStreamId: streamId,
                createdAt: serverTimestamp()
            });
        } else if (existingChannel.currentStreamId !== streamId) {
            batch.update(channelRef, { currentStreamId: streamId });
        }

        if (existingStream) {
            batch.update(doc(db, 'streams', streamId), {
                playbackURL: source.canonicalUrl
            });
        } else {
            batch.set(doc(db, 'streams', streamId), {
                streamerUid: user.uid,
                channelId: user.uid,
                title: 'Minha primeira live na Zytrix',
                description: '',
                categoryId: existingChannel?.categoryId || 'Just Chatting',
                thumbnailURL: safeImageUrl(profile?.photoURL || ''),
                status: 'offline',
                playbackURL: source.canonicalUrl,
                startedAt: null,
                endedAt: null,
                createdAt: serverTimestamp(),
                viewerCount: 0
            });
        }

        await batch.commit();
        // Verify the persisted state before presenting creation as successful.
        const [savedChannel, savedStream] = await Promise.all([
            getDoc(channelRef),
            getDoc(doc(db, 'streams', streamId))
        ]);
        if (!savedChannel.exists() || !savedStream.exists()
            || savedStream.data().streamerUid !== user.uid) {
            throw new Error('channel-verification-failed');
        }
        // The next page loads the persisted channel and stream independently.
        location.href = 'config-live.html';
    } catch (error) {
        console.error('Erro ao criar/recuperar canal:', error);
        if (error?.code === 'permission-denied') {
            message.textContent = 'O banco recusou a criação. Verifique seu e-mail e as permissões da conta. Se continuar, informe o suporte.';
        } else if (error?.code === 'unavailable' || error?.code === 'auth/network-request-failed') {
            message.textContent = 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
        } else {
            message.textContent = 'Não foi possível criar o canal. Nenhuma nova tentativa será feita automaticamente.';
        }
    } finally {
        creatingChannel = false;
        if (button.isConnected) button.disabled = false;
    }
}

async function reauthenticateForDeletion() {
    const providers = user.providerData.map(item => item.providerId);
    if (providers.includes('google.com')) {
        await reauthenticateWithPopup(user, googleProvider);
        return;
    }
    if (providers.includes('password')) {
        const password = window.prompt('Para confirmar a exclusão, digite sua senha atual:');
        if (!password) throw new Error('Senha não informada.');
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        return;
    }
    throw new Error('Não foi possível reautenticar este método de login.');
}
async function deleteRefsInBatches(refs) {
    const unique = [...new Map(refs.map(ref => [ref.path, ref])).values()];
    for (let offset = 0; offset < unique.length; offset += 400) {
        const batch = writeBatch(db);
        unique.slice(offset, offset + 400).forEach(ref => batch.delete(ref));
        await batch.commit();
    }
}
async function collectAccountRefs(uid) {
    const refs = [];
    const ownLists = await Promise.all([
        getDocs(collection(db, 'users', uid, 'following')),
        getDocs(collection(db, 'users', uid, 'watchHistory')),
        getDocs(collection(db, 'channels', uid, 'followers')).catch(() => null),
        getDocs(query(collection(db, 'streams'), where('streamerUid', '==', uid)))
    ]);
    ownLists.forEach(snap => snap?.docs?.forEach(item => refs.push(item.ref)));
    try {
        const followerRefs = await getDocs(query(collectionGroup(db, 'followers'), where('uid', '==', uid)));
        followerRefs.docs.forEach(item => refs.push(item.ref));
    }
    catch (error) {
        console.warn('Não foi possível limpar todas as referências de seguidores.', error);
    }
    try {
        const ownMessages = await getDocs(query(collectionGroup(db, 'chat'), where('uid', '==', uid)));
        ownMessages.docs.forEach(item => refs.push(item.ref));
    }
    catch (error) {
        console.warn('Não foi possível limpar todas as mensagens do usuário.', error);
    }
    refs.push(
        doc(db, 'channels', uid),
        doc(db, 'wallets', uid),
        doc(db, 'profiles', uid),
        doc(db, 'users', uid)
    );
    return refs;
}
async function deleteAccount() {
    const message = document.querySelector('#delete-account-msg');
    const button = document.querySelector('#delete-account');
    const confirmation = window.prompt('Esta ação é permanente. Digite EXCLUIR para confirmar:');
    if (confirmation !== 'EXCLUIR') {
        message.innerHTML = '<div class="message err">Exclusão cancelada.</div>';
        return;
    }
    button.disabled = true;
    message.innerHTML = '<div class="message">Confirmando sua identidade...</div>';
    try {
        await reauthenticateForDeletion();
        message.innerHTML = '<div class="message">Removendo dados da conta...</div>';
        walletUnsubscribe?.();
        walletUnsubscribe = null;
        const refs = await collectAccountRefs(user.uid);
        await deleteRefsInBatches(refs);
        await deleteUser(user);
        localStorage.removeItem('zytrixSelectedStream');
        localStorage.removeItem('zytrixSelectedStreamName');
        localStorage.removeItem('zytrixSelectedStreamTitle');
        location.href = 'index.html';
    }
    catch (error) {
        console.error('Falha ao excluir conta:', error);
        const text = error?.code === 'auth/requires-recent-login'
            ? 'Entre novamente na conta e repita a exclusão.'
            : 'Não foi possível concluir a exclusão. Nenhuma nova tentativa será feita automaticamente.';
        message.innerHTML = `<div class="message err">${text}</div>`;
        button.disabled = false;
    }
}
onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
        location.href = 'login.html';
        return;
    }
    user = currentUser;
    try {
        await load();
    }
    catch (error) {
        console.error(error);
        root.innerHTML = '<div class="state">Não foi possível carregar seu perfil.</div>';
    }
});
