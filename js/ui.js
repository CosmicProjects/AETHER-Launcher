/**
 * AETHER UI Manager
 * Handles all visual rendering, layout switching, and window management.
 */

import { storage } from './storage.js';
import { gameEngine } from './gameEngine.js';
import { env } from './envDetector.js';
import { generateTitleArtwork } from './artwork.js';
import {
    getAetherConfig,
    getConfiguredSupabaseConfig,
    getPublicLibraryApiUrl as readPublicLibraryApiUrl
} from './runtimeConfig.js';

const DEFAULT_THEME_ID = 'unicorn';

const THEME_DEFINITIONS = [
    {
        id: 'unicorn',
        name: 'Unicorn',
        description: 'Pink, lilac, and ice for a dreamy neon finish.',
        colors: ['#ff7ad9', '#8b5cf6', '#73e9ff'],
        bg: '#120c1f',
        card: '#1b1330'
    },
    {
        id: 'aurora',
        name: 'Aurora',
        description: 'Mint, sky, and violet with a cool northern glow.',
        colors: ['#34d399', '#60a5fa', '#a78bfa'],
        bg: '#08131e',
        card: '#111d33'
    },
    {
        id: 'sunset',
        name: 'Sunset',
        description: 'Coral, tangerine, and gold for warm energy.',
        colors: ['#fb7185', '#fb923c', '#facc15'],
        bg: '#190e13',
        card: '#28131d'
    },
    {
        id: 'ocean',
        name: 'Ocean',
        description: 'Sky, teal, and cobalt with a deep-water base.',
        colors: ['#38bdf8', '#14b8a6', '#6366f1'],
        bg: '#07131d',
        card: '#0f1f31'
    },
    {
        id: 'forest',
        name: 'Forest',
        description: 'Emerald, moss, and amber for a lush palette.',
        colors: ['#22c55e', '#84cc16', '#f59e0b'],
        bg: '#081612',
        card: '#13231b'
    },
    {
        id: 'candy',
        name: 'Candy',
        description: 'Rose, periwinkle, and lemon with a playful edge.',
        colors: ['#f472b6', '#a78bfa', '#fbbf24'],
        bg: '#160f1c',
        card: '#251631'
    }
];

