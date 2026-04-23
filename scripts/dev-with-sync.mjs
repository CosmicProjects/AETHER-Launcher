import path from 'path';
import { spawn } from 'child_process';
import net from 'net';

const rootDir = process.cwd();
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const serverScript = path.join(rootDir, 'server.js');
const syncServerPort = 8080;

const children = [];
let shuttingDown = false;

function spawnProcess(command, args, name) {
    const child = spawn(command, args, {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'development'
        },
        windowsHide: false
    });

    child.on('exit', code => {
        if (shuttingDown) {
            return;
        }

        console.error(`[dev] ${name} exited with code ${code ?? 'null'}.`);
        shutdown(code ?? 1);
    });

    children.push(child);
    return child;
}

async function waitForPort(port, host = '127.0.0.1', timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const isReady = await new Promise(resolve => {
            const socket = net.createConnection({ port, host });
            const cleanup = () => {
                socket.removeAllListeners();
                socket.destroy();
            };

            socket.once('connect', () => {
                cleanup();
                resolve(true);
            });

            socket.once('error', () => {
                cleanup();
                resolve(false);
            });
        });

        if (isReady) {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 150));
    }

    return false;
}

function shutdown(code = 0) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    for (const child of children) {
        try {
            child.kill();
        } catch (_) {}
    }

    process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

spawnProcess(process.execPath, [serverScript], 'sync server');

const serverReady = await waitForPort(syncServerPort);
if (!serverReady) {
    console.error(`[dev] Sync server did not open port ${syncServerPort} in time.`);
    shutdown(1);
}

spawnProcess(process.execPath, [nextBin, 'dev'], 'next dev');
