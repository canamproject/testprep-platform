import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function Login({ tenantSlug, defaultMode = 'login' }) {
  const { login, loginWithToken, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode]       = useState(defaultMode); // 'login' | 'signup'
  const [tab, setTab]         = useState('student');    // login tabs: admin|partner|student
  const [tenant, setTenant]   = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Signup form
  const [sig, setSig] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });

  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') navigate('/admin');
      else if (user.role === 'partner_admin') navigate('/partner');
      else if (user.role === 'faculty') navigate('/faculty');
      else navigate('/student');
    }
  }, [user]);

  useEffect(() => {
    if (tenantSlug) {
      api.get(`/tenant/${tenantSlug}`).then(setTenant).catch(() => {});
    }
  }, [tenantSlug]);

  const brandColor = tenant?.brand_color || '#1a1a2e';
  const agencyName = tenant?.name || 'TestPrep Platform';
  const logoText   = tenant?.logo_initials || 'TP';

  // ── Login ─────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const u = await login(email, password);
      if (u.role === 'super_admin') navigate('/admin');
      else if (u.role === 'partner_admin') navigate('/partner');
      else if (u.role === 'faculty') navigate('/faculty');
      else navigate('/student');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  // ── Signup ────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (sig.password !== sig.confirm) { setError('Passwords do not match'); return; }
    if (sig.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const data = await api.post('/auth/signup', {
        name: sig.name,
        email: sig.email,
        phone: sig.phone,
        password: sig.password,
        agency_slug: tenantSlug || null,
      });
      loginWithToken(data.token, data.user);
      navigate('/student');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f1f5f9' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-100">

          {/* Brand header */}
          <div className="px-8 pt-8 pb-6 text-white text-center" style={{ background: brandColor }}>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-black">
              {logoText}
            </div>
            <h1 className="text-xl font-bold">{agencyName}</h1>
            {tenant && (
              <p className="text-white/60 text-xs mt-1">Powered by TestPrep Platform</p>
            )}
          </div>

          <div className="bg-white px-8 py-6">

            {/* Mode toggle: Sign In / Sign Up */}
            <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
              <button onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                Sign In
              </button>
              <button onClick={() => { setMode('signup'); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                Sign Up
              </button>
            </div>

            {/* Admin/Partner tabs — only on login, non-tenant */}
            {mode === 'login' && !tenantSlug && (
              <div className="flex gap-1 mb-4">
                {[['student','Student'],['partner','Partner'],['admin','Admin']].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all border ${tab === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>
            )}

            {/* ── SIGN IN FORM ── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label>Email Address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
                </div>
                <div>
                  <label>Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: brandColor }}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            )}

            {/* ── SIGN UP FORM ── */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-3">
                {tenant && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl text-xs text-blue-700 font-medium mb-1">
                    <span>🏫</span>
                    <span>Signing up under <strong>{agencyName}</strong></span>
                  </div>
                )}
                <div>
                  <label>Full Name *</label>
                  <input required placeholder="Priya Sharma"
                    value={sig.name} onChange={e => setSig({ ...sig, name: e.target.value })} />
                </div>
                <div>
                  <label>Email Address *</label>
                  <input type="email" required placeholder="your@email.com"
                    value={sig.email} onChange={e => setSig({ ...sig, email: e.target.value })} />
                </div>
                <div>
                  <label>Phone <span className="font-normal text-slate-400">optional</span></label>
                  <input type="tel" placeholder="+91 98765 43210"
                    value={sig.phone} onChange={e => setSig({ ...sig, phone: e.target.value })} />
                </div>
                <div>
                  <label>Password *</label>
                  <input type="password" required placeholder="Min 6 characters"
                    value={sig.password} onChange={e => setSig({ ...sig, password: e.target.value })} />
                </div>
                <div>
                  <label>Confirm Password *</label>
                  <input type="password" required placeholder="Repeat password"
                    value={sig.confirm} onChange={e => setSig({ ...sig, confirm: e.target.value })} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 mt-1"
                  style={{ background: brandColor }}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
                <p className="text-xs text-slate-400 text-center">
                  By signing up you agree to our terms of service.
                </p>
              </form>
            )}

          </div>
        </div>

        {/* Tenant portals — only on main login, not on tenant pages */}
        {!tenantSlug && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Are you a student from a partner institute?{' '}
            <span className="text-slate-600">Use your institute's link to sign up.</span>
          </p>
        )}
      </div>
    </div>
  );
}
