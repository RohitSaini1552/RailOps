const express = require('express');
const pool = require('../config/pool');
const authMiddleware = require('../middleware/authMiddleware');
const { emitSeatEvent } = require('../sockets/seatSocket');
const { getSeatLockRecord, lockSeat, releaseSeat } = require('../services/seatLockService');

const router = express.Router();

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function parseSeatNumber(value) {
  const seatNumber = Number(value);
  return Number.isInteger(seatNumber) ? seatNumber : null;
}

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const trainId = Number(req.body.trainId);
    const journeyDate = req.body.journeyDate;
    const seatNumber = parseSeatNumber(req.body.seatNumber);

    if (!isPositiveInteger(trainId) || !journeyDate || !seatNumber) {
      return res.status(400).json({ message: 'trainId, journeyDate, and seatNumber are required.' });
    }

    const bookingCheck = await pool.query(
      `SELECT 1
       FROM bookings b
       JOIN booking_passengers bp ON bp.booking_id = b.id
       WHERE b.train_id = $1
         AND b.journey_date = $2
         AND b.status = 'confirmed'
         AND bp.seat_number = $3
       LIMIT 1`,
      [trainId, journeyDate, seatNumber]
    );

    if (bookingCheck.rowCount > 0) {
      return res.status(409).json({ message: 'This seat is already booked.' });
    }

    const locked = await lockSeat({
      trainId,
      journeyDate,
      seatNumber,
      userId: req.user.id
    });

    if (!locked) {
      return res.status(409).json({ message: 'This seat is already locked by another user.' });
    }

    emitSeatEvent(req.app.get('io'), { trainId, journeyDate }, 'seat-lock:changed', {
      seatNumbers: [seatNumber],
      status: 'locked',
      actorUserId: req.user.id
    });

    return res.status(201).json({
      message: 'Seat locked successfully.',
      seatNumber,
      status: 'locked'
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const trainId = Number(req.body.trainId);
    const journeyDate = req.body.journeyDate;
    const seatNumber = parseSeatNumber(req.body.seatNumber);

    if (!isPositiveInteger(trainId) || !journeyDate || !seatNumber) {
      return res.status(400).json({ message: 'trainId, journeyDate, and seatNumber are required.' });
    }

    const lockRecord = await getSeatLockRecord({
      trainId,
      journeyDate,
      seatNumber,
      allowRedisFailure: false
    });

    if (lockRecord && Number(lockRecord.userId) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only release your own seat locks.' });
    }

    const released = await releaseSeat({
      trainId,
      journeyDate,
      seatNumber,
      userId: req.user.id
    });

    if (released || !lockRecord) {
      emitSeatEvent(req.app.get('io'), { trainId, journeyDate }, 'seat-lock:changed', {
        seatNumbers: [seatNumber],
        status: 'available',
        actorUserId: req.user.id
      });
    }

    return res.json({
      message: released ? 'Seat released successfully.' : 'Seat was already available.',
      seatNumber,
      status: 'available'
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;