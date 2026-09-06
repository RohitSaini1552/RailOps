const { connectRedis, redisClient } = require('../config/redis');
const { normalizeSeatNumbers } = require('../utils/seatMatrix');

const LOCK_TTL_MS = 5 * 60 * 1000;

function normalizeJourneyDate(journeyDate) {
  if (!journeyDate) {
    return '';
  }

  if (journeyDate instanceof Date) {
    return journeyDate.toISOString().slice(0, 10);
  }

  return String(journeyDate).slice(0, 10);
}

function getSeatLockKey(trainId, journeyDate, seatNumber) {
  return `seat-lock:${trainId}:${normalizeJourneyDate(journeyDate)}:${seatNumber}`;
}

function getTrainRoomName(trainId, journeyDate) {
  return `train:${trainId}:date:${normalizeJourneyDate(journeyDate)}`;
}

function createRedisUnavailableError() {
  const error = new Error('Redis is unavailable. Start Redis locally and try again.');
  error.status = 503;
  return error;
}

async function ensureRedisConnected() {
  try {
    await connectRedis();
  } catch (error) {
    throw createRedisUnavailableError();
  }
}

async function getSeatLockRecord({ trainId, journeyDate, seatNumber, allowRedisFailure = false }) {
  try {
    await ensureRedisConnected();

    const raw = await redisClient.get(getSeatLockKey(trainId, journeyDate, seatNumber));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      seatNumber: Number(seatNumber),
      userId: Number(parsed.userId),
      lockedAt: parsed.lockedAt,
      ttlMs: Number(parsed.ttlMs) || LOCK_TTL_MS
    };
  } catch (error) {
    if (allowRedisFailure) {
      return null;
    }

    throw error;
  }
}

async function getLockedSeatNumbers({ trainId, journeyDate, allowRedisFailure = false }) {
  try {
    await ensureRedisConnected();

    const pattern = getSeatLockKey(trainId, journeyDate, '*');
    const lockedSeatNumbers = [];

    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      const seatNumber = Number(key.split(':').pop());
      if (Number.isInteger(seatNumber)) {
        lockedSeatNumbers.push(seatNumber);
      }
    }

    return normalizeSeatNumbers(lockedSeatNumbers);
  } catch (error) {
    if (allowRedisFailure) {
      return [];
    }

    throw error;
  }
}

async function verifySeatLocksForUser({ trainId, journeyDate, seatNumbers, userId }) {
  await ensureRedisConnected();

  const normalizedSeatNumbers = normalizeSeatNumbers(seatNumbers);
  const records = await Promise.all(
    normalizedSeatNumbers.map((seatNumber) => getSeatLockRecord({ trainId, journeyDate, seatNumber }))
  );

  const missingSeatNumbers = [];

  records.forEach((record, index) => {
    const seatNumber = normalizedSeatNumbers[index];
    if (!record || Number(record.userId) !== Number(userId)) {
      missingSeatNumbers.push(seatNumber);
    }
  });

  return {
    valid: missingSeatNumbers.length === 0,
    missingSeatNumbers,
    records
  };
}

async function lockSeat({ trainId, journeyDate, seatNumber, userId, ttlMs = LOCK_TTL_MS }) {
  await ensureRedisConnected();

  const result = await redisClient.set(
    getSeatLockKey(trainId, journeyDate, seatNumber),
    JSON.stringify({
      userId,
      lockedAt: new Date().toISOString(),
      ttlMs
    }),
    {
      NX: true,
      PX: ttlMs
    }
  );

  return result === 'OK';
}

async function releaseSeat({ trainId, journeyDate, seatNumber, userId }) {
  await ensureRedisConnected();

  const current = await redisClient.get(getSeatLockKey(trainId, journeyDate, seatNumber));
  if (!current) {
    return false;
  }

  const parsed = JSON.parse(current);
  if (Number(parsed.userId) !== Number(userId)) {
    return false;
  }

  await redisClient.del(getSeatLockKey(trainId, journeyDate, seatNumber));
  return true;
}

async function releaseSeats({ trainId, journeyDate, seatNumbers, userId }) {
  const normalizedSeatNumbers = normalizeSeatNumbers(seatNumbers);
  const releasedSeatNumbers = [];

  for (const seatNumber of normalizedSeatNumbers) {
    const released = await releaseSeat({ trainId, journeyDate, seatNumber, userId });
    if (released) {
      releasedSeatNumbers.push(seatNumber);
    }
  }

  return releasedSeatNumbers;
}

module.exports = {
  LOCK_TTL_MS,
  getLockedSeatNumbers,
  getSeatLockKey,
  getSeatLockRecord,
  getTrainRoomName,
  lockSeat,
  releaseSeat,
  releaseSeats,
  verifySeatLocksForUser
};