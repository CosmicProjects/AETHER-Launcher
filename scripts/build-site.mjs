import fs from 'fs/promises';
import path from 'path';

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

function createBuildManifest() {
    const now = new Date();
    const buildStamp = now.getTime().toString(36);
    return {
        version: `site-${buildStamp}`,
        builtAt: now.toISOString(),
        label: `Build ${buildStamp}`
    };
}

async function build() {
    console.log('🏗️ Starting static site build...');

    // Clean and create outDir
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });

    // Copy assets
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

    await fs.writeFile(
        path.join(outDir, 'site-build.json'),
        `${JSON.stringify(createBuildManifest(), null, 2)}\n`,
        'utf8'
    );

    console.log(`✅ Built static site at ${outDir}`);
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
