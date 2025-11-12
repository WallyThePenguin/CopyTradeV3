import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
    plugins: [react()],
    root: 'src/web',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
    },
    server: {
        port: 3000,
        https: {
            key: fs.readFileSync('server.key'),
            cert: fs.readFileSync('server.cert'),
        },
        proxy: {
            '/api': {
                target: 'https://localhost:5000',
                changeOrigin: true,
                secure: false, // Accept self-signed certificates
            },
            '/ws': {
                target: 'wss://localhost:5000',
                ws: true,
                secure: false, // Accept self-signed certificates
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
}); 