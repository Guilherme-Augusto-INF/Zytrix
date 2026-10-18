/* GTM Consent Mode (basic): do not fetch Google scripts before analytics opt-in. */
(() => {
  'use strict';
  const CONTAINER_ID = 'GTM-M44CGG92';
  const KEY = 'zytrix.analytics-consent.v1';
  const SOURCE = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(CONTAINER_ID);
  const CONSENT_DEFAULT = {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    personalization_storage: 'denied'
  };
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', CONSENT_DEFAULT);
  let active = false;
  let panel;
  function readChoice() {
    try {
      const choice = localStorage.getItem(KEY);
      return choice === 'accepted' || choice === 'rejected' ? choice : null;
    } catch { return null; }
  }
  function saveChoice(choice) {
    try { localStorage.setItem(KEY, choice); } catch { /* No persistent storage: ask again on next visit. */ }
  }
  function enableMetrics() {
    if (active) return;
    active = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = SOURCE;
    script.dataset.zytrixGtm = CONTAINER_ID;
    document.head.appendChild(script);
  }
  function setChoice(choice) {
    const wasActive = active;
    saveChoice(choice);
    if (choice === 'accepted') enableMetrics();
    if (choice === 'rejected' && wasActive) {
      // Already executed tags cannot be reliably unloaded. Revoke and reload.
      gtag('consent', 'update', { analytics_storage: 'denied' });
      location.reload();
      return;
    }
    panel?.remove();
    panel = null;
  }
  function showPanel() {
    if (panel) return;
    panel = document.createElement('section');
    panel.className = 'zytrix-cookie-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Preferências de cookies e métricas');
    const title = document.createElement('h2');
    title.textContent = 'Privacidade e métricas';
    const description = document.createElement('p');
    description.textContent = 'O Zytrix usa armazenamento necessário para funcionar. Com sua permissão, o Google Tag Manager pode carregar métricas de visitas. Você pode mudar a escolha quando quiser.';
    const links = document.createElement('p');
    const policy = document.createElement('a');
    policy.href = '/privacidade';
    policy.textContent = 'Política de Privacidade';
    links.appendChild(policy);
    const actions = document.createElement('div');
    actions.className = 'zytrix-cookie-actions';
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'zytrix-cookie-reject';
    reject.textContent = 'Recusar métricas';
    reject.addEventListener('click', () => setChoice('rejected'));
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'zytrix-cookie-accept';
    accept.textContent = 'Aceitar métricas';
    accept.addEventListener('click', () => setChoice('accepted'));
    actions.append(reject, accept);
    panel.append(title, description, links, actions);
    document.body.appendChild(panel);
  }
  function attachSettings() {
    if (document.getElementById('zytrix-cookie-settings')) return;
    const button = document.createElement('button');
    button.id = 'zytrix-cookie-settings';
    button.type = 'button';
    button.textContent = 'Preferências de cookies';
    button.addEventListener('click', showPanel);
    const footer = document.querySelector('footer');
    if (footer) {
      button.className = 'zytrix-cookie-settings';
      footer.appendChild(button);
    } else {
      button.className = 'zytrix-cookie-settings zytrix-cookie-settings-floating';
      document.body.appendChild(button);
    }
  }
  const choice = readChoice();
  if (choice === 'accepted') enableMetrics();
  function init() {
    attachSettings();
    if (choice === null) showPanel();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
