const express = require('express');
const pool = require('../config/pool');
const { getLockedSeatNumbers } = require('../services/seatLockService');
const { buildSeatMatrix } = require('../utils/seatMatrix');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const source = (req.query.source || '').trim();
    const destination = (req.query.destination || '').trim();
    const journeyDate = req.query.date;

    if (!source || !destination || !journeyDate) {
      return res.status(400).json({ message: 'source, destination, and date are required.' });
    }

    const result = await pool.query(
      `SELECT
         t.id,
         t.name,
         t.source,
         t.destination,
         t.distance_km,
         t.fare,
         t.departure_time,
         t.arrival_time,
         t.duration,
         t.total_seats,
         COALESCE(COUNT(DISTINCT bp.seat_number), 0) AS booked_seats
       FROM trains t
       LEFT JOIN bookings b
         ON b.train_id = t.id
        AND b.journey_date = $3
        AND b.status = 'confirmed'
       LEFT JOIN booking_passengers bp
         ON bp.booking_id = b.id
       WHERE LOWER(t.source) = LOWER($1)
         AND LOWER(t.destination) = LOWER($2)
       GROUP BY t.id
       ORDER BY t.departure_time ASC`,
      [source, destination, journeyDate]
    );

    const trains = await Promise.all(
      result.rows.map(async (train) => {
        const lockedSeatNumbers = await getLockedSeatNumbers({
          trainId: train.id,
          journeyDate,
          allowRedisFailure: true
        });

        return {
          id: train.id,
          name: train.name,
          source: train.source,
          destination: train.destination,
          distanceKm: train.distance_km,
          fare: train.fare,
          departureTime: train.departure_time,
          arrivalTime: train.arrival_time,
          duration: train.duration,
          totalSeats: train.total_seats,
          seatsAvailable: Math.max(train.total_seats - Number(train.booked_seats) - lockedSeatNumbers.length, 0)
        };
      })
    );

    return res.json({ trains });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const trainId = Number(req.params.id);
    const journeyDate = req.query.date;

    if (!trainId || !journeyDate) {
      return res.status(400).json({ message: 'Train id and date are required.' });
    }

    const trainResult = await pool.query('SELECT * FROM trains WHERE id = $1', [trainId]);
    if (trainResult.rowCount === 0) {
      return res.status(404).json({ message: 'Train not found.' });
    }

    const bookedResult = await pool.query(
      `SELECT DISTINCT bp.seat_number
       FROM bookings b
       JOIN booking_passengers bp ON bp.booking_id = b.id
       WHERE b.train_id = $1
         AND b.journey_date = $2
         AND b.status = 'confirmed'`,
      [trainId, journeyDate]
    );

    const bookedSeatNumbers = bookedResult.rows.map((row) => row.seat_number);
    const lockedSeatNumbers = await getLockedSeatNumbers({
      trainId,
      journeyDate,
      allowRedisFailure: true
    });

    const train = trainResult.rows[0];
    const seatMatrix = buildSeatMatrix(train.total_seats, bookedSeatNumbers, lockedSeatNumbers);

    return res.json({
      train: {
        id: train.id,
        name: train.name,
        source: train.source,
        destination: train.destination,
        distanceKm: train.distance_km,
        fare: train.fare,
        departureTime: train.departure_time,
        arrivalTime: train.arrival_time,
        duration: train.duration,
        totalSeats: train.total_seats
      },
      journeyDate,
      bookedSeats: bookedSeatNumbers,
      lockedSeats: lockedSeatNumbers,
      seatMatrix
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
