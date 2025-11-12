// Script to start the server with the new certificate
// This sets the NODE_TLS_REJECT_UNAUTHORIZED environment variable to 0
// which allows self-signed certificates in development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Import and run the server directly
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run the server file directly
const serverPath = path.join(__dirname, 'src', 'web', 'server.js');
console.log(`Starting server from: ${serverPath}`);

// Use spawn to run the server file directly
const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
    }
});

serverProcess.on('error', (err) => {
    console.error('Failed to start server process:', err);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('Stopping server...');
    serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
});