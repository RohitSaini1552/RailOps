const { createClient } = require('redis');
const env = require('./env');

const redisClient = createClient({ url: env.redisUrl });

let connectPromise = null;

redisClient.on('error', (error) => {
  console.error('Redis client error:', error.message);
});

async function connectRedis() {
  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!connectPromise) {
    connectPromise = redisClient.connect().finally(() => {
      connectPromise = null;
    });
  }

  return connectPromise;
}

module.exports = {
  connectRedis,
  redisClient
};