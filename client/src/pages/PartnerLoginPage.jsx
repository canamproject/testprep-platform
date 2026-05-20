import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ── USP data ─────────────────────────────────────────────────
const FEATURES = [
  { icon: '🔒', title: 'Zero Data Leakage', desc: 'Contact details are masked by default. Every access is permanently logged — even by us. You see the full audit trail.', color: '#10b981' },
  { icon: '⚡', title: 'Instant Payments', desc: 'UPI · QR code · payment link · mobile. Students pay in 30 seconds. No gateway, no delay, no cuts.', color: '#3b82f6' },
  { icon: '🎨', title: 'Your Brand, 100%', desc: 'Your logo, colors, domain. Your Android/iOS app. Students see your academy everywhere — never our name.', color: '#8b5cf6' },
  { icon: '🎓', title: 'All Class Types', desc: 'IELTS · PTE · SAT · Visa · Language · Custom. Live + self-paced in one platform.', color: '#f59e0b' },
  { icon: '📊', title: 'Live Analytics', desc: 'Real-time revenue, student progress, attendance tracking, and commission payouts — all in one dashboard.', color: '#06b6d4' },
  { icon: '🤝', title: 'Transparent Commissions', desc: 'Set your own fees, track earnings live, request payouts instantly. No surprises.', color: '#ec4899' },
];

const STATS = [
  { value: '500+', label: 'Partner Agencies' },
  { value: '50K+', label: 'Students Enrolled' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '30s', label: 'Avg Payment Time' },
];

