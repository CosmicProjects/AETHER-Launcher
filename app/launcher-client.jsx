'use client';

import { useEffect } from 'react';

export default function LauncherClient() {
    useEffect(() => {
        void import('../js/main.js');
    }, []);

    return null;
}
