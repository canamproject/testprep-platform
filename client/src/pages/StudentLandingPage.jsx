import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import CourseDetailModal from '../components/CourseDetailModal';
import LogoDisplay from '../components/LogoDisplay';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const CAT_COLORS = {
  IELTS: '#3b82f6', PTE: '#10b981', TOEFL: '#8b5cf6',
  GERMAN: '#f59e0b', FRENCH: '#ec4899', SPOKEN_ENGLISH: '#06b6d4',
  OTHER: '#64748b',
};

const CAT_ICONS = {
  IELTS: '🎓', PTE: '📝', TOEFL: '🏆', GERMAN: '🇩🇪',
  FRENCH: '🇫🇷', SPOKEN_ENGLISH: '🗣️', OTHER: '📚',
};

const FEATURES = [
  { icon: '📺', title: 'Live Interactive Classes', desc: 'Join real-time sessions with expert faculty. Ask questions, get answers instantly.' },
  { icon: '📱', title: 'Study Anywhere', desc: 'Access classes and materials from any device — phone, tablet, or desktop.' },
  { icon: '📊', title: 'Track Your Progress', desc: 'Detailed analytics, test scores, attendance reports — everything in one place.' },
  { icon: '🏆', title: 'Mock Tests & Practice', desc: 'Full-length practice tests with instant scoring and detailed feedback.' },
  { icon: '🔔', title: 'Smart Reminders', desc: 'Never miss a class. Get WhatsApp & SMS alerts before every session.' },
  { icon: '🎯', title: 'Personalised Learning', desc: 'AI-powered recommendations based on your weak areas and test targets.' },
];

const DAY_ABBR = { Mon:'Mo',Tue:'Tu',Wed:'We',Thu:'Th',Fri:'Fr',Sat:'Sa',Sun:'Su' };

function parseDays(str) {
  if (!str) return [];
  return str.split(',').map(d => DAY_ABBR[d.trim()] || d.trim());
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ' · ' +
    d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}

