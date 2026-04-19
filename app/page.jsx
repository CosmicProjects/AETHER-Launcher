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

export default async function HomePage() {
    const launcherShell = await readLauncherShell();

    return (
        <div
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: launcherShell }}
        />
    );
}
