import fs from 'fs/promises';
import path from 'path';

export function createSiteVersionManifest() {
    const builtAt = new Date().toISOString();

    return {
        version: builtAt,
        builtAt
    };
}

export async function writeSiteVersionManifest(outputDir) {
    const manifest = createSiteVersionManifest();
    const manifestPath = path.join(outputDir, 'site-version.json');

    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    return manifest;
}