// ── Banner carousel ───────────────────────────────────────────────────────────
function BannerStrip({ banners, brandColor }) {
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
    <div className="w-full cursor-pointer" onClick={() => b.link_url && window.open(b.link_url,'_blank')}>
      <div className="flex items-stretch min-h-[72px] rounded-2xl overflow-hidden shadow-lg relative"
        style={{ background: b.bg_color || brandColor }}>
        {b.image_data && (
          <div className="w-20 flex-shrink-0">
            <img src={b.image_data} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 px-5 py-3 flex flex-col justify-center" style={{ color: b.text_color || '#fff' }}>
          {b.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full self-start mb-1" style={{ background:'rgba(255,255,255,0.2)' }}>{b.badge}</span>}
          <p className="font-black text-sm leading-tight">{b.title}</p>
          {b.subtitle && <p className="text-xs opacity-70 mt-0.5">{b.subtitle}</p>}
          {b.link_url && <span className="text-[11px] font-bold mt-1 opacity-80">{b.link_text || 'Learn More'} →</span>}
        </div>
        {banners.length > 1 && (
          <div className="flex items-center gap-1 pr-4">
            {banners.map((_,i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className={`rounded-full transition-all ${i===idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ open, onClose, tenantSlug, agencyName, brandColor, defaultMode = 'signup', prefilledCourse }) {
  const { login, loginWithToken, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sig, setSig] = useState({ name:'', email:'', phone:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setMode(defaultMode); setError(''); } }, [open, defaultMode]);
  useEffect(() => { if (user) { navigate(`/${tenantSlug}/student`); } }, [user]);

  if (!open) return null;

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const u = await login(email, password);
      const slug = u.slug || u.agency_slug || tenantSlug;
      navigate(`/${slug}/student`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault(); setError('');
    if (sig.password !== sig.confirm) { setError('Passwords do not match'); return; }
    if (sig.password.length < 6) { setError('Min 6 characters'); return; }
    setLoading(true);
    try {
      const data = await api.post('/auth/signup', {
        name: sig.name, email: sig.email, phone: sig.phone,
        password: sig.password, agency_slug: tenantSlug || null,
      });
      loginWithToken(data.token, data.user);
      const agSlug = data.user?.slug || data.user?.agency_slug || tenantSlug;
      navigate(`/${agSlug}/student`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl animate-[slideUp_0.25s_ease]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-white relative" style={{ background: brandColor }}>
          <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">✕</button>
          <p className="text-xs font-semibold opacity-70 mb-1">{agencyName}</p>
          <h3 className="text-lg font-black">{mode === 'signup' ? 'Create your free account' : 'Welcome back!'}</h3>
          {prefilledCourse && mode === 'signup' && (
            <p className="text-xs opacity-80 mt-1">Enrolling in: <strong>{prefilledCourse}</strong></p>
          )}
        </div>
        {/* Toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1 mx-5 mt-4 gap-1">
          {['signup','login'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode===m ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              {m === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>
          ))}
        </div>
        <div className="px-5 py-4">
          {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs">{error}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <input type="text" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email or mobile number" className="input text-sm" />
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" className="input text-sm" />
              <button type="submit" disabled={loading}
                className="w-full py-2.5 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                style={{ background: brandColor }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-2.5">
              <input type="text" required placeholder="Full Name *" value={sig.name} onChange={e => setSig({...sig,name:e.target.value})} className="input text-sm" />
              <input type="email" required placeholder="Email Address *" value={sig.email} onChange={e => setSig({...sig,email:e.target.value})} className="input text-sm" />
              <input type="tel" placeholder="Phone (optional)" value={sig.phone} onChange={e => setSig({...sig,phone:e.target.value})} className="input text-sm" />
              <input type="password" required placeholder="Password (min 6 chars) *" value={sig.password} onChange={e => setSig({...sig,password:e.target.value})} className="input text-sm" />
              <input type="password" required placeholder="Confirm Password *" value={sig.confirm} onChange={e => setSig({...sig,confirm:e.target.value})} className="input text-sm" />
              <button type="submit" disabled={loading}
                className="w-full py-2.5 text-white font-bold rounded-xl text-sm disabled:opacity-50"
                style={{ background: brandColor }}>
                {loading ? 'Creating account…' : '🚀 Create Free Account'}
              </button>
              <p className="text-[10px] text-slate-400 text-center">By signing up you agree to our terms of service.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function StudentLandingPage({ tenantSlug }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant]       = useState(null);
  const [courses, setCourses]     = useState([]);
  const [batches, setBatches]     = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [banners, setBanners]     = useState([]);
  const [catFilter, setCatFilter]       = useState('ALL');
  const [authOpen, setAuthOpen]         = useState(false);
  const [authMode, setAuthMode]         = useState('signup');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [detailCourseId, setDetailCourseId] = useState(null);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [scrolled, setScrolled]         = useState(false);

  const coursesRef   = useRef(null);
  const scheduleRef  = useRef(null);
  const batchesRef   = useRef(null);

  useEffect(() => {
    if (user) navigate(`/${tenantSlug}/student`, { replace: true });
  }, [user]);

  useEffect(() => {
    api.get(`/tenant/${tenantSlug}`).then(t => { if (t && !t.error) setTenant(t); }).catch(() => {});
    api.get(`/public/${tenantSlug}/courses`).then(d => { if (Array.isArray(d)) setCourses(d); }).catch(() => {});
    api.get(`/public/${tenantSlug}/batches`).then(d => { if (Array.isArray(d)) setBatches(d); }).catch(() => {});
    api.get(`/public/${tenantSlug}/live-classes`).then(d => { if (Array.isArray(d)) setLiveClasses(d); }).catch(() => {});
    api.get(`/login-banners?role=student`).then(d => { if (Array.isArray(d)) setBanners(d); }).catch(() => {});
  }, [tenantSlug]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const brandColor  = tenant?.brand_color || '#1a1a2e';
  const agencyName  = tenant?.name || 'Academy';
  const logoUrl     = tenant?.logo_url;
  const logoText    = tenant?.logo_initials || agencyName.slice(0,2).toUpperCase();

  const categories  = ['ALL', ...new Set(courses.map(c => c.category).filter(Boolean))];
  const filteredCourses = catFilter === 'ALL' ? courses : courses.filter(c => c.category === catFilter);

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const openEnroll = (course) => {
    setSelectedCourse(course?.title || null);
    setAuthMode('signup');
    setAuthOpen(true);
  };

  const openDetail = (courseId) => setDetailCourseId(courseId);
  const handleAuthRequired = (type, item, course) => {
    setPendingPurchase({ type, item, course });
    setSelectedCourse(course?.title || item?.title || null);
    setAuthMode('signup');
    setDetailCourseId(null);
    setAuthOpen(true);
  };

  // ── Derive a readable hex for text contrast on brand bg ──────────────────
  const isDark = (() => {
    try {
      const c = brandColor.replace('#','');
      const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
      return (r*0.299 + g*0.587 + b*0.114) < 140;
    } catch { return true; }
  })();
  const onBrand = isDark ? '#ffffff' : '#1a1a2e';

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── STICKY NAV ─────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-lg' : ''}`}
        style={{ background: scrolled ? brandColor : 'transparent' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <LogoDisplay
              logoUrl={logoUrl}
              fit={tenant?.logo_fit || 'contain'}
              bg={tenant?.logo_bg || 'white'}
              padding={tenant?.logo_padding != null ? Number(tenant.logo_padding) : 6}
              brandColor={brandColor}
              initials={logoText}
              shape={tenant?.logo_shape || 'rounded'}
              size={36}
            />
            <span className={`font-black text-base transition-colors ${scrolled ? 'text-white' : 'text-white'}`}
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {agencyName}
            </span>
          </div>
          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-6">
            {[['Courses', coursesRef], ['Batches', batchesRef], ['Schedule', scheduleRef]].map(([lbl, ref]) => (
              <button key={lbl} onClick={() => scrollTo(ref)}
                className="text-sm font-semibold text-white/80 hover:text-white transition-colors" style={{ textShadow:'0 1px 3px rgba(0,0,0,0.3)' }}>
                {lbl}
              </button>
            ))}
          </div>
          {/* CTA */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
              className="text-sm font-semibold text-white/80 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all"
              style={{ textShadow:'0 1px 3px rgba(0,0,0,0.3)' }}>
              Sign In
            </button>
            <button onClick={() => openEnroll(null)}
              className="text-sm font-bold px-4 py-1.5 rounded-lg transition-all shadow-md hover:shadow-lg hover:-translate-y-px"
              style={{ background: 'white', color: brandColor }}>
              Enroll Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-4 pt-20 pb-16 overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${brandColor}f0, ${brandColor}cc, ${brandColor}88)` }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-5"
            style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.1) 0deg, transparent 1deg, transparent 59deg, rgba(255,255,255,0.1) 60deg)' }} />
        </div>

        {/* Agency Logo */}
        <div className="relative mb-6 flex justify-center">
          <div className="shadow-2xl" style={{ border: '2px solid rgba(255,255,255,0.3)', borderRadius: logoUrl ? undefined : '1rem', display:'inline-block' }}>
            <LogoDisplay
              logoUrl={logoUrl}
              fit={tenant?.logo_fit || 'contain'}
              bg={logoUrl ? (tenant?.logo_bg || 'white') : 'transparent'}
              padding={tenant?.logo_padding != null ? Number(tenant.logo_padding) : 10}
              brandColor={brandColor}
              initials={logoText}
              shape={tenant?.logo_shape || 'rounded'}
              size={80}
              style={{ background: logoUrl ? undefined : 'rgba(255,255,255,0.15)' }}
            />
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight mb-4 relative"
          style={{ textShadow:'0 2px 20px rgba(0,0,0,0.3)' }}>
          {agencyName}
        </h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-xl mx-auto mb-2 relative font-medium">
          Live classes · Mock tests · Expert faculty
        </p>
        <p className="text-sm text-white/60 mb-10 relative">Powered by TestPrep Platform</p>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 relative">
          <button onClick={() => openEnroll(null)}
            className="px-8 py-3.5 rounded-xl font-black text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
            style={{ background: 'white', color: brandColor }}>
            🚀 Enroll Now — It's Free
          </button>
          <button onClick={() => scrollTo(coursesRef)}
            className="px-8 py-3.5 rounded-xl font-bold text-base border-2 border-white/40 text-white hover:bg-white/10 transition-all">
            View Courses →
          </button>
        </div>

        {/* Stats strip */}
        {(courses.length > 0 || batches.length > 0) && (
          <div className="flex flex-wrap justify-center gap-6 mt-12 relative">
            {[
              { v: courses.length, l: 'Courses' },
              { v: batches.length, l: 'Active Batches' },
              { v: liveClasses.length, l: 'Upcoming Classes' },
              { v: '24/7', l: 'Support' },
            ].map(({ v, l }) => (
              <div key={l} className="text-center">
                <div className="text-2xl font-black text-white">{v}</div>
                <div className="text-xs text-white/60 font-semibold">{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce text-xl">↓</div>
      </section>

      {/* ── BANNERS ────────────────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 -mt-6 relative z-10">
          <BannerStrip banners={banners} brandColor={brandColor} />
        </section>
      )}

      {/* ── COURSES ────────────────────────────────────────────── */}
      <section ref={coursesRef} className="py-20 px-4 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: brandColor + '18', color: brandColor }}>Our Courses</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">Choose Your Path to Success</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto">Expert preparation for every major exam and language goal.</p>
          </div>

          {/* Category filter pills */}
          {categories.length > 2 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${catFilter === cat
                    ? 'text-white border-transparent shadow-md'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400 bg-white'}`}
                  style={catFilter === cat ? { background: cat === 'ALL' ? brandColor : (CAT_COLORS[cat] || brandColor) } : {}}>
                  {cat !== 'ALL' && (CAT_ICONS[cat] || '📚')} {cat === 'ALL' ? 'All Courses' : cat}
                </button>
              ))}
            </div>
          )}

          {/* Course cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.length === 0 ? (
              <div className="col-span-3 text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="text-5xl mb-3">📚</div>
                <p className="font-black text-slate-700 text-lg">Courses coming soon!</p>
                <p className="text-slate-400 text-sm mt-1">Check back shortly or sign up to be notified.</p>
                <button onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
                  className="mt-5 px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
                  style={{ background: brandColor }}>
                  Notify Me →
                </button>
              </div>
            ) : filteredCourses.map(course => (
              <div key={course.id}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                {/* Thumbnail or color bar */}
                {course.thumbnail_url ? (
                  <div className="h-36 bg-slate-100 overflow-hidden">
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${CAT_COLORS[course.category] || brandColor}, ${brandColor})` }} />
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black px-2.5 py-1 rounded-full"
                      style={{ background: (CAT_COLORS[course.category] || brandColor) + '18', color: CAT_COLORS[course.category] || brandColor }}>
                      {CAT_ICONS[course.category] || '📚'} {course.category}
                    </span>
                    <div className="flex items-center gap-2">
                      {course.is_live_class ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">🔴 Live</span> : null}
                      {course.duration_weeks ? <span className="text-xs text-slate-400 font-semibold">{course.duration_weeks}w</span> : null}
                    </div>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-2 group-hover:text-blue-700 transition-colors leading-snug">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="text-xs text-slate-500 leading-relaxed flex-1 line-clamp-3 mb-3">{course.description}</p>
                  )}
                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xl font-black text-slate-900">{fmt(course.price)}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">full course fee</div>
                      </div>
                      <button onClick={() => openEnroll(course)}
                        className="px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90 hover:shadow-md"
                        style={{ background: brandColor }}>
                        Enroll Now →
                      </button>
                    </div>
                    <button onClick={() => openDetail(course.id)}
                      className="w-full py-2 rounded-xl text-xs font-bold border-2 transition-all hover:shadow-sm flex items-center justify-center gap-1.5"
                      style={{ borderColor: brandColor + '40', color: brandColor, background: brandColor + '08' }}>
                      📋 View Details & Curriculum
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BATCHES (Running + Upcoming split) ─────────────────── */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const running  = batches.filter(b => !b.start_date || new Date(b.start_date) <= today);
        const upcoming = batches.filter(b => b.start_date && new Date(b.start_date) > today);

        const BatchCard = ({ b, isUpcoming }) => {
          const timeStr = (b.class_time || b.schedule_time || '').slice(0,5);
          const seatPct = b.max_students > 0 ? Math.min(100, Math.round((b.enrolled_count||0)/b.max_students*100)) : 0;
          return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
                  style={{ background: (CAT_COLORS[b.category] || brandColor) + '18', color: CAT_COLORS[b.category] || brandColor }}>
                  {CAT_ICONS[b.category] || '📚'} {b.category || 'Course'}
                </span>
                {isUpcoming
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">🗓 Upcoming</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">● Running</span>
                }
              </div>
              <h3 className="font-black text-slate-900 text-base mb-0.5 leading-snug">{b.name}</h3>
              {b.course_title && <p className="text-xs font-semibold text-slate-500 mb-2">{b.course_title}</p>}
              {b.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{b.description}</p>}

              <div className="space-y-1.5 mb-4 flex-1">
                {b.start_date && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>🗓</span>
                    <span>{fmtDate(b.start_date)}{b.end_date ? ` — ${fmtDate(b.end_date)}` : ''}</span>
                  </div>
                )}
                {timeStr && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>⏰</span>
                    <span>{timeStr} · {b.duration_minutes || 60} min/session</span>
                  </div>
                )}
                {b.schedule_days && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>📆</span>
                    <span>{parseDays(b.schedule_days).join(' · ')}</span>
                  </div>
                )}
                {b.trainer_name && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>👨‍🏫</span><span>{b.trainer_name}</span>
                  </div>
                )}
                {b.max_students > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>👥</span><span>{b.enrolled_count || 0} / {b.max_students} seats filled</span>
                  </div>
                )}
              </div>

              {/* Seats progress bar */}
              {b.max_students > 0 && (
                <div className="mb-4">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${seatPct}%`, background: seatPct > 80 ? '#ef4444' : brandColor }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{seatPct >= 80 ? '🔥 Almost full' : 'Seats available'}</span>
                    <span>{seatPct}%</span>
                  </div>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100 gap-2">
                {b.course_price ? (
                  <div>
                    <div className="text-lg font-black text-slate-900">{fmt(b.course_price)}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">course fee</div>
                  </div>
                ) : <div />}
                <div className="flex gap-2">
                  {b.course_id && (
                    <button onClick={() => openDetail(b.course_id)}
                      className="px-3 py-2 rounded-xl text-xs font-bold border transition-all hover:shadow-sm"
                      style={{ borderColor: brandColor + '40', color: brandColor, background: brandColor + '08' }}>
                      Details
                    </button>
                  )}
                  <button onClick={() => openEnroll({ title: b.name })}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white hover:opacity-90 hover:shadow-md transition-all"
                    style={{ background: brandColor }}>
                    {isUpcoming ? 'Pre-Enroll →' : 'Join →'}
                  </button>
                </div>
              </div>
            </div>
          );
        };

        return (
          <section ref={batchesRef} className="py-20 px-4 scroll-mt-16"
            style={{ background: `linear-gradient(135deg, ${brandColor}08, ${brandColor}04, #f8fafc)` }}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
                  style={{ background: brandColor + '18', color: brandColor }}>Batches</span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">Join a Batch</h2>
                <p className="text-slate-500 mt-3">Live, structured programs with expert faculty and cohort learning.</p>
              </div>

              {/* Running batches */}
              {running.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-sm font-black text-slate-900">🟢 Currently Running</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">{running.length} batch{running.length > 1 ? 'es' : ''}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {running.map(b => <BatchCard key={b.id} b={b} isUpcoming={false} />)}
                  </div>
                </div>
              )}

              {/* Upcoming batches */}
              {upcoming.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-sm font-black text-slate-900">🗓 Upcoming Batches</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{upcoming.length} batch{upcoming.length > 1 ? 'es' : ''} starting soon</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcoming.map(b => <BatchCard key={b.id} b={b} isUpcoming={true} />)}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {batches.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                  <div className="text-5xl mb-3">🗓</div>
                  <p className="font-black text-slate-700 text-lg">New batch programs are being scheduled.</p>
                  <p className="text-slate-400 text-sm mt-1">Sign up to get notified when enrollment opens.</p>
                  <button onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
                    className="mt-5 px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
                    style={{ background: brandColor }}>
                    🔔 Get Notified →
                  </button>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ── UPCOMING LIVE CLASSES ───────────────────────────────── */}
      {liveClasses.length > 0 && (
        <section ref={scheduleRef} className="py-20 px-4 bg-white scroll-mt-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
                style={{ background: brandColor + '18', color: brandColor }}>Class Schedule</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">Upcoming Live Classes</h2>
              <p className="text-slate-500 mt-3">Free preview classes open to all — enroll to attend as a full member.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {liveClasses.map((lc, i) => (
                <div key={lc.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${i < liveClasses.length-1 ? 'border-b border-slate-100' : ''}`}>
                  {/* Date pill */}
                  <div className="flex-shrink-0 text-center w-14 rounded-xl py-2"
                    style={{ background: brandColor + '12' }}>
                    <div className="text-[10px] font-black uppercase" style={{ color: brandColor }}>
                      {new Date(lc.scheduled_at).toLocaleDateString('en-IN',{month:'short'})}
                    </div>
                    <div className="text-xl font-black text-slate-900 leading-none">
                      {new Date(lc.scheduled_at).getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 text-sm truncate">{lc.title || lc.course_title}</p>
                      {lc.status === 'live' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">🔴 LIVE NOW</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-semibold">{lc.batch_name}</span>
                      {lc.faculty_name && <span className="text-[11px] text-slate-400">👨‍🏫 {lc.faculty_name}</span>}
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: (CAT_COLORS[lc.category]||brandColor)+'18', color: CAT_COLORS[lc.category]||brandColor }}>
                        {lc.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-slate-900">
                      {new Date(lc.scheduled_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
                    </div>
                    <div className="text-[10px] text-slate-400">{lc.duration_minutes} min</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <button onClick={() => openEnroll(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 hover:shadow-md transition-all"
                style={{ background: brandColor }}>
                Enroll to Join All Classes →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES / USPs ────────────────────────────────────── */}
      <section className="py-20 px-4"
        style={{ background: `linear-gradient(160deg, ${brandColor}f5 0%, ${brandColor}dd 50%, ${brandColor}f5 100%)` }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>Why Students Love Us</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">Everything You Need to Succeed</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i}
                className="rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-black text-white text-base mb-1.5">{f.title}</h3>
                <p className="text-xs text-white/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ─────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="mx-auto mb-6 shadow-lg inline-flex">
            <LogoDisplay
              logoUrl={logoUrl}
              fit={tenant?.logo_fit || 'contain'}
              bg={tenant?.logo_bg || 'white'}
              padding={tenant?.logo_padding != null ? Number(tenant.logo_padding) : 8}
              brandColor={brandColor}
              initials={logoText}
              shape={tenant?.logo_shape || 'rounded'}
              size={64}
            />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            Ready to start your journey?
          </h2>
          <p className="text-slate-500 mb-8 text-base">Join hundreds of students already learning with {agencyName}. Sign up free today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => openEnroll(null)}
              className="px-8 py-3.5 rounded-xl font-black text-base text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
              style={{ background: brandColor }}>
              🚀 Create Free Account
            </button>
            <button onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
              className="px-8 py-3.5 rounded-xl font-bold text-base border-2 border-slate-200 text-slate-600 hover:border-slate-400 transition-all">
              Already a student? Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="py-8 px-4 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center font-black text-[10px]"
              style={{ background: brandColor, color: onBrand }}>
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : logoText}
            </div>
            <span className="font-semibold text-slate-500">{agencyName}</span>
            {tenant?.city && <span>· {tenant.city}</span>}
          </div>
          <div className="flex items-center gap-4">
            {tenant?.email && <a href={`mailto:${tenant.email}`} className="hover:text-slate-600 transition-colors">{tenant.email}</a>}
            {tenant?.phone && <a href={`tel:${tenant.phone}`} className="hover:text-slate-600 transition-colors">{tenant.phone}</a>}
          </div>
          <span>Powered by <strong className="text-slate-500">TestPrep Platform</strong></span>
        </div>
      </footer>

      {/* ── AUTH MODAL ─────────────────────────────────────────── */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        tenantSlug={tenantSlug}
        agencyName={agencyName}
        brandColor={brandColor}
        defaultMode={authMode}
        prefilledCourse={selectedCourse}
      />

      {/* ── COURSE DETAIL MODAL ────────────────────────────────── */}
      <CourseDetailModal
        courseId={detailCourseId}
        open={!!detailCourseId}
        onClose={() => setDetailCourseId(null)}
        accent={brandColor}
        tenantSlug={tenantSlug}
        onAuthRequired={handleAuthRequired}
      />

      {/* ── Slide-up animation ─────────────────────────────────── */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
