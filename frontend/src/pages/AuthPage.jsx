import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AuthPage({ mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, token } = useAuth();
  const initialMode = mode || (location.pathname === '/register' ? 'register' : 'login');
  const [activeMode, setActiveMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (token) {
      navigate('/search', { replace: true });
    }
  }, [token, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (activeMode === 'register') {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password
        });
        setMessage('Registration successful. Please log in.');
        setActiveMode('login');
        setForm((current) => ({ ...current, password: '' }));
      } else {
        await login(form.email.trim(), form.password);
        navigate('/search');
      }
    } catch (apiError) {
      setError(apiError?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setActiveMode(nextMode);
    setError('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-8 text-ink-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-glow backdrop-blur-xl sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-sun-50 px-4 py-2 text-sm font-semibold text-ink-700">
            <span className="h-2.5 w-2.5 rounded-full bg-ember-400" />
            RailOps
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-ink-500">RailOps Platform</p>
            <h2 className="max-w-xl text-4xl font-black leading-tight sm:text-5xl">
              RailOps - book trains made easy.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-ink-700 sm:text-lg">
              Search routes, reserve seats with confidence, and manage every booking from one clean, focused workspace.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Route search', ''],
              ['Seat selection', ''],
              ['Booking control', '']
            ].map(([title, detail]) => (
              <div key={title} className="rounded-3xl border border-ink-900/10 bg-white p-5 shadow-sm">
                <p className="text-lg font-bold text-ink-900">{title}</p>
                {detail ? <p className="mt-2 text-sm leading-6 text-ink-600">{detail}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-glow sm:p-8">
          <div className="mb-6 flex rounded-full bg-ink-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 rounded-full px-4 py-2 transition ${activeMode === 'login' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 rounded-full px-4 py-2 transition ${activeMode === 'register' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {activeMode === 'register' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink-700" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 outline-none transition focus:border-ink-500"
                  placeholder="Aarav Sharma"
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 outline-none transition focus:border-ink-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 outline-none transition focus:border-ink-500"
                placeholder="At least 6 characters"
              />
            </div>

            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Please wait...' : activeMode === 'register' ? 'Create account' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-sm text-ink-600">
            {activeMode === 'register' ? (
              <p>
                Already registered?{' '}
                <Link to="/" className="font-semibold text-ink-900 underline decoration-ember-300 decoration-2 underline-offset-4">
                  Go to login
                </Link>
              </p>
            ) : (
              <p>
                Need an account?{' '}
                <Link to="/register" className="font-semibold text-ink-900 underline decoration-ember-300 decoration-2 underline-offset-4">
                  Register here
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuthPage;
