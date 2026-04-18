function getConfigObject() {
    const config = (typeof globalThis !== 'undefined' && globalThis.__AETHER_CONFIG__)
        || (typeof window !== 'undefined' && window.__AETHER_CONFIG__)
        || {};

    return config && typeof config === 'object' ? config : {};
}

export function getAetherConfig() {
    return getConfigObject();
}

export function readPublicLibraryReadUrl(config = getConfigObject()) {
    return String(config.publicLibraryReadUrl || '').trim().replace(/\/$/, '');
}

export function readPublicLibraryApiUrl(config = getConfigObject()) {
    return String(config.publicLibraryApiUrl || '').trim().replace(/\/$/, '');
}

export function getSupabasePublicLibraryConfig(config = getConfigObject()) {
    const supabaseConfig = config.supabase && typeof config.supabase === 'object'
        ? config.supabase
        : {};

    const supabaseUrl = String(supabaseConfig.url || config.supabaseUrl || '').trim().replace(/\/$/, '');
    const supabaseAnonKey = String(supabaseConfig.anonKey || config.supabaseAnonKey || '').trim();
    const supabaseTable = String(supabaseConfig.table || config.supabaseTable || 'public_library').trim() || 'public_library';

    return {
        configured: Boolean(supabaseUrl && supabaseAnonKey && supabaseTable),
        supabaseUrl,
        supabaseAnonKey,
        supabaseTable
    };
}
