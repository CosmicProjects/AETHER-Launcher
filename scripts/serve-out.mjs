import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'out');
const port = Number(process.env.PORT || 3000);
const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1]?.trim() || '';
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
const basePath = configuredBasePath || (process.env.GITHUB_ACTIONS === 'true' && repoName ? `/${repoName}` : '');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm'
};

function getMimeType(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function stripFirstPathSegment(pathname) {
    const trimmed = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    if (!trimmed) {
        return '/';
    }

    const slashIndex = trimmed.indexOf('/');
    if (slashIndex === -1) {
        return '/';
    }

    return `/${trimmed.slice(slashIndex + 1)}`;
}

async function resolveCandidatePath(normalizedPath) {
    const normalizedWithIndex = normalizedPath === '/' ? '/index.html' : normalizedPath;
    const relativePath = normalizedWithIndex.startsWith('/') ? normalizedWithIndex.slice(1) : normalizedWithIndex;
    const candidatePath = path.join(outDir, relativePath);

    try {
        const stats = await fs.stat(candidatePath);
        if (stats.isDirectory()) {
            return path.join(candidatePath, 'index.html');
        }
        return candidatePath;
    } catch (_) {
        if (!path.extname(candidatePath)) {
            const htmlCandidate = path.join(outDir, `${relativePath}.html`);
            try {
                await fs.stat(htmlCandidate);
                return htmlCandidate;
            } catch (_) {}

            const indexCandidate = path.join(outDir, relativePath, 'index.html');
            try {
                await fs.stat(indexCandidate);
                return indexCandidate;
            } catch (_) {}
        }

        return null;
    }
}

async function resolveAssetPath(requestPath) {
    const safePath = decodeURIComponent(requestPath || '/').split('?')[0];
    const normalized = basePath && safePath.startsWith(basePath)
        ? safePath.slice(basePath.length) || '/'
        : safePath;

    const primary = await resolveCandidatePath(normalized);
    if (primary) {
        return primary;
    }

    const fallback = await resolveCandidatePath(stripFirstPathSegment(normalized));
    return fallback;
}

async function handleRequest(req, res) {
    const assetPath = await resolveAssetPath(req.url || '/');

    if (!assetPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    try {
        const headers = {
            'Content-Type': getMimeType(assetPath),
            'Cache-Control': 'no-store'
        };
        res.writeHead(200, headers);
        await pipeline(createReadStream(assetPath), res);
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Failed to serve asset: ${error.message}`);
    }
}

async function main() {
    try {
        const stats = await fs.stat(outDir);
        if (!stats.isDirectory()) {
            throw new Error('The out directory does not exist. Run `npm run build` first.');
        }
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    const server = http.createServer((req, res) => {
        void handleRequest(req, res);
    });

    server.listen(port, () => {
        console.log(`Serving ${outDir} at http://localhost:${port}`);
    });
}

main().catch(error => {
    console.error('Failed to start static preview server:', error);
    process.exit(1);
});
