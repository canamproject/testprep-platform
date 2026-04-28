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
    if (localStorage.getItem('tp_token')) {
      api.get('/auth/me').then(u => {
        setUser(u);
        localStorage.setItem('tp_user', JSON.stringify(u));
      }).catch(() => {
        clearToken();
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
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
