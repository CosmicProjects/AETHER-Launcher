/**
 * AETHER Pro Dev Server
 * A lightweight, zero-dependency development server with built-in Hot Reload.
 * Uses Server-Sent Events (SSE) to notify the launcher of file changes.
 * NEW: Automated Game Sync API for "No-Select" updates.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function loadDotEnvFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return;
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            const equalsIndex = trimmed.indexOf('=');
            if (equalsIndex <= 0) {
                continue;
            }

            const key = trimmed.slice(0, equalsIndex).trim();
            if (!key || process.env[key]) {
                continue;
            }

            let value = trimmed.slice(equalsIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            process.env[key] = value;
        }
    } catch (err) {
        console.warn(`[ENV] Unable to read ${filePath}: ${err.message}`);
    }
}

loadDotEnvFile(path.join(__dirname, '.env'));
loadDotEnvFile(path.join(__dirname, '.env.local'));

const PORT = 8080;
const WATCH_DIR = './';
const PUBLIC_LIBRARY_FILE = path.join(__dirname, 'data', 'public-library.json');
const IGNORE_DIRS = [
    'node_modules', '.git', '.gemini', '.kilocode', 
    'build', 'dist', 'out', 'bin', 'obj', 'data',
    'instagram auto poster', 'AI-Prompt-Saver', 'server starter UI'
];

// SSE Clients
let clients = [];
let lastTriggerTime = 0;
const DEBOUNCE_MS = 100;

// Auto-push: debounce git commits so rapid saves only trigger one push
let autoPushTimer = null;
const AUTO_PUSH_DEBOUNCE_MS = 3000;

function scheduleAutoPush() {
    clearTimeout(autoPushTimer);
    autoPushTimer = setTimeout(() => {
        const ts = getTS();
        const cmd = `git add data/public-library.json && git commit -m "auto: update game library" && git push`;
        exec(cmd, { cwd: __dirname }, (err, stdout, stderr) => {
            if (err) {
                // "nothing to commit" is not a real error
                if (stderr.includes('nothing to commit') || stdout.includes('nothing to commit')) {
                    console.log(`${ts} [GIT] Library already up to date, no push needed.`);
                } else {
                    console.error(`${ts} [GIT] Auto-push failed: ${stderr || err.message}`);
                }
                return;
            }
            console.log(`${ts} [GIT] ✅ Library pushed to GitHub → site will update shortly.`);
        });
    }, AUTO_PUSH_DEBOUNCE_MS);
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm'
};

const PUBLIC_LIBRARY_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

function sendJsonResponse(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...PUBLIC_LIBRARY_CORS_HEADERS
    });
    res.end(JSON.stringify(payload));
}

/**
 * Recursively reads a directory and returns a map of file paths to Buffers
 */
function readDirectoryRecursive(dir, baseDir = dir) {
    let results = {};
    const list = fs.readdirSync(dir);
    
    for (let file of list) {
        let filePath = path.join(dir, file);
        let stat = fs.statSync(filePath);
        
        if (stat && stat.isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                Object.assign(results, readDirectoryRecursive(filePath, baseDir));
            }
        } else {
            const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
            results[relPath] = fs.readFileSync(filePath);
        }
    }
    return results;
}

function ensureParentDirectory(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        if (!raw.trim()) {
            return fallback;
        }

        return JSON.parse(raw);
    } catch (err) {
        console.warn(`[PUBLIC] Failed to read ${filePath}: ${err.message}`);
        return fallback;
    }
}

function writeJsonFile(filePath, value) {
    ensureParentDirectory(filePath);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk;
            if (body.length > 25 * 1024 * 1024) {
                reject(new Error('Payload too large'));
                req.destroy();
            }
        });

        req.on('end', () => {
            if (!body.trim()) {
                resolve(null);
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error('Invalid JSON body'));
            }
        });

        req.on('error', reject);
    });
}

function normalizePublicLibrary(data) {
    if (Array.isArray(data)) {
        return { games: data };
    }

    if (!data || typeof data !== 'object') {
        return { games: [] };
    }

    if (!Array.isArray(data.games)) {
        data.games = [];
    }

    return data;
}

