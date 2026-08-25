import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import BookingsPage from './pages/BookingsPage';
import SearchTrainsPage from './pages/SearchTrainsPage';
import TrainDetailPage from './pages/TrainDetailPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';

function App() {
  const { loading, token } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero-radial text-ink-900">
        <div className="rounded-3xl border border-white/70 bg-white/90 px-6 py-4 shadow-glow backdrop-blur">
          Loading your session...
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/search" replace /> : <AuthPage />} />
      <Route path="/login" element={token ? <Navigate to="/search" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={token ? <Navigate to="/search" replace /> : <AuthPage mode="register" />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/search" element={<SearchTrainsPage />} />
        <Route path="/trains/:id" element={<TrainDetailPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={token ? '/search' : '/'} replace />} />
    </Routes>
  );
}

export default App;
