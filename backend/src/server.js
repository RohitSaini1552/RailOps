const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const pool = require('./config/pool');
const { connectRedis } = require('./config/redis');
const { initSeatSocket } = require('./sockets/seatSocket');

async function startServer() {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: false
    }
  });

  app.set('io', io);
  initSeatSocket(io);

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('Unable to connect to PostgreSQL. Check backend/.env and start the database before using the app.');
    console.error(error.message);
  }

  try {
    await connectRedis();
  } catch (error) {
    console.error('Redis is unavailable right now. Start Redis locally before testing seat locks.');
    console.error(error.message);
  }

  server.listen(env.port, () => {
    console.log(`Backend server running on http://localhost:${env.port}`);
  });
}

startServer();