function readPublicLibraryCache() {
    return normalizePublicLibrary(readJsonFile(PUBLIC_LIBRARY_FILE, { games: [] }));
}



function normalizePublicGameRecord(record) {
    const payload = record?.payload ?? record?.game ?? record;

    if (!payload || typeof payload !== 'object') {
        return null;
    }

    return {
        ...payload,
        publicPublishedAt: payload.publicPublishedAt ?? record?.public_published_at ?? payload.public_published_at ?? null,
        publicUpdatedAt: payload.publicUpdatedAt ?? record?.public_updated_at ?? payload.public_updated_at ?? null
    };
}

function buildPublicGameRow(game, now = Date.now()) {
    const publicPublishedAt = game.publicPublishedAt || now;
    const publicUpdatedAt = now;
    const payload = {
        ...game,
        isPublic: true,
        publicPublishedAt,
        publicUpdatedAt
    };

    return {
        id: payload.id,
        payload,
        public_published_at: publicPublishedAt,
        public_updated_at: publicUpdatedAt
    };
}

async function readPublicLibrary() {
    return readPublicLibraryCache();
}

async function savePublicLibrary(library) {
    const normalized = normalizePublicLibrary(library);
    writeJsonFile(PUBLIC_LIBRARY_FILE, normalized);
    scheduleAutoPush();
    return normalized;
}

async function upsertPublicGame(game) {
    const library = readPublicLibraryCache();
    const now = Date.now();
    const games = Array.isArray(library.games) ? library.games : [];
    const existingGame = games.find(existing => existing.id === game.id) || null;
    const publicGame = {
        ...existingGame,
        ...game,
        isPublic: true,
        publicPublishedAt: game.publicPublishedAt || existingGame?.publicPublishedAt || now,
        publicUpdatedAt: now
    };

    const index = games.findIndex(existing => existing.id === publicGame.id);
    if (index === -1) {
        games.unshift(publicGame);
    } else {
        games[index] = publicGame;
    }

    await savePublicLibrary({ games });



    return publicGame;
}

async function removePublicGame(gameId) {
    const library = readPublicLibraryCache();
    const games = Array.isArray(library.games) ? library.games : [];
    const filtered = games.filter(game => game.id !== gameId);

    if (filtered.length !== games.length) {
        await savePublicLibrary({ games: filtered });



        return true;
    }

    return false;
}

const server = http.createServer((req, res) => {
    // 1. SSE Reload Endpoint
    if (req.url === '/aether-reload') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        clients.push(res);
        req.on('close', () => clients = clients.filter(c => c !== res));
        return;
    }

    // 2. Public Library API
    if (req.url.startsWith('/api/public-library')) {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);

        if (req.method === 'OPTIONS') {
            res.writeHead(204, PUBLIC_LIBRARY_CORS_HEADERS);
            res.end();
            return;
        }

        if (req.method === 'GET') {
            (async () => {
                try {
                    const library = await readPublicLibrary();
                    sendJsonResponse(res, 200, { success: true, games: library.games || [] });
                } catch (err) {
                    sendJsonResponse(res, 500, { success: false, error: err.message });
                }
            })();
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            (async () => {
                try {
                    const body = await readRequestBody(req);
                    const payload = body?.game || body?.data || body;
                    const games = Array.isArray(body?.games) ? body.games : null;

                    if (games && games.length > 0) {
                        const saved = [];
                        for (const game of games) {
                            saved.push(await upsertPublicGame(game));
                        }
                        sendJsonResponse(res, 200, { success: true, games: saved });
                        return;
                    }

                    if (!payload || !payload.id) {
                        sendJsonResponse(res, 400, { success: false, error: 'Missing game payload or id' });
                        return;
                    }

                    const saved = await upsertPublicGame(payload);
                    sendJsonResponse(res, 200, { success: true, game: saved });
                } catch (err) {
                    sendJsonResponse(res, 500, { success: false, error: err.message });
                }
            })();
            return;
        }

        if (req.method === 'DELETE') {
            const gameId = urlParams.searchParams.get('id');
            if (!gameId) {
                sendJsonResponse(res, 400, { success: false, error: 'Missing game id' });
                return;
            }

            (async () => {
                try {
                    const removed = await removePublicGame(gameId);
                    sendJsonResponse(res, 200, { success: removed, removed });
                } catch (err) {
                    sendJsonResponse(res, 500, { success: false, error: err.message });
                }
            })();
            return;
        }

        sendJsonResponse(res, 405, { success: false, error: 'Method not allowed' });
        return;
    }

    // 3. Automated Game Sync API
    if (req.url.startsWith('/api/sync-game')) {
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const folderName = urlParams.searchParams.get('folder');
        
        if (!folderName) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'Missing folder name' }));
        }

        try {
            // Smart Path Resolution: Check current dir, then parent dir (siblings), then common 'games' subfolder
            const searchPaths = [
                path.join(process.cwd(), folderName),
                path.join(path.dirname(process.cwd()), folderName),
                path.join(process.cwd(), 'games', folderName),
                path.join(path.dirname(process.cwd()), 'games', folderName)
            ];

            let gamePath = null;
            for (const p of searchPaths) {
                if (fs.existsSync(p)) {
                    gamePath = p;
                    break;
                }
            }

            if (!gamePath) {
                res.writeHead(404);
                return res.end(JSON.stringify({ 
                    error: `Folder "${folderName}" not found.`,
                    searched: searchPaths 
                }));
            }

            console.log(`[${new Date().toLocaleTimeString()}] [SYNC] Synchronizing from: ${gamePath}`);
            const files = readDirectoryRecursive(gamePath);
            // Convert buffers to base64 for JSON transport
            const encodedFiles = {};
            for (const [path, buffer] of Object.entries(files)) {
                encodedFiles[path] = buffer.toString('base64');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, files: encodedFiles }));
            return;
        } catch (err) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    // 4. Static File Serving
    let filePath = '.' + req.url.split('?')[0];
    if (filePath === './') filePath = './index.html';

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            });
            res.end(content, 'utf-8');
        }
    });
});

