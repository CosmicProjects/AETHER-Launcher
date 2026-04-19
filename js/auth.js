import { ui } from './ui.js';
import { storage } from './storage.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

function initSupabase() {
    const config = window.__AETHER_CONFIG__ || {};
    const url = config.supabase?.url;
    const key = config.supabase?.anonKey;
    if (!url || !key) return null;
    return createClient(url, key);
}

export class AuthManager {
    constructor() {
        this.user = null;
        this.supabase = initSupabase();
        globalThis.__AETHER_AUTH__ = this;
        this.init();
    }

    async init() {
        this.bindEvents();

        if (this.supabase) {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                await this._applySupabaseSession(session);
            } else {
                await this._loadLocalSession();
            }

            this.supabase.auth.onAuthStateChange(async (_event, session) => {
                if (session) {
                    await this._applySupabaseSession(session);
                } else if (!this.user?.guest) {
                    this.user = null;
                    this.updateUI();
                }
            });
        } else {
            await this._loadLocalSession();
        }

        this.updateUI();
    }

    async _applySupabaseSession(session) {
        const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Player';
        const avatar = session.user.user_metadata?.avatar || null;
        this.user = { username, displayName: username, email: session.user.email, id: session.user.id, ...(avatar ? { avatar } : {}) };
        await storage.switchUser(username);
        await this._saveLocalSession();
        this.updateUI();
    }

    async _loadLocalSession() {
        try {
            const data = localStorage.getItem('aether_session');
            if (!data) return;
            const parsed = JSON.parse(data);
            if (parsed?.username) {
                if (!parsed.displayName) parsed.displayName = parsed.username;
                this.user = parsed;
                await storage.switchUser(parsed.guest ? null : parsed.username);
            }
        } catch {}
    }

    async _saveLocalSession() {
        try {
            if (this.user) {
                localStorage.setItem('aether_session', JSON.stringify(this.user));
                await storage.saveProfile({ displayName: this.user.displayName || this.user.username || 'Player', avatar: this.user.avatar || null });
            } else {
                localStorage.removeItem('aether_session');
            }
        } catch {}
    }

    // Legacy alias used by ui.js
    async saveSession() { return this._saveLocalSession(); }

    updateUI() {
        const authBtn = document.getElementById('auth-btn');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        const cloudStatus = document.getElementById('cloud-status');

        if (this.user) {
            const isGuest = this.user.guest === true;
            const displayName = this.user.displayName || this.user.username || (isGuest ? 'Guest' : 'Player');
            const isOwner = this.user.username === 'Cosmic';
            const isGamer = !isGuest && (() => {
                try { return JSON.parse(localStorage.getItem('aether_subscription') || '{}').plan === 'gamer'; } catch { return false; }
            })();

            authBtn?.classList.add('hidden');
            userProfile?.classList.remove('hidden');
            userProfile?.classList.add('flex');

            if (userName) userName.textContent = displayName;
            if (cloudStatus) {
                if (isOwner) { cloudStatus.textContent = 'Owner'; cloudStatus.style.color = 'rgb(var(--brand-primary-rgb))'; }
                else if (isGamer) { cloudStatus.textContent = 'Gamer Plan'; cloudStatus.style.color = 'rgb(168 85 247)'; }
                else { cloudStatus.textContent = isGuest ? 'Guest Session' : 'Free Plan'; cloudStatus.style.color = ''; }
            }

            if (userAvatar) {
                const avatarContent = this.user.avatar
                    ? `<img src="${this.user.avatar}" class="w-full h-full object-cover rounded-full">`
                    : displayName.charAt(0).toUpperCase();
                const badge = isOwner
                    ? `<span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-brand-primary flex items-center justify-center text-white" style="font-size:8px;font-weight:800;">★</span>`
                    : isGamer
                        ? `<span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white" style="font-size:8px;font-weight:800;">G</span>`
                        : '';
                userAvatar.style.position = 'relative';
                userAvatar.innerHTML = avatarContent + badge;
            }
        } else {
            authBtn?.classList.remove('hidden');
            userProfile?.classList.add('hidden');
            userProfile?.classList.remove('flex');
        }
    }

    openModal() {
        const modal = document.getElementById('auth-modal');
        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
    }

    closeModal() {
        const modal = document.getElementById('auth-modal');
        modal?.classList.add('hidden');
        modal?.classList.remove('flex');
    }

    async startGuestSession() {
        this.user = { username: 'Guest', displayName: 'Guest', guest: true };
        await storage.switchUser(null);
        await this._saveLocalSession();
        this.updateUI();
        this.closeModal();
        ui.notify('Guest Mode', 'Browse and play without an account.', 'info');
        ui.switchView('library');
    }

    async getCurrentUser() { return this.user; }

    async setUser(userData) {
        if (!userData) {
            if (this.supabase) await this.supabase.auth.signOut();
            this.user = null;
            await this._saveLocalSession();
            this.updateUI();
            await storage.switchUser(null);
            ui.renderLibrary();
            return;
        }
        const isGuest = userData.guest === true;
        const username = userData.username || 'Player';
        await storage.switchUser(isGuest ? null : username);
        let storedProfile = null;
        try { storedProfile = await storage.getProfile(null); } catch {}
        const displayName = userData.displayName || storedProfile?.displayName || username;
        const avatar = userData.avatar || storedProfile?.avatar || null;
        this.user = { ...userData, username, displayName, ...(avatar ? { avatar } : {}) };
        await this._saveLocalSession();
        this.updateUI();
        ui.renderLibrary();
    }

    _showError(el, msg, type = 'error') {
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden', 'text-red-400', 'bg-red-500/10', 'text-emerald-400', 'bg-emerald-500/10');
        if (type === 'success') el.classList.add('text-emerald-400', 'bg-emerald-500/10');
        else el.classList.add('text-red-400', 'bg-red-500/10');
    }

    _setLoading(btn, loading, defaultText) {
        btn.disabled = loading;
        btn.textContent = loading ? 'Please wait…' : defaultText;
    }

    async _verifyOwnerPassword() {
        const config = window.__AETHER_CONFIG__ || {};
        const password = prompt('This username is protected. Enter the owner password:');
        if (password === null) return false;
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        return hex === config.ownerPasswordHash;
    }

    bindEvents() {
        document.getElementById('auth-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('auth-close-btn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('guest-btn')?.addEventListener('click', () => this.startGuestSession());

        document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
            if (this.supabase && !this.user?.guest) await this.supabase.auth.signOut();
            this.user = null;
            localStorage.removeItem('aether_session');
            this.updateUI();
            await storage.switchUser(null);
            ui.renderLibrary();
            ui.switchView('featured');
            ui.notify('Signed out', 'See you next time!', 'info');
        });

        // Tab switching
        const tabSignup = document.getElementById('tab-signup');
        const tabSignin = document.getElementById('tab-signin');
        const panelSignup = document.getElementById('panel-signup');
        const panelSignin = document.getElementById('panel-signin');

        tabSignup?.addEventListener('click', () => {
            tabSignup.classList.add('bg-white/10', 'text-white');
            tabSignup.classList.remove('text-white/40');
            tabSignin.classList.remove('bg-white/10', 'text-white');
            tabSignin.classList.add('text-white/40');
            panelSignup?.classList.remove('hidden');
            panelSignin?.classList.add('hidden');
        });

        tabSignin?.addEventListener('click', () => {
            tabSignin.classList.add('bg-white/10', 'text-white');
            tabSignin.classList.remove('text-white/40');
            tabSignup.classList.remove('bg-white/10', 'text-white');
            tabSignup.classList.add('text-white/40');
            panelSignin?.classList.remove('hidden');
            panelSignup?.classList.add('hidden');
        });

        // Sign Up
        document.getElementById('signup-submit')?.addEventListener('click', async () => {
            const username = document.getElementById('signup-username')?.value.trim();
            const email = document.getElementById('signup-email')?.value.trim();
            const password = document.getElementById('signup-password')?.value;
            const errorEl = document.getElementById('signup-error');
            const btn = document.getElementById('signup-submit');

            if (!username || username.length < 3) return this._showError(errorEl, 'Username must be at least 3 characters.');
            if (!/^[A-Za-z0-9._-]{3,24}$/.test(username)) return this._showError(errorEl, 'Username can only contain letters, numbers, . _ -');
            if (!email) return this._showError(errorEl, 'Email is required.');
            if (!password || password.length < 6) return this._showError(errorEl, 'Password must be at least 6 characters.');

            const config = window.__AETHER_CONFIG__ || {};
            const ownerUsername = config.ownerUsername || 'Cosmic';

            if (username.toLowerCase() === ownerUsername.toLowerCase()) {
                const ok = await this._verifyOwnerPassword();
                if (!ok) return this._showError(errorEl, 'Incorrect owner password.');

                // Owner uses local auth, not Supabase
                await this.setUser({ username, displayName: username });
                this.closeModal();
                ui.notify('Welcome, ' + username + '!', 'Signed in as owner.', 'success');
                ui.switchView('library');
                return;
            }

            if (!this.supabase) return this._showError(errorEl, 'Auth service unavailable. Try guest mode.');

            this._setLoading(btn, true, 'Create Account');
            const { data, error } = await this.supabase.auth.signUp({
                email, password,
                options: { data: { username } }
            });
            this._setLoading(btn, false, 'Create Account');

            if (error) return this._showError(errorEl, error.message);

            if (data.session) {
                await this._applySupabaseSession(data.session);
                this.closeModal();
                ui.notify('Welcome, ' + username + '!', 'Account created successfully.', 'success');
                ui.switchView('library');
            } else {
                this._showError(errorEl, 'Account created! Check your email to confirm, then sign in.', 'success');
            }
        });

        // Sign In
        document.getElementById('signin-submit')?.addEventListener('click', async () => {
            const email = document.getElementById('signin-email')?.value.trim();
            const password = document.getElementById('signin-password')?.value;
            const errorEl = document.getElementById('signin-error');
            const btn = document.getElementById('signin-submit');

            if (!email || !password) return this._showError(errorEl, 'Email and password are required.');
            if (!this.supabase) return this._showError(errorEl, 'Auth service unavailable.');

            this._setLoading(btn, true, 'Sign In');
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            this._setLoading(btn, false, 'Sign In');

            if (error) return this._showError(errorEl, error.message);

            await this._applySupabaseSession(data.session);
            this.closeModal();
            ui.notify('Welcome back, ' + this.user.displayName + '!', '', 'success');
            ui.switchView('library');
        });
    }
}

export const auth = new AuthManager();
