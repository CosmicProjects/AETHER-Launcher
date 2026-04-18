/**
 * AETHER Auth Manager
 * Handles Local Session & UI States.
 */

import { ui } from './ui.js';

export class AuthManager {
    constructor() {
        this.user = this.loadSession();
        globalThis.__AETHER_AUTH__ = this;
        this.init();
    }

    loadSession() {
        try {
            const data = localStorage.getItem('aether_session');
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.warn('Failed to load session:', err);
            return null;
        }
    }

    saveSession() {
        try {
            if (this.user) {
                localStorage.setItem('aether_session', JSON.stringify(this.user));
            } else {
                localStorage.removeItem('aether_session');
            }
        } catch (err) {
            console.warn('Failed to save session:', err);
        }
    }

    async init() {
        this.bindEvents();
        this.updateUI();
    }

    updateUI() {
        const authBtn = document.getElementById('auth-btn');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');

        if (this.user) {
            authBtn?.classList.add('hidden');
            userProfile?.classList.remove('hidden');
            userProfile?.classList.add('flex');
            
            const username = this.user.username || 'Player';
            if (userName) userName.textContent = username;
            
            if (userAvatar) {
                if (this.user.avatar) {
                    userAvatar.innerHTML = `<img src="${this.user.avatar}" class="w-full h-full object-cover rounded-full">`;
                } else {
                    userAvatar.innerHTML = username.charAt(0).toUpperCase();
                }
            }
        } else {
            authBtn?.classList.remove('hidden');
            userProfile?.classList.add('hidden');
            userProfile?.classList.remove('flex');
        }
    }

    openModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('hidden');
            authModal.classList.add('flex');
        }
    }

    closeModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
        }
    }

    async getCurrentUser() {
        return this.user;
    }

    setUser(userData) {
        this.user = userData;
        this.saveSession();
        this.updateUI();
    }

    bindEvents() {
        const authBtn = document.getElementById('auth-btn');
        const authForm = document.getElementById('auth-form');
        const signOutBtn = document.getElementById('sign-out-btn');
        const authCloseBtn = document.getElementById('auth-close-btn');

        authBtn?.addEventListener('click', () => this.openModal());
        authCloseBtn?.addEventListener('click', () => this.closeModal());

        authForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('auth-username');
            const username = usernameInput?.value.trim() || 'Player';
            
            this.setUser({ username });
            this.closeModal();
            ui.notify('Welcome', `Logged in as ${username}`, 'success');
            ui.switchView('library');
        });

        signOutBtn?.addEventListener('click', () => {
            this.setUser(null);
            ui.switchView('featured');
            ui.notify('Logged Out', 'Your session has ended.', 'info');
        });
    }
}

export const auth = new AuthManager();