// ── Banner carousel ───────────────────────────────────────────
function BannerCarousel({ banners }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (banners.length < 2) return;
    timer.current = setInterval(() => setIdx(i => (i + 1) % banners.length), 4500);
    return () => clearInterval(timer.current);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[idx];

  return (
    <section className="py-10 px-4" style={{ background: '#f8fafc' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-slate-800">📢 Latest Updates</h2>
          {banners.length > 1 && (
            <div className="flex gap-1.5">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-slate-800 w-5' : 'bg-slate-300'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl overflow-hidden shadow-lg flex flex-col md:flex-row min-h-[180px] transition-all duration-500"
          style={{ background: b.bg_color || '#1e40af' }}>
          {/* Text side */}
          <div className="flex-1 p-8 flex flex-col justify-center" style={{ color: b.text_color || '#fff' }}>
            {b.badge && (
              <span className="inline-block text-xs font-black px-3 py-1 rounded-full mb-3 self-start"
                style={{ background: 'rgba(255,255,255,0.2)', color: b.text_color || '#fff' }}>
                {b.badge}
              </span>
            )}
            <h3 className="text-2xl font-black mb-2 leading-tight">{b.title}</h3>
            {b.subtitle && <p className="text-sm leading-relaxed opacity-80 mb-4">{b.subtitle}</p>}
            {b.link_url && (
              <a href={b.link_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl self-start transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.2)', color: b.text_color || '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                {b.link_text || 'Learn More'} →
              </a>
            )}
          </div>
          {/* Image side */}
          {b.image_data && (
            <div className="md:w-72 flex-shrink-0">
              <img src={b.image_data} alt={b.title} className="w-full h-full object-cover" style={{ minHeight: 180 }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PartnerLoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [banners,  setBanners]  = useState([]);
  const formRef = useRef(null);

  // Fetch banners (public, no auth)
  useEffect(() => {
    fetch('/api/login-banners?role=partner')
      .then(r => r.ok ? r.json() : []).then(setBanners).catch(() => {});
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return;
    if (user.role === 'partner_admin') {
      const slug = user.slug || user.agency_slug;
      navigate(slug ? `/${slug}/partner` : '/partner', { replace: true });
    } else if (user.role === 'super_admin') navigate('/admin', { replace: true });
    else if (user.role === 'faculty') navigate('/faculty', { replace: true });
    else navigate('/student', { replace: true });
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const u = await login(email, password);
      if (u.role !== 'partner_admin') {
        setError('This portal is for Agency Partners only.');
        setLoading(false); return;
      }
      const slug = u.slug || u.agency_slug;
      navigate(slug ? `/${slug}/partner` : '/partner', { replace: true });
    } catch (err) { setError(err.message); setLoading(false); }
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── STICKY NAV ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-md"
        style={{ background: 'rgba(15,23,42,0.95)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white"
              style={{ background: '#4f46e5' }}>TP</div>
            <span className="text-white font-bold text-sm">TestPrep Platform</span>
            <span className="hidden sm:block text-white/30 text-xs ml-1">· Agency Partner Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/faculty-login" className="text-white/60 text-xs hover:text-white transition">Faculty login</Link>
            <button onClick={scrollToForm}
              className="text-xs font-bold px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
              style={{ background: '#4f46e5' }}>
              Sign In →
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 55%, #1e3a8a 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row gap-12 items-center">

            {/* Left: Headline + USPs */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-6"
                style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                🏢 White-Label EdTech Platform
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
                Launch your own<br />
                <span style={{ color: '#93c5fd' }}>branded academy</span><br />
                in minutes.
              </h1>
              <p className="text-white/60 text-lg mb-8 leading-relaxed max-w-lg">
                The only EdTech platform with a zero data leakage guarantee, instant UPI payments, and full white-label branding for every class type.
              </p>

              {/* Stats bar */}
              <div className="flex flex-wrap gap-6 mb-8">
                {STATS.map(s => (
                  <div key={s.label}>
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-xs text-white/50">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-2">
                {['🔒 Contact Audit Trail', '⚡ UPI Payments', '🎨 Full White-Label', '📱 Android + iOS PWA'].map(b => (
                  <span key={b} className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Login form card */}
            <div ref={formRef} className="w-full lg:w-96 flex-shrink-0">
              <div className="rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
                <div className="px-8 pt-8 pb-2">
                  <h2 className="text-xl font-black text-white mb-1">Partner Sign In</h2>
                  <p className="text-white/50 text-sm mb-6">Access your agency dashboard</p>

                  {error && (
                    <div className="mb-4 p-3 rounded-xl text-sm font-medium"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wide">Email or Mobile</label>
                      <input type="text" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="admin@youragency.com or mobile"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wide">Password</label>
                      <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }} />
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50 hover:opacity-90 mt-2"
                      style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #1d4ed8 100%)' }}>
                      {loading ? 'Signing in…' : '🔐 Sign In to Partner Portal'}
                    </button>
                  </form>
                </div>

                {/* Privacy badge inside card */}
                <div className="px-8 py-5 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex gap-2.5 items-start">
                    <span className="text-base flex-shrink-0">🛡️</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#6ee7b7' }}>Your data is 100% protected</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        All contact access is logged and visible to you. We cannot silently view your students' data.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Faculty? <Link to="/faculty-login" className="underline" style={{ color: 'rgba(255,255,255,0.5)' }}>faculty-login →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ADMIN-EDITABLE BANNERS ──────────────────────────── */}
      <BannerCarousel banners={banners} />

      {/* ── FEATURES GRID ──────────────────────────────────── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 mb-3">Everything you need to run your academy</h2>
            <p className="text-slate-500 max-w-xl mx-auto">One platform for live classes, payments, student management, and growth — under your own brand.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ background: f.color + '18' }}>
                  {f.icon}
                </div>
                <h3 className="font-black text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DATA PRIVACY HIGHLIGHT ─────────────────────────── */}
      <section className="py-16 px-4" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' }}>
        <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-10 items-center">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: '#d1fae5', color: '#065f46' }}>
              🏆 Industry First Feature
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4">
              We literally cannot<br />view your students secretly.
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              Every time anyone — including our own admin team — views a student's phone number or email, it gets logged: who, when, from which IP, and why.
              You see this complete audit trail in your dashboard, permanently. It's the only EdTech platform with this level of transparency.
            </p>
            <div className="space-y-3">
              {[
                '📍 Contact details masked everywhere by default',
                '🔍 Every reveal, call, email & WhatsApp action is logged',
                '🚨 Suspicious bulk access auto-flagged and alerted',
                '📋 Full audit trail visible to you in your dashboard',
              ].map(point => (
                <div key={point} className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="rounded-2xl p-6 shadow-xl" style={{ background: '#0f172a' }}>
              <div className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                LIVE AUDIT LOG
              </div>
              {[
                { name: 'Rakesh (Partner)', action: '👁 viewed', student: 'Priya S.', flag: false, time: '2m ago' },
                { name: 'Admin', action: '📞 called', student: 'Arjun M.', flag: false, time: '15m ago' },
                { name: 'Admin', action: '👁 viewed', student: 'Neha K.', flag: true, time: '1h ago' },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                  <div>
                    <div className="text-xs text-white/80 font-semibold">{r.name} {r.action} {r.student}</div>
                    <div className="text-[10px] text-white/30">{r.time}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.flag ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {r.flag ? '🚨 flagged' : '✅ normal'}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-white/25 mt-3 text-center">You see every access to your students' data</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ─────────────────────────────────────── */}
      <section className="py-12 px-4 text-center" style={{ background: '#0f172a' }}>
        <h2 className="text-2xl font-black text-white mb-2">Ready to grow your academy?</h2>
        <p className="text-white/50 text-sm mb-6">Sign in above or contact us to get your branded portal set up today.</p>
        <button onClick={scrollToForm}
          className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white transition-all hover:opacity-90"
          style={{ background: '#4f46e5' }}>
          🔐 Sign In to Partner Portal ↑
        </button>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="py-5 px-4 text-center text-xs text-slate-400 border-t border-slate-100">
        © 2025 TestPrep Platform. All contact access is logged & audited.
        <span className="mx-2">·</span>
        <Link to="/faculty-login" className="hover:text-slate-600">Faculty Login</Link>
        <span className="mx-2">·</span>
        <Link to="/login" className="hover:text-slate-600">Admin</Link>
      </footer>
    </div>
  );
}
