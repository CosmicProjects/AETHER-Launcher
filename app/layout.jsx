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
    return {
        url: String(config.firebase?.url || config.firebaseUrl || '').trim().replace(/\/$/, '')
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

function readSupabaseConfig() {
    const url = readEnvFirst('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL').replace(/\/$/, '');
    const anonKey = readEnvFirst(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'SUPABASE_ANON_KEY',
        'SUPABASE_PUBLISHABLE_KEY'
    );
    const table = readEnvFirst('NEXT_PUBLIC_SUPABASE_TABLE', 'SUPABASE_TABLE') || 'public_library';

    return {
        url,
        anonKey,
        table
    };
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

function mergeSupabaseConfig(fileConfig, envConfig) {
    const fileSupabase = fileConfig.supabase && typeof fileConfig.supabase === 'object'
        ? fileConfig.supabase
        : {};

    return {
        url: envConfig.url || String(fileSupabase.url || fileConfig.supabaseUrl || '').trim().replace(/\/$/, ''),
        anonKey: envConfig.anonKey || String(fileSupabase.anonKey || fileConfig.supabaseAnonKey || '').trim(),
        table: envConfig.table || String(fileSupabase.table || fileConfig.supabaseTable || 'public_library').trim() || 'public_library'
    };
}

async function buildLauncherConfig() {
    const fileConfig = await readFileLauncherConfig();
    const envSupabase = readSupabaseConfig();
    const supabase = mergeSupabaseConfig(fileConfig, envSupabase);
    const envPublicLibraryReadUrl = readEnvFirst('NEXT_PUBLIC_PUBLIC_LIBRARY_READ_URL', 'PUBLIC_LIBRARY_READ_URL').replace(/\/$/, '');
    const envPublicLibraryApiUrl = readEnvFirst('NEXT_PUBLIC_PUBLIC_LIBRARY_API_URL', 'PUBLIC_LIBRARY_API_URL').replace(/\/$/, '');
    const envFirebaseUrl = readEnvFirst('NEXT_PUBLIC_FIREBASE_URL', 'FIREBASE_URL').replace(/\/$/, '');
    const fileReadUrl = readPublicLibraryReadUrl(fileConfig);
    const fileApiUrl = readPublicLibraryApiUrl(fileConfig);
    const fileFirebase = readFirebaseConfig(fileConfig);

    return {
        ...fileConfig,
        publicLibraryApiUrl: envPublicLibraryApiUrl || fileApiUrl,
        publicLibraryReadUrl: envPublicLibraryReadUrl || fileReadUrl || './data/public-library.json',
        firebase: {
            ...fileFirebase,
            url: envFirebaseUrl || fileFirebase.url
        },
        supabase,
        supabaseUrl: supabase.url,
        supabaseAnonKey: supabase.anonKey,
        supabaseTable: supabase.table
    };
}

export default async function RootLayout({ children }) {
    const config = await buildLauncherConfig();

    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&display=swap" rel="stylesheet" />
                <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png?v=2" />
                <link rel="icon" type="image/svg+xml" sizes="any" href="favicon.svg?v=2" />
                <link rel="shortcut icon" href="favicon-32.png?v=2" />
                <link rel="stylesheet" href="styles.css" />
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
