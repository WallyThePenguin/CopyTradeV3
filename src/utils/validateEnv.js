import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = [
    'DISCORD_TOKEN',
    'DATABASE_URL'
];

export function validateEnv(required = REQUIRED_VARS) {
    const missing = required.filter(name => !process.env[name]);
    if (missing.length > 0) {
        console.error(`Missing environment variables: ${missing.join(', ')}`);
        return false;
    }
    return true;
}

