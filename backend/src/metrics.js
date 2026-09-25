const client = require('prom-client');
const pool = require('./config/pool');
const { redisClient } = require('./config/redis');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const dbPoolTotalConnections = new client.Gauge({
  name: 'railops_db_pool_total_connections',
  help: 'Total PostgreSQL connections in the pool.',
  registers: [register]
});

const dbPoolIdleConnections = new client.Gauge({
  name: 'railops_db_pool_idle_connections',
  help: 'Idle PostgreSQL connections in the pool.',
  registers: [register]
});

const dbPoolWaitingRequests = new client.Gauge({
  name: 'railops_db_pool_waiting_requests',
  help: 'Requests waiting for a PostgreSQL connection.',
  registers: [register]
});

const redisConnected = new client.Gauge({
  name: 'railops_redis_connected',
  help: 'Whether Redis is connected: 1 for connected, 0 for disconnected.',
  registers: [register]
});

const socketConnections = new client.Gauge({
  name: 'railops_socket_connections',
  help: 'Current number of connected Socket.io clients.',
  registers: [register]
});

const socketRoomJoins = new client.Counter({
  name: 'railops_socket_room_joins_total',
  help: 'Total number of Socket.io seat-room joins.',
  registers: [register]
});

const seatLocksAcquired = new client.Counter({
  name: 'railops_seat_locks_acquired_total',
  help: 'Total number of successfully acquired seat locks.',
  registers: [register]
});

const seatLocksRejected = new client.Counter({
  name: 'railops_seat_locks_rejected_total',
  help: 'Total number of rejected seat-lock attempts.',
  registers: [register]
});

const seatLocksReleased = new client.Counter({
  name: 'railops_seat_locks_released_total',
  help: 'Total number of successfully released seat locks.',
  registers: [register]
});

const bookingsCreated = new client.Counter({
  name: 'railops_bookings_created_total',
  help: 'Total number of successfully created bookings.',
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'railops_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestsTotal = new client.Counter({
  name: 'railops_http_requests_total',
  help: 'Total number of HTTP requests.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

function updateConnectionMetrics() {
  dbPoolTotalConnections.set(pool.totalCount);
  dbPoolIdleConnections.set(pool.idleCount);
  dbPoolWaitingRequests.set(pool.waitingCount);
  redisConnected.set(redisClient.isReady ? 1 : 0);
}

function httpMetricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }

  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationInSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationInSeconds);
  });

  next();
}

async function metricsHandler(req, res) {
  updateConnectionMetrics();
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  metricsHandler,
  httpMetricsMiddleware,
  bookingsCreated,
  seatLocksAcquired,
  seatLocksRejected,
  seatLocksReleased,
  socketConnections,
  socketRoomJoins
};