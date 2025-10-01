const IORedis = require('ioredis');
const logger = require('./logger');

// Initialize ioredis client
const redisClient = new IORedis({
  host: 'localhost', // Adjust host
  port: 6379, // Adjust port
  password: '', // Add if required
  db: 0, // Default database
  retryStrategy: times => Math.min(times * 50, 2000), // Retry on failure
});

redisClient.on('error', err => logger.error(`Redis connection error: ${err}`));
redisClient.on('connect', () => logger.info('Connected to Redis'));

// Cache TTL (5 minutes by default)
const DEFAULT_TTL = 5 * 60; // 300 seconds

// Helper to cache and retrieve data
const cacheData = async (key, fetchFn, ttl = DEFAULT_TTL) => {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      logger.info(`Cache hit for ${key}`);
      return JSON.parse(cached);
    }

    const data = await fetchFn();
    await redisClient.setex(key, ttl, JSON.stringify(data));
    logger.info(`Cache miss for ${key}, stored with TTL ${ttl}s`);
    return data;
  } catch (err) {
    logger.error(`Redis error for ${key}: ${err.message}`);
    return fetchFn(); // Fallback to fetch if Redis fails
  }
};

// Clean up on shutdown
process.on('SIGINT', async () => {
  await redisClient.quit();
  process.exit(0);
});

module.exports = {redisClient, cacheData};
