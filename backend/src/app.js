const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const seatLockRoutes = require('./routes/seatLockRoutes');
const trainRoutes = require('./routes/trainRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');
const { httpMetricsMiddleware, metricsHandler } = require('./metrics');

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.clientOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
    credentials: false
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(httpMetricsMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', metricsHandler);

app.use('/api/auth', authRoutes);
app.use('/api/seat-locks', seatLockRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/bookings', bookingRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use(errorMiddleware);

module.exports = app;
