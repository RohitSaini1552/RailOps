const dotenv = require('dotenv');

dotenv.config();

const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const env = {
  port: Number(process.env.PORT) || 5000,
  clientUrl: clientOrigins[0],
  clientOrigins,
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  jwtSecret: process.env.JWT_SECRET || 'replace-with-a-long-random-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
};

module.exports = env;
