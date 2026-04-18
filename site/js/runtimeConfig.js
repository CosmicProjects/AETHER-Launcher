function getConfigObject() {
    const config = (typeof globalThis !== 'undefined' && globalThis.__AETHER_CONFIG__)
        || (typeof window !== 'undefined' && window.__AETHER_CONFIG__)
        || {};

    return config && typeof config === 'object' ? config : {};
}

export function normalizeSupabaseUrl(url) {
    return String(url || '').trim().replace(/\/$/, '');
}

export function isPlaceholderSupabaseUrl(url) {
    const normalized = normalizeSupabaseUrl(url).toLowerCase();
    return !normalized || normalized.includes('your-project.supabase.co');
}

export function isPlaceholderSupabaseAnonKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    return !normalized || normalized === 'your-anon-key' || normalized === 'your-public-anon-key';
}

export function getAetherConfig() {
    return getConfigObject();
}

export function getConfiguredSupabaseConfig(config = getConfigObject()) {
    const supabaseUrl = normalizeSupabaseUrl(config.supabaseUrl);
    const supabaseAnonKey = String(config.supabaseAnonKey || '').trim();

    return {
        supabaseUrl,
        supabaseAnonKey,
        configured: Boolean(
            supabaseUrl &&
            supabaseAnonKey &&
            !isPlaceholderSupabaseUrl(supabaseUrl) &&
            !isPlaceholderSupabaseAnonKey(supabaseAnonKey)
        )
    };
}

export function getPublicLibraryApiUrl(config = getConfigObject()) {
    return String(config.publicLibraryApiUrl || '').trim().replace(/\/$/, '');
}
