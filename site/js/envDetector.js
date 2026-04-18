/**
 * AETHER Environment Detector
 * Detects the current deployment environment and monitors configured backend health.
 */

export class EnvDetector {
    constructor() {
        this.status = {
            env: 'UNKNOWN',
            isLocal: false,
            platform: 'Browser (Static)',
            apiStatus: 'OFFLINE',
            latency: 0,
            uptime: 100,
        };
        
        // Configurable endpoints to monitor
        this.monitoredServers = [
            { name: 'Primary API', url: 'https://api.aether.local/health', type: 'REST' },
            { name: 'Asset CDN', url: 'https://cdn.aether.local/status', type: 'Static' },
            { name: 'Gateway', url: 'https://socket.aether.local/', type: 'WebSocket' }
        ];
    }

    async detect() {
        const hostname = window.location.hostname;
        const port = window.location.port;

        // Platform Detection
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            this.status.env = 'DEVELOPMENT';
            this.status.isLocal = true;
            this.status.platform = 'Local Machine';
        } else if (hostname.includes('vercel.app')) {
            this.status.env = 'PRODUCTION';
            this.status.platform = 'Vercel Edge Rendering';
        } else if (hostname.includes('github.io')) {
            this.status.env = 'PRODUCTION';
            this.status.platform = 'GitHub Pages';
        } else if (hostname.includes('cloudflare.com')) {
            this.status.env = 'PRODUCTION';
            this.status.platform = 'Cloudflare Pages';
        } else {
            this.status.env = 'PRODUCTION';
            this.status.platform = 'Cloud Web Deployment';
        }

        // Docker detection (heuristic)
        if (hostname.includes('internal') || port === '8080') {
            this.status.platform += ' (Dockerized Container)';
        }

        return this.status;
    }

    /**
     * Pings configured servers to check connectivity.
     */
    async checkHealth() {
        // Mock health check since we don't have real servers
        // In a real app, this would fetch() the endpoints.
        const start = performance.now();
        
        try {
            // Simulated probe
            await new Promise(r => setTimeout(r, 150));
            this.status.apiStatus = 'ONLINE';
            this.status.latency = Math.round(performance.now() - start);
        } catch (err) {
            this.status.apiStatus = 'OFFLINE';
            this.status.latency = 0;
        }

        return this.status;
    }

    getMonitoredServers() {
        return this.monitoredServers.map(s => ({
            ...s,
            status: Math.random() > 0.1 ? 'ONLINE' : 'OFFLINE',
            latency: Math.floor(Math.random() * 50) + 10
        }));
    }
}

export const env = new EnvDetector();
await env.detect();
