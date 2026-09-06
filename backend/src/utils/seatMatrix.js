function normalizeSeatNumbers(seatNumbers = []) {
  return Array.from(
    new Set(
      seatNumbers
        .map((seatNumber) => Number(seatNumber))
        .filter((seatNumber) => Number.isInteger(seatNumber) && seatNumber > 0)
    )
  ).sort((left, right) => left - right);
}

function buildSeatMatrix(totalSeats, bookedSeatNumbers = [], lockedSeatNumbers = []) {
  const bookedSet = new Set(normalizeSeatNumbers(bookedSeatNumbers));
  const lockedSet = new Set(normalizeSeatNumbers(lockedSeatNumbers));
  const seatMatrix = [];

  for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
    let status = 'available';

    if (bookedSet.has(seatNumber)) {
      status = 'booked';
    } else if (lockedSet.has(seatNumber)) {
      status = 'locked';
    }

    const rowIndex = Math.floor((seatNumber - 1) / 10);
    if (!seatMatrix[rowIndex]) {
      seatMatrix[rowIndex] = [];
    }

    seatMatrix[rowIndex].push({
      seatNumber,
      status
    });
  }

  return seatMatrix;
}

function countUnavailableSeats(bookedSeatNumbers = [], lockedSeatNumbers = []) {
  const occupied = new Set([...normalizeSeatNumbers(bookedSeatNumbers), ...normalizeSeatNumbers(lockedSeatNumbers)]);
  return occupied.size;
}

module.exports = {
  buildSeatMatrix,
  countUnavailableSeats,
  normalizeSeatNumbers
};