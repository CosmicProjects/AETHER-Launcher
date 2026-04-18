/**
 * AETHER Hot Reload Manager
 * Connects to the Dev Server Event Stream and manages launcher updates.
 */

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const PENDING_UPDATE_KEY = 'aether.pendingLauncherUpdate';
    let fallbackPendingUpdate = null;
    let updateOverlayVisible = false;

    const readPendingUpdate = () => {
        try {
            const raw = window.localStorage.getItem(PENDING_UPDATE_KEY);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (err) {
            console.warn('Unable to read pending launcher update from storage:', err);
        }

        return fallbackPendingUpdate;
    };

    const writePendingUpdate = (payload) => {
        fallbackPendingUpdate = payload;
        try {
            window.localStorage.setItem(PENDING_UPDATE_KEY, JSON.stringify(payload));
        } catch (err) {
            console.warn('Unable to persist launcher update flag:', err);
        }
    };

    const clearPendingUpdate = () => {
        fallbackPendingUpdate = null;
        try {
            window.localStorage.removeItem(PENDING_UPDATE_KEY);
        } catch (err) {
            console.warn('Unable to clear launcher update flag:', err);
        }
    };

    const parseMessage = (raw) => {
        if (typeof raw !== 'string') {
            return { type: 'reload' };
        }

        const trimmed = raw.trim();
        if (!trimmed) {
            return { type: 'reload' };
        }

        if (trimmed === 'reload') {
            return { type: 'reload' };
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && parsed.type) {
                return parsed;
            }
        } catch (err) {
            // Fall through to a generic reload.
        }

        return { type: 'reload', raw: trimmed };
    };

    const unregisterServiceWorkers = async () => {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }
    };

    const reloadLauncher = async () => {
        try {
            await unregisterServiceWorkers();
        } catch (err) {
            console.warn('Failed to unregister service workers before reload:', err);
        }

        window.location.reload();
    };

    const getOverlayElements = () => ({
        overlay: document.getElementById('launcher-update-overlay'),
        title: document.getElementById('launcher-update-title'),
        copy: document.getElementById('launcher-update-copy'),
        file: document.getElementById('launcher-update-file'),
        reload: document.getElementById('launcher-update-reload'),
        dismiss: document.getElementById('launcher-update-dismiss')
    });

    const showLauncherUpdateOverlay = (payload) => {
        const { overlay, title, copy, file } = getOverlayElements();
        if (!overlay) return;

        const fileName = payload?.file || 'launcher.bat';

        if (title) title.textContent = 'Launcher Update Ready';
        if (copy) {
            copy.textContent = `The launcher batch file changed${fileName ? ` (${fileName})` : ''}. Reload when you return to pick up the latest version.`;
        }
        if (file) file.textContent = fileName;

        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        updateOverlayVisible = true;

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    };

    const hideLauncherUpdateOverlay = () => {
        const { overlay } = getOverlayElements();
        if (!overlay) return;

        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        updateOverlayVisible = false;
    };

    const maybeShowPendingLauncherUpdate = () => {
        const pending = readPendingUpdate();
        if (!pending) return;
        if (document.visibilityState !== 'visible') return;

        showLauncherUpdateOverlay(pending);
    };

    const queueLauncherUpdate = (payload) => {
        const nextPayload = {
            type: 'launcher-update',
            file: payload.file || 'launcher.bat',
            detectedAt: payload.detectedAt || Date.now()
        };

        writePendingUpdate(nextPayload);

        if (updateOverlayVisible) {
            showLauncherUpdateOverlay(nextPayload);
        }
    };

    const bindLauncherUpdateControls = () => {
        const { reload, dismiss } = getOverlayElements();

        if (reload) {
            reload.addEventListener('click', async () => {
                clearPendingUpdate();
                await reloadLauncher();
            });
        }

        if (dismiss) {
            dismiss.addEventListener('click', () => {
                clearPendingUpdate();
                hideLauncherUpdateOverlay();
            });
        }
    };

    const eventSource = new EventSource('/aether-reload');

    eventSource.onopen = () => {
        console.log('📡 AETHER Hot Reload Active: Pro Dev Monitoring Connected.');
    };

    eventSource.onmessage = (event) => {
        const message = parseMessage(event.data);

        if (message.type === 'launcher-update') {
            console.log(`🧾 Launcher batch file updated: ${message.file || 'launcher.bat'}`);
            queueLauncherUpdate(message);
            return;
        }

        if (message.type === 'reload') {
            if (readPendingUpdate()) {
                console.log('🧾 Launcher update pending. Skipping immediate reload until you return to the site.');
                return;
            }

            console.log('📦 AETHER Files Changed: Refreshing Launcher...');
            reloadLauncher();
        }
    };

    eventSource.onerror = () => {
        console.warn('📡 AETHER Hot Reload Sync Lost. Server may be offline.');
        eventSource.close();

        if (readPendingUpdate()) {
            return;
        }

        setTimeout(() => window.location.reload(), 3000);
    };

    document.addEventListener('visibilitychange', maybeShowPendingLauncherUpdate);
    window.addEventListener('focus', maybeShowPendingLauncherUpdate);
    window.addEventListener('pageshow', maybeShowPendingLauncherUpdate);

    bindLauncherUpdateControls();
    maybeShowPendingLauncherUpdate();
}
