'use client';

import { useEffect } from 'react';

export default function LauncherClient() {
    useEffect(() => {
        const appRoot = document.getElementById('app');
        const siteBuildVersion = appRoot?.dataset.siteBuild?.trim();
        if (siteBuildVersion) {
            window.__AETHER_SITE_BUILD__ = siteBuildVersion;
        }

        void import('../js/main.js');
    }, []);

    return null;
}
