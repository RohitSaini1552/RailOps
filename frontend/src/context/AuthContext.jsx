import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('train4_token') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      } catch (error) {
        localStorage.removeItem('train4_token');
        setToken('');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [token]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('train4_token', response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const register = async (payload) => {
    const response = await api.post('/auth/register', payload);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('train4_token');
    setToken('');
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
