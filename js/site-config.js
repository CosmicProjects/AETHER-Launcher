window.__AETHER_CONFIG__ = {
    publicLibraryApiUrl: '',
    publicLibraryReadUrl: window.location.hostname.includes('github.io')
        ? 'https://raw.githubusercontent.com/cosmicprojects/AETHER-Launcher/main/data/public-library.json'
        : './data/public-library.json',
    supabase: {
        url: '',
        anonKey: '',
        table: 'public_library'
    }
};
