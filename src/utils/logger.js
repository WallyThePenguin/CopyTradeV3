import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '..', '..', 'data', 'logs');
        this.initialize();
    }

    async initialize() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('Error creating log directory:', error);
        }
    }

    formatMessage(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = data
            ? `${timestamp} - ${message}: ${JSON.stringify(data, null, 2)}`
            : `${timestamp} - ${message}`;
        return logMessage;
    }

    async log(message, data = null) {
        const logMessage = this.formatMessage(message, data);
        console.log(logMessage);

        try {
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDir, `${date}.log`);
            await fs.appendFile(logFile, logMessage + '\n');
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    async error(message, error) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            name: error.name
        };
        await this.log(`ERROR: ${message}`, errorData);
    }

    async warn(message, data = null) {
        await this.log(`WARN: ${message}`, data);
    }

    async info(message, data = null) {
        await this.log(`INFO: ${message}`, data);
    }

    async debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            await this.log(`DEBUG: ${message}`, data);
        }
    }
}

export const logger = new Logger(); 