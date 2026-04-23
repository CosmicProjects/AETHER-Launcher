const SITE_VERSION_PATH = './site-version.json';
const UPDATE_CHECK_INTERVAL_MS = 60_000;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function isLocalHost() {
    return LOCAL_HOSTNAMES.has(window.location.hostname) || window.location.protocol === 'file:';
}

function getCurrentBuildVersion() {
    return String(window.__AETHER_SITE_BUILD__ || '').trim();
}

function getBuildVersionFromDom() {
    return String(document.getElementById('app')?.dataset.siteBuild || '').trim();
}

function getBuildManifestUrl() {
    const url = new URL(SITE_VERSION_PATH, window.location.href);
    url.searchParams.set('_', Date.now().toString());
    return url.toString();
}

function formatBuildTime(value) {
    if (!value) {
        return 'Published just now';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Published just now';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function refreshIcons() {
    globalThis.lucide?.createIcons?.();
}

class SiteUpdatesManager {
    constructor() {
        this.currentVersion = null;
        this.latestManifest = null;
        this.started = false;
        this.checkIntervalId = null;
        this.boundVisibilityHandler = null;
        this.boundReloadHandler = null;
    }

    resolveCurrentVersion() {
        return getCurrentBuildVersion() || getBuildVersionFromDom() || 'local-dev';
    }

    get banner() {
        return document.getElementById('site-update-banner');
    }

    get bannerCopy() {
        return document.getElementById('site-update-copy');
    }

    get bannerMeta() {
        return document.getElementById('site-update-meta');
    }

    get reloadButton() {
        return document.getElementById('site-update-reload');
    }

    get badge() {
        return document.getElementById('site-update-badge');
    }

    setBannerVisible(visible) {
        const banner = this.banner;
        if (!banner) {
            return;
        }

        banner.setAttribute('aria-hidden', visible ? 'false' : 'true');
        banner.classList.toggle('pointer-events-none', !visible);
        banner.classList.toggle('max-h-0', !visible);
        banner.classList.toggle('opacity-0', !visible);
        banner.classList.toggle('-translate-y-2', !visible);
        banner.classList.toggle('max-h-48', visible);
        banner.classList.toggle('opacity-100', visible);
        banner.classList.toggle('translate-y-0', visible);
        banner.classList.toggle('border-transparent', !visible);
        banner.classList.toggle('border-amber-300/20', visible);
    }

    setBadgeVisible(visible, manifest) {
        const badge = this.badge;
        if (!badge) {
            return;
        }

        if (!visible) {
            badge.classList.add('hidden');
            badge.setAttribute('aria-hidden', 'true');
            badge.removeAttribute('title');
            return;
        }

        badge.classList.remove('hidden');
        badge.setAttribute('aria-hidden', 'false');
        badge.innerHTML = `
            <i data-lucide="sparkles" class="w-3 h-3 pointer-events-none"></i>
            <span>Site update</span>
        `;

        if (manifest?.builtAt) {
            badge.title = `Published ${formatBuildTime(manifest.builtAt)}`;
        } else {
            badge.removeAttribute('title');
        }

        refreshIcons();
    }

    showUpdate(manifest) {
        this.latestManifest = manifest;
        const banner = this.banner;
        const bannerCopy = this.bannerCopy;
        const bannerMeta = this.bannerMeta;

        if (bannerCopy) {
            bannerCopy.textContent = 'Reload to pick up the latest site version.';
        }

        if (bannerMeta) {
            bannerMeta.textContent = manifest?.builtAt
                ? `Published ${formatBuildTime(manifest.builtAt)}`
                : 'Published just now';
        }

        this.setBannerVisible(true);
        this.setBadgeVisible(true, manifest);
        refreshIcons();

        if (banner) {
            banner.dataset.siteVersion = manifest?.version || '';
        }
    }

    hideUpdate() {
        this.latestManifest = null;
        this.setBannerVisible(false);
        this.setBadgeVisible(false);
    }

    async fetchManifest() {
        const response = await fetch(getBuildManifestUrl(), {
            cache: 'no-store',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error(`Site version request failed with ${response.status}`);
        }

        const manifest = await response.json();
        if (!manifest || typeof manifest !== 'object') {
            throw new Error('Site version response was not a JSON object');
        }

        return manifest;
    }

    async checkForUpdate() {
        if (isLocalHost()) {
            this.hideUpdate();
            return null;
        }

        try {
            const manifest = await this.fetchManifest();
            const version = String(manifest.version || manifest.builtAt || '').trim();

            if (!version) {
                return null;
            }

            manifest.version = version;
            this.latestManifest = manifest;

            if (!this.currentVersion) {
                this.currentVersion = this.resolveCurrentVersion();
                this.hideUpdate();
                return manifest;
            }

            if (version !== this.currentVersion) {
                this.showUpdate(manifest);
            } else {
                this.hideUpdate();
            }

            return manifest;
        } catch (error) {
            console.warn('Unable to check for site updates:', error);
            return null;
        }
    }

    handleReloadRequest() {
        const manifestVersion = this.latestManifest?.version;
        const nextUrl = new URL(window.location.href);

        if (manifestVersion) {
            nextUrl.searchParams.set('site-update', manifestVersion);
        } else {
            nextUrl.searchParams.set('site-update', Date.now().toString());
        }

        window.location.assign(nextUrl.toString());
    }

    bindEvents() {
        const reloadButton = this.reloadButton;

        if (reloadButton && !this.boundReloadHandler) {
            this.boundReloadHandler = () => {
                this.handleReloadRequest();
            };
            reloadButton.addEventListener('click', this.boundReloadHandler);
        }

        if (!this.boundVisibilityHandler) {
            this.boundVisibilityHandler = () => {
                if (!document.hidden) {
                    void this.checkForUpdate();
                }
            };
            document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        }
    }

    async start() {
        if (this.started) {
            return;
        }

        this.started = true;
        this.currentVersion = this.resolveCurrentVersion();
        this.bindEvents();

        if (isLocalHost()) {
            this.hideUpdate();
            return;
        }

        await this.checkForUpdate();
        this.checkIntervalId = window.setInterval(() => {
            if (!document.hidden) {
                void this.checkForUpdate();
            }
        }, UPDATE_CHECK_INTERVAL_MS);
    }
}

export const siteUpdates = new SiteUpdatesManager();
