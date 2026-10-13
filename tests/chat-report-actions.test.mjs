import test from 'node:test';
import assert from 'node:assert/strict';
import { chatReportTargets, menuPosition } from '../assets/js/chat-report-actions.js';

test('report targets preserve chat context and existing safe report routes', () => {
    const targets = chatReportTargets('message-1', 'user-1', 'stream-1');
    assert.equal(targets.length, 2);
    const chat = new URL(targets[0].href, 'https://zytrix-lives.vercel.app');
    assert.equal(chat.pathname, '/denunciar');
    assert.equal(chat.searchParams.get('targetType'), 'chat');
    assert.equal(chat.searchParams.get('contextId'), 'stream-1');
    assert.equal(new URL(targets[1].href, chat).searchParams.get('contextId'), '-');
});

test('rejects injected identifiers and invalid contexts without unsafe links', () => {
    for (const value of ['javascript:alert(1)', '<img onerror=alert(1)>', '../user', '', 'a'.repeat(129)]) {
        assert.deepEqual(chatReportTargets(value, value, value), []);
    }
    assert.equal(chatReportTargets('message', 'user', '../stream').length, 1);
    assert.equal(chatReportTargets('message', 'neon:5f2da840-1097-469d-b442-10d089153186', 'stream').length, 2);
});

test('menu flips and clamps at viewport edges including narrow and short screens', () => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 180 }, { width: 1350, height: 928 }]) {
        for (const anchor of [{ right: 31, top: 0, bottom: 32 }, { right: viewport.width, top: viewport.height - 44, bottom: viewport.height }]) {
            const menu = { width: 180, height: 100 };
            const p = menuPosition(anchor, menu, viewport);
            assert.ok(p.left >= 8 && p.left + menu.width <= viewport.width - 8);
            assert.ok(p.top >= 8 && p.top + Math.min(menu.height, p.maxHeight) <= viewport.height - 8);
        }
    }
});

// Minimal DOM adapter: real controller code runs without a browser dependency.
function dom() {
    class Element {
        constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.style = {}; this.parentElement = null; this.className = ''; this.hidden = false; this.ownerDocument = document; this.classList = { add: c => { this.className += ' ' + c; }, remove: c => { this.className = this.className.split(' ').filter(v => v !== c).join(' '); } }; }
        get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
        get firstElementChild() { return this.children[0]; }
        get lastElementChild() { return this.children.at(-1); }
        append(child) { this.children.push(child); child.parentElement = this; }
        remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
        replaceChildren() { for (const child of [...this.children]) child.remove(); }
        setAttribute(key, value) { this.attributes[key] = value; }
        getAttribute(key) { return this.attributes[key] ?? null; }
        contains(child) { return child === this || this.children.some(c => c.contains(child)); }
        matches(selector) { return selector.startsWith('.') && this.className.split(' ').includes(selector.slice(1)); }
        closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
        querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
        focus() { document.activeElement = this; }
        getBoundingClientRect() { return { right: 380, top: 500, bottom: 532, width: 180, height: 80 }; }
    }
    const listeners = new Map();
    const windowListeners = new Map();
    const observerCallbacks = [];
    const window = { innerWidth: 390, innerHeight: 600,
        addEventListener: (name, fn) => windowListeners.set(name, fn), removeEventListener: name => windowListeners.delete(name),
        MutationObserver: class { constructor(fn) { observerCallbacks.push(fn); } observe() {} disconnect() {} }
    };
    const document = { defaultView: window, createElement: tag => new Element(tag), activeElement: null,
        addEventListener(name, fn) { if (listeners.has(name)) throw new Error('duplicate listener'); listeners.set(name, fn); },
        removeEventListener(name) { listeners.delete(name); }
    };
    document.body = new Element('body'); document.activeElement = document.body;
    const root = new Element('section'); document.body.append(root);
    return { document, root, listeners, windowListeners, observerCallbacks,
        message() { const article = new Element('article'); article.className = 'chat-message'; root.append(article); return article; },
        event(name, target, key) { const event = { target, key, preventDefault() {}, stopPropagation() {} }; listeners.get(name)?.(event); }
    };
}
const { createChatReportActions } = await import('../assets/js/chat-report-actions.js');

