/**
 * AETHER Auth Manager
 * Handles Local Session & UI States.
 */

import { ui } from './ui.js';

export class AuthManager {
    constructor() {
        this.user = null;
        this.init();
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
            if (userAvatar) userAvatar.textContent = username.charAt(0).toUpperCase();
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
            
            this.user = { username };
            this.updateUI();
            this.closeModal();
            ui.notify('Welcome', `Logged in as ${username}`, 'success');
            ui.switchView('library');
        });

        signOutBtn?.addEventListener('click', () => {
            this.user = null;
            this.updateUI();
            ui.switchView('featured');
            ui.notify('Logged Out', 'Your session has ended.', 'info');
        });
    }
}

export const auth = new AuthManager();
