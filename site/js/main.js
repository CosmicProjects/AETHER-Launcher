/**
 * AETHER Launcher Main Entrance
 * Project: High-Fidelity Game Launcher Site
 * Version: 1.0.0
 * Initializer for the entire application.
 */

import { storage } from './storage.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

async function initAether() {
    console.log('🚀 AETHER Launcher: Initializing Engine...');
    
    // Register Service Worker for Virtual File System
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
            console.log('🛡️ AETHER Virtual Filesystem Layer Active:', registration.scope);
            // Ensure SW is controlling immediately
            if (!navigator.serviceWorker.controller) {
                window.location.reload();
                return;
            }
        } catch (error) {
            console.error('CRITICAL: AETHER Filesystem Registration Failed:', error);
        }
    }
    // Cleanup: Remove demo games if they exist
    const demoIds = ['demo-1', 'demo-2'];
    for (const id of demoIds) {
        await storage.deleteGame(id);
    }

    // Process current library
    const games = await storage.getAllGames();
    if (games.length === 0) {
        console.log('📦 Library is empty. Ready for user imports.');
    }
    
    // Initial UI Render
    await ui.renderLibrary();
}

// Initial Launch
initAether().catch(err => {
    console.error('CRITICAL: AETHER failed to launch core systems.', err);
});
