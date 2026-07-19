const requiredEnvs = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'JWT_EXPIRE'];

const validateEnv = () => {
    const missing = requiredEnvs.filter((key) => !process.env[key]);

    if(missing.length > 0){
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    if(process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32){
        console.warn('Warning: JWT_SECRET is shorter than the recommended 32 characters');
    }
};

module.exports = validateEnv;