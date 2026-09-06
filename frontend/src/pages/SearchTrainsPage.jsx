import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function SearchTrainsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ source: '', destination: '', date: '' });
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await api.get('/trains', {
        params: {
          source: form.source.trim(),
          destination: form.destination.trim(),
          date: form.date
        }
      });
      setTrains(response.data.trains || []);
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Unable to load trains right now.');
      setTrains([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-glow backdrop-blur sm:p-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-500">Search Trains</p>
          <h2 className="text-3xl font-black text-ink-900 sm:text-4xl">Find a route for the exact day you want to travel.</h2>
          <p className="text-ink-600">Availability is computed per train and journey date, so the seat count updates against current bookings.</p>
        </div>
        <form className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]" onSubmit={handleSubmit}>
          <input
            type="text"
            name="source"
            value={form.source}
            onChange={handleChange}
            required
            className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 outline-none transition focus:border-ink-500"
            placeholder="Source"
          />
          <input
            type="text"
            name="destination"
            value={form.destination}
            onChange={handleChange}
            required
            className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 outline-none transition focus:border-ink-500"
            placeholder="Destination"
          />
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 outline-none transition focus:border-ink-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-ink-900 px-6 py-3 font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Searching...' : 'Get Trains'}
          </button>
        </form>
        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      </section>

      <section className="space-y-4">
        {searched && !loading && trains.length === 0 && !error && (
          <div className="rounded-[2rem] border border-dashed border-ink-300 bg-white/70 p-10 text-center text-ink-600">
            No trains found for that route. Try another city pair.
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {trains.map((train) => (
            <button
              type="button"
              key={train.id}
              onClick={() => navigate(`/trains/${train.id}?date=${form.date}`)}
              className="group rounded-[1.75rem] border border-white/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">{train.name}</p>
                  <h3 className="mt-2 text-2xl font-black text-ink-900">
                    {train.source} <span className="text-ember-400">→</span> {train.destination}
                  </h3>
                </div>
                <div className="rounded-full bg-sun-50 px-4 py-2 text-sm font-bold text-ink-800">
                  {train.seatsAvailable} seats left
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-ink-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Distance</p>
                  <p className="mt-1 text-lg font-bold text-ink-900">{train.distanceKm} km</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Fare</p>
                  <p className="mt-1 text-lg font-bold text-ink-900">₹{train.fare} / seat</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Schedule</p>
                  <p className="mt-1 font-semibold text-ink-900">
                    {train.departureTime} / {train.arrivalTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink-500">Duration</p>
                  <p className="mt-1 font-semibold text-ink-900">{train.duration}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default SearchTrainsPage;
