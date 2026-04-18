window.__AETHER_CONFIG__ = {
    publicLibraryApiUrl: window.location.hostname.includes('github.io')
        ? 'http://localhost:8080/api/public-library'
        : '',
    publicLibraryReadUrl: window.location.hostname.includes('github.io')
        ? 'http://localhost:8080/data/public-library.json'
        : './data/public-library.json',
    supabase: {
        url: '',
        anonKey: '',
        table: 'public_library'
    }
};
