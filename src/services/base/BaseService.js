import { logger } from '../../utils/logger.js';

/**
 * Base service class that provides common functionality for all services
 */
export default class BaseService {
    constructor(name) {
        this.name = name;
        this.initialized = false;
        this.initializing = false;
        logger.info(`Creating new ${name} service instance`);
    }

    /**
     * Initialize the service
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            logger.info(`${this.name} service already initialized`);
            return;
        }

        if (this.initializing) {
            logger.info(`${this.name} service is already initializing`);
            return;
        }

        this.initializing = true;
        logger.info(`Starting ${this.name} service initialization`);

        try {
            await this._initializeImplementation();
            this.initialized = true;
            logger.info(`${this.name} service initialized successfully`);
        } catch (error) {
            logger.error(`Error during ${this.name} service initialization`, error);
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Implementation-specific initialization logic
     * @returns {Promise<void>}
     * @protected
     */
    async _initializeImplementation() {
        throw new Error('_initializeImplementation must be implemented by subclasses');
    }

    /**
     * Check if the service is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Ensure the service is initialized before proceeding
     * @throws {Error} If the service is not initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            const message = `${this.name} service not initialized`;
            logger.error(message);
            throw new Error(message);
        }
    }

    /**
     * Log debug information
     * @param {string} message - Debug message
     * @param {*} data - Optional data to log
     */
    debugLog(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = data
            ? `${timestamp} - ${this.name} - ${message}: ${JSON.stringify(data, null, 2)}`
            : `${timestamp} - ${this.name} - ${message}`;
        logger.debug(logMessage);
    }
}