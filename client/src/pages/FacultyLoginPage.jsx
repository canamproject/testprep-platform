import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const USPS = [
  {
    icon: '🎥',
    title: 'One-Click Live Classes',
    desc: 'Schedule and launch interactive live classes instantly — Zoom or Jitsi, your choice. No technical setup required.',
    badge: 'Simple',
    hi: '#3b82f6',
  },
  {
    icon: '📈',
    title: 'Student Progress Dashboard',
    desc: 'Track every student\'s test scores, attendance, and learning progress in real time. See who needs help before exams.',
    badge: 'Real-Time',
    hi: '#10b981',
  },
  {
    icon: '📝',
    title: 'Built-In Test Management',
    desc: 'Create and assign mock tests, module tests, and practice sets. Automatic scoring with band score calculations.',
    badge: 'Auto-Graded',
    hi: '#8b5cf6',
  },
  {
    icon: '📱',
    title: 'Teach From Anywhere',
    desc: 'Mobile-first platform — teach, track students, and manage your batches from phone or desktop, anytime.',
    badge: 'Mobile Ready',
    hi: '#f59e0b',
  },
  {
    icon: '🎯',
    title: 'Attendance & Insights',
    desc: 'Automatic attendance tracking per class. See who joined, how long they stayed, and their overall progress %.',
    badge: 'Automatic',
    hi: '#06b6d4',
  },
];

export default function FacultyLoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'faculty') navigate('/faculty', { replace: true });
    else if (user.role === 'partner_admin') {
      const slug = user.slug || user.agency_slug;
      navigate(slug ? `/${slug}/partner` : '/partner', { replace: true });
    } else if (user.role === 'super_admin') navigate('/admin', { replace: true });
    else navigate('/student', { replace: true });
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const u = await login(email, password);
      if (u.role !== 'faculty') {
        setError('This portal is for Faculty (teachers) only. Use the correct login link for your role.');
        setLoading(false);
        return;
      }
      navigate('/faculty', { replace: true });
    } catch (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: USP Panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] flex-col justify-center px-12 py-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #064e3b 0%, #065f46 45%, #047857 100%)' }}>
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full opacity-10 blur-3xl" style={{ background: '#34d399' }} />
        <div className="absolute bottom-10 right-10 w-56 h-56 rounded-full opacity-10 blur-3xl" style={{ background: '#6ee7b7' }} />

        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black text-white"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>👩‍🏫</div>
            <div>
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase">TestPrep Platform</p>
              <p className="text-white font-bold text-sm">Faculty Portal</p>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white mb-3 leading-tight">
            Teach smarter,<br />
            <span style={{ color: '#6ee7b7' }}>track progress</span><br />
            effortlessly.
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            Everything you need to run live classes, track student progress, and deliver great results — in one simple dashboard.
          </p>

          <div className="space-y-3">
            {USPS.map((u, i) => (
              <div key={i} className="flex gap-3 p-3.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="text-xl flex-shrink-0 mt-0.5">{u.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-white font-bold text-sm">{u.title}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: u.hi + '30', color: u.hi }}>{u.badge}</span>
                  </div>
                  <p className="text-white/45 text-xs leading-relaxed">{u.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 p-3.5 rounded-2xl"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <span className="text-xl flex-shrink-0">🏆</span>
            <p className="text-xs leading-relaxed" style={{ color: '#6ee7b7' }}>
              <strong>Trusted by top educators:</strong> IELTS, PTE, Visa prep, and language instructors across 20+ institutes use this platform daily.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: Login Form ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl"
              style={{ background: '#065f46' }}>👩‍🏫</div>
            <h2 className="text-xl font-black text-slate-900">Faculty Portal</h2>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-black text-slate-900">Faculty Login</h2>
            <p className="text-slate-500 text-sm mt-1">Sign in to your teaching dashboard</p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Email or Mobile Number</label>
              <input type="text" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com or 9876543210"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-slate-900" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 hover:opacity-90 shadow-md"
              style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
              {loading ? 'Signing in…' : '📚 Sign In to Faculty Portal'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-4">
            Default password: <span className="font-mono font-bold text-slate-600">Faculty@123</span> — please change after first login
          </p>

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-2 text-center text-xs text-slate-400">
            <p>
              Agency partner login: <Link to="/partner-login" className="text-indigo-600 font-semibold hover:underline">/partner-login</Link>
            </p>
            <p>
              Platform admin: <Link to="/login" className="text-slate-600 font-semibold hover:underline">admin login →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
