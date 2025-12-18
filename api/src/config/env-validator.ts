/**
 * Environment Variable Validator
 * Validates that all required environment variables are present and properly formatted
 */

interface EnvConfig {
    // API Configuration
    API_PORT: string;
    NODE_ENV: string;

    // APS Credentials
    APS_CLIENT_ID: string;
    APS_CLIENT_SECRET: string;
    APS_CALLBACK_URL: string;
    APS_BUCKET: string;

    // Database
    DATABASE_URL: string;

    // Session
    SESSION_SECRET: string;

    // Redis (Optional for now, will be required in production)
    REDIS_URL?: string;
    REDIS_HOST?: string;
    REDIS_PORT?: string;
}

const REQUIRED_ENV_VARS = [
    'API_PORT',
    'NODE_ENV',
    'APS_CLIENT_ID',
    'APS_CLIENT_SECRET',
    'APS_CALLBACK_URL',
    'APS_BUCKET',
    'DATABASE_URL',
    'SESSION_SECRET'
] as const;

const OPTIONAL_ENV_VARS = [
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET'
] as const;

/**
 * Validates all required environment variables
 * @throws {Error} if any required variable is missing or invalid
 */
export function validateEnvironment(): EnvConfig {
    console.log('🔍 Validating environment variables...');

    const missing: string[] = [];
    const invalid: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
        const value = process.env[varName];

        if (!value || value.trim() === '') {
            missing.push(varName);
            continue;
        }

        // Validate specific formats
        switch (varName) {
            case 'APS_CLIENT_ID':
                if (value === 'your_aps_client_id' || value.length < 20) {
                    invalid.push(`${varName} (appears to be a placeholder or too short)`);
                }
                break;

            case 'APS_CLIENT_SECRET':
                if (value === 'your_aps_client_secret' || value.length < 20) {
                    invalid.push(`${varName} (appears to be a placeholder or too short)`);
                }
                break;

            case 'SESSION_SECRET':
                if (value === 'dev-secret' || value.length < 32) {
                    const msg = `${varName} is too short or insecure (should be at least 32 characters)`;
                    if (process.env.NODE_ENV === 'production') {
                        invalid.push(msg);
                    } else {
                        warnings.push(msg);
                    }
                }
                break;

            case 'API_PORT':
                const port = parseInt(value, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                    invalid.push(`${varName} (must be a valid port number)`);
                }
                break;

            case 'NODE_ENV':
                if (!['development', 'production', 'test'].includes(value)) {
                    warnings.push(`${varName} has unexpected value: ${value}`);
                }
                break;

            case 'APS_CALLBACK_URL':
            case 'DATABASE_URL':
                // Just check they're not empty (already done above)
                break;
        }
    }

    // Check optional variables (just warn if missing)
    for (const varName of OPTIONAL_ENV_VARS) {
        const value = process.env[varName];
        if (!value || value.trim() === '') {
            if (varName.startsWith('REDIS')) {
                warnings.push(`${varName} not set - Redis features will be disabled`);
            }
        }
    }

    // Report results
    if (missing.length > 0) {
        console.error('\n❌ Missing required environment variables:');
        missing.forEach(v => console.error(`   - ${v}`));
    }

    if (invalid.length > 0) {
        console.error('\n❌ Invalid environment variables:');
        invalid.forEach(v => console.error(`   - ${v}`));
    }

    if (warnings.length > 0) {
        console.warn('\n⚠️  Environment warnings:');
        warnings.forEach(w => console.warn(`   - ${w}`));
    }

    // Fail if there are missing or invalid variables
    if (missing.length > 0 || invalid.length > 0) {
        console.error('\n💡 Please check your .env file and ensure all required variables are set correctly.');
        console.error('   You can use .env.example as a template.\n');
        process.exit(1);
    }

    console.log('✅ Environment variables validated successfully\n');

    return process.env as unknown as EnvConfig;
}

/**
 * Gets a validated environment configuration
 * Safe to use after validateEnvironment() has been called
 */
export function getEnvConfig(): EnvConfig {
    return process.env as unknown as EnvConfig;
}

/**
 * Checks if Redis is configured
 */
export function isRedisConfigured(): boolean {
    return !!(process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PORT));
}

/**
 * Checks if AWS S3 is configured
 */
export function isS3Configured(): boolean {
    return !!(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_S3_BUCKET
    );
}
