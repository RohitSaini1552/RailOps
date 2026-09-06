const express = require('express');
const pool = require('../config/pool');
const authMiddleware = require('../middleware/authMiddleware');
const { generatePnr } = require('../utils/pnr');
const { emitSeatEvent } = require('../sockets/seatSocket');
const { releaseSeats, verifySeatLocksForUser } = require('../services/seatLockService');

const router = express.Router();

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

router.post('/', authMiddleware, async (req, res, next) => {
  let client;

  try {
    client = await pool.connect();
    const trainId = Number(req.body.trainId);
    const journeyDate = req.body.journeyDate;
    const seats = Array.isArray(req.body.seats) ? req.body.seats.map(Number) : [];
    const passengers = Array.isArray(req.body.passengers) ? req.body.passengers : [];

    if (!isPositiveInteger(trainId) || !journeyDate) {
      return res.status(400).json({ message: 'trainId and journeyDate are required.' });
    }

    if (!Array.isArray(req.body.seats) || seats.length === 0) {
      return res.status(400).json({ message: 'Select at least one seat.' });
    }

    if (seats.length !== passengers.length) {
      return res.status(400).json({ message: 'Passenger details must match the selected seats.' });
    }

    const uniqueSeats = new Set(seats);
    if (uniqueSeats.size !== seats.length) {
      return res.status(400).json({ message: 'Duplicate seat numbers are not allowed.' });
    }

    const invalidSeat = seats.find((seatNumber) => !Number.isInteger(seatNumber) || seatNumber < 1 || seatNumber > 100);
    if (invalidSeat) {
      return res.status(400).json({ message: 'Seat numbers must be between 1 and 100.' });
    }

    const invalidPassenger = passengers.find((passenger) => {
      const seatNumber = Number(passenger.seatNumber);
      const name = (passenger.name || '').trim();
      const age = Number(passenger.age);
      const idProof = (passenger.idProof || '').trim();

      return !isPositiveInteger(seatNumber) || !name || !Number.isInteger(age) || age <= 0 || !idProof;
    });

    if (invalidPassenger) {
      return res.status(400).json({ message: 'Each passenger needs a name, age, seat number, and ID proof.' });
    }

    const lockValidation = await verifySeatLocksForUser({
      trainId,
      journeyDate,
      seatNumbers: seats,
      userId: req.user.id
    });

    if (!lockValidation.valid) {
      return res.status(409).json({
        message: 'Some selected seats are no longer locked for you.',
        unavailableSeats: lockValidation.missingSeatNumbers
      });
    }

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [trainId, Math.floor(new Date(`${journeyDate}T00:00:00Z`).getTime() / 1000)]);

    const trainResult = await client.query('SELECT id, fare, total_seats FROM trains WHERE id = $1', [trainId]);
    if (trainResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Train not found.' });
    }

    const bookedResult = await client.query(
      `SELECT DISTINCT bp.seat_number
       FROM bookings b
       JOIN booking_passengers bp ON bp.booking_id = b.id
       WHERE b.train_id = $1
         AND b.journey_date = $2
         AND b.status = 'confirmed'`,
      [trainId, journeyDate]
    );

    const bookedSeats = new Set(bookedResult.rows.map((row) => Number(row.seat_number)));
    const unavailableSeats = seats.filter((seatNumber) => bookedSeats.has(seatNumber));

    if (unavailableSeats.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'One or more selected seats were just booked by someone else.',
        unavailableSeats
      });
    }

    const train = trainResult.rows[0];
    const totalFare = Number(train.fare) * seats.length;
    const pnr = generatePnr();

    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, train_id, journey_date, total_fare, status, pnr)
       VALUES ($1, $2, $3, $4, 'confirmed', $5)
       RETURNING id, pnr, total_fare, status, journey_date, created_at`,
      [req.user.id, trainId, journeyDate, totalFare, pnr]
    );

    const booking = bookingResult.rows[0];

    for (const passenger of passengers) {
      await client.query(
        `INSERT INTO booking_passengers (booking_id, seat_number, name, age, id_proof)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          booking.id,
          Number(passenger.seatNumber),
          passenger.name.trim(),
          Number(passenger.age),
          passenger.idProof.trim()
        ]
      );
    }

    await client.query('COMMIT');

    await releaseSeats({
      trainId,
      journeyDate,
      seatNumbers: seats,
      userId: req.user.id
    }).catch(() => {});

    emitSeatEvent(req.app.get('io'), { trainId, journeyDate }, 'booking:confirmed', {
      seatNumbers: seats,
      status: 'booked',
      actorUserId: req.user.id,
      bookingId: booking.id,
      pnr: booking.pnr
    });

    return res.status(201).json({
      message: 'Booking confirmed successfully.',
      booking: {
        id: booking.id,
        pnr: booking.pnr,
        totalFare: booking.total_fare,
        status: booking.status,
        journeyDate: booking.journey_date,
        createdAt: booking.created_at,
        trainId,
        seats,
        passengers
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         b.id,
         b.pnr,
         b.journey_date,
         b.total_fare,
         b.status,
         b.created_at,
         t.id AS train_id,
         t.name AS train_name,
         t.source,
         t.destination,
         t.departure_time,
         t.arrival_time,
         t.duration,
         ARRAY_AGG(bp.seat_number ORDER BY bp.seat_number) AS seats,
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'seatNumber', bp.seat_number,
             'name', bp.name,
             'age', bp.age,
             'idProof', bp.id_proof
           )
           ORDER BY bp.seat_number
         ) AS passengers
       FROM bookings b
       JOIN trains t ON t.id = b.train_id
       JOIN booking_passengers bp ON bp.booking_id = b.id
       WHERE b.user_id = $1
       GROUP BY b.id, t.id
       ORDER BY b.journey_date DESC, b.created_at DESC`,
      [req.user.id]
    );

    const bookings = result.rows.map((row) => ({
      id: row.id,
      pnr: row.pnr,
      journeyDate: row.journey_date,
      totalFare: row.total_fare,
      status: row.status,
      createdAt: row.created_at,
      train: {
        id: row.train_id,
        name: row.train_name,
        source: row.source,
        destination: row.destination,
        departureTime: row.departure_time,
        arrivalTime: row.arrival_time,
        duration: row.duration
      },
      seats: row.seats,
      passengers: row.passengers
    }));

    return res.json({ bookings });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id/cancel', authMiddleware, async (req, res, next) => {
  let client;

  try {
    client = await pool.connect();
    const bookingId = Number(req.params.id);
    if (!isPositiveInteger(bookingId)) {
      return res.status(400).json({ message: 'Invalid booking id.' });
    }

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT
         b.id,
          b.train_id,
         b.user_id,
         b.status,
         b.journey_date,
         t.departure_time,
         t.name AS train_name
       FROM bookings b
       JOIN trains t ON t.id = b.train_id
       WHERE b.id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (bookingResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const booking = bookingResult.rows[0];

    if (booking.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only cancel your own bookings.' });
    }

    if (booking.status !== 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'This booking is already cancelled.' });
    }

    const journeyDateText = typeof booking.journey_date === 'string'
      ? booking.journey_date
      : booking.journey_date.toISOString().slice(0, 10);
    const journeyStart = new Date(`${journeyDateText}T${booking.departure_time}`);
    if (journeyStart.getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Past journeys cannot be cancelled.' });
    }

    const passengersResult = await client.query(
      'SELECT seat_number FROM booking_passengers WHERE booking_id = $1 ORDER BY seat_number',
      [bookingId]
    );

    await client.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', bookingId]);
    await client.query('COMMIT');

    emitSeatEvent(req.app.get('io'), { trainId: booking.train_id, journeyDate: booking.journey_date }, 'booking:cancelled', {
      seatNumbers: passengersResult.rows.map((row) => Number(row.seat_number)),
      status: 'available',
      actorUserId: req.user.id,
      bookingId
    });

    return res.json({
      message: `Booking cancelled successfully for ${booking.train_name}.`
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
