const { getTrainRoomName } = require('../services/seatLockService');

function initSeatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join-seat-room', ({ trainId, journeyDate }) => {
      if (!trainId || !journeyDate) {
        return;
      }

      socket.join(getTrainRoomName(trainId, journeyDate));
    });

    socket.on('leave-seat-room', ({ trainId, journeyDate }) => {
      if (!trainId || !journeyDate) {
        return;
      }

      socket.leave(getTrainRoomName(trainId, journeyDate));
    });
  });
}

function emitSeatEvent(io, { trainId, journeyDate }, eventName, payload) {
  if (!io) {
    return;
  }

  io.to(getTrainRoomName(trainId, journeyDate)).emit(eventName, {
    trainId: Number(trainId),
    journeyDate,
    ...payload
  });
}

module.exports = {
  emitSeatEvent,
  initSeatSocket
};