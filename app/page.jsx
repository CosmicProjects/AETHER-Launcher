import fs from 'fs/promises';
import path from 'path';

const INDEX_HTML_PATH = path.join(process.cwd(), 'index.html');

function stripScriptTags(html) {
    return html
        .replace(/\s*<!-- Scripts -->\s*/gi, '\n')
        .replace(/<script\b[\s\S]*?<\/script>\s*/gi, '')
        .trim();
}

async function readLauncherShell() {
    const indexHtml = await fs.readFile(INDEX_HTML_PATH, 'utf8');
    const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    if (!bodyMatch) {
        throw new Error('Unable to locate the launcher body markup in index.html');
    }

    return stripScriptTags(bodyMatch[1]);
}

async function readSiteVersionManifest() {
    const manifestPath = path.join(process.cwd(), 'public', 'site-version.json');

    try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw);
        return manifest && typeof manifest.version === 'string' ? manifest : null;
    } catch {
        return null;
    }
}

function applyBuildVersion(shell, version) {
    return shell.replaceAll('__AETHER_BUILD_VERSION__', version);
}

export default async function HomePage() {
    const [launcherShell, siteVersionManifest] = await Promise.all([
        readLauncherShell(),
        readSiteVersionManifest()
    ]);
    const siteBuildVersion = siteVersionManifest?.version || 'local-dev';

    return (
        <div
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: applyBuildVersion(launcherShell, siteBuildVersion) }}
        />
    );
}
