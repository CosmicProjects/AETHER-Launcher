/**
 * AETHER Admin Panel Manager
 */

import { ui } from './ui.js';
import { env } from './envDetector.js';

class AdminManager {
    constructor() {
        this.statusInterval = null;
    }

    startMonitoring() {
        // Ping servers periodically when the admin view is open
        if (this.statusInterval) clearInterval(this.statusInterval);
        
        this.statusInterval = setInterval(async () => {
            if (ui.currentView === 'admin') {
                await env.checkHealth();
                ui.renderAdmin();
            } else {
                clearInterval(this.statusInterval);
            }
        }, 5000);
    }
}

export const adminManager = new AdminManager();
