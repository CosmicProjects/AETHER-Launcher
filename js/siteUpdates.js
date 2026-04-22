const SITE_BUILD_STORAGE_KEY = 'aether.lastSeenSiteBuildVersion';
const MANIFEST_PATHS = ['site-build.json', 'public/site-build.json'];
const POLL_INTERVAL_MS = 5 * 60 * 1000;

let updateOverlayBound = false;
let fallbackSeenVersion = null;
let pollHandle = null;

function isLocalLikeHost() {
    if (typeof window === 'undefined') {
        return true;
    }

    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || window.location.protocol === 'file:';
}

function getManifestUrls() {
    if (typeof window === 'undefined') {
        return [];
    }

    return MANIFEST_PATHS.map(pathname => new URL(pathname, window.location.href).toString());
}

function shortVersion(version) {
    const value = String(version || '').trim();
    if (!value) {
        return 'latest';
    }

    return value.length > 12 ? value.slice(0, 12) : value;
}

function normalizeBuildManifest(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const version = String(raw.version || '').trim();
    if (!version) {
        return null;
    }

    const builtAt = String(raw.builtAt || '').trim();
    const label = String(raw.label || '').trim() || `Build ${shortVersion(version)}`;

    return { version, builtAt, label };
}

function formatBuiltAt(isoString) {
    if (!isoString) {
        return '';
    }

    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function readSeenVersion() {
    try {
        const stored = window.localStorage.getItem(SITE_BUILD_STORAGE_KEY);
        if (stored) {
            return stored;
        }
    } catch (error) {
        console.warn('Unable to read site build state from storage:', error);
    }

    return fallbackSeenVersion;
}

function writeSeenVersion(version) {
    fallbackSeenVersion = version;

    try {
        window.localStorage.setItem(SITE_BUILD_STORAGE_KEY, version);
    } catch (error) {
        console.warn('Unable to persist site build state:', error);
    }
}

function getOverlayElements() {
    return {
        overlay: document.getElementById('launcher-update-overlay'),
        title: document.getElementById('launcher-update-title'),
        copy: document.getElementById('launcher-update-copy'),
        file: document.getElementById('launcher-update-file'),
        reload: document.getElementById('launcher-update-reload'),
        dismiss: document.getElementById('launcher-update-dismiss')
    };
}

function showUpdateOverlay(manifest) {
    const { overlay, title, copy, file } = getOverlayElements();
    if (!overlay) {
        return;
    }

    const versionLabel = manifest?.label || `Build ${shortVersion(manifest?.version)}`;
    const builtAtLabel = formatBuiltAt(manifest?.builtAt);

    if (title) {
        title.textContent = 'Site Update Ready';
    }

    if (copy) {
        copy.textContent = builtAtLabel
            ? `A newer build is live. Built ${builtAtLabel}. Reload to load the latest launcher shell, styles, and catalog data.`
            : 'A newer build is live. Reload to load the latest launcher shell, styles, and catalog data.';
    }

    if (file) {
        file.textContent = versionLabel;
    }

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function hideUpdateOverlay() {
    const { overlay } = getOverlayElements();
    if (!overlay) {
        return;
    }

    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}

async function fetchBuildManifest() {
    if (typeof window === 'undefined') {
        return null;
    }

    for (const manifestUrl of getManifestUrls()) {
        try {
            const response = await fetch(manifestUrl, { cache: 'no-store' });
            if (!response.ok) {
                continue;
            }

            const manifest = normalizeBuildManifest(await response.json());
            if (manifest) {
                return manifest;
            }
        } catch (error) {
            console.warn(`Unable to load site build manifest from ${manifestUrl}:`, error);
        }
    }

    return null;
}

async function checkForSiteUpdate() {
    if (isLocalLikeHost()) {
        return;
    }

    const manifest = await fetchBuildManifest();
    if (!manifest) {
        return;
    }

    const seenVersion = readSeenVersion();
    if (!seenVersion) {
        writeSeenVersion(manifest.version);
        return;
    }

    if (seenVersion === manifest.version) {
        return;
    }

    writeSeenVersion(manifest.version);
    showUpdateOverlay(manifest);
}

function bindUpdateControls() {
    if (updateOverlayBound || typeof window === 'undefined') {
        return;
    }

    updateOverlayBound = true;

    const { reload, dismiss } = getOverlayElements();

    if (reload) {
        reload.addEventListener('click', () => {
            window.location.reload();
        });
    }

    if (dismiss) {
        dismiss.addEventListener('click', () => {
            hideUpdateOverlay();
        });
    }
}

function scheduleChecks() {
    const runCheck = () => {
        void checkForSiteUpdate();
    };

    runCheck();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            runCheck();
        }
    });

    window.addEventListener('focus', runCheck);
    window.addEventListener('pageshow', runCheck);

    pollHandle = window.setInterval(runCheck, POLL_INTERVAL_MS);
}

export function startSiteUpdateMonitor() {
    if (typeof window === 'undefined' || isLocalLikeHost()) {
        return;
    }

    if (pollHandle) {
        return;
    }

    bindUpdateControls();
    scheduleChecks();
}
