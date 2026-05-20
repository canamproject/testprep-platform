import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

// ── Banner mini-carousel (student page) ─────────────────────
function StudentBanners({ banners, brandColor }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (banners.length < 2) return;
    timer.current = setInterval(() => setIdx(i => (i + 1) % banners.length), 4000);
    return () => clearInterval(timer.current);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[idx];

  return (
    <div className="mb-4 rounded-2xl overflow-hidden shadow-sm cursor-pointer"
      onClick={() => b.link_url && window.open(b.link_url, '_blank')}>
      <div className="flex items-stretch min-h-[80px]" style={{ background: b.bg_color || brandColor }}>
        {b.image_data && (
          <div className="w-24 flex-shrink-0">
            <img src={b.image_data} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 px-4 py-3 flex flex-col justify-center" style={{ color: b.text_color || '#fff' }}>
          {b.badge && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full self-start mb-1"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              {b.badge}
            </span>
          )}
          <p className="font-black text-sm leading-tight">{b.title}</p>
          {b.subtitle && <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{b.subtitle}</p>}
          {b.link_url && (
            <span className="text-[10px] font-bold mt-1 opacity-80">{b.link_text || 'Learn More'} →</span>
          )}
        </div>
        {banners.length > 1 && (
          <div className="flex flex-col justify-center gap-1 pr-3">
            {banners.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className={`w-1.5 rounded-full transition-all ${i === idx ? 'h-5 bg-white' : 'h-1.5 bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── USP strip for agency-branded pages ──────────────────────
const STUDENT_USPS = [
  { icon: '🎥', text: 'Live Interactive Classes' },
  { icon: '📱', text: 'Study on Any Device' },
  { icon: '📊', text: 'Track Your Progress' },
  { icon: '🏆', text: 'Mock Tests & Practice' },
];

export default function Login({ tenantSlug, defaultMode = 'login' }) {
  const { login, loginWithToken, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode]     = useState(defaultMode);
  const [tab, setTab]       = useState('student');
  const [tenant, setTenant] = useState(null);
  const [banners, setBanners] = useState([]);

  // Login state
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  // null = idle | string = error message | { retrying, countdown } = server-starting state
  const [status, setStatus] = useState(null);

  // Signup form
  const [sig, setSig] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });

  const retryRef = useRef(null); // cancel flag for retry loop

  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') navigate('/admin');
      else if (user.role === 'partner_admin') navigate('/partner');
      else if (user.role === 'faculty') navigate('/faculty');
      else navigate('/student');
    }
  }, [user]);

  // Warm up Railway server silently on page load
  useEffect(() => {
    let dead = false;
    const ping = () => fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    ping();
    const id = setInterval(() => { if (!dead) ping(); }, 10000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (tenantSlug) {
      api.get(`/tenant/${tenantSlug}`).then(t => { if (t && !t.error) setTenant(t); }).catch(() => {});
      api.get(`/login-banners?role=student`).then(d => { if (Array.isArray(d)) setBanners(d); }).catch(() => {});
    }
  }, [tenantSlug]);

  const brandColor = tenant?.brand_color || '#1a1a2e';
  const agencyName = tenant?.name || 'TestPrep Platform';
  const logoText   = tenant?.logo_initials || 'TP';

  // ── Login with visible auto-retry on server errors ────────
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatus(null);

    // Cancel any previous retry loop
    if (retryRef.current) retryRef.current.cancelled = true;
    const ctx = { cancelled: false };
    retryRef.current = ctx;

    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY  = 8; // seconds between attempts

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (ctx.cancelled) break;
      try {
        const u = await login(email, password);
        // ✅ Success — navigate
        const slug = u.slug || u.agency_slug;
        if (u.role === 'super_admin') navigate('/admin');
        else if (u.role === 'partner_admin') navigate(slug ? `/${slug}/partner` : '/partner');
        else if (u.role === 'faculty') navigate('/faculty');
        else navigate(slug ? `/${slug}/student` : '/student');
        return; // done
      } catch (err) {
        if (ctx.cancelled) break;
        const msg = err.message || '';
        const isServerDown = msg === 'SERVER_UNAVAILABLE' || msg === 'SERVER_TIMEOUT'
          || msg.includes('502') || msg.includes('503') || msg.includes('not responding');

        if (isServerDown && attempt < MAX_ATTEMPTS) {
          // Show countdown and auto-retry
          for (let t = RETRY_DELAY; t > 0; t--) {
            if (ctx.cancelled) break;
            setStatus({ retrying: true, countdown: t, attempt, max: MAX_ATTEMPTS });
            await new Promise(r => setTimeout(r, 1000));
          }
          setStatus({ retrying: true, countdown: 0, attempt, max: MAX_ATTEMPTS });
          continue; // next attempt
        }

        // Permanent error (wrong password, etc.) or ran out of retries
        setStatus(isServerDown
          ? 'Server is taking too long to respond. Please try again in a minute.'
          : msg
        );
        break;
      }
    }

    if (!ctx.cancelled) setLoading(false);
  };

  // ── Signup ───────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (sig.password !== sig.confirm) { setStatus('Passwords do not match'); return; }
    if (sig.password.length < 6) { setStatus('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const data = await api.post('/auth/signup', {
        name: sig.name, email: sig.email, phone: sig.phone,
        password: sig.password, agency_slug: tenantSlug || null,
      });
      loginWithToken(data.token, data.user);
      const agSlug = data.user?.slug || data.user?.agency_slug || tenantSlug;
      navigate(agSlug ? `/${agSlug}/student` : '/student', { replace: true });
    } catch (err) {
      setStatus(err.message);
    } finally { setLoading(false); }
  };

  // ── Status display helper ─────────────────────────────────
  const StatusBox = () => {
    if (!status) return null;
    if (typeof status === 'object' && status.retrying) {
      return (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <span className="animate-spin inline-block">⏳</span>
            Server is starting up… (attempt {status.attempt}/{status.max})
          </div>
          {status.countdown > 0 && (
            <div className="text-xs text-amber-600">
              Retrying automatically in <strong>{status.countdown}s</strong>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="mb-3 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
        {status}
      </div>
    );
  };

  // ── Tenant (agency-branded) page ─────────────────────────
  if (tenantSlug) {
    return (
      <div className="min-h-screen" style={{ background: '#f1f5f9' }}>
        {/* Top section with brand color */}
        <div className="px-4 pt-8 pb-6 text-white text-center" style={{ background: brandColor }}>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-black">
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt={agencyName} className="w-full h-full object-cover rounded-2xl" />
              : logoText
            }
          </div>
          <h1 className="text-xl font-bold">{agencyName}</h1>
          <p className="text-white/60 text-xs mt-1">Powered by TestPrep Platform</p>

          {/* USP mini-strip */}
          <div className="flex justify-center flex-wrap gap-2 mt-4">
            {STUDENT_USPS.map(u => (
              <span key={u.text} className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                {u.icon} {u.text}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-2 pb-8">
          {/* Admin-managed banners */}
          {banners.length > 0 && (
            <div className="mt-4">
              <StudentBanners banners={banners} brandColor={brandColor} />
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden mt-3">
            <div className="px-6 py-5">
              {/* Mode toggle */}
              <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
                <button onClick={() => { setMode('login'); setStatus(null); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                  Sign In
                </button>
                <button onClick={() => { setMode('signup'); setStatus(null); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                  Sign Up
                </button>
              </div>

              <StatusBox />

              {/* Sign In */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="label">Email or Mobile Number</label>
                    <input type="text" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com or 9876543210" className="input" />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: brandColor }}>
                    {loading
                      ? (typeof status === 'object' ? 'Waiting for server…' : 'Signing in…')
                      : 'Sign In'}
                  </button>
                </form>
              )}

              {/* Sign Up */}
              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl text-xs text-blue-700 font-medium mb-1">
                    <span>🏫</span>
                    <span>Signing up under <strong>{agencyName}</strong></span>
                  </div>
                  {[
                    { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Priya Sharma', req: true },
                    { label: 'Email Address *', key: 'email', type: 'email', placeholder: 'your@email.com', req: true },
                    { label: 'Phone', key: 'phone', type: 'tel', placeholder: '+91 98765 43210', req: false },
                    { label: 'Password *', key: 'password', type: 'password', placeholder: 'Min 6 characters', req: true },
                    { label: 'Confirm Password *', key: 'confirm', type: 'password', placeholder: 'Repeat password', req: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input type={f.type} required={f.req} placeholder={f.placeholder} className="input"
                        value={sig[f.key]} onChange={e => setSig({ ...sig, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <button type="submit" disabled={loading}
                    className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 mt-1"
                    style={{ background: brandColor }}>
                    {loading ? 'Creating account…' : 'Create Account'}
                  </button>
                  <p className="text-xs text-slate-400 text-center">By signing up you agree to our terms of service.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Generic login page (no tenant) ──────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f1f5f9' }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-100">
          <div className="px-8 pt-8 pb-6 text-white text-center" style={{ background: '#1a1a2e' }}>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-black">TP</div>
            <h1 className="text-xl font-bold">TestPrep Platform</h1>
          </div>

          <div className="bg-white px-8 py-6">
            <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
              <button onClick={() => { setMode('login'); setStatus(null); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                Sign In
              </button>
              <button onClick={() => { setMode('signup'); setStatus(null); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                Sign Up
              </button>
            </div>

            {mode === 'login' && (
              <div className="flex gap-1 mb-4">
                {[['student','Student'],['partner','Partner'],['admin','Admin']].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all border ${tab === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            <StatusBox />

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input" />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#1a1a2e' }}>
                  {loading
                    ? (typeof status === 'object' ? 'Waiting for server…' : 'Signing in…')
                    : 'Sign In'}
                </button>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-3">
                {[
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Priya Sharma', req: true },
                  { label: 'Email Address *', key: 'email', type: 'email', placeholder: 'your@email.com', req: true },
                  { label: 'Phone', key: 'phone', type: 'tel', placeholder: '+91 98765 43210', req: false },
                  { label: 'Password *', key: 'password', type: 'password', placeholder: 'Min 6 characters', req: true },
                  { label: 'Confirm Password *', key: 'confirm', type: 'password', placeholder: 'Repeat password', req: true },
                ].map(f => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <input type={f.type} required={f.req} placeholder={f.placeholder} className="input"
                      value={sig[f.key]} onChange={e => setSig({ ...sig, [f.key]: e.target.value })} />
                  </div>
                ))}
                <button type="submit" disabled={loading}
                  className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 mt-1"
                  style={{ background: '#1a1a2e' }}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
                <p className="text-xs text-slate-400 text-center">By signing up you agree to our terms of service.</p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Are you a student from a partner institute?{' '}
          <span className="text-slate-600">Use your institute's link to sign up.</span>
        </p>
      </div>
    </div>
  );
}
