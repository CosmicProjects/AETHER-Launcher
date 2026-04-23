import fs from 'fs/promises';
import path from 'path';
import { writeSiteVersionManifest } from './site-version.mjs';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'site');
const copyTargets = [
    'assets',
    'data',
    'js',
    'index.html',
    'styles.css',
    'sw.js',
    'favicon-32.png',
    'favicon.svg'
];

async function build() {
    console.log('🏗️ Starting static site build...');

    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });

    for (const target of copyTargets) {
        const sourcePath = path.join(rootDir, target);
        const destinationPath = path.join(outDir, target);

        try {
            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
                await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
            } else {
                await fs.mkdir(path.dirname(destinationPath), { recursive: true });
                await fs.copyFile(sourcePath, destinationPath);
            }
        } catch (err) {
            if (err?.code !== 'ENOENT') {
                console.error(`Error copying ${target}:`, err);
            }
        }
    }

    const manifest = await writeSiteVersionManifest(outDir);
    const indexPath = path.join(outDir, 'index.html');

    try {
        const indexHtml = await fs.readFile(indexPath, 'utf8');
        const versionedHtml = indexHtml.replaceAll('__AETHER_BUILD_VERSION__', manifest.version);
        await fs.writeFile(indexPath, versionedHtml, 'utf8');
    } catch (err) {
        if (err?.code !== 'ENOENT') {
            console.error('Error stamping build version into index.html:', err);
        }
    }

    console.log(`✅ Built static site at ${outDir}`);
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