function hexToRgbTriplet(hex) {
    const cleaned = String(hex || '').trim().replace(/^#/, '');
    if (!cleaned) {
        return '255 255 255';
    }

    const expanded = cleaned.length === 3
        ? cleaned.split('').map(char => char + char).join('')
        : cleaned.slice(0, 6);
    const value = Number.parseInt(expanded, 16);

    if (!Number.isFinite(value)) {
        return '255 255 255';
    }

    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `${r} ${g} ${b}`;
}

function colorWithAlpha(hex, alpha) {
    const [r, g, b] = hexToRgbTriplet(hex).split(' ');
    return `rgb(${r} ${g} ${b} / ${alpha})`;
}

function buildTheme(theme) {
    const colors = Array.isArray(theme.colors) && theme.colors.length >= 3
        ? theme.colors.slice(0, 3)
        : ['#ff7ad9', '#8b5cf6', '#73e9ff'];

    return {
        ...theme,
        colors,
        primary: colors[0],
        secondary: colors[1],
        accent: colors[2],
        primaryRgb: hexToRgbTriplet(colors[0]),
        secondaryRgb: hexToRgbTriplet(colors[1]),
        accentRgb: hexToRgbTriplet(colors[2]),
        bgRgb: hexToRgbTriplet(theme.bg || '#0a0a0f'),
        cardRgb: hexToRgbTriplet(theme.card || '#111118')
    };
}

const THEMES = THEME_DEFINITIONS.map(buildTheme);
const THEME_MAP = new Map(THEMES.map(theme => [theme.id, theme]));

const PUBLIC_FILE_MIME_TYPES = {
    '.htm': 'text/html',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.map': 'application/json',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm'
};

function inferPublicMimeType(pathValue, fallback = 'application/octet-stream') {
    const ext = `.${String(pathValue || '').split('.').pop().toLowerCase()}`;
    return PUBLIC_FILE_MIME_TYPES[ext] || fallback;
}

function getSiteConfig() {
    return getAetherConfig();
}

function getSupabasePublicLibraryConfig() {
    const config = getSiteConfig();
    const supabaseConfig = getConfiguredSupabaseConfig(config);
    const supabaseTable = String(config.supabaseTable || config.supabasePublicGamesTable || 'public_games').trim() || 'public_games';

    return {
        ...supabaseConfig,
        supabaseTable,
        publicLibraryApiUrl: readPublicLibraryApiUrl(config)
    };
}

const LIBRARY_VIEWS = {
    library: {
        eyebrow: 'Collection Overview',
        title: 'Game Library',
        description: 'Manage and launch your personal collection',
        emptyTitle: 'No games found',
        emptyDescription: 'Your library is currently empty. Start by importing a folder or a ZIP file containing your games.'
    },
    favorites: {
        eyebrow: 'Curated Picks',
        title: 'Favorites',
        description: 'Your starred games at a glance',
        filter: game => game.isFavorite,
        emptyTitle: 'No favorites yet',
        emptyDescription: 'Heart a game to pin it here.'
    },
    continue: {
        eyebrow: 'Resume State',
        title: 'Continue Playing',
        description: 'Jump back into games you have already launched',
        filter: game => game.lastPlayed !== null,
        defaultSort: 'recent',
        emptyTitle: 'Nothing to continue',
        emptyDescription: 'Launch a game once and it will appear here.'
    },
    unplayed: {
        eyebrow: 'Fresh Finds',
        title: 'Unplayed',
        description: 'Games you have not launched yet',
        filter: game => game.lastPlayed === null,
        defaultSort: 'name',
        emptyTitle: 'All caught up',
        emptyDescription: 'Every game in your library has been launched at least once.'
    },
    'top-played': {
        eyebrow: 'Popular Titles',
        title: 'Most Played',
        description: 'Rank games by launch count',
        defaultSort: 'plays',
        emptyTitle: 'No play history yet',
        emptyDescription: 'Launch a few games to build the ranking.'
    },
    community: {
        eyebrow: 'Global Catalog',
        title: 'Community Games',
        description: 'Discover and play games shared by others.',
        emptyTitle: 'No community games',
        emptyDescription: 'Be the first to share your creation!'
    }
};

export class UIManager {
    constructor() {
        this.currentView = 'featured';
        this.searchQuery = '';
        this.activeWindows = [];
        this.safeModeEnabled = false;
        this.systemNotificationsEnabled = false;
        this.themeId = DEFAULT_THEME_ID;
        this.activeTheme = THEME_MAP.get(DEFAULT_THEME_ID);
        this.pendingRecoverySession = null;
        this.recoverySessionToken = null;
        this.storageSelectionId = null;
        this.launchOverlayHideTimer = null;
        this.launchOverlaySequence = 0;
        this.gameUpdateCheckInProgress = false;
        this.publicGames = [];
        this.publicLibraryReady = null;
        this.preferencesReady = this.loadPreferences();
        this.libraryViewNames = new Set([...Object.keys(LIBRARY_VIEWS), 'recent']);
        this.zIndices = {
            window: 100,
            overlay: 50,
            sidebar: 40,
            header: 30
        };
        if (typeof globalThis !== 'undefined') {
            globalThis.__AETHER_UI__ = this;
        }
        this.init();
    }

    async init() {
        await this.preferencesReady;
        await this.loadPublicLibrary();
        this.switchView(this.currentView);
        this.bindEvents();
        this.updateHeaderEnv();
        if (this.pendingRecoverySession) {
            this.notify(
                'Crash recovery available',
                `Resume "${this.pendingRecoverySession.title || 'your last game'}" from the Library.`,
                'warning'
            );
        }
        lucide.createIcons();
        void this.scanForGameUpdates({ notify: true });
    }

    async loadPreferences() {
        try {
            this.safeModeEnabled = await storage.getSetting('safeModeEnabled', false);
            this.systemNotificationsEnabled = await storage.getSetting('systemNotificationsEnabled', false);
            this.pendingRecoverySession = await storage.getSetting('activeGameSession', null);
            this.themeId = await storage.getSetting('themeId', DEFAULT_THEME_ID);
            this.applyTheme(this.themeId);
        } catch (err) {
            console.warn('Unable to load launcher preferences:', err);
            this.safeModeEnabled = false;
            this.systemNotificationsEnabled = false;
            this.pendingRecoverySession = null;
            this.applyTheme(DEFAULT_THEME_ID);
        }
    }

    getAuthManager() {
        return (typeof globalThis !== 'undefined' && globalThis.__AETHER_AUTH__) || null;
    }

    getSupabaseClient() {
        return this.getAuthManager()?.supabase || null;
    }

    getPreferencesTableName() {
        const config = getSiteConfig();
        return String(config.supabasePreferencesTable || 'launcher_preferences').trim() || 'launcher_preferences';
    }

    getPublicLibraryApiUrl() {
        const config = getSiteConfig();
        return readPublicLibraryApiUrl(config);
    }

    canSyncPublicLibrary() {
        return Boolean(this.getPublicLibraryApiUrl());
    }

    async getAuthenticatedUser() {
        const authManager = this.getAuthManager();
        if (!authManager?.getCurrentUser) {
            return null;
        }

        try {
            return await authManager.getCurrentUser();
        } catch (err) {
            console.warn('Unable to read authenticated user for preference sync:', err);
            return null;
        }
    }

    async loadCloudPreferences() {
        const client = this.getSupabaseClient();
        const user = await this.getAuthenticatedUser();

        if (!client || !user) {
            return null;
        }

        try {
            const { data, error } = await client
                .from(this.getPreferencesTableName())
                .select('theme_id,safe_mode_enabled,system_notifications_enabled,updated_at')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data || null;
        } catch (err) {
            console.warn('Unable to load cloud preferences:', err);
            return null;
        }
    }

    async saveCloudPreferences() {
        const client = this.getSupabaseClient();
        const user = await this.getAuthenticatedUser();

        if (!client || !user) {
            return false;
        }

        try {
            const payload = {
                user_id: user.id,
                theme_id: this.themeId,
                safe_mode_enabled: Boolean(this.safeModeEnabled),
                system_notifications_enabled: Boolean(this.systemNotificationsEnabled),
                updated_at: Date.now()
            };

            const { error } = await client
                .from(this.getPreferencesTableName())
                .upsert(payload, { onConflict: 'user_id' });

            if (error) {
                throw error;
            }

            return true;
        } catch (err) {
            console.warn('Unable to save cloud preferences:', err);
            return false;
        }
    }

    async syncPreferencesFromCloud() {
        const cloudPreferences = await this.loadCloudPreferences();
        if (!cloudPreferences) {
            return this.saveCloudPreferences();
        }

        const themeId = cloudPreferences.theme_id || DEFAULT_THEME_ID;
        const safeModeEnabled = Boolean(cloudPreferences.safe_mode_enabled);
        const systemNotificationsEnabled = Boolean(cloudPreferences.system_notifications_enabled);

        this.applyTheme(themeId);
        this.safeModeEnabled = safeModeEnabled;
        this.systemNotificationsEnabled = systemNotificationsEnabled;

        try {
            await storage.saveSetting('themeId', this.themeId);
            await storage.saveSetting('safeModeEnabled', this.safeModeEnabled);
            await storage.saveSetting('systemNotificationsEnabled', this.systemNotificationsEnabled);
        } catch (err) {
            console.warn('Unable to persist synced preferences locally:', err);
        }

        if (this.currentView === 'settings') {
            this.renderSettings();
        }

        return true;
    }

    async onAuthSessionChanged(user) {
        if (!user) {
            return;
        }

        await this.preferencesReady;
        await this.syncPreferencesFromCloud();
    }

    getTheme(themeId = this.themeId) {
        return THEME_MAP.get(themeId) || THEME_MAP.get(DEFAULT_THEME_ID) || THEMES[0];
    }

    applyTheme(themeId) {
        const theme = this.getTheme(themeId);
        this.themeId = theme.id;
        this.activeTheme = theme;

        if (typeof document === 'undefined') {
            return theme;
        }

        const root = document.documentElement;
        root.dataset.theme = theme.id;
        root.style.setProperty('--brand-primary-rgb', theme.primaryRgb);
        root.style.setProperty('--brand-secondary-rgb', theme.secondaryRgb);
        root.style.setProperty('--brand-accent-rgb', theme.accentRgb);
        root.style.setProperty('--brand-bg-rgb', theme.bgRgb);
        root.style.setProperty('--brand-card-rgb', theme.cardRgb);
        root.style.setProperty('--brand-primary', theme.primary);
        root.style.setProperty('--brand-secondary', theme.secondary);
        root.style.setProperty('--brand-accent', theme.accent);
        root.style.setProperty('--brand-bg', theme.bg);
        root.style.setProperty('--brand-card', theme.card);
        return theme;
    }

    async setTheme(themeId) {
        const theme = this.getTheme(themeId);
        const changed = theme.id !== this.themeId;
        this.applyTheme(theme.id);

        if (changed) {
            await storage.saveSetting('themeId', theme.id);
            void this.saveCloudPreferences();
        }

        this.refreshCurrentView();
    }

    refreshCurrentView() {
        const normalizedView = this.normalizeLibraryView(this.currentView);

        if (normalizedView === 'settings') {
            this.renderSettings();
            return;
        }

        if (normalizedView === 'storage') {
            this.renderStorageManager();
            return;
        }

        if (normalizedView === 'updates') {
            this.renderUpdates();
            return;
        }

        if (normalizedView === 'admin') {
            this.renderAdmin();
            return;
        }

        if (this.libraryViewNames.has(normalizedView)) {
            this.renderLibrary();
        }
    }

    renderThemePicker() {
        return THEMES.map(theme => {
            const isActive = this.themeId === theme.id;
            return `
                <button
                    type="button"
                    data-theme-id="${theme.id}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                    data-active="${isActive ? 'true' : 'false'}"
                    class="theme-option"
                >
                    <div class="theme-option__swatch">
                        <span style="background: ${theme.primary};"></span>
                        <span style="background: ${theme.secondary};"></span>
                        <span style="background: ${theme.accent};"></span>
                    </div>
                    <div class="theme-option__meta">
                        <div class="min-w-0">
                            <div class="font-800 text-white">${theme.name}</div>
                            <p class="text-xs text-white/45 mt-1 leading-relaxed">${theme.description}</p>
                        </div>
                        <span class="theme-option__badge">
                            <i data-lucide="${isActive ? 'check' : 'sparkles'}" class="w-3 h-3"></i>
                            ${isActive ? 'Active' : 'Use'}
                        </span>
                    </div>
                </button>
            `;
        }).join('');
    }

    async setSafeModeEnabled(enabled) {
        this.safeModeEnabled = Boolean(enabled);
        await storage.saveSetting('safeModeEnabled', this.safeModeEnabled);
        void this.saveCloudPreferences();

        if (this.currentView === 'settings') {
            this.renderSettings();
        }
    }

    async setSystemNotificationsEnabled(enabled) {
        if (!enabled) {
            this.systemNotificationsEnabled = false;
            await storage.saveSetting('systemNotificationsEnabled', false);
            if (this.currentView === 'settings') {
                this.renderSettings();
            }
            return;
        }

        if (!('Notification' in window)) {
            this.notify('Notifications unavailable', 'This browser does not support system notifications.', 'warning');
            return;
        }

        const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();

        this.systemNotificationsEnabled = permission === 'granted';
        await storage.saveSetting('systemNotificationsEnabled', this.systemNotificationsEnabled);
        void this.saveCloudPreferences();

        if (this.currentView === 'settings') {
            this.renderSettings();
        }

        if (this.systemNotificationsEnabled) {
            this.notify('System notifications enabled', 'Launcher events will now surface as native notifications.', 'success');
        } else {
            this.notify('Notifications blocked', 'Grant notification permission to enable native alerts.', 'warning');
        }
    }

    prefersReducedMotion() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }

        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    clearLaunchOverlayTimer() {
        if (this.launchOverlayHideTimer) {
            clearTimeout(this.launchOverlayHideTimer);
            this.launchOverlayHideTimer = null;
        }
    }

    hashString(input) {
        const text = String(input || '');
        let hash = 2166136261;

        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(36);
    }

    getGameFileEntries(game) {
        return Object.entries(game?.files || {});
    }

    getGameSizeBytes(game) {
        if (Number.isFinite(game?.totalBytes)) {
            return game.totalBytes;
        }

        return this.getGameFileEntries(game).reduce((sum, [, blob]) => sum + (blob?.size || 0), 0);
    }

    getGameFileCount(game) {
        if (Number.isFinite(game?.fileCount)) {
            return game.fileCount;
        }

        return this.getGameFileEntries(game).length;
    }

    getGameFingerprint(game) {
        if (game?.contentSignature && game.contentSignatureVersion === 2) {
            return game.contentSignature;
        }

        const parts = this.getGameFileEntries(game)
            .map(([path, blob]) => `${String(path || '').toLowerCase()}:${blob?.size || 0}:${blob?.type || ''}`)
            .sort();

        return this.hashString(`${game?.entryPoint || ''}|${parts.join('|')}`);
    }

    normalizeGamePath(pathValue) {
        return String(pathValue || '')
            .replace(/\\/g, '/')
            .replace(/^\.\//, '')
            .replace(/^\/+/, '');
    }

    getGameSourceFolder(game) {
        const entryPoint = this.normalizeGamePath(game?.entryPoint);
        if (!entryPoint || !entryPoint.includes('/')) {
            return null;
        }

        return entryPoint.split('/')[0];
    }

    isPathInsideGameFolder(game, pathValue) {
        const folder = this.getGameSourceFolder(game);
        if (!folder) return false;

        const normalizedPath = this.normalizeGamePath(pathValue);
        return normalizedPath === folder || normalizedPath.startsWith(`${folder}/`);
    }

    formatUpdateSummary(titles) {
        const names = (titles || []).filter(Boolean);

        if (names.length === 0) {
            return 'One or more games have updates available.';
        }

        if (names.length === 1) {
            return `"${names[0]}" has an update available.`;
        }

        if (names.length === 2) {
            return `"${names[0]}" and "${names[1]}" have updates available.`;
        }

        return `"${names[0]}", "${names[1]}", and ${names.length - 2} more have updates available.`;
    }

    async scanForGameUpdates({ notify = true } = {}) {
        if (!env.status.isLocal || this.gameUpdateCheckInProgress) {
            return [];
        }

        this.gameUpdateCheckInProgress = true;
        try {
            const games = await storage.getAllGames();
            const newlyDetected = [];
            let mutated = false;

            for (const game of games) {
                const sourceFolder = this.getGameSourceFolder(game);
                let localSignature = game.contentSignatureVersion === 2 && game.contentSignature
                    ? game.contentSignature
                    : await gameEngine.buildFileContentSignature(game.files, game.entryPoint);
                let needsSave = false;

                if (game.contentSignatureVersion !== 2 || game.contentSignature !== localSignature) {
                    game.contentSignature = localSignature;
                    game.contentSignatureVersion = 2;
                    needsSave = true;
                }

                if (!sourceFolder) {
                    if (needsSave) {
                        await storage.saveGame(game);
                        mutated = true;
                    }
                    continue;
                }

                try {
                    const response = await fetch(`/api/sync-game?folder=${encodeURIComponent(sourceFolder)}`, { cache: 'no-store' });
                    const data = await response.json();

                    if (!response.ok || !data?.success || !data.files) {
                        if (needsSave) {
                            await storage.saveGame(game);
                            mutated = true;
                        }
                        continue;
                    }

                    const serverSignature = await gameEngine.buildFileContentSignatureFromEncodedFiles(data.files, game.entryPoint);
                    const updateAvailable = localSignature !== serverSignature;

                    if (updateAvailable) {
                        if (!game.updateAvailable || game.updateSourceSignature !== serverSignature) {
                            newlyDetected.push(game);
                        }
                        game.updateAvailable = true;
                        game.updateSourceSignature = serverSignature;
                        game.updateDetectedAt = Date.now();
                        needsSave = true;
                    } else if (game.updateAvailable || game.updateSourceSignature || game.updateDetectedAt) {
                        game.updateAvailable = false;
                        delete game.updateSourceSignature;
                        delete game.updateDetectedAt;
                        needsSave = true;
                    }

                    if (needsSave) {
                        await storage.saveGame(game);
                        mutated = true;
                    }
                } catch (err) {
                    console.warn(`Unable to check updates for "${game.title}":`, err);
                }
            }

            if (notify && newlyDetected.length > 0) {
                this.notify(
                    newlyDetected.length === 1 ? 'Game update available' : 'Game updates available',
                    this.formatUpdateSummary(newlyDetected.map(game => game.title)),
                    'warning'
                );
            }

            if (mutated && this.currentView !== 'settings' && this.currentView !== 'admin') {
                this.refreshCurrentView();
            }

            return newlyDetected;
        } finally {
            this.gameUpdateCheckInProgress = false;
        }
    }

    getPlayableEntryPoint(game) {
        if (game?.entryPoint && game.files?.[game.entryPoint]) {
            return game.entryPoint;
        }

        const entries = this.getGameFileEntries(game).map(([path]) => path);
        const preferred = entries.find(path => /(^|\/)(index|main)\.html?$/i.test(path));
        if (preferred) return preferred;

        const fallback = entries.find(path => /\.html?$/i.test(path));
        return fallback || null;
    }

    isGameBroken(game) {
        return !game?.entryPoint || !game.files?.[game.entryPoint];
    }

    buildDuplicateIndex(games) {
        const duplicateIndex = new Map();

        for (const game of games || []) {
            const fingerprint = this.getGameFingerprint(game);
            if (!duplicateIndex.has(fingerprint)) {
                duplicateIndex.set(fingerprint, []);
            }
            duplicateIndex.get(fingerprint).push(game);
        }

        for (const [fingerprint, group] of duplicateIndex.entries()) {
            if (group.length < 2) {
                duplicateIndex.delete(fingerprint);
            }
        }

        return duplicateIndex;
    }

    isPublicMirrorGame(game) {
        return Boolean(game?.isPublicMirror);
    }

    clonePublicGame(game) {
        if (!game) return null;

        return {
            ...game,
            files: { ...(game.files || {}) },
            encodedFiles: { ...(game.encodedFiles || {}) },
            fileTypes: { ...(game.fileTypes || {}) },
            tags: Array.isArray(game.tags) ? [...game.tags] : [],
            changelog: Array.isArray(game.changelog)
                ? game.changelog.map(entry => ({
                    ...entry,
                    meta: entry?.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta)
                        ? { ...entry.meta }
                        : entry?.meta
                }))
                : []
        };
    }

    setPublicGames(games) {
        const unique = new Map();
        for (const game of games || []) {
            if (game?.id) {
                unique.set(game.id, this.clonePublicGame(game));
            }
        }

        this.publicGames = Array.from(unique.values());
        this.publicLibraryReady = Promise.resolve(this.publicGames);
        return this.publicGames;
    }

    upsertPublicGameInCache(game) {
        if (!game?.id) return this.publicGames;

        const next = [];
        let replaced = false;
        const cloned = this.clonePublicGame(game);

        for (const existing of this.publicGames || []) {
            if (existing?.id === cloned.id) {
                next.push(cloned);
                replaced = true;
            } else {
                next.push(existing);
            }
        }

        if (!replaced) {
            next.unshift(cloned);
        }

        this.publicGames = next;
        this.publicLibraryReady = Promise.resolve(this.publicGames);
        return this.publicGames;
    }

    removePublicGameFromCache(gameId) {
        this.publicGames = (this.publicGames || []).filter(game => game?.id !== gameId);
        this.publicLibraryReady = Promise.resolve(this.publicGames);
        return this.publicGames;
    }

    getCombinedLibraryGames(localGames = []) {
        const combined = new Map();

        for (const game of this.publicGames || []) {
            if (game?.id) {
                combined.set(game.id, game);
            }
        }

        for (const game of localGames || []) {
            if (game?.id) {
                combined.set(game.id, game);
            }
        }

        return Array.from(combined.values());
    }

    getPublicChangelogEntries(changelog) {
        const allowedTypes = new Set(['import', 'update', 'repair', 'repair-failed']);

        return Array.isArray(changelog)
            ? changelog
                .filter(entry => allowedTypes.has(entry?.type))
                .map(entry => ({
                    ...entry,
                    meta: entry?.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta)
                        ? { ...entry.meta }
                        : {}
                }))
                .slice(0, 24)
            : [];
    }

    getPublicLibrarySupabaseConfig() {
        return getSupabasePublicLibraryConfig();
    }

    async loadPublicLibraryFromSupabase() {
        const config = this.getPublicLibrarySupabaseConfig();
        if (!config.configured) {
            return null;
        }

        try {
            const response = await fetch(
                `${config.supabaseUrl}/rest/v1/${encodeURIComponent(config.supabaseTable)}?select=payload&order=public_updated_at.desc`,
                {
                    cache: 'no-store',
                    headers: {
                        apikey: config.supabaseAnonKey,
                        Authorization: `Bearer ${config.supabaseAnonKey}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const rows = await response.json();
            if (!Array.isArray(rows)) {
                throw new Error('Unexpected Supabase response shape');
            }

            return rows
                .map(row => row?.payload ?? row?.game ?? row)
                .filter(game => game && typeof game === 'object');
        } catch (err) {
            console.warn('Unable to load public library from Supabase:', err);
            return null;
        }
    }

    bytesToBase64(bytes) {
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        let binary = '';
        const chunkSize = 0x8000;

        for (let i = 0; i < view.length; i += chunkSize) {
            binary += String.fromCharCode(...view.subarray(i, i + chunkSize));
        }

        return btoa(binary);
    }

    async blobToBase64(blob) {
        if (!blob) return '';

        const bytes = new Uint8Array(await blob.arrayBuffer());
        return this.bytesToBase64(bytes);
    }

    async hydratePublicGame(rawGame) {
        if (!rawGame?.id) return null;

        const sourceFiles = rawGame.encodedFiles && typeof rawGame.encodedFiles === 'object'
            ? rawGame.encodedFiles
            : rawGame.files && typeof rawGame.files === 'object'
                ? rawGame.files
                : {};
        const encodedFiles = {};
        const fileTypes = {};
        const files = {};
        let calculatedBytes = 0;

        for (const [filePath, rawValue] of Object.entries(sourceFiles)) {
            let base64 = '';
            let type = null;

            if (typeof rawValue === 'string') {
                base64 = rawValue;
            } else if (rawValue && typeof rawValue === 'object') {
                base64 = String(rawValue.base64 || rawValue.data || rawValue.content || '');
                type = rawValue.type || rawValue.mimeType || rawValue.contentType || null;
            }

            if (!base64) continue;

            if (!type && rawGame.fileTypes && typeof rawGame.fileTypes === 'object') {
                type = rawGame.fileTypes[filePath] || null;
            }

            if (!type) {
                type = inferPublicMimeType(filePath);
            }

            const bytes = gameEngine.decodeBase64ToBytes(base64);
            encodedFiles[filePath] = base64;
            fileTypes[filePath] = type;
            files[filePath] = new Blob([bytes], { type });
            calculatedBytes += bytes.length;
        }

        const fileCount = Object.keys(encodedFiles).length;
        const entryPoint = rawGame.entryPoint || null;
        const computedSignature = fileCount > 0
            ? await gameEngine.buildFileContentSignatureFromEncodedFiles(encodedFiles, entryPoint)
            : null;
        const now = Date.now();
        const publicCategory = rawGame.category && rawGame.category !== 'Personal'
            ? rawGame.category
            : 'Shared';
        const publicTags = Array.isArray(rawGame.tags)
            ? rawGame.tags.filter(tag => String(tag || '').toLowerCase() !== 'local')
            : [];

        return this.clonePublicGame({
            ...rawGame,
            id: rawGame.id,
            title: rawGame.title || 'Untitled Game',
            description: rawGame.description || 'Shared public game.',
            entryPoint,
            thumbnail: rawGame.thumbnail || this.generateFallbackThumb(rawGame.title || 'Untitled Game'),
            addedAt: rawGame.addedAt ?? rawGame.publicPublishedAt ?? now,
            lastUpdatedAt: rawGame.lastUpdatedAt ?? rawGame.publicUpdatedAt ?? now,
            lastPlayed: null,
            playCount: 0,
            tags: publicTags,
            category: publicCategory,
            type: rawGame.type || 'HTML5/Web',
            fileCount: Number.isFinite(rawGame.fileCount) ? rawGame.fileCount : fileCount,
            totalBytes: Number.isFinite(rawGame.totalBytes) ? rawGame.totalBytes : calculatedBytes,
            contentSignature: rawGame.contentSignatureVersion === 2 && rawGame.contentSignature
                ? rawGame.contentSignature
                : computedSignature,
            contentSignatureVersion: 2,
            changelog: Array.isArray(rawGame.changelog) ? rawGame.changelog : [],
            isFavorite: false,
            isPublic: true,
            isPublicMirror: true,
            publicSource: rawGame.publicSource || 'owner',
            publicPublishedAt: rawGame.publicPublishedAt || rawGame.publicUpdatedAt || now,
            publicUpdatedAt: rawGame.publicUpdatedAt || now,
            updateAvailable: false,
            files,
            encodedFiles,
            fileTypes
        });
    }

    async loadPublicLibrary({ force = false } = {}) {
        if (this.publicLibraryReady && !force) {
            return this.publicLibraryReady;
        }

        if (force) {
            this.publicLibraryReady = null;
        }

        this.publicLibraryReady = (async () => {
            const supabaseGames = await this.loadPublicLibraryFromSupabase();
            if (supabaseGames !== null) {
                const hydratedGames = [];

                for (const rawGame of supabaseGames) {
                    const hydrated = await this.hydratePublicGame(rawGame);
                    if (hydrated) {
                        hydratedGames.push(hydrated);
                    }
                }

                this.publicLibrarySource = 'supabase';
                return this.setPublicGames(hydratedGames);
            }

            const apiUrl = this.getPublicLibraryApiUrl();
            const sources = apiUrl
                ? [
                    { url: apiUrl, kind: 'api' },
                    { url: './data/public-library.json', kind: 'file' }
                ]
                : [
                    { url: './data/public-library.json', kind: 'file' }
                ];

            for (const source of sources) {
                try {
                    const response = await fetch(source.url, { cache: 'no-store' });
                    if (!response.ok) {
                        continue;
                    }

                    const data = await response.json();
                    if (source.kind === 'api' && data?.success === false) {
                        continue;
                    }
                    const rawGames = Array.isArray(data?.games)
                        ? data.games
                        : Array.isArray(data)
                            ? data
                            : [];
                    const hydratedGames = [];

                    for (const rawGame of rawGames) {
                        const hydrated = await this.hydratePublicGame(rawGame);
                        if (hydrated) {
                            hydratedGames.push(hydrated);
                        }
                    }

                    this.publicLibrarySource = source.kind;
                    return this.setPublicGames(hydratedGames);
                } catch (err) {
                    console.warn(`Unable to load public library from ${source.url}:`, err);
                }
            }

            this.publicLibrarySource = null;
            return this.setPublicGames([]);
        })();

        return this.publicLibraryReady;
    }

    async serializeGameForPublic(game) {
        if (!game) return null;

        const fileEntries = Object.entries(game.files || {});
        const encodedFiles = {};
        const fileTypes = {};
        let calculatedBytes = 0;
        const publicTags = Array.isArray(game.tags)
            ? game.tags.filter(tag => String(tag || '').toLowerCase() !== 'local')
            : [];
        const publicDescription = game.description && game.description !== 'Uploaded directly via AETHER Launcher.'
            ? game.description
            : 'Shared from the AETHER library.';
        const publicCategory = game.category && game.category !== 'Personal'
            ? game.category
            : 'Shared';

        for (const [filePath, blob] of fileEntries) {
            if (!blob) continue;

            const bytes = new Uint8Array(await blob.arrayBuffer());
            calculatedBytes += bytes.length;
            encodedFiles[filePath] = this.bytesToBase64(bytes);
            fileTypes[filePath] = blob.type || inferPublicMimeType(filePath);
        }

        return {
            id: game.id,
            title: game.title || 'Untitled Game',
            description: publicDescription,
            entryPoint: game.entryPoint || null,
            thumbnail: game.thumbnail || this.generateFallbackThumb(game.title || 'Untitled Game'),
            addedAt: game.addedAt ?? Date.now(),
            lastUpdatedAt: game.lastUpdatedAt ?? Date.now(),
            tags: publicTags,
            category: publicCategory,
            type: game.type || 'HTML5/Web',
            fileCount: Number.isFinite(game.fileCount) ? game.fileCount : fileEntries.length,
            totalBytes: Number.isFinite(game.totalBytes) ? game.totalBytes : calculatedBytes,
            contentSignature: game.contentSignature || null,
            contentSignatureVersion: game.contentSignatureVersion || 2,
            changelog: this.getPublicChangelogEntries(game.changelog),
            isPublic: true,
            publicSource: game.publicSource || 'owner',
            publicPublishedAt: game.publicPublishedAt || null,
            publicUpdatedAt: Date.now(),
            encodedFiles,
            fileTypes
        };
    }

    async publishGameToPublicLibrary(game) {
        if (!game || this.isPublicMirrorGame(game) || game.isPublic === false) {
            return false;
        }

        const apiUrl = this.getPublicLibraryApiUrl();
        if (!apiUrl) {
            return false;
        }

        try {
            const payload = await this.serializeGameForPublic(game);
            if (!payload) return false;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: payload })
            });
            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || `HTTP ${response.status}`);
            }

            const publishedGame = await this.hydratePublicGame(data.game || payload);
            if (publishedGame) {
                this.upsertPublicGameInCache(publishedGame);
                try {
                    const localGame = await storage.getGame(game.id);
                    if (localGame) {
                        localGame.publicPublishedAt = localGame.publicPublishedAt || publishedGame.publicPublishedAt || payload.publicPublishedAt || Date.now();
                        localGame.publicUpdatedAt = publishedGame.publicUpdatedAt || payload.publicUpdatedAt || Date.now();
                        await storage.saveGame(localGame);
                        game.publicPublishedAt = localGame.publicPublishedAt;
                        game.publicUpdatedAt = localGame.publicUpdatedAt;
                    }
                } catch (syncErr) {
                    console.warn(`Unable to cache public metadata for "${game.title || 'game'}":`, syncErr);
                }
            }

            return true;
        } catch (err) {
            console.warn(`Unable to publish "${game.title || 'game'}" to the public library:`, err);
            return false;
        }
    }

    async removeGameFromPublicLibrary(gameId) {
        if (!gameId) return false;

        const apiUrl = this.getPublicLibraryApiUrl();
        if (!apiUrl) {
            return false;
        }

        try {
            const response = await fetch(`${apiUrl}?id=${encodeURIComponent(gameId)}`, {
                method: 'DELETE'
            });
            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || `HTTP ${response.status}`);
            }

            this.removePublicGameFromCache(gameId);
            return true;
        } catch (err) {
            console.warn(`Unable to remove public game ${gameId}:`, err);
            return false;
        }
    }

    async getGameForAction(gameId) {
        const localGame = await storage.getGame(gameId);
        if (localGame) {
            return localGame;
        }

        await this.loadPublicLibrary();
        const publicGame = (this.publicGames || []).find(game => game?.id === gameId);
        return publicGame ? this.clonePublicGame(publicGame) : null;
    }

    getGameBadges(game, duplicateIndex = null) {
        const badges = [];
        const sizeBytes = this.getGameSizeBytes(game);
        const playCount = game?.playCount || 0;
        const daysSinceAdded = game?.addedAt ? Math.floor((Date.now() - game.addedAt) / 86400000) : null;
        const daysSincePlayed = game?.lastPlayed ? Math.floor((Date.now() - game.lastPlayed) / 86400000) : null;
        const fingerprint = this.getGameFingerprint(game);
        const duplicateGroup = duplicateIndex?.get?.(fingerprint);

        if (game?.isFavorite) {
            badges.push({ label: 'Favorite', tone: 'primary', icon: 'heart' });
        }

        if (game?.isPublicMirror) {
            badges.push({ label: 'Public', tone: 'accent', icon: 'globe-2' });
        }

        if (game?.updateAvailable) {
            badges.push({ label: 'Update Available', tone: 'warning', icon: 'refresh-cw' });
        }

        if (this.isGameBroken(game)) {
            badges.push({ label: 'Repair Needed', tone: 'danger', icon: 'triangle-alert' });
        }

        if (duplicateGroup) {
            badges.push({ label: 'Duplicate', tone: 'warning', icon: 'copy' });
        }

        if (playCount > 0) {
            badges.push({ label: `${playCount} Plays`, tone: playCount > 5 ? 'accent' : 'success', icon: 'play' });
        } else {
            badges.push({ label: 'Fresh', tone: 'success', icon: 'sparkles' });
        }

        if (game?.lastUpdatedAt && game.lastUpdatedAt > (game.addedAt || 0)) {
            badges.push({ label: 'Updated', tone: 'accent', icon: 'refresh-cw' });
        }

        if (sizeBytes >= 1024 * 1024 * 1024) {
            badges.push({ label: this.formatSize(sizeBytes), tone: 'warning', icon: 'hard-drive' });
        } else if (sizeBytes >= 250 * 1024 * 1024) {
            badges.push({ label: 'Large', tone: 'warning', icon: 'hard-drive' });
        }

        if (daysSincePlayed !== null && daysSincePlayed <= 7) {
            badges.push({ label: 'Recent', tone: 'accent', icon: 'clock-3' });
        } else if (daysSinceAdded !== null && daysSinceAdded <= 7) {
            badges.push({ label: 'New', tone: 'accent', icon: 'badge-plus' });
        }

        return badges.slice(0, 4);
    }

    appendChangelogEntry(changelog, entry) {
        const history = Array.isArray(changelog) ? [...changelog] : [];
        history.unshift({
            id: entry.id || crypto.randomUUID(),
            at: entry.at || Date.now(),
            type: entry.type || 'update',
            title: entry.title || entry.message || 'Updated',
            message: entry.message || entry.title || 'Updated',
            meta: entry.meta || {}
        });
        return history.slice(0, 24);
    }

    recordGameEvent(game, type, message, meta = {}) {
        if (!game) return game;

        game.changelog = this.appendChangelogEntry(game.changelog, {
            type,
            message,
            meta
        });
        game.lastActivityAt = Date.now();
        return game;
    }

    ensureToastContainer() {
        return document.getElementById('toast-stack');
    }

    showToast(title, body, tone = 'info') {
        const stack = this.ensureToastContainer();
        if (!stack) return;

        const iconConfig = {
            success: { icon: 'check-circle-2', color: '#34d399' },
            warning: { icon: 'triangle-alert', color: '#fbbf24' },
            error: { icon: 'x-circle', color: '#f87171' },
            info: { icon: 'info', color: 'var(--brand-primary)' }
        };
        const config = iconConfig[tone] || iconConfig.info;

        const toast = document.createElement('div');
        toast.className = 'toast-item pointer-events-auto';
        toast.dataset.tone = tone;
        toast.innerHTML = `
            <div class="p-4">
                <div class="flex items-start gap-3">
                    <div class="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                        <i data-lucide="${config.icon}" class="w-4 h-4" style="color: ${config.color}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="font-700 text-sm text-white">${title}</div>
                        <div class="text-xs text-white/45 leading-5 mt-1">${body}</div>
                    </div>
                </div>
            </div>
        `;

        stack.appendChild(toast);
        lucide.createIcons();

        let dismissed = false;
        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            toast.classList.add('toast-hide');
            window.setTimeout(() => toast.remove(), 220);
        };

        const timeout = window.setTimeout(dismiss, tone === 'error' ? 6500 : 5000);
        toast.addEventListener('click', () => {
            window.clearTimeout(timeout);
            dismiss();
        });
    }

    notify(title, body, tone = 'info') {
        this.showToast(title, body, tone);

        if (!this.systemNotificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        try {
            const notification = new Notification(title, {
                body,
                icon: './favicon-32.png?v=2',
                badge: './favicon-32.png?v=2'
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (err) {
            console.warn('Failed to show native notification:', err);
        }
    }

    async saveRecoverySession(game) {
        if (!game) return;
        if (!this.activeWindows.some(window => window.gameId === game.id)) return;

        const token = crypto.randomUUID();
        this.recoverySessionToken = token;
        const session = {
            gameId: game.id,
            title: game.title,
            launchedAt: Date.now(),
            token
        };

        this.pendingRecoverySession = session;

        try {
            await storage.saveSetting('activeGameSession', session);
        } catch (err) {
            console.warn('Unable to persist crash recovery session:', err);
            return;
        }

        if (this.recoverySessionToken !== token) {
            try {
                await storage.saveSetting('activeGameSession', null);
            } catch (err) {
                console.warn('Unable to clear stale crash recovery session:', err);
            }
            return;
        }
    }

    async clearRecoverySession() {
        this.recoverySessionToken = crypto.randomUUID();
        this.pendingRecoverySession = null;
        try {
            await storage.saveSetting('activeGameSession', null);
        } catch (err) {
            console.warn('Unable to clear crash recovery session:', err);
        }
    }

    getVisibleGames(games) {
        const viewConfig = this.getLibraryViewConfig(this.currentView);
        const searchQuery = this.searchQuery.trim().toLowerCase();
        const sortFilter = document.getElementById('sort-filter');
        const sortMode = sortFilter?.value || viewConfig.defaultSort || 'name';

        let filtered = (games || []).filter(game => {
            const title = String(game.title || '').toLowerCase();
            const tags = Array.isArray(game.tags) ? game.tags : [];

            return !searchQuery ||
                title.includes(searchQuery) ||
                tags.some(tag => String(tag || '').toLowerCase().includes(searchQuery));
        });

        if (viewConfig.filter) {
            filtered = filtered.filter(viewConfig.filter);
        }

        return this.sortGames(filtered, sortMode);
    }

    async launchRandomGame() {
        await this.loadPublicLibrary();
        const games = this.getCombinedLibraryGames(await storage.getAllGames());
        const visibleGames = this.libraryViewNames.has(this.currentView)
            ? this.getVisibleGames(games)
            : games;

        if (!visibleGames.length) {
            this.notify('No games available', 'Import a game before using Random Game.', 'warning');
            return;
        }

        const picked = visibleGames[Math.floor(Math.random() * visibleGames.length)];
        this.notify('Random pick selected', picked.title, 'info');
        await this.openGameWindow(picked.id);
    }

    async repairGame(gameId) {
        const game = await storage.getGame(gameId);
        if (!game) return;

        const originalEntry = game.entryPoint;
        const repairedEntry = this.getPlayableEntryPoint(game);
        const regeneratedThumbnail = this.generateFallbackThumb(game.title);
        let changed = false;

        if (repairedEntry && repairedEntry !== game.entryPoint) {
            game.entryPoint = repairedEntry;
            changed = true;
        }

        if (game.thumbnail !== regeneratedThumbnail) {
            game.thumbnail = regeneratedThumbnail;
            changed = true;
        }

        if (!repairedEntry) {
            this.notify('Repair failed', `${game.title} does not contain a playable HTML entry point.`, 'error');
            this.recordGameEvent(game, 'repair-failed', 'Repair failed - no playable entry point was found.');
            await storage.saveGame(game);
            if (this.currentView === 'storage') this.renderStorageManager();
            return;
        }

        this.recordGameEvent(
            game,
            'repair',
            changed
                ? `Repaired entry point${originalEntry && originalEntry !== repairedEntry ? ` from ${originalEntry} to ${repairedEntry}` : ''}.`
                : 'Integrity check passed.'
        );

        game.lastUpdatedAt = Date.now();
        await storage.saveGame(game);
        if (game.isPublic !== false) {
            const published = await this.publishGameToPublicLibrary(game);
            if (!published && this.canSyncPublicLibrary()) {
                this.notify(
                    'Public sync unavailable',
                    `"${game.title}" was repaired locally, but the shared catalog could not be updated.`,
                    'warning'
                );
            }
        }
        this.notify('Game repaired', `${game.title} is ready to launch again.`, 'success');
        this.renderLibrary();
        if (this.currentView === 'storage') this.renderStorageManager();
    }

    selectStorageGame(gameId) {
        this.storageSelectionId = gameId || null;
        if (this.currentView === 'storage') {
            this.renderStorageManager();
        }
    }

    renderLibraryNotices(games, duplicateIndex) {
        const notices = document.getElementById('library-notices');
        if (!notices) return;

        const items = [];
        const recoveryGame = this.pendingRecoverySession
            ? games.find(game => game.id === this.pendingRecoverySession.gameId)
            : null;
        const duplicateGroups = Array.from(duplicateIndex.values());
        const brokenCount = games.filter(game => this.isGameBroken(game)).length;
        const updateGames = games.filter(game => game.updateAvailable);

        if (this.pendingRecoverySession && !recoveryGame) {
            this.pendingRecoverySession = null;
            void this.clearRecoverySession();
        }

        if (updateGames.length > 0) {
            items.push(`
                <div class="launcher-notice rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div class="text-[10px] font-800 uppercase tracking-[0.35em] text-amber-300/80 mb-2">Update Queue</div>
                        <div class="font-700 text-white">${updateGames.length} game${updateGames.length === 1 ? '' : 's'} ${updateGames.length === 1 ? 'has' : 'have'} updates available</div>
                        <div class="text-sm text-white/45 mt-1">${this.formatUpdateSummary(updateGames.map(game => game.title))} Open Updates Hub to sync the changed game folders.</div>
                    </div>
                    <button data-notice-action="open-updates" class="px-4 py-2 rounded-xl bg-amber-400/15 border border-amber-300/20 text-amber-100 text-sm font-700 active:scale-95 transition-all">Open Updates Hub</button>
                </div>
            `);
        }

        if (recoveryGame) {
            items.push(`
                <div class="launcher-notice rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div class="text-[10px] font-800 uppercase tracking-[0.35em] text-brand-accent/80 mb-2">Crash Recovery</div>
                        <div class="font-700 text-white">Resume "${recoveryGame.title}"</div>
                        <div class="text-sm text-white/45 mt-1">A session was left open unexpectedly. You can reopen it now or dismiss the recovery state.</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <button data-notice-action="resume-session" class="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-700 active:scale-95 transition-all">Resume</button>
                        <button data-notice-action="dismiss-session" class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm font-600 active:scale-95 transition-all">Dismiss</button>
                    </div>
                </div>
            `);
        }

        if (duplicateGroups.length > 0) {
            items.push(`
                <div class="launcher-notice rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div class="text-[10px] font-800 uppercase tracking-[0.35em] text-amber-300/80 mb-2">Duplicate Detection</div>
                        <div class="font-700 text-white">${duplicateGroups.length} duplicate group${duplicateGroups.length === 1 ? '' : 's'} detected</div>
                        <div class="text-sm text-white/45 mt-1">Matching file signatures are highlighted across the library and in Storage Manager.</div>
                    </div>
                    <button data-notice-action="open-storage" class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm font-600 active:scale-95 transition-all">Open Storage Manager</button>
                </div>
            `);
        }

        if (brokenCount > 0) {
            items.push(`
                <div class="launcher-notice rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div class="text-[10px] font-800 uppercase tracking-[0.35em] text-red-300/80 mb-2">Repair Queue</div>
                        <div class="font-700 text-white">${brokenCount} game${brokenCount === 1 ? '' : 's'} need repair</div>
                        <div class="text-sm text-white/45 mt-1">Broken imports are surfaced automatically so you can fix missing entry points fast.</div>
                    </div>
                    <button data-notice-action="open-storage" class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm font-600 active:scale-95 transition-all">Review Repairs</button>
                </div>
            `);
        }

        notices.innerHTML = items.join('');
        notices.classList.toggle('hidden', items.length === 0);

        notices.querySelectorAll('[data-notice-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.noticeAction;
                if (action === 'resume-session' && this.pendingRecoverySession) {
                    const sessionGameId = this.pendingRecoverySession.gameId;
                    await this.clearRecoverySession();
                    this.openGameWindow(sessionGameId);
                    return;
                }

                if (action === 'dismiss-session') {
                    await this.clearRecoverySession();
                    this.renderLibrary();
                    return;
                }

                if (action === 'open-storage') {
                    this.switchView('storage');
                    return;
                }

                if (action === 'open-updates') {
                    this.switchView('updates');
                    return;
                }
            });
        });
    }

    bindSettingsControls() {
        const themeButtons = document.querySelectorAll('[data-theme-id]');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const themeId = btn.dataset.themeId;
                if (themeId) {
                    await this.setTheme(themeId);
                }
            });
        });

        const safeModeToggle = document.getElementById('safe-mode-toggle');
        if (safeModeToggle) {
            safeModeToggle.addEventListener('click', async () => {
                await this.setSafeModeEnabled(!this.safeModeEnabled);
            });
        }

        const notificationsToggle = document.getElementById('system-notifications-toggle');
        if (notificationsToggle) {
            notificationsToggle.addEventListener('click', async () => {
                await this.setSystemNotificationsEnabled(!this.systemNotificationsEnabled);
            });
        }

        const openStorageManager = document.getElementById('open-storage-manager');
        if (openStorageManager) {
            openStorageManager.addEventListener('click', () => this.switchView('storage'));
        }

        const clearRecoverySession = document.getElementById('clear-recovery-session');
        if (clearRecoverySession) {
            clearRecoverySession.addEventListener('click', async () => {
                await this.clearRecoverySession();
                this.notify('Recovery cleared', 'The pending crash recovery session was removed.', 'info');
                this.renderSettings();
                this.renderLibrary();
            });
        }
    }

    /**
     * Bind all interactive events for the UI.
     */
    bindEvents() {
        // Navigation clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.nav;
                this.switchView(view);
            });
        });

        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.switchView('featured'));
        }

        const sortFilter = document.getElementById('sort-filter');
        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.renderLibrary());
        }

        const emptyStateAction = document.getElementById('empty-state-action');
        if (emptyStateAction) {
            emptyStateAction.addEventListener('click', () => {
                if (emptyStateAction.dataset.action === 'clear-search') {
                    const searchInput = document.getElementById('game-search');
                    if (searchInput) {
                        searchInput.value = '';
                        this.searchQuery = '';
                        this.renderLibrary();
                        searchInput.focus();
                    }
                    return;
                }

                if (emptyStateAction.dataset.action === 'library') {
                    this.switchView('library');
                    return;
                }

                this.toggleImportModal(true);
            });
        }

        // Search input
        const searchInput = document.getElementById('game-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderLibrary();
            });
        }

        // Import Buttons (All instances)
        document.querySelectorAll('#import-btn, .import-trigger').forEach(btn => {
            btn.addEventListener('click', () => this.toggleImportModal(true));
        });

        const randomGameBtn = document.getElementById('random-game-btn');
        if (randomGameBtn) {
            randomGameBtn.addEventListener('click', () => this.launchRandomGame());
        }

        // Modal close
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.toggleImportModal(false));
        });
        
        const modalBg = document.getElementById('import-modal');
        if (modalBg) {
            modalBg.addEventListener('click', (e) => {
                if (e.target.id === 'import-modal') this.toggleImportModal(false);
            });
        }

        // Drag & Drop
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('click', () => {
                document.getElementById('file-input').click();
            });

            document.getElementById('file-input').addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-brand-primary', 'bg-brand-primary/10');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-brand-primary', 'bg-brand-primary/10');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-brand-primary', 'bg-brand-primary/10');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files);
                }
            });
        }
    }

    /**
     * Switch between main views (Library, Admin, Settings).
     */
    switchView(viewName) {
        const normalizedView = this.normalizeLibraryView(viewName);

        // Toggle Nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            const isActive = this.normalizeLibraryView(item.dataset.nav) === normalizedView;
            item.classList.toggle('active', isActive);
            item.classList.toggle('bg-white/5', isActive);
            item.classList.toggle('text-brand-primary', isActive);
        });

        // Toggle Views
        const targetViewId = this.libraryViewNames.has(normalizedView) ? 'library' : normalizedView;
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('hidden', view.id !== `view-${targetViewId}`);
        });

        this.currentView = normalizedView;

        const viewConfig = this.getLibraryViewConfig(normalizedView);
        const sortFilter = document.getElementById('sort-filter');
        if (sortFilter && viewConfig.defaultSort) {
            sortFilter.value = viewConfig.defaultSort;
        }

        const gameSearch = document.getElementById('game-search');
        if (gameSearch) {
             gameSearch.placeholder = normalizedView === 'community'
                ? 'Search community...'
                : normalizedView === 'featured'
                    ? 'Search games...'
                    : 'Search your library...';
        }

        if (normalizedView === 'admin') this.renderAdmin();
        if (normalizedView === 'settings') this.renderSettings();
        if (normalizedView === 'updates') this.renderUpdates();
        if (normalizedView === 'storage') this.renderStorageManager();
        if (normalizedView === 'community') this.renderCommunity();
        if (this.libraryViewNames.has(normalizedView) && normalizedView !== 'community') this.renderLibrary();
    }

    normalizeLibraryView(viewName) {
        return viewName === 'recent' ? 'continue' : viewName;
    }

    getLibraryViewConfig(viewName) {
        return LIBRARY_VIEWS[viewName] || LIBRARY_VIEWS.library;
    }

    getSizeScale(bytes) {
        const mb = 1024 * 1024;
        const gb = mb * 1024;

        if (bytes >= gb) return { unit: 'GB', divisor: gb };
        return { unit: 'MB', divisor: mb };
    }

    formatSize(bytes, scale = null) {
        if (!Number.isFinite(bytes) || bytes <= 0) return scale ? `0 ${scale.unit}` : '0 MB';

        const sizeScale = scale || this.getSizeScale(bytes);
        const value = bytes / sizeScale.divisor;
        const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
        return `${value.toFixed(precision)} ${sizeScale.unit}`;
    }

    getImportSourceName(files) {
        const firstFile = files?.[0];
        const relativePath = firstFile?.webkitRelativePath || firstFile?.name || '';

        if (relativePath.includes('/')) {
            return relativePath.split('/')[0];
        }

        return relativePath.replace(/\.zip$/i, '') || 'Imported Game';
    }

    getImportStats(files) {
        const fileArray = Array.from(files || []);
        const totalBytes = fileArray.reduce((sum, file) => sum + (file.size || 0), 0);

        return {
            fileArray,
            totalBytes,
            totalFiles: fileArray.length,
            sourceName: this.getImportSourceName(fileArray),
            sizeScale: this.getSizeScale(totalBytes)
        };
    }

    sortGames(games, sortMode) {
        const sorted = [...games];

        switch (sortMode) {
            case 'recent':
                return sorted.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.addedAt || 0) - (a.addedAt || 0));
            case 'added':
                return sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
            case 'plays':
                return sorted.sort((a, b) => (b.playCount || 0) - (a.playCount || 0) || (b.lastPlayed || 0) - (a.lastPlayed || 0));
            case 'name':
            default:
                return sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
        }
    }

    /**
     * Renders the game cards in the library grid.
     */
    async renderLibrary() {
        const grid = document.getElementById('games-grid');
        const emptyState = document.getElementById('empty-state');
        const emptyStateTitle = document.getElementById('empty-state-title');
        const emptyStateCopy = document.getElementById('empty-state-copy');
        const titleEl = document.getElementById('view-library-title');
        const descEl = document.getElementById('view-library-desc');
        const sortFilter = document.getElementById('sort-filter');
        const emptyStateAction = document.getElementById('empty-state-action');
        if (!grid) return;

        await this.loadPublicLibrary();
        const viewConfig = this.getLibraryViewConfig(this.currentView);
        const localGames = await storage.getAllGames();
        const games = this.getCombinedLibraryGames(localGames);
        const duplicateIndex = this.buildDuplicateIndex(games);
        const filteredGames = this.getVisibleGames(games);

        if (titleEl) titleEl.textContent = viewConfig.title;
        if (descEl) descEl.textContent = viewConfig.description;

        this.renderLibraryNotices(games, duplicateIndex);

        if (games.length === 0 || filteredGames.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');

            if (emptyStateTitle && emptyStateCopy) {
                if (games.length === 0) {
                    emptyStateTitle.textContent = LIBRARY_VIEWS.library.emptyTitle;
                    emptyStateCopy.textContent = LIBRARY_VIEWS.library.emptyDescription;
                    if (emptyStateAction) {
                        emptyStateAction.textContent = 'Quick Import';
                        emptyStateAction.dataset.action = 'import';
                    }
                } else if (this.searchQuery.trim()) {
                    emptyStateTitle.textContent = `No matches for "${this.searchQuery.trim()}"`;
                    emptyStateCopy.textContent = 'Try a different search term or clear the search box.';
                    if (emptyStateAction) {
                        emptyStateAction.textContent = 'Clear Search';
                        emptyStateAction.dataset.action = 'clear-search';
                    }
                } else {
                    emptyStateTitle.textContent = viewConfig.emptyTitle || 'No games found';
                    emptyStateCopy.textContent = viewConfig.emptyDescription || 'Nothing matched this view.';
                    if (emptyStateAction) {
                        emptyStateAction.textContent = this.currentView === 'library' ? 'Quick Import' : 'Back to Library';
                        emptyStateAction.dataset.action = this.currentView === 'library' ? 'import' : 'library';
                    }
                }
            }
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');
        if (emptyStateAction) {
            emptyStateAction.textContent = 'Quick Import';
            emptyStateAction.dataset.action = 'import';
        }

        grid.innerHTML = filteredGames.map(game => this.createGameCard(game, {
            duplicateIndex,
            isBroken: this.isGameBroken(game)
        })).join('');
        
        // Re-inject icons
        lucide.createIcons();

        // Bind clicks to launch
        grid.querySelectorAll('.game-card').forEach(card => {
            const id = card.dataset.id;
            card.addEventListener('click', () => this.openGameWindow(id));
            
            // Handle buttons inside card
            const favBtn = card.querySelector('.fav-btn');
            if (favBtn) {
                favBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFavorite(id);
                });
            }

            const deleteBtn = card.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeGame(id);
                });
            }

            const repairBtn = card.querySelector('.repair-btn');
            if (repairBtn) {
                repairBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.repairGame(id);
                });
            }

            const publishBtn = card.querySelector('.publish-btn');
            if (publishBtn) {
                publishBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const success = await this.publishGameToPublicLibrary(game);
                    if (success) {
                        this.notify('Published!', `"${game.title}" is now live in the community catalog.`, 'success');
                        this.renderLibrary();
                    } else if (this.canSyncPublicLibrary()) {
                        this.notify('Publish Failed', 'Ensure you have an active connection and Supabase is configured.', 'error');
                    }
                });
            }
        });
    }

    /**
     * Renders games from Supabase in the community grid.
     */
    async renderCommunity() {
        const grid = document.getElementById('community-grid');
        const emptyState = document.getElementById('community-empty');
        if (!grid) return;

        grid.innerHTML = '<div class="col-span-full py-20 flex justify-center"><div class="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div></div>';
        
        await this.loadPublicLibrary({ force: true });
        
        if (!this.publicGames || this.publicGames.length === 0) {
            grid.classList.add('hidden');
            emptyState?.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState?.classList.add('hidden');

        grid.innerHTML = this.publicGames.map(game => this.createGameCard(game, {
            isPublicMirror: true
        })).join('');

        lucide.createIcons();

        grid.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => this.openGameWindow(card.dataset.id));
        });
    }

    createGameCard(game, context = {}) {
        const badges = this.getGameBadges(game, context.duplicateIndex || null);
        const leadBadge = badges.slice(0, 1);
        const supportBadges = badges.slice(1, 4);
        const fileCount = this.getGameFileCount(game);
        const sizeBytes = this.getGameSizeBytes(game);
        const playCount = game?.playCount || 0;
        const hasRepair = Boolean(context.isBroken);
        const isPublicMirror = this.isPublicMirrorGame(game) || Boolean(context.isPublicMirror);
        const theme = this.getCardThemeTokens(game.title);
        const titleInitial = (String(game.title || 'G').trim().charAt(0) || 'G').toUpperCase();
        const recencyLabel = game.lastPlayed
            ? `${Math.max(1, Math.floor((Date.now() - game.lastPlayed) / 86400000))}d ago`
            : 'Never played';
        const statusLabel = context.isBroken
            ? 'Needs repair'
            : isPublicMirror
                ? 'Shared'
            : game.updateAvailable
                ? 'Update available'
            : game.isFavorite
                ? 'Starred'
                : playCount > 0
                    ? 'In rotation'
                    : 'Fresh install';
        const accentStyle = [
            `--card-accent: ${theme.accent}`,
            `--card-accent-soft: ${theme.accentSoft}`,
            `--card-accent-glow: ${theme.accentGlow}`,
            `--card-accent-glow-2: ${theme.accentGlow2}`,
            `--card-edge: ${theme.edge}`
        ].join('; ');

        return `
            <div class="game-card relative group cursor-pointer" data-id="${game.id}" style="${accentStyle}">
                <div class="game-card-shell glass-card overflow-hidden h-full flex flex-col rounded-2xl">
                    <div class="game-card-media relative overflow-hidden">
                        <img src="${this.generateFallbackThumb(game.title)}" class="game-card-img group-hover:scale-110 transition-transform duration-700" alt="${game.title}">
                        <div class="game-card-overlay absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span class="game-card-cta">LAUNCH NOW</span>
                        </div>
                        <div class="game-card-media-glow pointer-events-none"></div>
                        <div class="game-card-media-rim pointer-events-none"></div>
                        <div class="absolute top-3 left-3 right-3 z-10 space-y-2">
                            <div class="flex items-center gap-2">
                                <span class="game-card-pill game-card-pill-accent shrink-0">${game.type}</span>
                                <div class="flex-1 min-w-0"></div>
                                ${isPublicMirror ? '' : `
                                    <button class="fav-btn shrink-0 p-2 bg-black/40 backdrop-blur-md rounded-lg text-white/60 hover:text-brand-primary transition-all active:scale-90" title="Toggle Favorite">
                                        <i data-lucide="${game.isFavorite ? 'heart-off' : 'heart'}" class="w-4 h-4 ${game.isFavorite ? 'fill-brand-primary text-brand-primary' : ''}"></i>
                                    </button>
                                `}
                            </div>
                            <div class="flex justify-start">
                                <span class="game-card-status-label max-w-full">${statusLabel}</span>
                            </div>
                        </div>
                        <div class="absolute bottom-1 left-3 right-3 z-10 flex items-end justify-between gap-3 pointer-events-none">
                            <div class="game-card-mini-stats">
                                <span class="game-card-mini-stat">
                                    <i data-lucide="file" class="w-3 h-3"></i>
                                    ${fileCount}
                                </span>
                                <span class="game-card-mini-stat">
                                    <i data-lucide="hard-drive" class="w-3 h-3"></i>
                                    ${this.formatSize(sizeBytes)}
                                </span>
                            </div>
                            <div class="game-card-monogram">${titleInitial}</div>
                        </div>
                        ${isPublicMirror ? '' : `
                            <button class="delete-btn absolute top-14 right-3 p-2 bg-black/40 backdrop-blur-md rounded-lg text-white/60 hover:text-red-500 transition-all z-20 active:scale-90" title="Remove Game">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        `}
                        ${hasRepair && !isPublicMirror ? `
                            <button class="repair-btn absolute top-24 right-3 p-2 bg-black/40 backdrop-blur-md rounded-lg text-white/60 hover:text-amber-400 transition-all z-20 active:scale-90" title="Repair Game">
                                <i data-lucide="wrench" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                        ${!isPublicMirror && this.canSyncPublicLibrary() ? `
                            <button class="publish-btn absolute top-34 right-3 p-2 bg-brand-primary/20 backdrop-blur-md rounded-lg text-brand-primary hover:bg-brand-primary hover:text-white transition-all z-20 active:scale-90" title="Publish to Community" data-id="${game.id}">
                                <i data-lucide="share-2" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="p-4 md:p-5 flex-1 flex flex-col">
                        <div class="game-card-meta-row">
                            <span class="game-card-kicker">${game.category || game.type || 'Personal'}</span>
                            <span class="game-card-status">${recencyLabel}</span>
                        </div>
                        <h4 class="game-card-title text-white font-700 text-base md:text-lg group-hover:text-brand-primary transition-colors mb-1 truncate">${game.title}</h4>
                        <div class="mt-2.5 mb-3 space-y-2">
                            ${leadBadge.length ? `
                                <div class="badge-rail badge-rail-lead">
                                    ${leadBadge.map(badge => `
                                        <span class="badge-chip" data-tone="${badge.tone}" data-variant="lead">
                                            ${badge.icon ? `<i data-lucide="${badge.icon}" class="w-3 h-3"></i>` : ''}
                                            ${badge.label}
                                        </span>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${supportBadges.length ? `
                                <div class="badge-rail badge-rail-support">
                                    ${supportBadges.map(badge => `
                                        <span class="badge-chip" data-tone="${badge.tone}" data-variant="support">
                                            ${badge.icon ? `<i data-lucide="${badge.icon}" class="w-3 h-3"></i>` : ''}
                                            ${badge.label}
                                        </span>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="game-card-stats">
                            <div class="game-card-stat">
                                <div class="game-card-stat-label">Files</div>
                                <div class="game-card-stat-value"><i data-lucide="file" class="w-3 h-3"></i>${fileCount}</div>
                            </div>
                            <div class="game-card-stat">
                                <div class="game-card-stat-label">Size</div>
                                <div class="game-card-stat-value"><i data-lucide="hard-drive" class="w-3 h-3"></i>${this.formatSize(sizeBytes)}</div>
                            </div>
                            <div class="game-card-stat">
                                <div class="game-card-stat-label">Plays</div>
                                <div class="game-card-stat-value"><i data-lucide="play" class="w-3 h-3"></i>${playCount}</div>
                            </div>
                        </div>
                        <p class="text-white/40 text-[11px] md:text-xs font-500 line-clamp-1 md:line-clamp-2 leading-relaxed mt-3">${game.description}</p>
                        <div class="game-card-footer mt-2.5 pt-2.5 md:mt-3 md:pt-3">
                            <span>${game.lastPlayed ? 'Played' : 'Unplayed'}</span>
                            <span>${isPublicMirror ? 'Public' : game.isFavorite ? 'Favorite' : 'Library'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getCardThemeTokens(title) {
        const theme = this.getTheme();
        const seed = Number.parseInt(this.hashString(title), 36) || 0;
        const colors = [...theme.colors];
        const offset = colors.length > 0 ? seed % colors.length : 0;
        const rotated = colors.slice(offset).concat(colors.slice(0, offset));

        return {
            accent: rotated[0],
            accentSoft: colorWithAlpha(rotated[0], 0.18),
            accentGlow: colorWithAlpha(rotated[1] || rotated[0], 0.28),
            accentGlow2: colorWithAlpha(rotated[2] || rotated[0], 0.16),
            edge: colorWithAlpha(rotated[0], 0.4)
        };
    }

    /**
     * File Upload Logic
     */
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const progressStatus = document.getElementById('upload-status');
        const progressSize = document.getElementById('upload-size');
        const progressFileCount = document.getElementById('upload-file-count');

        const { fileArray, totalBytes, totalFiles, sourceName, sizeScale } = this.getImportStats(files);

        progress.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        if (progressStatus) progressStatus.textContent = `Downloading ${sourceName}...`;
        if (progressSize) progressSize.textContent = `${this.formatSize(0, sizeScale)} / ${this.formatSize(totalBytes, sizeScale)}`;
        if (progressFileCount) progressFileCount.textContent = `${totalFiles} file${totalFiles === 1 ? '' : 's'}`;

        try {
            const result = await gameEngine.processFiles(fileArray, sourceName, ({ bytesProcessed, totalBytes: jobTotalBytes, filesProcessed, totalFiles: jobTotalFiles, currentFileName }) => {
                const percent = jobTotalBytes > 0
                    ? Math.min(100, Math.round((bytesProcessed / jobTotalBytes) * 100))
                    : Math.min(100, Math.round((filesProcessed / Math.max(jobTotalFiles, 1)) * 100));

                progressBar.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;

                if (progressStatus) {
                    progressStatus.textContent = currentFileName
                        ? `Downloading ${currentFileName}`
                        : `Downloading ${sourceName}...`;
                }

                if (progressSize) {
                    progressSize.textContent = `${this.formatSize(bytesProcessed, sizeScale)} / ${this.formatSize(jobTotalBytes, sizeScale)}`;
                }

                if (progressFileCount) {
                    progressFileCount.textContent = `${filesProcessed} / ${jobTotalFiles} files`;
                }
            });

            const importedGame = result?.game;
            const allGames = await storage.getAllGames();
            const duplicateGroup = importedGame
                ? this.buildDuplicateIndex(allGames).get(this.getGameFingerprint(importedGame)) || []
                : [];

            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            if (progressStatus) progressStatus.textContent = `Imported ${sourceName}`;
            if (progressSize) progressSize.textContent = `${this.formatSize(totalBytes, sizeScale)} downloaded`;
            if (progressFileCount) progressFileCount.textContent = `${totalFiles} file${totalFiles === 1 ? '' : 's'}`;

            if (importedGame) {
                this.storageSelectionId = importedGame.id;
            }

            if (duplicateGroup.length > 1 && importedGame) {
                this.notify(
                    'Duplicate detected',
                    `"${importedGame.title}" matches ${duplicateGroup.length - 1} other imported game${duplicateGroup.length === 2 ? '' : 's'}.`,
                    'warning'
                );
            } else if (importedGame) {
                this.notify('Game imported', `"${importedGame.title}" is ready to launch.`, 'success');
            }

            if (importedGame && importedGame.isPublic !== false) {
                const published = await this.publishGameToPublicLibrary(importedGame);
                if (!published && this.canSyncPublicLibrary()) {
                    this.notify(
                        'Public sync unavailable',
                        `"${importedGame.title}" was saved locally, but the shared catalog could not be updated.`,
                        'warning'
                    );
                }
            }
            
            setTimeout(() => {
                this.toggleImportModal(false);
                if (this.currentView === 'storage') {
                    this.renderStorageManager();
                } else {
                    this.renderLibrary();
                }
            }, 500);

        } catch (err) {
            alert('Error processing files: ' + err.message);
            this.notify('Import failed', err.message, 'error');
            progress.classList.add('hidden');
            progressBar.style.width = '0%';
            if (progressPercent) progressPercent.textContent = '0%';
            if (progressStatus) progressStatus.textContent = 'Preparing download...';
            if (progressSize) progressSize.textContent = '0 MB / 0 MB';
            if (progressFileCount) progressFileCount.textContent = '0 files';
        }
    }

    toggleImportModal(show) {
        const modal = document.getElementById('import-modal');
        modal.classList.toggle('hidden', !show);
        modal.classList.toggle('flex', show);

        if (show) {
            const progress = document.getElementById('upload-progress');
            const progressBar = document.getElementById('progress-bar');
            const progressPercent = document.getElementById('progress-percent');
            const progressStatus = document.getElementById('upload-status');
            const progressSize = document.getElementById('upload-size');
            const progressFileCount = document.getElementById('upload-file-count');

            if (progress) progress.classList.add('hidden');
            if (progressBar) progressBar.style.width = '0%';
            if (progressPercent) progressPercent.textContent = '0%';
            if (progressStatus) progressStatus.textContent = 'Preparing download...';
            if (progressSize) progressSize.textContent = '0 MB / 0 MB';
            if (progressFileCount) progressFileCount.textContent = '0 files';
        }
    }

    showLaunchOverlay(gameTitle, status = 'Preparing sandbox...') {
        const overlay = document.getElementById('launch-overlay');
        const title = document.getElementById('launch-title');
        const launchStatus = document.getElementById('launch-status');

        if (!overlay) return;

        this.clearLaunchOverlayTimer();
        this.launchOverlaySequence += 1;
        const sequence = this.launchOverlaySequence;

        if (title) title.textContent = `Launching "${gameTitle}"`;
        if (launchStatus) launchStatus.textContent = status;
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        overlay.classList.remove('launch-overlay-hiding');
        overlay.setAttribute('aria-hidden', 'false');

        if (this.prefersReducedMotion()) {
            overlay.classList.add('launch-overlay-visible');
            return;
        }

        overlay.classList.remove('launch-overlay-visible');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.launchOverlaySequence !== sequence) return;
                overlay.classList.add('launch-overlay-visible');
            });
        });
    }

    updateLaunchOverlay(status) {
        const launchStatus = document.getElementById('launch-status');
        if (launchStatus) launchStatus.textContent = status;
    }

    hideLaunchOverlay() {
        const overlay = document.getElementById('launch-overlay');
        if (!overlay) return;

        this.launchOverlaySequence += 1;
        const sequence = this.launchOverlaySequence;
        this.clearLaunchOverlayTimer();

        const finish = () => {
            if (this.launchOverlaySequence !== sequence) return;
            overlay.classList.remove('launch-overlay-visible');
            overlay.classList.remove('launch-overlay-hiding');
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
            overlay.setAttribute('aria-hidden', 'true');
            this.launchOverlayHideTimer = null;
        };

        if (this.prefersReducedMotion()) {
            finish();
            return;
        }

        overlay.classList.remove('launch-overlay-visible');
        overlay.classList.add('launch-overlay-hiding');
        this.launchOverlayHideTimer = window.setTimeout(finish, 360);
    }

    releaseLaunchResources(launchResult) {
        if (!launchResult?.blobUrls) return;

        for (const objectUrl of Object.values(launchResult.blobUrls)) {
            try {
                URL.revokeObjectURL(objectUrl);
            } catch (err) {
                console.warn('Failed to revoke game object URL:', err);
            }
        }

        launchResult.blobUrls = {};
    }

    stopGameFrame(iframe) {
        if (!iframe) return;

        try {
            const frameWindow = iframe.contentWindow;
            const frameDocument = iframe.contentDocument || frameWindow?.document;

            if (frameDocument) {
                frameDocument.querySelectorAll('audio, video').forEach((media) => {
                    try {
                        media.pause();
                        media.removeAttribute('src');
                        media.load?.();
                    } catch (err) {
                        console.warn('Failed to pause media during game shutdown:', err);
                    }
                });
            }

            frameWindow?.stop?.();
            iframe.src = 'about:blank';
        } catch (err) {
            console.warn('Failed to stop game frame cleanly:', err);
            try {
                iframe.src = 'about:blank';
            } catch (_) {}
        }
    }

    generateFallbackThumb(title) {
        return generateTitleArtwork(title);
    }

    /**
     * Window Management System
     */
    async openGameWindow(gameId) {
        const game = await this.getGameForAction(gameId);
        if (!game) return;
        const isPublicMirror = this.isPublicMirrorGame(game);
        const persistLaunchState = !isPublicMirror;

        // Check if already open
        if (this.activeWindows.some(w => w.gameId === gameId)) {
            // Focus it or flash it
            return;
        }

        await this.preferencesReady;
        this.showLaunchOverlay(
            game.title,
            this.safeModeEnabled
                ? 'Safe Mode active - local storage is blocked.'
                : 'Preparing sandbox...'
        );
        await new Promise(resolve => requestAnimationFrame(() => resolve()));

        let launchResult;
        let winEl = null;
        const launchStartedAt = Date.now();

        try {
            this.updateLaunchOverlay(
                this.safeModeEnabled
                    ? 'Safe Mode active - blocking storage APIs.'
                    : 'Preparing game files...'
            );
            launchResult = await gameEngine.launchGame(game, { safeMode: this.safeModeEnabled });

            if (!launchResult?.url) {
                throw new Error('Game entry point was not found.');
            }
            this.updateLaunchOverlay('Assembling game window...');
        
        // Create Window DOM
        const windowId = `win-${gameId}`;
        winEl = document.createElement('div');
        winEl.id = windowId;
        winEl.className = 'fixed inset-4 bg-brand-bg rounded-2xl border border-white/10 shadow-2xl overflow-hidden glass-panel z-50 pointer-events-auto flex flex-col window-pop-in';
        winEl.style.zIndex = this.zIndices.window++;

        winEl.innerHTML = `
            <div class="window-header h-14 bg-black/40 border-b border-white/10 flex items-center justify-between px-6 select-none">
                <div class="flex items-center gap-3">
                    <i data-lucide="gamepad-2" class="w-5 h-5 text-brand-primary"></i>
                    <span class="font-700 text-sm tracking-tight text-white/80">${game.title} <span class="text-white/20 font-500 mx-2">—</span> <span class="text-white/40 font-500 text-[10px] uppercase">Running Embedded</span></span>
                </div>
                <div class="flex items-center gap-2">
                    ${isPublicMirror ? '' : '<button class="win-btn win-artwork window-control" title="Generate Title Artwork"><i data-lucide="sparkles" class="w-4 h-4"></i></button>'}
                    <button class="win-btn win-reload window-control"><i data-lucide="rotate-cw" class="w-4 h-4"></i></button>
                    <button class="win-btn win-minimize window-control"><i data-lucide="minus" class="w-4 h-4"></i></button>
                    <button class="win-btn win-maximize window-control"><i data-lucide="maximize-2" class="w-4 h-4"></i></button>
                    <button class="win-btn win-close window-control window-control-close"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="flex-1 bg-black relative">
                <iframe src="about:blank" class="w-full h-full border-none" sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin"></iframe>
                <div class="loader game-window-loader absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                </div>
            </div>
            <div class="h-8 bg-black/60 border-t border-white/5 flex items-center justify-between px-6">
                <div class="flex gap-4">
                     <span class="text-[9px] font-700 text-white/20 flex items-center gap-1"><i data-lucide="cpu" class="w-3 h-3"></i> GPU ACCELERATED</span>
                     <span class="text-[9px] font-700 text-white/20 flex items-center gap-1"><i data-lucide="shield-check" class="w-3 h-3 text-emerald-500/50"></i> SANDBOXED</span>
                </div>
                <div class="text-[9px] font-700 text-brand-accent">AETHER PRO PLATFORM v1.4.2</div>
            </div>
        `;

        document.getElementById('window-container').appendChild(winEl);
        lucide.createIcons();
        this.updateLaunchOverlay('Booting embedded runtime...');

        const iframe = winEl.querySelector('iframe');
        const loader = winEl.querySelector('.loader');
        iframe.addEventListener('load', () => {
            const elapsed = Date.now() - launchStartedAt;
            const minimumVisible = this.prefersReducedMotion() ? 0 : 280;
            const completionHold = this.prefersReducedMotion() ? 0 : 60;
            const remaining = Math.max(0, minimumVisible - elapsed) + completionHold;

            this.updateLaunchOverlay('Game ready');

            setTimeout(() => {
                if (loader) {
                    loader.classList.add('game-window-loader-hidden');
                }
                this.hideLaunchOverlay();
            }, remaining);
        }, { once: true });
        iframe.src = launchResult.url;

        // Control events
        winEl.querySelector('.win-close').addEventListener('click', () => {
            this.closeWindow(gameId);
        });

        const artworkBtn = winEl.querySelector('.win-artwork');
        if (artworkBtn) {
            artworkBtn.addEventListener('click', async () => {
                 await this.generateGameArtwork(gameId);
            });
        }

        winEl.querySelector('.win-reload').addEventListener('click', () => {
             winEl.querySelector('iframe').contentWindow.location.reload();
        });

        winEl.querySelector('.win-maximize').addEventListener('click', () => {
             if (!document.fullscreenElement) {
                winEl.querySelector('iframe').requestFullscreen().catch(err => {
                    alert(`Error attempting to enable fullscreen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });

        this.activeWindows.push({ gameId, el: winEl, launchResult });

        if (persistLaunchState) {
            // Update play count
            game.playCount = (game.playCount || 0) + 1;
            game.lastPlayed = Date.now();
            this.recordGameEvent(
                game,
                'launch',
                `Launched${this.safeModeEnabled ? ' in Safe Mode' : ''}.`,
                {
                    safeMode: this.safeModeEnabled,
                    launchMode: this.safeModeEnabled ? 'safe' : 'standard'
                }
            );
            await storage.saveGame(game);
            await this.saveRecoverySession(game);
            if (this.currentView === 'storage') {
                this.renderStorageManager();
            } else {
                this.renderLibrary();
            }
        }
        } catch (err) {
            if (launchResult) {
                this.releaseLaunchResources(launchResult);
            }
            if (winEl) {
                const activeIndex = this.activeWindows.findIndex(w => w.gameId === gameId);
                if (activeIndex !== -1) {
                    this.activeWindows.splice(activeIndex, 1);
                }
                winEl.remove();
            }
            if (this.pendingRecoverySession?.gameId === gameId) {
                void this.clearRecoverySession();
            }
            this.hideLaunchOverlay();
            console.error('Failed to launch game:', err);
            alert(`Failed to launch "${game.title}": ${err.message}`);
        }
    }

    async generateGameArtwork(gameId) {
        try {
            const game = await storage.getGame(gameId);
            if (!game) return;

            game.thumbnail = generateTitleArtwork(game.title || 'Untitled Game');
            await storage.saveGame(game);
            if (game.isPublic !== false) {
                const published = await this.publishGameToPublicLibrary(game);
                if (!published && this.canSyncPublicLibrary()) {
                    this.notify(
                        'Public sync unavailable',
                        `"${game.title}" now has new artwork locally, but the shared catalog could not be updated.`,
                        'warning'
                    );
                }
            }
            this.renderLibrary();
            this.notify('Artwork regenerated', `"${game.title}" now uses title-based artwork.`, 'success');
        } catch (err) {
            console.error('Artwork generation failed:', err);
            alert('Failed to regenerate artwork.');
        }
    }

    closeWindow(gameId) {
        const index = this.activeWindows.findIndex(w => w.gameId === gameId);
        if (index !== -1) {
            const win = this.activeWindows[index];
            if (win.el.dataset.closing === 'true') return;
            win.el.dataset.closing = 'true';
            if (this.pendingRecoverySession?.gameId === gameId) {
                void this.clearRecoverySession();
            }
            this.hideLaunchOverlay();
            if (document.fullscreenElement && win.el.contains(document.fullscreenElement)) {
                document.exitFullscreen().catch(() => {});
            }
            this.stopGameFrame(win.el.querySelector('iframe'));
            this.releaseLaunchResources(win.launchResult);
            win.el.classList.remove('window-pop-in');
            win.el.classList.add('window-pop-out');
            const closeDelay = this.prefersReducedMotion() ? 0 : 320;
            const removeWindow = () => {
                win.el.remove();
                this.activeWindows.splice(index, 1);
            };

            if (closeDelay === 0) {
                removeWindow();
            } else {
                setTimeout(removeWindow, closeDelay);
            }
        }
    }

    /**
     * Admin View Rendering
     */
    async renderAdmin() {
        const view = document.getElementById('view-admin');
        const status = await env.checkHealth();
        const servers = env.getMonitoredServers();

        view.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h2 class="text-3xl font-800 mb-1">Environment Manager</h2>
                        <p class="text-white/40 text-sm font-500">Deployment detection & infrastructure health</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div class="glass-panel p-6 rounded-2xl">
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs font-700 text-white/30 uppercase tracking-widest">Runtime Env</span>
                            <i data-lucide="layers" class="w-4 h-4 text-brand-primary"></i>
                        </div>
                        <div class="text-2xl font-800 text-white">${status.env}</div>
                        <div class="text-xs font-600 text-brand-primary mt-1">${status.platform}</div>
                    </div>
                    <div class="glass-panel p-6 rounded-2xl">
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs font-700 text-white/30 uppercase tracking-widest">API Status</span>
                            <i data-lucide="activity" class="w-4 h-4 text-emerald-400"></i>
                        </div>
                        <div class="text-2xl font-800 text-emerald-400">${status.apiStatus}</div>
                        <div class="text-xs font-600 text-white/20 mt-1">Latency: ${status.latency}ms</div>
                    </div>
                    <div class="glass-panel p-6 rounded-2xl">
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs font-700 text-white/30 uppercase tracking-widest">Platform Health</span>
                            <i data-lucide="shield" class="w-4 h-4 text-brand-accent"></i>
                        </div>
                        <div class="text-2xl font-800 text-white">OPTIMAL</div>
                        <div class="text-xs font-600 text-emerald-400 mt-1">${status.uptime}% Uptime Managed</div>
                    </div>
                </div>

                <div class="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                    <div class="px-6 py-4 bg-white/5 border-b border-white/5 font-700 text-sm uppercase tracking-wider text-white/40">
                        Authorized Target Monitoring
                    </div>
                    <div class="divide-y divide-white/5">
                        ${servers.map(server => `
                            <div class="px-6 py-5 flex items-center justify-between group hover:bg-white/5 transition-all">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/5">
                                        <i data-lucide="${server.type === 'WebSocket' ? 'zap' : 'server'}" class="w-5 h-5 text-white/40 group-hover:text-brand-primary transition-colors"></i>
                                    </div>
                                    <div>
                                        <div class="font-700 text-white/90">${server.name}</div>
                                        <div class="text-xs font-500 text-white/20 truncate max-w-xs">${server.url}</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-6">
                                    <div class="text-right">
                                        <div class="text-xs font-700 text-white/30 uppercase">Response</div>
                                        <div class="text-sm font-700 text-white/80">${server.latency}ms</div>
                                    </div>
                                    <div class="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-xl border border-white/10">
                                        <span class="w-2 h-2 rounded-full ${server.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}"></span>
                                        <span class="text-xs font-700 ${server.status === 'ONLINE' ? 'text-emerald-500' : 'text-red-500'}">${server.status}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    updateHeaderEnv() {
        const badge = document.getElementById('env-badge');
        if (badge) {
            badge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                ${env.status.env} • ${env.status.platform}
            `;
        }
    }

    async renderUpdates() {
        const view = document.getElementById('view-updates');
        const games = await storage.getAllGames();
        const updateCount = games.filter(game => game.updateAvailable).length;
        const sortedGames = [...games].sort((a, b) => {
            const updateDelta = Number(Boolean(b.updateAvailable)) - Number(Boolean(a.updateAvailable));
            if (updateDelta !== 0) return updateDelta;
            return String(a.title || '').localeCompare(String(b.title || ''));
        });

        view.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <div class="mb-8">
                    <h2 class="text-3xl font-800 mb-1">Update Hub</h2>
                    <p class="text-white/40 text-sm font-500">Synchronize library games with your local project folders</p>
                    ${updateCount > 0 ? `
                        <div class="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-full border border-amber-300/20 bg-amber-400/10 text-amber-100 text-xs font-700">
                            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            ${updateCount} game${updateCount === 1 ? '' : 's'} ${updateCount === 1 ? 'has' : 'have'} updates available
                        </div>
                    ` : ''}
                </div>

                <div class="space-y-4">
                    ${games.length === 0 ? '<p class="text-white/20 italic">No games installed to update.</p>' : ''}
                    ${sortedGames.map(game => `
                        <div class="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-brand-primary/20 transition-all">
                            <div class="flex items-center gap-4">
                                <img src="${this.generateFallbackThumb(game.title)}" class="w-16 h-10 rounded-lg object-cover">
                                <div>
                                    <h4 class="font-700 text-white">${game.title}</h4>
                                    <p class="text-[10px] text-white/30 uppercase font-700 tracking-tighter">${game.entryPoint}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-right mr-4">
                                     <div class="text-[10px] font-700 text-white/20 uppercase">${game.updateAvailable ? 'Update Status' : 'Last Modified'}</div>
                                     <div class="text-xs font-600 ${game.updateAvailable ? 'text-amber-300' : 'text-white/60'}">${game.updateAvailable ? 'Update available' : new Date(game.lastUpdatedAt || game.addedAt).toLocaleDateString()}</div>
                                </div>
                                <button class="update-game-btn px-6 py-2 ${game.updateAvailable ? 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-100 border border-amber-300/20' : 'bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white'} rounded-xl text-xs font-700 transition-all active:scale-95" data-id="${game.id}">
                                    UPDATE FILES
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <input type="file" id="update-file-input" class="hidden" webkitdirectory directory multiple>
        `;

        lucide.createIcons();

        // Bind update buttons
        view.querySelectorAll('.update-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pendingUpdateId = btn.dataset.id;
                // Start automated sync attempt first
                this.performGameUpdate(this.pendingUpdateId);
            });
        });

        const updateInput = document.getElementById('update-file-input');
        if (updateInput) {
            updateInput.addEventListener('change', async (e) => {
                if (this.pendingUpdateId) {
                    await this.performGameUpdate(this.pendingUpdateId, e.target.files);
                    this.pendingUpdateId = null;
                }
            });
        }
    }

    async performGameUpdate(gameId, files) {
        const game = await storage.getGame(gameId);
        if (!game) return;

        if (!env.status.isLocal) {
            this.notify('Updates unavailable', 'Game syncing is only available on the local dev server.', 'info');
            return;
        }

        const overlay = document.getElementById('sync-overlay');
        const syncBar = document.getElementById('sync-bar');
        const syncPercent = document.getElementById('sync-percent');
        const syncStatus = document.getElementById('sync-status');
        const syncTitle = document.getElementById('sync-title');

        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        syncTitle.textContent = `Syncing "${game.title}"`;
        syncBar.style.width = '0%';
        syncPercent.textContent = '0%';
        syncStatus.textContent = 'Contacting Dev Server...';

        try {
            // Priority: Attempt Automated Server Sync
            const folderName = game.entryPoint.includes('/') ? game.entryPoint.split('/')[0] : null;
            
            if (folderName && !files) {
                console.log(`[SYNC] Attempting automated sync for folder: ${folderName}`);
                const response = await fetch(`/api/sync-game?folder=${encodeURIComponent(folderName)}`);
                const data = await response.json();
                
                if (data.success) {
                    const syncResult = await gameEngine.syncFilesFromServer(gameId, data.files, (pct, status) => {
                        syncBar.style.width = pct + '%';
                        syncPercent.textContent = pct + '%';
                        syncStatus.textContent = status;
                    });
                    
                    if (syncResult.changed) {
                        syncStatus.textContent = 'Update Complete!';
                        syncStatus.classList.add('text-brand-primary');
                        this.notify('Game updated', `"${game.title}" was synchronized from the server.`, 'success');
                    } else {
                        syncStatus.textContent = 'No changes detected. Already up to date.';
                        syncStatus.classList.add('text-white/40');
                        this.notify('Already up to date', `"${game.title}" matched the current server copy.`, 'info');
                    }

                    const updatedGame = syncResult.game || game;
                    if ((syncResult.changed || syncResult.upgraded) && updatedGame?.isPublic !== false) {
                        const published = await this.publishGameToPublicLibrary(updatedGame);
                        if (!published && this.canSyncPublicLibrary()) {
                            this.notify(
                                'Public sync unavailable',
                                `"${updatedGame.title}" was updated locally, but the shared catalog could not be refreshed.`,
                                'warning'
                            );
                        }
                    }

                    setTimeout(() => {
                        overlay.classList.add('hidden');
                        overlay.classList.remove('flex');
                        syncStatus.classList.remove('text-brand-primary', 'text-white/40');
                        this.renderUpdates();
                        this.renderLibrary();
                        if (this.currentView === 'storage') {
                            this.renderStorageManager();
                        }
                    }, syncResult.changed ? 1500 : 2500);
                    return;
                } else {
                    console.error(`[SYNC] Automated sync failed: ${data.error}`);
                    syncStatus.textContent = 'Folder not found on server.';
                    syncStatus.classList.add('text-red-500');
                    this.notify('Update failed', 'Folder not found on the dev server.', 'error');
                    setTimeout(() => {
                        overlay.classList.add('hidden');
                        overlay.classList.remove('flex');
                    }, 3000);
                    return;
                }
            }

            // Manual fallback only if explicitly passed (not triggered by button)
            if (files && files.length > 0) {
                // ... manual processing could go here if needed ...
            }
        } catch (err) {
            console.error('Update error:', err);
            syncStatus.textContent = 'Connection to dev server lost.';
            syncStatus.classList.add('text-red-500');
            this.notify('Update failed', 'Connection to the dev server was lost.', 'error');
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
            }, 3000);
        }
    }

    async renderStorageManager() {
        const view = document.getElementById('view-storage');
        if (!view) return;

        const games = await storage.getAllGames();
        const duplicateIndex = this.buildDuplicateIndex(games);
        const sortedGames = [...games].sort((a, b) => {
            const aScore = (b.lastUpdatedAt || b.addedAt || 0) - (a.lastUpdatedAt || a.addedAt || 0);
            if (aScore !== 0) return aScore;
            return String(a.title || '').localeCompare(String(b.title || ''));
        });

        let selectedGame = games.find(game => game.id === this.storageSelectionId) || sortedGames[0] || null;
        if (selectedGame) {
            this.storageSelectionId = selectedGame.id;
        }

        const totalBytes = games.reduce((sum, game) => sum + this.getGameSizeBytes(game), 0);
        const brokenGames = games.filter(game => this.isGameBroken(game));
        const duplicateGroups = Array.from(duplicateIndex.values()).sort((a, b) => b.length - a.length);
        const selectedBadges = selectedGame ? this.getGameBadges(selectedGame, duplicateIndex) : [];
        const selectedDuplicateGroup = selectedGame
            ? duplicateIndex.get(this.getGameFingerprint(selectedGame)) || []
            : [];
        const selectedChangelog = Array.isArray(selectedGame?.changelog) ? selectedGame.changelog : [];

        view.innerHTML = `
            <div class="max-w-7xl mx-auto space-y-8">
                <div class="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
                    <div class="max-w-2xl">
                        <h2 class="text-3xl md:text-4xl font-800 mb-2">Storage Manager</h2>
                        <p class="text-white/40 text-sm md:text-base font-500">
                            Inspect your installed games, review duplicates, repair broken imports, and read per-game history.
                        </p>
                    </div>
                    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-[720px]">
                        <div class="storage-card rounded-2xl px-4 py-3 min-w-0">
                            <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-white/25">Games</div>
                            <div class="text-2xl font-800 mt-1">${games.length}</div>
                        </div>
                        <div class="storage-card rounded-2xl px-4 py-3 min-w-0">
                            <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-white/25">Storage</div>
                            <div class="text-2xl font-800 mt-1">${this.formatSize(totalBytes)}</div>
                        </div>
                        <div class="storage-card rounded-2xl px-4 py-3 min-w-0">
                            <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-white/25">Duplicates</div>
                            <div class="text-2xl font-800 mt-1">${duplicateGroups.length}</div>
                        </div>
                        <div class="storage-card rounded-2xl px-4 py-3 min-w-0">
                            <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-white/25">Broken</div>
                            <div class="text-2xl font-800 mt-1">${brokenGames.length}</div>
                        </div>
                    </div>
                </div>

                ${games.length === 0 ? `
                    <div class="storage-card rounded-3xl p-8 text-center">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <i data-lucide="database" class="w-8 h-8 text-white/25"></i>
                        </div>
                        <h3 class="text-xl font-700 mb-2">No games installed</h3>
                        <p class="text-white/40 text-sm max-w-md mx-auto">Import a game first, then this screen will show storage, repair, and changelog details.</p>
                    </div>
                ` : `
                    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] gap-6">
                        <div class="storage-card rounded-3xl p-4 md:p-5 space-y-4">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-white/25">Installed Games</div>
                                    <div class="text-sm text-white/45">Click a title to inspect it.</div>
                                </div>
                                <button id="storage-open-library" class="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs font-700 active:scale-95 transition-all">Open Library</button>
                            </div>
                            <div class="space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
                                ${sortedGames.map(game => {
                                    const badges = this.getGameBadges(game, duplicateIndex).slice(0, 3);
                                    const isSelected = selectedGame?.id === game.id;
                                    return `
                                        <button
                                            type="button"
                                            data-storage-game-id="${game.id}"
                                            class="w-full text-left rounded-2xl border transition-all p-3 ${isSelected ? 'border-brand-primary/35 bg-brand-primary/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'}"
                                            style="${isSelected ? 'box-shadow: 0 0 0 1px rgb(var(--brand-primary-rgb) / 0.14);' : ''}"
                                        >
                                            <div class="flex items-start gap-3">
                                                <img src="${this.generateFallbackThumb(game.title)}" class="w-14 h-14 rounded-xl object-cover shrink-0">
                                                <div class="min-w-0 flex-1">
                                                    <div class="flex items-center justify-between gap-3">
                                                        <h3 class="font-700 text-white truncate">${game.title}</h3>
                                                        <i data-lucide="chevron-right" class="w-4 h-4 text-white/20 shrink-0"></i>
                                                    </div>
                                                    <div class="mt-1 text-[10px] font-700 uppercase tracking-[0.22em] text-white/25">
                                                        ${this.getGameFileCount(game)} files • ${this.formatSize(this.getGameSizeBytes(game))}
                                                    </div>
                                                    <div class="mt-2 flex flex-wrap gap-2">
                                                        ${badges.map(badge => `
                                                            <span class="badge-chip" data-tone="${badge.tone}">
                                                                ${badge.icon ? `<i data-lucide="${badge.icon}" class="w-3 h-3"></i>` : ''}
                                                                ${badge.label}
                                                            </span>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <div class="storage-card rounded-3xl p-5 md:p-6 space-y-6">
                            ${selectedGame ? `
                                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                                    <div class="flex items-start gap-4 min-w-0">
                                        <img src="${this.generateFallbackThumb(selectedGame.title)}" class="w-24 h-24 rounded-2xl object-cover border border-white/10 shrink-0">
                                        <div class="min-w-0">
                                            <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-brand-accent/80 mb-2">Selected Game</div>
                                            <h3 class="text-2xl font-800 truncate">${selectedGame.title}</h3>
                                            <p class="text-white/40 text-sm mt-1 max-w-2xl">${selectedGame.description}</p>
                                            <div class="mt-3 flex flex-wrap gap-2">
                                                ${selectedBadges.map(badge => `
                                                    <span class="badge-chip" data-tone="${badge.tone}">
                                                        ${badge.icon ? `<i data-lucide="${badge.icon}" class="w-3 h-3"></i>` : ''}
                                                        ${badge.label}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-nowrap gap-2 overflow-x-auto custom-scrollbar pb-1">
                                        <button data-storage-action="launch" data-game-id="${selectedGame.id}" class="shrink-0 whitespace-nowrap min-w-[5.75rem] px-3 py-2 rounded-xl bg-brand-primary text-white text-xs font-700 active:scale-95 transition-all">Launch</button>
                                        <button data-storage-action="repair" data-game-id="${selectedGame.id}" class="shrink-0 whitespace-nowrap min-w-[5.75rem] px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs font-600 active:scale-95 transition-all ${this.isGameBroken(selectedGame) ? '' : 'opacity-60'}">Repair</button>
                                        <button data-storage-action="favorite" data-game-id="${selectedGame.id}" class="shrink-0 whitespace-nowrap min-w-[5.75rem] px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs font-600 active:scale-95 transition-all">${selectedGame.isFavorite ? 'Unfavorite' : 'Favorite'}</button>
                                        <button data-storage-action="delete" data-game-id="${selectedGame.id}" class="shrink-0 whitespace-nowrap min-w-[5.75rem] px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-xs font-700 active:scale-95 transition-all">Remove</button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                        <div class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">Files</div>
                                        <div class="text-xl font-800 mt-2">${this.getGameFileCount(selectedGame)}</div>
                                    </div>
                                    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                        <div class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">Storage</div>
                                        <div class="text-xl font-800 mt-2">${this.formatSize(this.getGameSizeBytes(selectedGame))}</div>
                                    </div>
                                    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                        <div class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">Plays</div>
                                        <div class="text-xl font-800 mt-2">${selectedGame.playCount || 0}</div>
                                    </div>
                                    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                        <div class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">Updated</div>
                                        <div class="text-sm font-700 mt-2">${new Date(selectedGame.lastUpdatedAt || selectedGame.addedAt).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-4">
                                    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                                        <div class="flex items-center justify-between">
                                            <h4 class="font-700">Duplicate Group</h4>
                                            <span class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">${selectedDuplicateGroup.length} matches</span>
                                        </div>
                                        ${selectedDuplicateGroup.length > 1 ? `
                                            <div class="space-y-2">
                                                ${selectedDuplicateGroup.map(game => `
                                                    <button data-storage-game-id="${game.id}" type="button" class="w-full text-left rounded-xl border border-white/10 bg-black/20 px-3 py-3 hover:bg-white/5 transition-all">
                                                        <div class="flex items-center justify-between gap-3">
                                                            <span class="font-600 text-white">${game.title}</span>
                                                            <span class="text-[10px] font-800 uppercase tracking-[0.24em] text-white/25">${this.formatSize(this.getGameSizeBytes(game))}</span>
                                                        </div>
                                                    </button>
                                                `).join('')}
                                            </div>
                                        ` : `
                                            <p class="text-sm text-white/40">No duplicate match found for this game.</p>
                                        `}
                                    </div>
                                    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                                        <div class="flex items-center justify-between">
                                            <h4 class="font-700">File Health</h4>
                                            <span class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">${this.isGameBroken(selectedGame) ? 'Repair needed' : 'Healthy'}</span>
                                        </div>
                                        <div class="space-y-2 text-sm text-white/45">
                                            <div><span class="text-white/70 font-600">Entry point:</span> ${selectedGame.entryPoint || 'Missing'}</div>
                                            <div><span class="text-white/70 font-600">Category:</span> ${selectedGame.category || 'Uncategorized'}</div>
                                            <div><span class="text-white/70 font-600">Added:</span> ${new Date(selectedGame.addedAt).toLocaleDateString()}</div>
                                            <div><span class="text-white/70 font-600">Last played:</span> ${selectedGame.lastPlayed ? new Date(selectedGame.lastPlayed).toLocaleString() : 'Never'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                                    <div class="flex items-center justify-between gap-3">
                                        <h4 class="font-700">Per-Game Changelog</h4>
                                        <span class="text-[10px] font-800 uppercase tracking-[0.28em] text-white/25">${selectedChangelog.length} entries</span>
                                    </div>
                                    ${selectedChangelog.length > 0 ? `
                                        <div class="space-y-2">
                                            ${selectedChangelog.slice(0, 8).map(entry => `
                                                <div class="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                                                    <div class="flex items-center justify-between gap-3">
                                                        <div class="font-700 text-sm text-white">${entry.title || entry.type || 'Updated'}</div>
                                                        <div class="text-[10px] font-800 uppercase tracking-[0.22em] text-white/25">${new Date(entry.at || Date.now()).toLocaleString()}</div>
                                                    </div>
                                                    <div class="text-sm text-white/45 mt-1">${entry.message || 'No additional details recorded.'}</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : `
                                        <p class="text-sm text-white/40">No changelog entries yet.</p>
                                    `}
                                </div>
                            ` : `
                                <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                                    <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                        <i data-lucide="gamepad-2" class="w-7 h-7 text-white/25"></i>
                                    </div>
                                    <h3 class="text-xl font-700 mb-2">No game selected</h3>
                                    <p class="text-white/40 text-sm max-w-sm mx-auto">Pick a game from the list to inspect storage usage, changelog entries, and repair state.</p>
                                </div>
                            `}
                        </div>
                    </div>
                `}
            </div>
        `;

        lucide.createIcons();

        const openLibraryBtn = view.querySelector('#storage-open-library');
        if (openLibraryBtn) {
            openLibraryBtn.addEventListener('click', () => this.switchView('library'));
        }

        view.querySelectorAll('[data-storage-game-id]').forEach(button => {
            button.addEventListener('click', () => {
                this.selectStorageGame(button.dataset.storageGameId);
            });
        });

        view.querySelectorAll('[data-storage-action]').forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.storageAction;
                const gameId = button.dataset.gameId;

                if (!gameId) return;

                if (action === 'launch') {
                    await this.openGameWindow(gameId);
                } else if (action === 'repair') {
                    await this.repairGame(gameId);
                } else if (action === 'favorite') {
                    await this.toggleFavorite(gameId);
                    if (this.currentView === 'storage') {
                        this.renderStorageManager();
                    }
                } else if (action === 'delete') {
                    await this.removeGame(gameId);
                }
            });
        });
    }

    async renderSettings() {
        await this.preferencesReady;
        const view = document.getElementById('view-settings');
        const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';
        const recoveryGameTitle = this.pendingRecoverySession?.title || 'None';
        const activeTheme = this.getTheme();
        view.innerHTML = `
            <div class="max-w-3xl mx-auto space-y-8">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h2 class="text-3xl font-800 mb-2">Settings</h2>
                        <p class="text-white/40 text-sm font-500 max-w-xl">Launcher preferences, notifications, and recovery controls.</p>
                    </div>
                    <button id="open-storage-manager" class="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm font-600 transition-all active:scale-95">
                        <i data-lucide="database" class="w-4 h-4 text-brand-accent"></i>
                        Open Storage Manager
                    </button>
                </div>

                <div class="glass-panel p-6 rounded-3xl space-y-5">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <div class="text-[10px] font-800 uppercase tracking-[0.35em] text-brand-accent/80 mb-2">Color Themes</div>
                            <h3 class="text-2xl font-800 mb-2">Choose your palette</h3>
                            <p class="text-white/40 text-sm max-w-2xl">This updates the launcher chrome, background glow, and the game card accents.</p>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-[10px] font-800 uppercase tracking-[0.32em] text-white/25">Active theme</div>
                            <div class="mt-2 text-sm font-700 text-white">${activeTheme.name}</div>
                        </div>
                    </div>
                <div class="theme-picker-grid">
                        ${this.renderThemePicker()}
                    </div>
                </div>

                <div class="glass-panel p-6 rounded-2xl flex items-center justify-between gap-6">
                    <div>
                        <div class="text-[10px] font-800 uppercase tracking-[0.35em] text-white/30 mb-2">Public Catalog</div>
                        <div class="font-700 text-lg mb-1">Supabase-backed site data</div>
                        <p class="text-white/40 text-sm">Public games load from Supabase when configured, and signed-in launcher preferences sync to your account. The local JSON cache remains the fallback.</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <div class="px-3 py-1 rounded-full border text-xs font-700 ${this.getPublicLibrarySupabaseConfig().configured ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/50'}">
                            ${this.getPublicLibrarySupabaseConfig().configured ? 'Connected' : 'Fallback mode'}
                        </div>
                        <div class="text-[10px] font-800 uppercase tracking-[0.28em] ${this.getAuthManager()?.user ? 'text-brand-accent/70' : 'text-white/25'}">
                            ${this.getAuthManager()?.user ? 'Preferences sync active' : 'Sign in to sync preferences'}
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="glass-panel p-6 rounded-2xl flex items-center justify-between gap-6">
                        <div>
                            <div class="font-700 text-lg mb-1">Hardware Acceleration</div>
                            <p class="text-white/40 text-sm">Enhanced rendering performance for WebGL games.</p>
                        </div>
                        <div class="w-12 h-6 bg-brand-primary rounded-full relative shrink-0">
                            <div class="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                        </div>
                    </div>

                    <div class="glass-panel p-6 rounded-2xl flex items-center justify-between gap-6">
                        <div>
                            <div class="font-700 text-lg mb-1">Safe Mode</div>
                            <p class="text-white/40 text-sm">Restrict all games from accessing local storage.</p>
                        </div>
                        <button
                            id="safe-mode-toggle"
                            type="button"
                            role="switch"
                            aria-checked="${this.safeModeEnabled ? 'true' : 'false'}"
                            class="relative flex h-8 w-14 items-center rounded-full border transition-all duration-200 shrink-0 ${this.safeModeEnabled ? 'border-brand-primary/40 bg-brand-primary/80 shadow-lg shadow-brand-primary/15' : 'border-white/10 bg-white/10'}"
                        >
                            <span class="sr-only">Toggle Safe Mode</span>
                            <span class="absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform duration-200 ${this.safeModeEnabled ? 'translate-x-6' : 'translate-x-0'}"></span>
                        </button>
                    </div>

                    <div class="glass-panel p-6 rounded-2xl flex items-center justify-between gap-6">
                        <div class="min-w-0">
                            <div class="font-700 text-lg mb-1">System Notifications</div>
                            <p class="text-white/40 text-sm">Use native notifications for imports, repairs, recovery, and update events.</p>
                            <div class="text-[10px] font-800 uppercase tracking-[0.3em] text-white/25 mt-3">Permission: ${notificationPermission}</div>
                        </div>
                        <button
                            id="system-notifications-toggle"
                            type="button"
                            role="switch"
                            aria-checked="${this.systemNotificationsEnabled ? 'true' : 'false'}"
                            class="relative flex h-8 w-14 items-center rounded-full border transition-all duration-200 shrink-0 ${this.systemNotificationsEnabled ? 'border-brand-accent/40 bg-brand-accent/80 shadow-lg shadow-brand-accent/15' : 'border-white/10 bg-white/10'}"
                        >
                            <span class="sr-only">Toggle System Notifications</span>
                            <span class="absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform duration-200 ${this.systemNotificationsEnabled ? 'translate-x-6' : 'translate-x-0'}"></span>
                        </button>
                    </div>

                    <div class="glass-panel p-6 rounded-2xl flex items-center justify-between gap-6">
                        <div class="min-w-0">
                            <div class="font-700 text-lg mb-1">Crash Recovery</div>
                            <p class="text-white/40 text-sm">Keeps the last launched game available if the launcher closes unexpectedly.</p>
                            <div class="text-[10px] font-800 uppercase tracking-[0.3em] text-white/25 mt-3 truncate">Pending: ${recoveryGameTitle}</div>
                        </div>
                        <button
                            id="clear-recovery-session"
                            type="button"
                            class="px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm font-700 transition-all active:scale-95 shrink-0 ${this.pendingRecoverySession ? '' : 'opacity-50 pointer-events-none'}"
                        >
                            Clear Session
                        </button>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
        this.bindSettingsControls();
    }

    async toggleFavorite(gameId) {
        const game = await storage.getGame(gameId);
        if (game) {
            game.isFavorite = !game.isFavorite;
            this.recordGameEvent(game, 'favorite', game.isFavorite ? 'Marked as favorite.' : 'Removed from favorites.');
            await storage.saveGame(game);
            if (this.currentView === 'storage') {
                this.renderStorageManager();
            }
            this.renderLibrary();
        }
    }
    async removeGame(gameId) {
        const game = await storage.getGame(gameId);
        if (!game) return;

        if (confirm(`Are you sure you want to remove "${game.title}" from your library? This action cannot be undone.`)) {
            if (this.pendingRecoverySession?.gameId === gameId) {
                await this.clearRecoverySession();
            }
            await storage.deleteGame(gameId);
            if (game.isPublic !== false) {
                const removedFromPublic = await this.removeGameFromPublicLibrary(gameId);
                if (!removedFromPublic && this.canSyncPublicLibrary()) {
                    this.notify(
                        'Public sync unavailable',
                        `"${game.title}" was removed locally, but the shared catalog could not be updated.`,
                        'warning'
                    );
                }
            }
            this.storageSelectionId = this.storageSelectionId === gameId ? null : this.storageSelectionId;
            this.notify('Game removed', `"${game.title}" was deleted from your library.`, 'info');
            if (this.currentView === 'storage') {
                this.renderStorageManager();
            }
            this.renderLibrary();
        }
    }
}

export const ui = new UIManager();
