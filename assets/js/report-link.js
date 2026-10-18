import { reportAvailability } from './report-service.js';
import { validTargetId } from './report-model.js';
let availability;
export function reportsAvailable() {
    availability ??= reportAvailability();
    return availability;
}
export async function reportLink(root, targetType, targetId, contextId = '-', placement = 'after') {
    if (!root || !validTargetId(targetId))
        return;
    try {
        if (!await reportsAvailable() || !root.isConnected)
            return;
    }
    catch {
        return;
    }
    const a = document.createElement('a');
    a.href = '/denunciar?' + new URLSearchParams({ targetType, targetId, contextId });
    a.textContent = targetType === 'profile' ? 'Denunciar perfil' : targetType === 'chat' ? 'Denunciar mensagem' : 'Denunciar live';
    a.className = 'btn';
    if (placement === 'append')
        root.append(a);
    else
        root.insertAdjacentElement('afterend', a);
}
