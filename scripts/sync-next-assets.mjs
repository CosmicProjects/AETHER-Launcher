import fs from 'fs/promises';
import path from 'path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const copyTargets = [
    'assets',
    'data',
    'favicon-32.png',
    'favicon.svg',
    'styles.css',
    'sw.js'
];

async function copyTarget(target) {
    const sourcePath = path.join(rootDir, target);
    const destinationPath = path.join(publicDir, target);

    const stats = await fs.stat(sourcePath);
    if (stats.isDirectory()) {
        await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
        return;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
}

async function syncAssets() {
    await fs.rm(publicDir, { recursive: true, force: true });
    await fs.mkdir(publicDir, { recursive: true });

    for (const target of copyTargets) {
        try {
            await copyTarget(target);
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    console.log(`Synced Next.js public assets into ${publicDir}`);
}

syncAssets().catch(error => {
    console.error('Failed to sync Next.js assets:', error);
    process.exit(1);
});
