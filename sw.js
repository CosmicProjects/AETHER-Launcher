/**
 * AETHER Service Worker - Virtual File System
 * Intercepts requests for games and serves files directly from IndexedDB.
 */

const DB_VERSION = 1;
const GAMES_STORE_NAME = 'games';
const SETTINGS_STORE_NAME = 'settings';
const SAFE_MODE_STORAGE_KEY = 'safeModeEnabled';

const SAFE_MODE_GUARD_SCRIPT = `(() => {
    const noop = () => {};
    const nullValue = () => null;
    const storageProto = typeof Storage !== 'undefined' ? Storage.prototype : null;

    const patch = (target, name, value) => {
        try {
            Object.defineProperty(target, name, {
                configurable: true,
                writable: true,
                value
            });
        } catch (_) {}
    };

    if (storageProto) {
        patch(storageProto, 'getItem', nullValue);
        patch(storageProto, 'setItem', noop);
        patch(storageProto, 'removeItem', noop);
        patch(storageProto, 'clear', noop);
        patch(storageProto, 'key', nullValue);
        try {
            Object.defineProperty(storageProto, 'length', {
                configurable: true,
                get: () => 0
            });
        } catch (_) {}
    }

    const createBlockedStorage = () => {
        const backing = Object.create(null);
        return new Proxy(backing, {
            get(target, prop) {
                if (prop === 'length') return 0;
                if (prop === 'getItem' || prop === 'key') return nullValue;
                if (prop === 'setItem' || prop === 'removeItem' || prop === 'clear') return noop;
                return Reflect.get(target, prop);
            },
            set() {
                return true;
            },
            deleteProperty() {
                return true;
            }
        });
    };

    try {
        const blockedStorage = createBlockedStorage();
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get: () => blockedStorage
        });
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get: () => blockedStorage
        });
    } catch (_) {}
})();`;

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Intercept requests starting with /virtual-game/
    if (url.pathname.includes('/virtual-game/')) {
        event.respondWith(handleVirtualRequest(event.request, url));
    }
});

async function handleVirtualRequest(request, url) {
    // Extract the part after /virtual-game/
    const marker = '/virtual-game/';
    const markerIndex = url.pathname.indexOf(marker);
    const virtualPath = url.pathname.substring(markerIndex + marker.length);
    
    // virtualPath format: [dbName]/[gameId]/[file/path/here]
    const parts = virtualPath.split('/');
    if (parts.length < 3) {
        return new Response('Invalid Virtual Path', { status: 400 });
    }

    const dbName = decodeURIComponent(parts[0]);
    const gameId = parts[1];
    const filePath = decodeURIComponent(parts.slice(2).join('/'));
    const safeModeRequested = url.searchParams.get('aetherSafeMode') === '1';

    return new Promise((resolve) => {
        const dbRequest = indexedDB.open(dbName, DB_VERSION);
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(GAMES_STORE_NAME)) {
                resolve(new Response('Game Container Not Found (Missing games store)', { status: 404 }));
                return;
            }

            let store;
            try {
                const transaction = db.transaction([GAMES_STORE_NAME], 'readonly');
                store = transaction.objectStore(GAMES_STORE_NAME);
            } catch (err) {
                console.error('[SW] Unable to open games store:', err);
                resolve(new Response('Game Container Not Found (Unable to open store)', { status: 404 }));
                return;
            }
            
            // Try string ID first (for UUIDs and labels)
            const getRequest = store.get(gameId);

            getRequest.onsuccess = () => {
                let game = getRequest.result;

                // If not found, check if it's a numeric ID stored as a Number
                if (!game && /^\d+$/.test(gameId)) {
                    const idInt = parseInt(gameId);
                    const retryRequest = store.get(idInt);
                    retryRequest.onsuccess = () => processGame(retryRequest.result);
                    retryRequest.onerror = () => resolve(new Response('Database Retry Error', { status: 500 }));
                } else {
                    processGame(game);
                }
            };

            async function processGame(game) {
                if (!game) {
                    console.error('[SW] Game Not Found in DB:', gameId);
                    resolve(new Response('Game Container Not Found (Check DB)', { status: 404 }));
                    return;
                }

                // Try direct match
                let blob = game.files[filePath];
                
                // Fallback: Check if user uploaded a folder and we need to match the relative path
                if (!blob) {
                    const keys = Object.keys(game.files);
                    const matchingKey = keys.find(k => k.endsWith(filePath) || k.toLowerCase() === filePath.toLowerCase());
                    if (matchingKey) blob = game.files[matchingKey];
                }

                if (!blob) {
                    console.error('[SW] File not found in game:', filePath);
                    resolve(new Response(`File Not Found in Virtual Container: ${filePath}`, { status: 404 }));
                    return;
                }

                const contentType = blob.type || getMimeType(filePath);
                const safeModeEnabled = safeModeRequested || await getSettingValue(db, SAFE_MODE_STORAGE_KEY, false);

                if (isHtmlDocument(filePath, contentType)) {
                    const html = await blob.text();
                    const responsiveHtml = injectResponsiveFrameBootstrap(html);
                    const finalHtml = safeModeEnabled
                        ? injectSafeModeGuard(responsiveHtml)
                        : responsiveHtml;

                    resolve(new Response(finalHtml, {
                        headers: { 'Content-Type': contentType }
                    }));
                    return;
                }

                resolve(new Response(blob, {
                    headers: { 'Content-Type': contentType }
                }));
            }

            getRequest.onerror = () => resolve(new Response('Database Error', { status: 500 }));
        };

        dbRequest.onerror = () => resolve(new Response('Shared Memory Error', { status: 500 }));
    });
}

