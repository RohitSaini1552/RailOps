import { useEffect, useState } from 'react';
import api from '../api/client';

function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadBookings = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/bookings/me');
      setBookings(response.data.bookings || []);
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const canCancel = (booking) => {
    if (booking.status !== 'confirmed') {
      return false;
    }

    const departureMoment = new Date(`${booking.journeyDate}T${booking.train.departureTime}`);
    return departureMoment.getTime() > Date.now();
  };

  const handleCancel = async (bookingId) => {
    setBusyId(bookingId);
    setActionError('');
    setMessage('');

    try {
      const response = await api.put(`/bookings/${bookingId}/cancel`);
      setMessage(response.data.message);
      await loadBookings();
    } catch (apiError) {
      setActionError(apiError?.response?.data?.message || 'Unable to cancel this booking.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-ink-700 shadow-glow">
        Loading bookings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-glow sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-500">Profile / My Bookings</p>
        <h2 className="mt-2 text-3xl font-black text-ink-900 sm:text-4xl">Your confirmed and cancelled trips</h2>
        <p className="mt-2 text-ink-600">Bookings list all passengers, seats, fare, status, and cancellation options for upcoming journeys.</p>
      </section>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {actionError && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}

      {bookings.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-ink-300 bg-white/70 p-10 text-center text-ink-600">
          You have no bookings yet. Search a train and confirm your first seat.
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <article key={booking.id} className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-black text-ink-900">{booking.train.name}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <p className="text-ink-600">
                    {booking.train.source} <span className="text-ember-400">→</span> {booking.train.destination} on {booking.journeyDate}
                  </p>
                  <div className="grid gap-3 text-sm text-ink-700 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-ink-500">PNR</p>
                      <p className="mt-1 font-semibold text-ink-900">{booking.pnr}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Seats</p>
                      <p className="mt-1 font-semibold text-ink-900">{booking.seats.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Fare</p>
                      <p className="mt-1 font-semibold text-ink-900">₹{booking.totalFare}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Booked at</p>
                      <p className="mt-1 font-semibold text-ink-900">{new Date(booking.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                  {booking.status === 'confirmed' && canCancel(booking) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(booking.id)}
                      disabled={busyId === booking.id}
                      className="rounded-full border border-ink-900/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-sun-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === booking.id ? 'Cancelling...' : 'Cancel booking'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-3xl bg-ink-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {booking.passengers.map((passenger) => (
                  <div key={`${booking.id}-${passenger.seatNumber}`} className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm font-bold text-ink-900">Seat {passenger.seatNumber}</p>
                    <p className="mt-1 text-sm text-ink-600">{passenger.name}, age {passenger.age}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink-500">{passenger.idProof}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookingsPage;
