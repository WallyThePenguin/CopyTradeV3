// Allow local HTTPS development with a self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the compiled server entry point once so restarts use the same path
const serverPath = path.join(__dirname, 'src', 'web', 'server.js');
console.log(`Starting server from: ${serverPath}`);

// Spawn the server in a child process so we can proxy its IO and signals
const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
    }
});

// Surface child-process failures immediately
serverProcess.on('error', (err) => {
    console.error('Failed to start server process:', err);
});

// Forward termination signals so the child can clean up
process.on('SIGINT', () => {
    console.log('Stopping server...');
    serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
});
