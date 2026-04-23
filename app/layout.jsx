import fs from 'fs/promises';
import path from 'path';
import vm from 'node:vm';
import LauncherClient from './launcher-client';

const tailwindThemeConfig = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    bg: 'rgb(var(--brand-bg-rgb) / <alpha-value>)',
                    card: 'rgb(var(--brand-card-rgb) / <alpha-value>)',
                    primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
                    secondary: 'rgb(var(--brand-secondary-rgb) / <alpha-value>)',
                    accent: 'rgb(var(--brand-accent-rgb) / <alpha-value>)'
                }
            },
            backdropBlur: {
                xs: '2px'
            }
        }
    }
};

export const metadata = {
    title: 'AETHER Launcher | Pro Game Hub'
};

function escapeInlineScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function readPublicLibraryReadUrl(config = {}) {
    return String(config.publicLibraryReadUrl || '').trim().replace(/\/$/, '');
}

function readPublicLibraryApiUrl(config = {}) {
    return String(config.publicLibraryApiUrl || '').trim().replace(/\/$/, '');
}

function readFirebaseConfig(config = {}) {
    const fb = config.firebase && typeof config.firebase === 'object' ? config.firebase : {};
    return {
        apiKey: String(fb.apiKey || '').trim(),
        authDomain: String(fb.authDomain || '').trim(),
        databaseURL: String(fb.databaseURL || '').trim(),
        projectId: String(fb.projectId || '').trim(),
        storageBucket: String(fb.storageBucket || '').trim(),
        messagingSenderId: String(fb.messagingSenderId || '').trim(),
        appId: String(fb.appId || '').trim(),
        measurementId: String(fb.measurementId || '').trim(),
    };
}

function readEnvFirst(...keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

async function readFileLauncherConfig() {
    const configPath = path.join(process.cwd(), 'js', 'site-config.js');

    try {
        const source = await fs.readFile(configPath, 'utf8');
        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(source, sandbox, { timeout: 1000 });
        return sandbox.window.__AETHER_CONFIG__ && typeof sandbox.window.__AETHER_CONFIG__ === 'object'
            ? sandbox.window.__AETHER_CONFIG__
            : {};
    } catch {
        return {};
    }
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

function versionedAssetUrl(assetPath, version) {
    return version ? `${assetPath}?v=${encodeURIComponent(version)}` : assetPath;
}

async function buildLauncherConfig() {
    const fileConfig = await readFileLauncherConfig();
    const envPublicLibraryReadUrl = readEnvFirst('NEXT_PUBLIC_PUBLIC_LIBRARY_READ_URL', 'PUBLIC_LIBRARY_READ_URL').replace(/\/$/, '');
    const envPublicLibraryApiUrl = readEnvFirst('NEXT_PUBLIC_PUBLIC_LIBRARY_API_URL', 'PUBLIC_LIBRARY_API_URL').replace(/\/$/, '');
    const fileReadUrl = readPublicLibraryReadUrl(fileConfig);
    const fileApiUrl = readPublicLibraryApiUrl(fileConfig);
    const fileFirebase = readFirebaseConfig(fileConfig);

    return {
        ...fileConfig,
        publicLibraryApiUrl: envPublicLibraryApiUrl || fileApiUrl,
        publicLibraryReadUrl: envPublicLibraryReadUrl || fileReadUrl || './data/public-library.json',
        firebase: fileFirebase,
    };
}

export default async function RootLayout({ children }) {
    const [config, siteVersionManifest] = await Promise.all([
        buildLauncherConfig(),
        readSiteVersionManifest()
    ]);
    const siteBuildVersion = siteVersionManifest?.version || 'local-dev';

    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&display=swap" rel="stylesheet" />
                <link rel="icon" type="image/png" sizes="32x32" href={versionedAssetUrl('favicon-32.png', siteBuildVersion)} />
                <link rel="icon" type="image/svg+xml" sizes="any" href={versionedAssetUrl('favicon.svg', siteBuildVersion)} />
                <link rel="shortcut icon" href={versionedAssetUrl('favicon-32.png', siteBuildVersion)} />
                <link rel="stylesheet" href={versionedAssetUrl('styles.css', siteBuildVersion)} />
                <script src="https://cdn.tailwindcss.com"></script>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `tailwind.config = ${escapeInlineScript(tailwindThemeConfig)};`
                    }}
                />
                <script src="https://unpkg.com/lucide@latest"></script>
            </head>
                <body className="bg-brand-bg text-[#f0f0f5] font-['Plus_Jakarta_Sans'] overflow-hidden selection:bg-brand-primary selection:text-white">
                    {children}
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window.__AETHER_CONFIG__ = ${escapeInlineScript(config)};`
                        }}
                    />
                    <LauncherClient />
                </body>
            </html>
        );
}
