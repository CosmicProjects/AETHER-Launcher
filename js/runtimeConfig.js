function getConfigObject() {
    const config = (typeof globalThis !== 'undefined' && globalThis.__AETHER_CONFIG__)
        || (typeof window !== 'undefined' && window.__AETHER_CONFIG__)
        || {};

    return config && typeof config === 'object' ? config : {};
}

export function getAetherConfig() {
    return getConfigObject();
}

export function getPublicLibraryApiUrl(config = getConfigObject()) {
    return String(config.publicLibraryApiUrl || '').trim().replace(/\/$/, '');
}
