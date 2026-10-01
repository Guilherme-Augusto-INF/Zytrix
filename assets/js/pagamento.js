import {createBackendSource} from './backend-source.js';
const paymentSource=createBackendSource();
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, collection } from './firebase.js';
import { header, footer } from './ui.js';
header();
footer();
const raw = localStorage.getItem('zytrixSelectedCoinPackage');
let pack=null;try{const id=JSON.parse(raw??'null')?.id;pack=[{id:'zy100',coins:100,priceCents:490},{id:'zy500',coins:500,priceCents:1490},{id:'zy1200',coins:1200,priceCents:2990},{id:'zy2500',coins:2500,priceCents:4990}].find(p=>p.id===id)??null;}catch{}
const neonPayment=await paymentSource.staging();
const root = document.querySelector('#payment-root');
let user = null, isAdmin = false;
function render() { if (!pack) {
    root.innerHTML = '<div class="state">Nenhum pacote selecionado. <a href="loja.html">Voltar à loja</a></div>';
    return;
} root.innerHTML = `<div class="card panel" style="max-width:620px;margin:auto"><div class="eyebrow">Pagamento</div><h1>Finalizar pedido</h1><div class="info-row"><strong>Zy Coins</strong><span class="coin-pill">◈ ${pack.coins.toLocaleString('pt-BR')}</span></div><div class="info-row"><strong>Total</strong><span>R$ ${(pack.priceCents / 100).toFixed(2).replace('.', ',')}</span></div><div class="form-group"><label>Forma de pagamento</label><select id="method" class="input"><option value="pix">PIX</option><option value="card">Cartão (simulação)</option></select></div><p class="muted">Esta tela é uma simulação. O projeto não coleta dados reais de cartão.</p><button id="pay" class="btn btn-primary">${isAdmin ? 'Simular pagamento aprovado' : 'Criar pedido pendente'}</button><div id="pay-msg"></div></div>`; if(neonPayment){document.querySelector('#method').closest('.form-group').remove();document.querySelector('#pay').textContent='Abrir Stripe sandbox';const note=root.querySelector('p.muted');note.textContent='Stripe em modo de teste. O saldo será atualizado somente após confirmação pelo webhook.';}document.querySelector('#pay').onclick = pay; }
async function pay() { const msg = document.querySelector('#pay-msg'); if (!user) {
    msg.innerHTML = '<div class="message err">Faça login para continuar.</div>';
    return;
} const method = document.querySelector('#method')?.value; try {
    if(neonPayment){
      const key='zytrix-checkout:'+user.uid+':'+pack.id;
      const requestKey=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,requestKey);
      const response=await fetch('/api/v1/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({packageId:pack.id,requestKey}),cache:'no-store',signal:AbortSignal.timeout(30000)});
      const result=await response.json();if(!response.ok||result.sandbox!==true||!result.url?.startsWith('https://checkout.stripe.com/'))throw Error('checkout_unavailable');
      sessionStorage.removeItem(key);location.assign(result.url);return;
    }

    const orderRef = doc(collection(db, 'zyCoinOrders'));
    if (isAdmin) {
        await runTransaction(db, async (tx) => { const walletRef = doc(db, 'wallets', user.uid), ws = await tx.get(walletRef); if (!ws.exists())
            throw new Error('Crie sua carteira abrindo a Loja primeiro.'); const w = ws.data(); tx.set(orderRef, { uid: user.uid, packageId: pack.id, coins: pack.coins, priceCents: pack.priceCents, paymentMethod: method, status: 'paid', mode: 'admin_demo', createdAt: serverTimestamp(), paidAt: serverTimestamp() }); tx.update(walletRef, { balance: Number(w.balance || 0) + pack.coins, updatedAt: serverTimestamp() }); });
        msg.innerHTML = '<div class="message ok">Pagamento demonstrativo aprovado e Zy Coins creditadas.</div>';
    }
    else {
        await setDoc(orderRef, { uid: user.uid, packageId: pack.id, coins: pack.coins, priceCents: pack.priceCents, paymentMethod: method, status: 'pending', mode: 'prototype', createdAt: serverTimestamp(), paidAt: null });
        msg.innerHTML = '<div class="message ok">Pedido criado como pendente. Nenhum pagamento real foi processado.</div>';
    }
}
catch (err) {
    console.error(err);
    msg.innerHTML = '<div class="message err">Não foi possível criar o pedido.</div>';
} }
onAuthStateChanged(auth, async (u) => { user = u; if (u) {
    const a = await getDoc(doc(db, 'admins', u.uid)).catch(() => null);
    isAdmin = !!a?.exists() && a.data().active === true;
} render(); });
