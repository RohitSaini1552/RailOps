import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import socket from '../socket';

const emptyPassenger = () => ({ name: '', age: '', idProof: '' });

function uniqueSeatNumbers(seatNumbers = []) {
  return Array.from(new Set(seatNumbers.map((seatNumber) => Number(seatNumber)).filter((seatNumber) => Number.isInteger(seatNumber))));
}

function removeSeatsFromPassengerMap(passengerMap, seatNumbers) {
  const seatSet = new Set(uniqueSeatNumbers(seatNumbers));
  const nextPassengerMap = {};

  Object.entries(passengerMap).forEach(([seatNumber, passenger]) => {
    if (!seatSet.has(Number(seatNumber))) {
      nextPassengerMap[seatNumber] = passenger;
    }
  });

  return nextPassengerMap;
}

function updateSeatCollection(currentData, seatNumbers, status) {
  if (!currentData) {
    return currentData;
  }

  const seatSet = new Set(uniqueSeatNumbers(seatNumbers));
  const currentBookedSeats = new Set(currentData.bookedSeats || []);
  const currentLockedSeats = new Set(currentData.lockedSeats || []);

  if (status === 'booked') {
    seatSet.forEach((seatNumber) => {
      currentBookedSeats.add(seatNumber);
      currentLockedSeats.delete(seatNumber);
    });
  } else if (status === 'locked') {
    seatSet.forEach((seatNumber) => {
      if (!currentBookedSeats.has(seatNumber)) {
        currentLockedSeats.add(seatNumber);
      }
    });
  } else {
    seatSet.forEach((seatNumber) => {
      currentBookedSeats.delete(seatNumber);
      currentLockedSeats.delete(seatNumber);
    });
  }

  const updatedSeatMatrix = (currentData.seatMatrix || []).map((row) =>
    row.map((seat) => {
      if (!seatSet.has(seat.seatNumber)) {
        return seat;
      }

      return {
        ...seat,
        status: status === 'available' && currentBookedSeats.has(seat.seatNumber)
          ? 'booked'
          : status === 'available' && currentLockedSeats.has(seat.seatNumber)
            ? 'locked'
            : status
      };
    })
  );

  return {
    ...currentData,
    bookedSeats: Array.from(currentBookedSeats),
    lockedSeats: Array.from(currentLockedSeats),
    seatMatrix: updatedSeatMatrix
  };
}

function TrainDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const journeyDate = searchParams.get('date') || '';
  const [trainData, setTrainData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [passengers, setPassengers] = useState({});
  const [paying, setPaying] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const trainId = Number(id);

  const syncSelectionForSeats = (seatNumbers) => {
    const seats = uniqueSeatNumbers(seatNumbers);
    setSelectedSeats((current) => current.filter((seatNumber) => !seats.includes(seatNumber)));
    setPassengers((current) => removeSeatsFromPassengerMap(current, seats));
  };

  useEffect(() => {
    const loadTrain = async () => {
      if (!journeyDate) {
        setError('Please choose a journey date from the search page.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setSelectedSeats([]);
      setPassengers({});

      try {
        const response = await api.get(`/trains/${id}`, {
          params: { date: journeyDate }
        });
        setTrainData(response.data);
      } catch (apiError) {
        setError(apiError?.response?.data?.message || 'Unable to load train details.');
      } finally {
        setLoading(false);
      }
    };

    loadTrain();
  }, [id, journeyDate]);

  useEffect(() => {
    if (!trainData?.train?.id || !journeyDate) {
      return undefined;
    }

    socket.connect();
    socket.emit('join-seat-room', {
      trainId,
      journeyDate
    });

    const handleSeatLockChanged = (payload) => {
      if (Number(payload.trainId) !== trainId || payload.journeyDate !== journeyDate) {
        return;
      }

      setTrainData((current) => updateSeatCollection(current, payload.seatNumbers || [], payload.status));

      if (payload.actorUserId !== user?.id && payload.status !== 'available') {
        syncSelectionForSeats(payload.seatNumbers || []);
        setError('Some seats changed while you were selecting them.');
      }
    };

    const handleBookingConfirmed = (payload) => {
      if (Number(payload.trainId) !== trainId || payload.journeyDate !== journeyDate) {
        return;
      }

      setTrainData((current) => updateSeatCollection(current, payload.seatNumbers || [], 'booked'));

      if (payload.actorUserId !== user?.id) {
        syncSelectionForSeats(payload.seatNumbers || []);
      }
    };

    const handleBookingCancelled = (payload) => {
      if (Number(payload.trainId) !== trainId || payload.journeyDate !== journeyDate) {
        return;
      }

      setTrainData((current) => updateSeatCollection(current, payload.seatNumbers || [], 'available'));
    };

    socket.on('seat-lock:changed', handleSeatLockChanged);
    socket.on('booking:confirmed', handleBookingConfirmed);
    socket.on('booking:cancelled', handleBookingCancelled);

    return () => {
      socket.off('seat-lock:changed', handleSeatLockChanged);
      socket.off('booking:confirmed', handleBookingConfirmed);
      socket.off('booking:cancelled', handleBookingCancelled);
      socket.emit('leave-seat-room', {
        trainId,
        journeyDate
      });
      socket.disconnect();
    };
  }, [journeyDate, trainData?.train?.id, trainId, user?.id]);

  const lockSeatOnServer = async (seatNumber) => {
    const response = await api.post('/seat-locks', {
      trainId,
      journeyDate,
      seatNumber
    });

    setSelectedSeats((current) => [...current, seatNumber].sort((left, right) => left - right));
    setPassengers((current) => ({
      ...current,
      [seatNumber]: current[seatNumber] || emptyPassenger()
    }));
    setTrainData((current) => updateSeatCollection(current, [seatNumber], response.data.status));
  };

  const releaseSeatOnServer = async (seatNumber) => {
    await api.delete('/seat-locks', {
      data: {
        trainId,
        journeyDate,
        seatNumber
      }
    });

    setSelectedSeats((current) => current.filter((seat) => seat !== seatNumber));
    setPassengers((current) => removeSeatsFromPassengerMap(current, [seatNumber]));
    setTrainData((current) => updateSeatCollection(current, [seatNumber], 'available'));
  };

  const toggleSeat = async (seatNumber, status) => {
    if (selectedSeats.includes(seatNumber)) {
      try {
        await releaseSeatOnServer(seatNumber);
      } catch (apiError) {
        setError(apiError?.response?.data?.message || 'Unable to release that seat right now.');
      }
      return;
    }

    if (status !== 'available') {
      return;
    }

    try {
      await lockSeatOnServer(seatNumber);
      setError('');
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Unable to lock that seat right now.');
    }
  };

  useEffect(() => {
    setPassengers((current) => {
      const next = {};
      selectedSeats.forEach((seatNumber) => {
        next[seatNumber] = current[seatNumber] || emptyPassenger();
      });
      return next;
    });
  }, [selectedSeats]);

  const handlePassengerChange = (seatNumber, field, value) => {
    setPassengers((current) => ({
      ...current,
      [seatNumber]: {
        ...(current[seatNumber] || emptyPassenger()),
        [field]: value
      }
    }));
  };

  const totalFare = (trainData?.train?.fare || 0) * selectedSeats.length;

  const handlePay = async () => {
    setPaying(true);
    setError('');

    try {
      const invalidPassenger = selectedSeats.find((seatNumber) => {
        const passenger = passengers[seatNumber] || emptyPassenger();
        return !passenger.name.trim() || Number(passenger.age) <= 0 || !passenger.idProof.trim();
      });

      if (invalidPassenger) {
        setError('Fill every passenger row before paying.');
        setPaying(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 700));

      const response = await api.post('/bookings', {
        trainId: Number(id),
        journeyDate,
        seats: selectedSeats,
        passengers: selectedSeats.map((seatNumber) => ({
          seatNumber,
          name: passengers[seatNumber].name.trim(),
          age: Number(passengers[seatNumber].age),
          idProof: passengers[seatNumber].idProof.trim()
        }))
      });

      setConfirmation({
        message: 'Payment successful, seats confirmed',
        pnr: response.data.booking.pnr
      });
      setSelectedSeats([]);
      setPassengers({});
      setTrainData((current) => updateSeatCollection(current, response.data.booking.seats, 'booked'));
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Payment failed or seats are no longer available.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-ink-700 shadow-glow">
        Loading train details...
      </div>
    );
  }

  if (error && !trainData) {
    return (
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-ink-700 shadow-glow">
        <p className="font-semibold text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="mt-4 rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Back to search
        </button>
      </div>
    );
  }

  const { train, seatMatrix } = trainData || {};

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-glow sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-500">Train Details</p>
            <h2 className="mt-2 text-3xl font-black text-ink-900 sm:text-4xl">{train.name}</h2>
            <p className="mt-2 text-ink-700">
              {train.source} <span className="text-ember-400">→</span> {train.destination} on {journeyDate}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-sun-50 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Fare per seat</p>
              <p className="mt-1 text-2xl font-black text-ink-900">₹{train.fare}</p>
            </div>
            <div className="rounded-3xl bg-ink-100 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Schedule</p>
              <p className="mt-1 font-bold text-ink-900">
                {train.departureTime} / {train.arrivalTime}
              </p>
            </div>
            <div className="rounded-3xl bg-emer-100 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Duration</p>
              <p className="mt-1 font-bold text-ink-900">{train.duration}</p>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/55 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-6 text-center shadow-glow">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">
              ✓
            </div>
            <h3 className="mt-4 text-2xl font-black text-ink-900">{confirmation.message}</h3>
            <p className="mt-2 text-ink-600">PNR: {confirmation.pnr}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  navigate('/bookings');
                }}
                className="flex-1 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                View bookings
              </button>
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="flex-1 rounded-full border border-ink-900/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-glow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-ink-500">Seat Matrix</p>
              <h3 className="mt-2 text-2xl font-black text-ink-900">Select multiple available seats</h3>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-ink-600">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Available</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Booked</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> Locked</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sun-300" /> Selected</span>
            </div>
          </div>
          <div className="mt-6 grid gap-2">
            {seatMatrix?.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-10 gap-2">
                {row.map((seat) => {
                  const selected = selectedSeats.includes(seat.seatNumber);
                  return (
                    <button
                      type="button"
                      key={seat.seatNumber}
                      disabled={seat.status === 'booked'}
                      onClick={() => {
                        void toggleSeat(seat.seatNumber, seat.status);
                      }}
                      className={`aspect-square rounded-xl border text-xs font-bold transition sm:text-sm ${
                        seat.status === 'booked'
                          ? 'cursor-not-allowed border-red-200 bg-red-100 text-red-700'
                          : seat.status === 'locked' && !selectedSeats.includes(seat.seatNumber)
                            ? 'cursor-not-allowed border-amber-200 bg-amber-100 text-amber-700'
                          : selected
                            ? 'border-sun-300 bg-sun-100 text-ink-900 shadow-sm'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:bg-emerald-100'
                      }`}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-glow">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-ink-500">Passenger Details</p>
                <h3 className="mt-2 text-2xl font-black text-ink-900">{selectedSeats.length} seats selected</h3>
              </div>
              <div className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
                Total: ₹{totalFare}
              </div>
            </div>

            {selectedSeats.length === 0 ? (
              <div className="mt-6 rounded-3xl bg-ink-50 p-6 text-sm text-ink-600">
                Select one or more available seats to enter passenger information.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {selectedSeats.map((seatNumber) => {
                  const passenger = passengers[seatNumber] || emptyPassenger();
                  return (
                    <div key={seatNumber} className="rounded-3xl border border-ink-200 bg-ink-50 p-4">
                      <p className="mb-3 font-bold text-ink-900">Seat {seatNumber}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          type="text"
                          value={passenger.name}
                          onChange={(event) => handlePassengerChange(seatNumber, 'name', event.target.value)}
                          className="rounded-2xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-ink-500"
                          placeholder="Passenger name"
                        />
                        <input
                          type="number"
                          min="1"
                          value={passenger.age}
                          onChange={(event) => handlePassengerChange(seatNumber, 'age', event.target.value)}
                          className="rounded-2xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-ink-500"
                          placeholder="Age"
                        />
                        <input
                          type="text"
                          value={passenger.idProof}
                          onChange={(event) => handlePassengerChange(seatNumber, 'idProof', event.target.value)}
                          className="rounded-2xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-ink-500"
                          placeholder="ID proof"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-glow">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-ink-500">Payment</p>
            <div className="mt-3 flex items-center justify-between text-lg font-bold text-ink-900">
              <span>Total fare</span>
              <span>₹{totalFare}</span>
            </div>
            <button
              type="button"
              onClick={handlePay}
              disabled={paying || selectedSeats.length === 0}
              className="mt-5 w-full rounded-2xl bg-ember-400 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ember-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paying ? 'Processing payment...' : 'Pay'}
            </button>
            <p className="mt-3 text-sm text-ink-600">This is a mock payment flow. Clicking Pay confirms the booking and locks the seats.</p>
          </section>
        </div>
      </section>
    </div>
  );
}

export default TrainDetailPage;
