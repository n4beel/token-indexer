export default () => ({
    port: parseInt(process.env.PORT || '3000', 10),

    database: {
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        username: process.env.DATABASE_USERNAME || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'password',
        database: process.env.DATABASE_NAME || 'token_indexer',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
    },

    blockchain: {
        polygon: {
            rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
            chainId: 137,
            startBlock: process.env.POLYGON_START_BLOCK
                ? parseInt(process.env.POLYGON_START_BLOCK, 10)
                : 'latest',
            batchSize: parseInt(process.env.POLYGON_BATCH_SIZE || '100', 10),
        },
    },

    indexing: {
        // Configuration for contracts to index
        contracts: {
            // Example USDC on Polygon
            usdc: {
                address:
                    process.env.USDC_CONTRACT_ADDRESS ||
                    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                chainId: 137,
                startBlock: process.env.USDC_START_BLOCK === 'latest' || !process.env.USDC_START_BLOCK
                    ? 'latest'
                    : parseInt(process.env.USDC_START_BLOCK, 10),
                events: ['Transfer', 'Approval'],
                enabled: process.env.INDEX_USDC === 'true' || true,
            },
        },

        // Processing configuration
        processing: {
            maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
            retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10),
            batchProcessing: process.env.BATCH_PROCESSING === 'true' || true,
            batchSize: parseInt(process.env.BATCH_SIZE || '50', 10),
        },
    },
});
