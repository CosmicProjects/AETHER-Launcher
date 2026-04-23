/**
 * AETHER Game Engine
 * Manages the parsing, sandboxing, and launching of game files.
 */

import { storage } from './storage.js';
import { generateTitleArtwork } from './artwork.js';

export class GameEngine {
    constructor() {
        this.activeWindows = new Map();
        this.supportedExtensions = ['.html', '.htm', '.js', '.json', '.canvas', '.webgl'];
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

    hashBytes(bytes) {
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        let hash = 2166136261;

        for (let i = 0; i < view.length; i++) {
            hash ^= view[i];
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(36);
    }

    normalizePath(pathValue) {
        return String(pathValue || '').replace(/\\/g, '/');
    }

    getPathPrefix(entryPoint) {
        const normalized = this.normalizePath(entryPoint);
        if (!normalized.includes('/')) {
            return '';
        }

        return `${normalized.split('/')[0]}/`;
    }

    decodeBase64ToBytes(base64) {
        const binaryString = atob(String(base64 || ''));
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes;
    }

    async buildFileContentSignature(fileData, entryPoint) {
        const parts = [];

        for (const [path, blob] of this.getFileEntries(fileData)) {
            const normalizedPath = this.normalizePath(path).toLowerCase();
            const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array();
            parts.push(`${normalizedPath}:${bytes.length}:${this.hashBytes(bytes)}`);
        }

        parts.sort();
        return this.hashString(`${entryPoint || ''}|${parts.join('|')}`);
    }

    async buildFileContentSignatureFromEncodedFiles(encodedFiles, entryPoint) {
        const pathPrefix = this.getPathPrefix(entryPoint);
        const parts = [];

        for (const [relPath, base64] of Object.entries(encodedFiles || {})) {
            const normalizedRelPath = this.normalizePath(relPath);
            const fullPath = normalizedRelPath.startsWith(pathPrefix)
                ? normalizedRelPath
                : `${pathPrefix}${normalizedRelPath}`;
            const bytes = this.decodeBase64ToBytes(base64);
            parts.push(`${fullPath.toLowerCase()}:${bytes.length}:${this.hashBytes(bytes)}`);
        }

        parts.sort();
        return this.hashString(`${entryPoint || ''}|${parts.join('|')}`);
    }

    getFileEntries(fileData) {
        return Object.entries(fileData || {});
    }

    findPlayableEntryPoint(fileData, preferredEntry = null) {
        if (preferredEntry && fileData?.[preferredEntry]) {
            return preferredEntry;
        }

        const entries = this.getFileEntries(fileData).map(([path]) => path);
        const preferred = entries.find(path => /(^|\/)(index|main)\.html?$/i.test(path));
        if (preferred) return preferred;

        const fallback = entries.find(path => /\.html?$/i.test(path));
        return fallback || null;
    }

    buildContentSignature(fileData, entryPoint) {
        const parts = this.getFileEntries(fileData)
            .map(([path, blob]) => `${String(path || '').toLowerCase()}:${blob?.size || 0}:${blob?.type || ''}`)
            .sort();

        return this.hashString(`${entryPoint || ''}|${parts.join('|')}`);
    }

    buildSignatureFromEncodedFiles(encodedFiles, entryPoint) {
        const parts = Object.entries(encodedFiles || {})
            .map(([path, base64]) => `${String(path || '').toLowerCase()}:${String(base64 || '').length}`)
            .sort();

        return this.hashString(`${entryPoint || ''}|${parts.join('|')}`);
    }

    applyGameMetadata(game, fileData, entryPoint, options = {}) {
        const now = Date.now();

        game.files = fileData;
        game.entryPoint = entryPoint || this.findPlayableEntryPoint(fileData, game.entryPoint);
        game.fileCount = Object.keys(fileData || {}).length;
        game.totalBytes = this.getFileEntries(fileData).reduce((sum, [, blob]) => sum + (blob?.size || 0), 0);
        if (options.contentSignature) {
            game.contentSignature = options.contentSignature;
            game.contentSignatureVersion = options.contentSignatureVersion || 2;
        } else if (!game.contentSignature) {
            game.contentSignature = this.buildContentSignature(fileData, game.entryPoint);
            game.contentSignatureVersion = options.contentSignatureVersion || 1;
        } else {
            game.contentSignatureVersion = options.contentSignatureVersion || game.contentSignatureVersion || 1;
        }
        game.lastUpdatedAt = options.lastUpdatedAt || now;
        game.thumbnail = generateTitleArtwork(game.title || 'Untitled Game');
        game.updateAvailable = false;
        delete game.updateSourceSignature;
        delete game.updateDetectedAt;

        if (options.changelogEntry) {
            game.changelog = Array.isArray(game.changelog) ? [...game.changelog] : [];
            game.changelog.unshift({
                id: crypto.randomUUID(),
                at: now,
                type: options.changelogEntry.type || 'update',
                title: options.changelogEntry.title || options.changelogEntry.message || 'Updated',
                message: options.changelogEntry.message || options.changelogEntry.title || 'Updated',
                meta: options.changelogEntry.meta || {}
            });
            game.changelog = game.changelog.slice(0, 24);
        }

        return game;
    }

    /**
     * Scans a list of files for game entry points.
     * Expects a list of File objects or a zip.
     */
    async processFiles(fileList, sourceName, onProgress) {
        const files = Array.from(fileList || []);
        console.log(`Processing ${files.length} files from ${sourceName}...`);

        const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
        if (onProgress) {
            onProgress({
                bytesProcessed: 0,
                totalBytes,
                filesProcessed: 0,
                totalFiles: files.length,
                currentFileName: null
            });
        }
        
        let entryPoint = null;
        const processedFiles = [];

        // Find entry point (index.html is primary)
        for (const file of files) {
            const path = file.webkitRelativePath || file.name;
            const fileName = path.split('/').pop().toLowerCase();
            
            if (fileName === 'index.html' || fileName === 'main.html') {
                entryPoint = path;
            }
            
            // Check if it's a browser-compatible extension
            const ext = fileName.slice(fileName.lastIndexOf('.'));
            if (this.supportedExtensions.includes(ext)) {
                processedFiles.push(path);
            }
        }

        if (!entryPoint && processedFiles.length > 0) {
            // Fallback: Pick the first HTML file found
            entryPoint = processedFiles.find(f => f.endsWith('.html') || f.endsWith('.htm'));
        }

        if (!entryPoint) {
            return {
                error: 'NO_ENTRY_POINT',
                message: 'No playable HTML entry point found (e.g. index.html).'
            };
        }

        // Store files as Blobs for persistence
        const fileData = {};
        let bytesProcessed = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const path = file.webkitRelativePath || file.name;
            fileData[path] = await this.readFileAsBlob(file);
            bytesProcessed += file.size || 0;

            if (onProgress) {
                onProgress({
                    bytesProcessed,
                    totalBytes,
                    filesProcessed: i + 1,
                    totalFiles: files.length,
                    currentFileName: path.split('/').pop()
                });
            }
        }

        const gameId = crypto.randomUUID();
        const title = sourceName || 'Untitled Game';
        const now = Date.now();
        const contentSignature = await this.buildFileContentSignature(fileData, entryPoint);
        const game = {
            id: gameId,
            title,
            description: 'Uploaded directly via AETHER Launcher.',
            entryPoint: entryPoint,
            files: fileData,
            thumbnail: generateTitleArtwork(title),
            addedAt: now,
            lastUpdatedAt: now,
            lastPlayed: null,
            playCount: 0,
            tags: ['Uploaded', 'Local'],
            category: 'Personal',
            isFavorite: false,
            isPublic: true,
            publicSource: 'owner',
            type: 'HTML5/Web',
            fileCount: Object.keys(fileData).length,
            totalBytes,
            contentSignature,
            contentSignatureVersion: 2,
            changelog: [{
                id: crypto.randomUUID(),
                at: now,
                type: 'import',
                title: 'Imported',
                message: `Imported ${Object.keys(fileData).length} file${Object.keys(fileData).length === 1 ? '' : 's'} from ${title}.`,
                meta: {
                    sourceName: title,
                    fileCount: Object.keys(fileData).length,
                    totalBytes
                }
            }]
        };

        await storage.saveGame(game);
        return { success: true, game };
    }

    async readFileAsBlob(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(new Blob([e.target.result], { type: file.type }));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Prepares and launches a game in a sandboxed iframe.
     */
    async launchGame(game, options = {}) {
        const blobUrls = {};
        const entryUrl = await this.prepareGameEnvironment(game, blobUrls);
        const safeModeEnabled = Boolean(options.safeMode);
        const launchUrl = safeModeEnabled && entryUrl
            ? `${entryUrl}${entryUrl.includes('?') ? '&' : '?'}aetherSafeMode=1`
            : entryUrl;

        return {
            gameId: game.id,
            url: launchUrl,
            blobUrls: blobUrls // Store for cleanup later
        };
    }

    /**
     * Updates the files for an existing game.
     */
    async refreshGameFiles(gameId, fileList) {
        console.log(`Updating files for game ${gameId}...`);
        const game = await storage.getGame(gameId);
        if (!game) return { error: 'NOT_FOUND', message: 'Game not found in database.' };

        const fileData = {};
        for (const file of fileList) {
            const path = file.webkitRelativePath.substring(file.webkitRelativePath.indexOf('/') + 1) || file.name;
            fileData[path] = await this.readFileAsBlob(file);
        }

        const entryPoint = this.findPlayableEntryPoint(fileData, game.entryPoint);
        const contentSignature = await this.buildFileContentSignature(fileData, entryPoint);
        this.applyGameMetadata(game, fileData, entryPoint, {
            contentSignature,
            contentSignatureVersion: 2,
            changelogEntry: {
                type: 'update',
                title: 'Files updated',
                message: `Updated ${Object.keys(fileData).length} file${Object.keys(fileData).length === 1 ? '' : 's'} from a local folder sync.`
            }
        });

        await storage.saveGame(game);
        return { success: true, game };
    }

    /**
     * Synchronizes files from an encoded file map.
     */
    async syncFilesFromEncodedFiles(gameId, encodedFiles, onProgress, options = {}) {
        const game = await storage.getGame(gameId);
        if (!game) return { error: 'NOT_FOUND' };

        const sourceLabel = String(options.sourceLabel || 'the source');
        // Determine if we need to prefix paths (e.g. if the entry point was Folder/index.html)
        const pathPrefix = this.getPathPrefix(game.entryPoint);

        const fileData = {};
        const entries = Object.entries(encodedFiles || {});
        const total = entries.length;
        let changeDetected = false;
        const signatureParts = [];
        const existingSignature = game.contentSignatureVersion === 2 && game.contentSignature
            ? game.contentSignature
            : await this.buildFileContentSignature(game.files, game.entryPoint);

        for (let i = 0; i < total; i++) {
             let [relPath, base64] = entries[i];
             relPath = this.normalizePath(relPath);

             // Ensure the path matches the structure expected by the VFS
             const fullPath = relPath.startsWith(pathPrefix) ? relPath : pathPrefix + relPath;
             
             // Update progress
             if (onProgress) onProgress(Math.floor((i / total) * 100), fullPath);

             // Convert base64 to bytes
             const bytes = this.decodeBase64ToBytes(base64);
             signatureParts.push(`${fullPath.toLowerCase()}:${bytes.length}:${this.hashBytes(bytes)}`);

             if (!changeDetected) {
                 const existingBlob = game.files[fullPath];
                 if (!existingBlob || existingBlob.size !== bytes.length) {
                     changeDetected = true;
                 }
             }
             
             // Guess mime type for the blob
             const ext = fullPath.split('.').pop().toLowerCase();
             const mimeTypes = {
                'html': 'text/html', 'js': 'application/javascript', 'css': 'text/css'
             };

             fileData[fullPath] = new Blob([bytes], { type: mimeTypes[ext] || 'application/octet-stream' });
        }

        const signature = this.hashString(`${game.entryPoint || ''}|${signatureParts.sort().join('|')}`);
        if (existingSignature !== signature) {
            changeDetected = true;
        }

        if (!changeDetected) {
            const needsMetadataRefresh =
                game.contentSignatureVersion !== 2 ||
                game.contentSignature !== signature ||
                game.updateAvailable ||
                game.updateSourceSignature ||
                game.updateDetectedAt;

            if (needsMetadataRefresh) {
                game.contentSignature = signature;
                game.contentSignatureVersion = 2;
                game.updateAvailable = false;
                delete game.updateSourceSignature;
                delete game.updateDetectedAt;
                await storage.saveGame(game);
                return { success: true, changed: false, upgraded: true, game };
            }
            return { success: true, changed: false };
        }

        if (onProgress) onProgress(100, 'Saving to database...');

        const entryPoint = this.findPlayableEntryPoint(fileData, game.entryPoint);
        const contentSignature = signature;
        this.applyGameMetadata(game, fileData, entryPoint, {
            contentSignature,
            contentSignatureVersion: 2,
            changelogEntry: {
                type: 'update',
                title: options.changelogTitle || 'Synced from source',
                message: options.changelogMessage || `Synced ${total} file${total === 1 ? '' : 's'} from ${sourceLabel}.`
            }
        });
        await storage.saveGame(game);
        return { success: true, changed: true, game };
    }

    async syncFilesFromServer(gameId, encodedFiles, onProgress) {
        return this.syncFilesFromEncodedFiles(gameId, encodedFiles, onProgress, {
            sourceLabel: 'the dev server',
            changelogTitle: 'Synced from server'
        });
    }

    /**
     * Maps the entry point to a virtual path intercepted by the Service Worker.
     * This allows the game to load relative assets (style.css, scripts, etc.)
     * directly from IndexedDB without rewriting paths.
     */
    async prepareGameEnvironment(game, blobUrls) {
        // Find the entry point and build the virtual path
        if (!game.files[game.entryPoint]) return null;

        const canUseVirtualFs = typeof navigator !== 'undefined'
            && 'serviceWorker' in navigator
            && Boolean(navigator.serviceWorker.controller);
        if (canUseVirtualFs) {
            if (game.isPublicMirror) {
                const existing = await storage.getGame(game.id);
                if (!existing) {
                    await storage.saveGame({ ...game, _tempMirror: true });
                }
            }
            return `./virtual-game/${encodeURIComponent(storage.dbName)}/${game.id}/${encodeURI(game.entryPoint)}`;
        }

        // Create Blob URLs for all files first so we can rewrite references
        for (const [path, blob] of Object.entries(game.files)) {
            blobUrls[path] = URL.createObjectURL(blob);
        }

        // Rewrite CSS files so any url(...) references point at blob URLs too.
        for (const [path, blob] of Object.entries(game.files)) {
            if (!/\.(css)$/i.test(path)) continue;

            try {
                const cssText = await blob.text();
                const rewrittenCss = this.rewriteCssAssetUrls(cssText, game.entryPoint, blobUrls);
                const nextBlob = new Blob([rewrittenCss], { type: blob.type || 'text/css' });
                const previousUrl = blobUrls[path];
                blobUrls[path] = URL.createObjectURL(nextBlob);
                if (previousUrl) {
                    try { URL.revokeObjectURL(previousUrl); } catch (_) {}
                }
            } catch (err) {
                console.warn(`Unable to rewrite CSS asset URLs for ${path}:`, err);
            }
        }

        // Rewrite JS modules several times so nested imports settle on final blob URLs.
        for (let pass = 0; pass < 6; pass++) {
            const nextJsUrls = new Map();

            for (const [path, blob] of Object.entries(game.files)) {
                if (!/\.(js|mjs)$/i.test(path)) continue;

                try {
                    const jsText = await blob.text();
                    const rewrittenJs = this.rewriteJsModuleUrls(jsText, path, blobUrls);
                    const nextBlob = new Blob([rewrittenJs], { type: blob.type || 'application/javascript' });
                    nextJsUrls.set(path, URL.createObjectURL(nextBlob));
                } catch (err) {
                    console.warn(`Unable to rewrite JS module URLs for ${path}:`, err);
                }
            }

            for (const [path, nextUrl] of nextJsUrls.entries()) {
                const previousUrl = blobUrls[path];
                blobUrls[path] = nextUrl;
                if (previousUrl && previousUrl !== nextUrl) {
                    try { URL.revokeObjectURL(previousUrl); } catch (_) {}
                }
            }
        }

        const entryBlob = game.files[game.entryPoint];
        if (!entryBlob) return null;

        const entryExt = String(game.entryPoint || '').split('.').pop().toLowerCase();
        if (entryExt !== 'html' && entryExt !== 'htm') {
            // Non-HTML entry points still use the virtual filesystem path.
            return `./virtual-game/${encodeURIComponent(storage.dbName)}/${game.id}/${encodeURI(game.entryPoint)}`;
        }

        const html = await entryBlob.text();
        const rewritten = this.rewriteHtmlAssetUrls(html, game.entryPoint, blobUrls);
        return URL.createObjectURL(new Blob([rewritten], { type: 'text/html' }));
    }

    normalizeRelativeAssetPath(assetPath, entryPoint) {
        const raw = String(assetPath || '').trim();
        if (!raw) return '';

        const stripped = raw.split('#')[0].split('?')[0];
        const entryDir = String(entryPoint || '').replace(/\\/g, '/').replace(/[^/]*$/, '');

        if (!entryDir) {
            return stripped.replace(/\\/g, '/').replace(/^\/+/, '');
        }

        try {
            const resolved = new URL(stripped, `https://aether.invalid/${entryDir}`).pathname.replace(/^\/+/, '');
            return resolved.replace(/\\/g, '/');
        } catch (_) {
            return stripped.replace(/\\/g, '/').replace(/^\/+/, '');
        }
    }

    resolveBlobUrl(assetPath, basePath, blobUrls) {
        const normalized = String(assetPath || '').trim();
        if (!normalized || /^(?:[a-z]+:|\/\/|data:|blob:|#|javascript:)/i.test(normalized)) {
            return normalized;
        }

        const candidates = new Set();
        const stripped = normalized.split('#')[0].split('?')[0].replace(/\\/g, '/');
        const entryDir = String(basePath || '').replace(/\\/g, '/').replace(/[^/]*$/, '');

        candidates.add(stripped);
        candidates.add(stripped.replace(/^\.\/+/, ''));
        candidates.add(stripped.replace(/^\/+/, ''));

        const normalizedRelative = this.normalizeRelativeAssetPath(stripped, basePath);
        if (normalizedRelative) {
            candidates.add(normalizedRelative);
            candidates.add(`./${normalizedRelative.replace(/^\.\/+/, '')}`);
        }

        if (entryDir) {
            candidates.add(`${entryDir}${stripped.replace(/^\/+/, '')}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/'));
        }

        for (const candidate of candidates) {
            const blobUrl = blobUrls[candidate];
            if (blobUrl) return blobUrl;
        }

        return stripped;
    }

    rewriteHtmlAssetUrls(html, entryPoint, blobUrls) {
        let rewrittenHtml = String(html || '')
            .replace(/(<(?:script|img|iframe|audio|video|source|track|embed)\b[^>]*?\s(?:src|data-src|poster)=["'])([^"']+)(["'])/gi,
                (_, prefix, url, suffix) => `${prefix}${this.resolveBlobUrl(url, entryPoint, blobUrls)}${suffix}`)
            .replace(/(<link\b[^>]*?\shref=["'])([^"']+)(["'])/gi,
                (_, prefix, url, suffix) => `${prefix}${this.resolveBlobUrl(url, entryPoint, blobUrls)}${suffix}`)
            .replace(/(<form\b[^>]*?\saction=["'])([^"']+)(["'])/gi,
                (_, prefix, url, suffix) => `${prefix}${this.resolveBlobUrl(url, entryPoint, blobUrls)}${suffix}`)
            .replace(/(url\(\s*["']?)([^"')]+)(["']?\s*\))/gi,
                (_, prefix, url, suffix) => `${prefix}${this.resolveBlobUrl(url, entryPoint, blobUrls)}${suffix}`);

        rewrittenHtml = rewrittenHtml.replace(
            /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
            (match, attrs, scriptBody) => {
                if (/\bsrc\s*=/.test(attrs) || /type\s*=\s*["']?(?:application\/json|importmap|text\/plain|application\/ld\+json)["']?/i.test(attrs)) {
                    return match;
                }

                const isModule = /type\s*=\s*["']?module["']?/i.test(attrs) || !/type\s*=/.test(attrs);
                if (!isModule) {
                    return match;
                }

                const nextBody = this.rewriteJsModuleUrls(scriptBody, entryPoint, blobUrls);
                return `<script${attrs}>${nextBody}</script>`;
            }
        );

        rewrittenHtml = rewrittenHtml.replace(
            /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
            (match, attrs, styleBody) => `<style${attrs}>${this.rewriteCssAssetUrls(styleBody, entryPoint, blobUrls)}</style>`
        );

        return this.injectResponsiveFrameBootstrap(rewrittenHtml);
    }

    rewriteCssAssetUrls(cssText, entryPoint, blobUrls) {
        return String(cssText || '')
            .replace(/(@import\s+(?:url\()?\s*["']?)([^"')\s;]+)(["']?\s*(?:\))?\s*;)/gi,
                (_, prefix, url, suffix) => `${prefix}${this.resolveBlobUrl(url, entryPoint, blobUrls)}${suffix}`)
            .replace(/(url\(\s*["']?)([^"')]+)(["']?\s*\))/gi,
                (_, prefix, url, suffix) => `${prefix}${this.resolveBlobUrl(url, entryPoint, blobUrls)}${suffix}`);
    }

    rewriteJsModuleUrls(jsText, modulePath, blobUrls) {
        const rewrite = (specifier) => this.resolveBlobUrl(specifier, modulePath, blobUrls);

        return String(jsText || '')
            .replace(/(\b(?:import|export)\b[^'"`;]*?\bfrom\s*)(['"])([^'"]+)(\2)/g,
                (_, prefix, quote, specifier, suffix) => `${prefix}${quote}${rewrite(specifier)}${suffix}`)
            .replace(/(\bimport\b\s*)(['"])([^'"]+)(\2)/g,
                (_, prefix, quote, specifier, suffix) => `${prefix}${quote}${rewrite(specifier)}${suffix}`)
            .replace(/(\bimport\s*\(\s*)(['"])([^'"]+)(\2)(\s*\))/g,
                (_, prefix, quote, specifier, suffix, tail) => `${prefix}${quote}${rewrite(specifier)}${suffix}${tail}`)
            .replace(/(new\s+URL\s*\(\s*)(['"])([^'"]+)(\2)(\s*,\s*import\.meta\.url\s*\))/g,
                (_, prefix, quote, specifier, suffix, tail) => `${prefix}${quote}${rewrite(specifier)}${suffix}${tail}`);
    }

    injectIntoHtmlHead(html, snippet) {
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

    injectResponsiveFrameBootstrap(html) {
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

        return this.injectIntoHtmlHead(html, snippets.join('\n'));
    }
}

export const gameEngine = new GameEngine();