// Helper for clean timestamps using system locale (e.g. 12 or 24hr auto-detection)
const getTS = () => `[${new Date().toLocaleTimeString()}]`;

// Prevent process from crashing on watcher/DB errors
process.on('uncaughtException', (err) => {
    console.error(`${getTS()} [CRITICAL] Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`${getTS()} [CRITICAL] Unhandled Rejection at:`, promise, 'reason:', reason);
});

// Watcher: Monitor current project for changes
const watchPaths = [WATCH_DIR];

watchPaths.forEach(wPath => {
    try {
        if (!fs.existsSync(wPath)) return;
        
        const watcher = fs.watch(wPath, { recursive: true }, (eventType, filename) => {
            try {
                // Debounce and Filter: ignore rapid double-fire events and system folders
                const now = Date.now();
                if (now - lastTriggerTime < DEBOUNCE_MS) return;
                
                if (filename && !IGNORE_DIRS.some(dir => filename.includes(dir))) {
                    lastTriggerTime = now;
                    const normalizedName = String(filename).replace(/\\/g, '/');
                    const isBatchFile = normalizedName.toLowerCase().endsWith('.bat');
                    const ts = getTS();
                    
                    console.log(isBatchFile
                        ? `${ts} [UPDATE] Launcher file changed: ${normalizedName}`
                        : `${ts} [RELOAD] Change detected: ${normalizedName}`);
                        
                    const payload = isBatchFile
                        ? { type: 'launcher-update', file: normalizedName, detectedAt: Date.now() }
                        : { type: 'reload', file: normalizedName };
                        
                    clients.forEach(res => {
                        try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch(e) {}
                    });
                }
            } catch (innerErr) {
                // Silently swallow internal watcher errors to prevent crash
            }
        });

        watcher.on('error', (err) => {
            console.warn(`${getTS()} [WATCH] Watcher error on ${wPath}: ${err.message}`);
        });

    } catch (err) {
        console.warn(`${getTS()} [WATCH] Could not monitor path: ${wPath}. ${err.message}`);
    }
});

server.listen(PORT, () => {
    const ts = getTS();
    console.log(`\n======================================================`);
    console.log(`${ts} 🚀 AETHER PRO DEV SERVER STARTED ON PORT ${PORT}`);
    console.log(`${ts} 📡 HOT RELOAD & SYNC API ACTIVE`);
    console.log(`======================================================\n`);
});