function getMimeType(path) {
    const ext = path.split('.').pop().toLowerCase();
    const types = {
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'json': 'application/json',
        'wasm': 'application/wasm'
    };
    return types[ext] || 'application/octet-stream';
}

function isHtmlDocument(path, contentType) {
    const lowerPath = path.toLowerCase();
    return lowerPath.endsWith('.html') || lowerPath.endsWith('.htm') || contentType.includes('text/html');
}

async function getSettingValue(db, key, defaultValue = null) {
    return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
            resolve(defaultValue);
            return;
        }

        let store;
        try {
            const transaction = db.transaction([SETTINGS_STORE_NAME], 'readonly');
            store = transaction.objectStore(SETTINGS_STORE_NAME);
        } catch (_) {
            resolve(defaultValue);
            return;
        }

        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result ? request.result.value : defaultValue);
        };

        request.onerror = () => resolve(defaultValue);
    });
}

function injectSafeModeGuard(html) {
    const scriptTag = `<script>${SAFE_MODE_GUARD_SCRIPT}</script>`;

    if (/<head[^>]*>/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, (match) => `${match}\n${scriptTag}`);
    }

    if (/<html[^>]*>/i.test(html)) {
        return html.replace(/<html([^>]*)>/i, (match) => `${match}\n<head>${scriptTag}</head>`);
    }

    return `${scriptTag}\n${html}`;
}

function injectIntoHtmlHead(html, snippet) {
    const safeSnippet = String(snippet || '').trim();
    if (!safeSnippet) {
        return html;
    }

    if (/<head[^>]*>/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, (match) => `${match}\n${safeSnippet}`);
    }

    if (/<html[^>]*>/i.test(html)) {
        return html.replace(/<html([^>]*)>/i, (match) => `${match}\n<head>${safeSnippet}</head>`);
    }

    return `${safeSnippet}\n${html}`;
}

function injectResponsiveFrameBootstrap(html) {
    const snippets = [];

    if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) {
        snippets.push('<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
    }

    snippets.push(`
<style id="aether-frame-sizing">
html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
}
body {
    min-width: 100%;
    min-height: 100%;
}
#app, #root, #game, #game-root, #canvas-container, .game-root, .game-stage, canvas {
    width: 100%;
    height: 100%;
}
canvas {
    display: block;
}
:where(img, video, svg) {
    max-width: 100%;
    max-height: 100%;
}
:root {
    --aether-frame-width: 100vw;
    --aether-frame-height: 100vh;
}
</style>`.trim());

    snippets.push(`
<script id="aether-frame-sizing-script">
(() => {
    const root = document.documentElement;
    let scheduled = false;

    const sync = () => {
        scheduled = false;
        const width = Math.max(1, Math.round(root.clientWidth || window.innerWidth || 0));
        const height = Math.max(1, Math.round(root.clientHeight || window.innerHeight || 0));

        root.style.setProperty('--aether-frame-width', width + 'px');
        root.style.setProperty('--aether-frame-height', height + 'px');
        root.dataset.aetherFrameWidth = String(width);
        root.dataset.aetherFrameHeight = String(height);
    };

    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(sync);
    };

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', schedule, { passive: true });
    }

    if ('ResizeObserver' in window) {
        try {
            new ResizeObserver(schedule).observe(document.documentElement);
        } catch (_) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync, { once: true });
    } else {
        sync();
    }

    schedule();
})();
</script>`.trim());

    return injectIntoHtmlHead(html, snippets.join('\n'));
}
