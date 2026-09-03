import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { loading, token } = useAuth();

  if (loading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
