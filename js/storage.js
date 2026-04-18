/**
 * AETHER Storage Manager
 * Handles persistent storage for game metadata and file blobs using IndexedDB.
 */

class StorageManager {
    constructor() {
        this.dbName = this._resolveDbName();
        this.dbVersion = 1;
        this.db = null;
    }

    _resolveDbName() {
        try {
            const session = localStorage.getItem('aether_session');
            if (session) {
                const { username } = JSON.parse(session);
                if (username) return `AetherLauncherDB_${username}`;
            }
        } catch (e) {}
        return 'AetherLauncherDB_guest';
    }

    async switchUser(username) {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.dbName = username ? `AetherLauncherDB_${username}` : 'AetherLauncherDB_guest';
        await this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Games metadata and content
                if (!db.objectStoreNames.contains('games')) {
                    db.createObjectStore('games', { keyPath: 'id' });
                }
                // Environment & Settings
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async saveGame(gameData) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['games'], 'readwrite');
            const store = transaction.objectStore('games');
            const request = store.put(gameData);

            request.onsuccess = () => resolve(gameData.id);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllGames() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['games'], 'readonly');
            const store = transaction.objectStore('games');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getGame(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['games'], 'readonly');
            const store = transaction.objectStore('games');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteGame(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['games'], 'readwrite');
            const store = transaction.objectStore('games');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveSetting(key, value) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ id: key, value });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key, defaultValue = null) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result ? request.result.value : defaultValue);
            request.onerror = () => reject(request.error);
        });
    }
}

export const storage = new StorageManager();
await storage.init();
