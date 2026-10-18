import { validTargetId } from './report-model.js';

export function chatReportTargets(messageId, uid, contextId) {
    const result = [];
    if (validTargetId(messageId) && validTargetId(contextId))
        result.push({ label: 'Denunciar mensagem', href: '/denunciar?' + new URLSearchParams({ targetType: 'chat', targetId: messageId, contextId }) });
    if (validTargetId(uid))
        result.push({ label: 'Denunciar perfil', href: '/denunciar?' + new URLSearchParams({ targetType: 'profile', targetId: uid, contextId: '-' }) });
    return result;
}

export function menuPosition(anchor, menu, viewport) {
    const gap = 8;
    const height = Math.min(menu.height, Math.max(0, viewport.height - gap * 2));
    return {
        left: Math.max(gap, Math.min(anchor.right - menu.width, viewport.width - menu.width - gap)),
        top: Math.max(gap, Math.min(anchor.bottom + 4 + height <= viewport.height - gap
            ? anchor.bottom + 4 : anchor.top - height - 4, viewport.height - height - gap)),
        maxHeight: Math.max(0, viewport.height - gap * 2)
    };
}

const controllers = new WeakMap();
let menuSequence = 0;
export function createChatReportActions(root, available) {
    if (controllers.has(root)) return controllers.get(root);
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const data = new WeakMap();
    const menu = doc.createElement('div');
    menu.className = 'chat-report-menu';
    menu.id = `chat-report-menu-${++menuSequence}`;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Ações da mensagem');
    menu.hidden = true;
    doc.body.append(menu);
    let opener = null;
    let restoreId = null;
    let disposed = false;
    let availability;
    function close(restoreFocus = false) {
        const previous = opener;
        opener = null;
        menu.hidden = true;
        menu.replaceChildren();
        if (previous) {
            previous.setAttribute('aria-expanded', 'false');
            previous.closest('.chat-message')?.classList.remove('chat-report-open');
            if (restoreFocus && previous.isConnected) previous.focus({ preventScroll: true });
        }
    }
    function open(button) {
        close();
        opener = button;
        button.setAttribute('aria-expanded', 'true');
        button.closest('.chat-message')?.classList.add('chat-report-open');
        for (const target of data.get(button).targets) {
            const link = doc.createElement('a');
            link.href = target.href;
            link.textContent = target.label;
            link.setAttribute('role', 'menuitem');
            link.tabIndex = -1;
            menu.append(link);
        }
        menu.hidden = false;
        const position = menuPosition(button.getBoundingClientRect(), menu.getBoundingClientRect(), { width: win.innerWidth, height: win.innerHeight });
        Object.assign(menu.style, { left: `${position.left}px`, top: `${position.top}px`, maxHeight: `${position.maxHeight}px` });
        menu.firstElementChild?.focus({ preventScroll: true });
    }
    function click(event) {
        const button = event.target.closest?.('.chat-report-trigger');
        if (button && root.contains(button) && data.has(button)) {
            event.preventDefault();
            event.stopPropagation();
            if (opener === button) close(true); else open(button);
        } else if (menu.contains(event.target)) close();
    }
    function outside(event) {
        if (opener && !menu.contains(event.target) && !opener.contains(event.target)) close();
    }
    function keydown(event) {
        const button = event.target.closest?.('.chat-report-trigger');
        if (button && root.contains(button) && data.has(button) && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault(); open(button);
            if (event.key === 'ArrowUp') menu.lastElementChild?.focus();
            return;
        }
        if (!opener) return;
        if (event.key === 'Escape') { event.preventDefault(); close(true); }
        else if (event.key === 'Tab') close(true);
        else if (menu.contains(event.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const items = [...menu.children];
            const index = items.indexOf(doc.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
        }
    }
    function viewportChange(event) {
        // Keep a tall menu scrollable on short screens; chat/page scroll closes it.
        if (event?.target && menu.contains(event.target)) return;
        close(true);
    }
    const observer = new win.MutationObserver(() => { if (opener && !opener.isConnected) close(); });
    observer.observe(root, { childList: true, subtree: true });
    doc.addEventListener('click', click);
    doc.addEventListener('pointerdown', outside);
    doc.addEventListener('keydown', keydown);
    doc.addEventListener('scroll', viewportChange, true);
    win.addEventListener('resize', viewportChange);
    win.visualViewport?.addEventListener('resize', viewportChange);
    const controller = {
        close,
        beforeRender() {
            const focused = opener || doc.activeElement;
            restoreId = data.get(focused)?.messageId || null;
            close();
        },
        async add(article, messageId, uid, contextId) {
            const targets = chatReportTargets(messageId, uid, contextId);
            if (!targets.length) return;
            try {
                availability ??= Promise.resolve().then(available);
                if (!await availability || disposed || !article.isConnected || article.querySelector('.chat-report-trigger')) return;
            } catch { return; }
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'chat-report-trigger';
            button.textContent = '⋯';
            button.setAttribute('aria-label', 'Mais ações da mensagem');
            button.setAttribute('aria-haspopup', 'menu');
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-controls', menu.id);
            data.set(button, { targets, messageId });
            const scroller = article.closest('.chat-messages');
            const atBottom = scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
            article.classList.add('has-report-actions');
            article.append(button);
            if (atBottom) scroller.scrollTop = scroller.scrollHeight;
            if (restoreId === messageId) { restoreId = null; button.focus({ preventScroll: true }); }
        },
        dispose() {
            disposed = true;
            close(); observer.disconnect(); menu.remove();
            doc.removeEventListener('click', click);
            doc.removeEventListener('pointerdown', outside);
            doc.removeEventListener('keydown', keydown);
            doc.removeEventListener('scroll', viewportChange, true);
            win.removeEventListener('resize', viewportChange);
            win.visualViewport?.removeEventListener('resize', viewportChange);
            controllers.delete(root);
        }
    };
    controllers.set(root, controller);
    return controller;
}
