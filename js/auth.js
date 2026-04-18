/**
 * AETHER Auth Manager
 * Handles Supabase Authentication and User Sessions.
 */

import { ui } from './ui.js';
import { getConfiguredSupabaseConfig } from './runtimeConfig.js';

const AUTH_USERNAME_DOMAIN = 'aether.local';

export class AuthManager {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.isSignUp = false;
        this.init();
    }

    async init() {
        const config = getConfiguredSupabaseConfig();
        if (config.configured) {
            this.supabase = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            if (typeof globalThis !== 'undefined') {
                globalThis.__AETHER_AUTH__ = this;
            }

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.user = session?.user || null;
                this.updateUI();
                void ui.onAuthSessionChanged?.(this.user);
            });
        } else {
            console.warn('Supabase not configured. Auth disabled.');
        }

        this.bindEvents();
        this.updateUI();
    }

    updateUI() {
        const authBtn = document.getElementById('auth-btn');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');

        if (this.user) {
            authBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userProfile.classList.add('flex');
            
            const username = this.getDisplayUsername(this.user);
            if (userName) userName.textContent = username;
            if (userAvatar) userAvatar.textContent = username.charAt(0).toUpperCase();
            
            ui.notify('Logged In', `Welcome back, ${username}`, 'success');
        } else {
            authBtn.classList.remove('hidden');
            userProfile.classList.add('hidden');
            userProfile.classList.remove('flex');
            void ui.onAuthSessionChanged?.(null);
        }
    }

    normalizeUsername(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9._-]/g, '')
            .replace(/^[._-]+|[._-]+$/g, '');
    }

    usernameToAuthEmail(username) {
        const normalized = this.normalizeUsername(username);
        return normalized ? `${normalized}@${AUTH_USERNAME_DOMAIN}` : '';
    }

    getDisplayUsername(user) {
        const metadataUsername = this.normalizeUsername(user?.user_metadata?.username);
        if (metadataUsername) {
            return metadataUsername;
        }

        const email = String(user?.email || '').trim();
        if (email.includes('@')) {
            return email.split('@')[0];
        }

        return 'Player';
    }

    syncModalState() {
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit');
        const authToggle = document.getElementById('auth-toggle');

        if (title) title.textContent = this.isSignUp ? 'Create Account' : 'Welcome Back';
        if (submitBtn) submitBtn.textContent = this.isSignUp ? 'Sign Up' : 'Sign In';
        if (authToggle) {
            authToggle.textContent = this.isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up";
        }
    }

    openModal({ signUp = false } = {}) {
        this.isSignUp = Boolean(signUp);
        this.syncModalState();

        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
            authModal.classList.add('flex');
        }

        document.getElementById('auth-form')?.reset();
        this.syncModalState();

        window.setTimeout(() => {
            document.getElementById('auth-username')?.focus();
        }, 0);
    }

    closeModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
        }

        document.getElementById('auth-form')?.reset();
        this.isSignUp = false;
        this.syncModalState();
    }

    async getCurrentUser() {
        if (this.user) return this.user;
        if (!this.supabase) return null;

        try {
            const { data } = await this.supabase.auth.getSession();
            return data?.session?.user || null;
        } catch (err) {
            console.warn('Unable to read auth session:', err);
            return null;
        }
    }

    bindEvents() {
        const authBtn = document.getElementById('auth-btn');
        const authForm = document.getElementById('auth-form');
        const authToggle = document.getElementById('auth-toggle');
        const signOutBtn = document.getElementById('sign-out-btn');
        const featuredPlayBtn = document.getElementById('featured-play-btn');
        const featuredLibraryBtn = document.getElementById('featured-library-btn');
        const authCloseBtn = document.getElementById('auth-close-btn');
        const protectedViews = new Set(['library', 'community', 'updates', 'favorites', 'storage', 'settings']);

        authBtn?.addEventListener('click', () => {
            this.openModal({ signUp: false });
        });

        featuredPlayBtn?.addEventListener('click', async () => {
            const currentUser = await this.getCurrentUser();
            if (currentUser) {
                ui.switchView('library');
                return;
            }

            this.openModal({ signUp: true });
        });

        featuredLibraryBtn?.addEventListener('click', async () => {
            const currentUser = await this.getCurrentUser();
            if (currentUser) {
                ui.switchView('library');
                return;
            }

            ui.notify('Account required', 'You must create a ccount first!', 'warning');
        });

        authToggle?.addEventListener('click', () => {
            this.isSignUp = !this.isSignUp;
            this.syncModalState();
        });

        authCloseBtn?.addEventListener('click', () => {
            this.closeModal();
        });

        document.addEventListener('click', async (event) => {
            const importTrigger = event.target?.closest?.('#import-btn, .import-trigger');
            if (importTrigger) {
                event.preventDefault();
                event.stopImmediatePropagation();

                const currentUser = await this.getCurrentUser();
                if (currentUser) {
                    ui.toggleImportModal(true);
                    return;
                }

                ui.notify('Account required', 'You must create a ccount first!', 'warning');
                return;
            }

            const navItem = event.target?.closest?.('#top-nav .nav-item[data-nav]');
            if (!navItem) return;

            const view = navItem.dataset.nav;
            if (!protectedViews.has(view)) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            const currentUser = await this.getCurrentUser();
            if (currentUser) {
                ui.switchView(view);
                return;
            }

            ui.notify('Account required', 'You must create a ccount first!', 'warning');
        }, true);

        authForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.supabase) {
                ui.notify('Auth unavailable', 'Supabase auth is not configured for this site.', 'warning');
                return;
            }

            const usernameInput = document.getElementById('auth-username');
            const username = this.normalizeUsername(usernameInput?.value);
            const password = document.getElementById('auth-password').value;
            const submitBtn = document.getElementById('auth-submit');

            if (!username) {
                ui.notify('Username required', 'Use 3-24 characters: letters, numbers, dots, underscores, or dashes.', 'warning');
                return;
            }

            const authEmail = this.usernameToAuthEmail(username);
            
            submitBtn.disabled = true;
            submitBtn.textContent = this.isSignUp ? 'Creating...' : 'Signing in...';

            try {
                let result;
                if (this.isSignUp) {
                    result = await this.supabase.auth.signUp({
                        email: authEmail,
                        password,
                        options: {
                            data: {
                                username
                            }
                        }
                    });
                } else {
                    result = await this.supabase.auth.signInWithPassword({ email: authEmail, password });
                }

                if (result.error) throw result.error;

                const isAuthenticated = Boolean(result?.session);
                if (isAuthenticated) {
                    ui.notify(this.isSignUp ? 'Account Created' : 'Login Success', 'Session active.', 'success');
                    this.closeModal();
                    ui.switchView('library');
                } else if (this.isSignUp) {
                    ui.notify('Account Created', 'Your username was saved. Sign in to continue.', 'info');
                    this.isSignUp = false;
                    this.syncModalState();
                } else {
                    ui.notify('Login Success', 'Session active.', 'success');
                    this.closeModal();
                    ui.switchView('library');
                }
            } catch (err) {
                ui.notify('Auth Error', err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                this.syncModalState();
            }
        });

        signOutBtn?.addEventListener('click', async () => {
            if (this.supabase) {
                await this.supabase.auth.signOut();
            }
            this.user = null;
            this.updateUI();
            ui.switchView('featured');
            ui.notify('Logged Out', 'Your session has ended.', 'info');
        });

        // Close modal on escape
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }
}

export const auth = new AuthManager();