test('delegated controller handles keyboard, outside clicks, action selection and one menu', async () => {
    const d = dom(); let calls = 0;
    const c = createChatReportActions(d.root, () => { calls++; return true; });
    assert.equal(createChatReportActions(d.root, () => false), c);
    const a = d.message(), b = d.message();
    await Promise.all([c.add(a, 'm1', 'u1', 's1'), c.add(b, 'm2', 'u2', 's1')]);
    const first = a.querySelector('.chat-report-trigger'), second = b.querySelector('.chat-report-trigger');
    const menu = d.document.body.querySelector('.chat-report-menu');
    assert.equal(calls, 1); assert.equal(d.listeners.size, 4);
    d.event('click', first); assert.equal(first.getAttribute('aria-expanded'), 'true'); assert.equal(menu.children.length, 2);
    assert.equal(d.document.activeElement, menu.firstElementChild);
    d.event('keydown', menu.firstElementChild, 'ArrowDown'); assert.equal(d.document.activeElement, menu.lastElementChild);
    d.event('click', second); assert.equal(first.getAttribute('aria-expanded'), 'false'); assert.equal(second.getAttribute('aria-expanded'), 'true');
    d.event('keydown', menu.firstElementChild, 'Escape'); assert.equal(menu.hidden, true); assert.equal(d.document.activeElement, second);
    d.event('keydown', first, 'ArrowDown'); assert.equal(menu.hidden, false);
    d.event('keydown', menu.firstElementChild, 'Tab'); assert.equal(menu.hidden, true); assert.equal(d.document.activeElement, first);
    d.event('click', first); d.event('pointerdown', d.document.body); assert.equal(menu.hidden, true);
    d.event('click', first); const link = menu.firstElementChild; assert.equal(link.getAttribute('role'), 'menuitem');
    d.event('click', link); assert.equal(menu.hidden, true);
    c.dispose(); assert.equal(d.listeners.size, 0); assert.equal(d.windowListeners.size, 0); assert.equal(menu.isConnected, false);
});

test('real-time replacements restore keyboard focus, cache availability and do not add listeners', async () => {
    const d = dom(); const c = createChatReportActions(d.root, () => true);
    let article = d.message(); await c.add(article, 'm1', 'u1', 's1');
    const original = article.querySelector('.chat-report-trigger'); original.focus();
    c.beforeRender(); d.root.replaceChildren(); article = d.message(); await c.add(article, 'm1', 'u1', 's1');
    assert.equal(d.document.activeElement, article.querySelector('.chat-report-trigger'));
    for (let i = 0; i < 50; i++) { c.beforeRender(); d.root.replaceChildren(); await c.add(d.message(), 'm1', 'u1', 's1'); }
    assert.equal(d.listeners.size, 4); assert.equal(d.document.body.children.filter(x => x.className === 'chat-report-menu').length, 1);
    d.event('click', d.root.querySelector('.chat-report-trigger')); d.root.replaceChildren(); d.observerCallbacks[0]();
    assert.equal(d.document.body.querySelector('.chat-report-menu').hidden, true); c.dispose();
});

test('disabled, failed and stale report availability never creates action controls', async () => {
    for (const available of [() => false, () => { throw new Error('offline'); }]) {
        const d = dom(); const c = createChatReportActions(d.root, available); const article = d.message();
        await c.add(article, 'm1', 'u1', 's1'); assert.equal(article.children.length, 0); c.dispose();
    }
    const d = dom(); let resolve;
    const c = createChatReportActions(d.root, () => new Promise(r => { resolve = r; }));
    const article = d.message(); const pending = c.add(article, 'm1', 'u1', 's1');
    await Promise.resolve(); article.remove(); resolve(true); await pending; assert.equal(article.children.length, 0); c.dispose();
});
