import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tp_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety fallback: never leave app stuck on loading > 20s
    // (api.js retries 3× @ 5s each = up to 15s, so give 20s total)
    const safetyTimer = setTimeout(() => setLoading(false), 20000);

    if (localStorage.getItem('tp_token')) {
      api.get('/auth/me').then(u => {
        setUser(u);
        localStorage.setItem('tp_user', JSON.stringify(u));
      }).catch(() => {
        // On persistent failure, clear stale token so user gets login page
        clearToken();
        setUser(null);
      }).finally(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });
    } else {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    localStorage.setItem('tp_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function loginWithToken(token, userData) {
    setToken(token);
    localStorage.setItem('tp_user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithToken, logout, loading, isAdmin: user?.role === 'super_admin', isPartner: user?.role === 'partner_admin', isStudent: user?.role === 'student' }}>
      {children}
    </AuthContext.Provider>
  );
}
