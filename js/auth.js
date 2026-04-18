/**
 * AETHER Auth Manager
 * Handles Local Session & UI States.
 */

import { ui } from './ui.js';
import { storage } from './storage.js';

export class AuthManager {
    constructor() {
        this.user = this.loadSession();
        globalThis.__AETHER_AUTH__ = this;
        this.init();
    }

    loadSession() {
        try {
            const data = localStorage.getItem('aether_session');
            if (!data) return null;

            const parsed = JSON.parse(data);
            if (parsed && parsed.username && !parsed.displayName) {
                parsed.displayName = parsed.username;
            }
            return parsed;
        } catch (err) {
            console.warn('Failed to load session:', err);
            return null;
        }
    }

    async saveSession() {
        try {
            if (this.user) {
                localStorage.setItem('aether_session', JSON.stringify(this.user));
            } else {
                localStorage.removeItem('aether_session');
            }
        } catch (err) {
            console.warn('Failed to save session:', err);
        }

        if (this.user) {
            try {
                await storage.saveProfile({
                    displayName: this.user.displayName || this.user.username || 'Player',
                    avatar: this.user.avatar || null
                });
            } catch (err) {
                console.warn('Failed to save profile data:', err);
            }
        }
    }

    async init() {
        this.bindEvents();
        if (this.user) {
            await this.saveSession();
        }
        this.updateUI();
    }

    updateUI() {
        const authBtn = document.getElementById('auth-btn');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        const cloudStatus = document.getElementById('cloud-status');

        if (this.user) {
            const isGuest = this.user.guest === true;
            const displayName = this.user.displayName || this.user.username || (isGuest ? 'Guest' : 'Player');
            authBtn?.classList.add('hidden');
            userProfile?.classList.remove('hidden');
            userProfile?.classList.add('flex');
            
            if (userName) userName.textContent = displayName;
            if (cloudStatus) cloudStatus.textContent = isGuest ? 'Guest Session' : 'Cloud Sync Active';
            
            if (userAvatar) {
                if (this.user.avatar) {
                    userAvatar.innerHTML = `<img src="${this.user.avatar}" class="w-full h-full object-cover rounded-full">`;
                } else {
                    userAvatar.innerHTML = displayName.charAt(0).toUpperCase();
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

    async startGuestSession() {
        await this.setUser({ username: 'Guest', displayName: 'Guest', guest: true });
        this.closeModal();
        ui.notify('Guest Mode', 'You can browse and play without creating an account.', 'info');
        ui.switchView('library');
    }

    async getCurrentUser() {
        return this.user;
    }

    async setUser(userData) {
        if (!userData) {
            this.user = null;
            await this.saveSession();
            this.updateUI();
            await storage.switchUser(null);
            ui.renderLibrary();
            return;
        }

        const isGuest = userData.guest === true;
        const username = userData.username || 'Player';

        await storage.switchUser(isGuest ? null : username);

        let storedProfile = null;
        try {
            storedProfile = await storage.getProfile(null);
        } catch (err) {
            console.warn('Failed to load profile data:', err);
        }

        const displayName = userData.displayName || storedProfile?.displayName || username;
        const avatar = userData.avatar || storedProfile?.avatar || null;

        this.user = {
            ...userData,
            username,
            displayName,
            ...(avatar ? { avatar } : {})
        };

        await this.saveSession();
        this.updateUI();
        ui.renderLibrary();
    }

    bindEvents() {
        const authBtn = document.getElementById('auth-btn');
        const authForm = document.getElementById('auth-form');
        const guestBtn = document.getElementById('guest-btn');
        const signOutBtn = document.getElementById('sign-out-btn');
        const authCloseBtn = document.getElementById('auth-close-btn');

        authBtn?.addEventListener('click', () => this.openModal());
        guestBtn?.addEventListener('click', async () => {
            await this.startGuestSession();
        });
        authCloseBtn?.addEventListener('click', () => this.closeModal());

        authForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('auth-username');
            const username = usernameInput?.value.trim() || 'Player';
            
            await this.setUser({ username, displayName: username });
            this.closeModal();
            ui.notify('Welcome', `Logged in as ${this.user?.displayName || username}`, 'success');
            ui.switchView('library');
        });

        signOutBtn?.addEventListener('click', async () => {
            await this.setUser(null);
            ui.switchView('featured');
            ui.notify('Logged Out', 'Your session has ended.', 'info');
        });
    }
}

export const auth = new AuthManager();
