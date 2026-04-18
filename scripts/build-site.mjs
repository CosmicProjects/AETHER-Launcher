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

async function loadDotEnvFile(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
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
        if (err?.code !== 'ENOENT') {
            throw err;
        }
    }
}

function normalizeSupabaseUrl(value) {
    return String(value || '').trim().replace(/\/$/, '');
}

function isPlaceholderSupabaseUrl(value) {
    const normalized = normalizeSupabaseUrl(value).toLowerCase();
    return !normalized || normalized.includes('your-project.supabase.co');
}

function isPlaceholderSupabaseAnonKey(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return !normalized || normalized === 'your-anon-key' || normalized === 'your-public-anon-key';
}

await loadDotEnvFile(path.join(rootDir, '.env'));
await loadDotEnvFile(path.join(rootDir, '.env.local'));

const rawSupabaseUrl = process.env.SUPABASE_URL || '';
const rawSupabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseUrl = isPlaceholderSupabaseUrl(rawSupabaseUrl) ? '' : normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = isPlaceholderSupabaseAnonKey(rawSupabaseAnonKey) ? '' : rawSupabaseAnonKey.trim();
const supabaseTable = (process.env.SUPABASE_PUBLIC_GAMES_TABLE || 'public_games').trim() || 'public_games';
const supabasePreferencesTable = (process.env.SUPABASE_USER_PREFERENCES_TABLE || 'launcher_preferences').trim() || 'launcher_preferences';
const publicLibraryApiUrl = (process.env.SUPABASE_PUBLIC_LIBRARY_API_URL || '').trim().replace(/\/$/, '');

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
            throw err;
        }
    }
}

await fs.mkdir(path.join(outDir, 'js'), { recursive: true });
await fs.writeFile(
    path.join(outDir, 'js', 'site-config.js'),
    `window.__AETHER_CONFIG__ = ${JSON.stringify({
        supabaseUrl,
        supabaseAnonKey,
        supabaseTable,
        supabasePreferencesTable,
        publicLibraryApiUrl
    }, null, 2)};\n`,
    'utf8'
);

console.log(`Built static site at ${outDir}`);
