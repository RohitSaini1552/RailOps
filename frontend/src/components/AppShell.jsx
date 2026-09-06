import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

function AppShell() {
  return (
    <div className="min-h-screen bg-hero-radial text-ink-900">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
