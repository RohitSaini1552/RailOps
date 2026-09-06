import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    [
      'rounded-full px-4 py-2 text-sm font-semibold transition',
      isActive ? 'bg-ink-900 text-white shadow-glow' : 'text-ink-700 hover:bg-white/80 hover:text-ink-900'
    ].join(' ');

  return (
    <header className="border-b border-white/60 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">RailOps</p>
          <h1 className="text-xl font-extrabold text-ink-900">Ticket Booking Platform</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <NavLink to="/search" className={linkClass}>
            Search Trains
          </NavLink>
          <NavLink to="/bookings" className={linkClass}>
            My Bookings
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-ink-900/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900 transition hover:border-ink-900/20 hover:bg-sun-50"
          >
            Logout
          </button>
        </nav>
        <div className="hidden rounded-2xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white md:block">
          {user?.name || 'Traveler'}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
