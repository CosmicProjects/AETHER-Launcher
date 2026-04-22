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

function createBuildManifest() {
    const now = new Date();
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
    const buildStamp = now.getTime().toString(36);
    const version = commitSha ? `${buildStamp}-${commitSha.slice(0, 12)}` : `local-${buildStamp}`;

    return {
        version,
        builtAt: now.toISOString(),
        label: commitSha ? `Build ${commitSha.slice(0, 12)}` : `Build ${buildStamp}`
    };
}

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

    const buildManifest = createBuildManifest();
    await fs.writeFile(
        path.join(publicDir, 'site-build.json'),
        `${JSON.stringify(buildManifest, null, 2)}\n`,
        'utf8'
    );

    console.log(`Synced Next.js public assets into ${publicDir}`);
}

syncAssets().catch(error => {
    console.error('Failed to sync Next.js assets:', error);
    process.exit(1);
});
