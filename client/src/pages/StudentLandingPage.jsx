import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import CourseDetailModal from '../components/CourseDetailModal';
import LogoDisplay from '../components/LogoDisplay';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const CAT_COLORS = {
  IELTS: '#2563eb', PTE: '#059669', TOEFL: '#7c3aed',
  GERMAN: '#d97706', FRENCH: '#db2777', SPOKEN_ENGLISH: '#0891b2',
  OTHER: '#475569',
};
const CAT_GRAD = {
  IELTS:          'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  PTE:            'linear-gradient(135deg,#047857,#10b981)',
  TOEFL:          'linear-gradient(135deg,#6d28d9,#8b5cf6)',
  GERMAN:         'linear-gradient(135deg,#b45309,#f59e0b)',
  FRENCH:         'linear-gradient(135deg,#be185d,#ec4899)',
  SPOKEN_ENGLISH: 'linear-gradient(135deg,#0e7490,#06b6d4)',
  OTHER:          'linear-gradient(135deg,#334155,#64748b)',
};
const CAT_ICONS = {
  IELTS: '🇬🇧', PTE: '🎓', TOEFL: '🌐', GERMAN: '🇩🇪',
  FRENCH: '🇫🇷', SPOKEN_ENGLISH: '🗣️', OTHER: '📚',
};
const CAT_TARGET = {
  IELTS: 'Target: Band 7+', PTE: 'Target: 79+ Score',
  TOEFL: 'Target: 100+ iBT', GERMAN: 'A1 → B2 Levels',
  FRENCH: 'DELF / DALF', SPOKEN_ENGLISH: 'Fluency in 90 days', OTHER: '',
};
const CAT_MODULES = {
  IELTS: ['Listening','Reading','Writing','Speaking'],
  PTE: ['Speaking & Writing','Reading','Listening'],
  TOEFL: ['Reading','Listening','Speaking','Writing'],
  GERMAN: ['Grammatik','Wortschatz','Hören','Sprechen'],
  FRENCH: ['Grammaire','Vocabulaire','Expression','Compréhension'],
  SPOKEN_ENGLISH: ['Pronunciation','Fluency','Grammar','Confidence'],
  OTHER: [],
};

const FEATURES = [
  { icon: '📺', title: 'Live Interactive Classes', desc: 'Real-time sessions with expert faculty. Ask questions, get instant feedback.' },
  { icon: '🏆', title: 'Full Mock Tests', desc: 'Exam-pattern mocks with band/score predictions and detailed analysis.' },
  { icon: '📊', title: 'Progress Tracking', desc: 'Visual dashboards, module scores, and weak-area alerts.' },
  { icon: '🎯', title: 'Personalised Study Plan', desc: 'AI-driven plans based on your diagnostic results and target score.' },
  { icon: '👨‍🏫', title: 'Expert Faculty', desc: 'Certified trainers with 10+ years of IELTS / PTE coaching experience.' },
  { icon: '📱', title: 'Study on Any Device', desc: 'Phone, tablet or desktop — your classes follow you everywhere.' },
];

const STATS = [
  { v: '10,000+', l: 'Students Trained' },
  { v: '95%', l: 'Score Improvement' },
  { v: '50+', l: 'Expert Trainers' },
  { v: '4.9★', l: 'Average Rating' },
];

const EXAM_CATS = ['IELTS','PTE','TOEFL','GERMAN','FRENCH','SPOKEN_ENGLISH'];

const DAY_ABBR = { Mon:'Mo',Tue:'Tu',Wed:'We',Thu:'Th',Fri:'Fr',Sat:'Sa',Sun:'Su' };

function parseDays(str) {
  if (!str) return [];
  return str.split(',').map(d => DAY_ABBR[d.trim()] || d.trim());
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
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
  const [expandedBatch, setExpandedBatch] = useState(null); // batch id that is open

  const coursesRef   = useRef(null);
  const scheduleRef  = useRef(null);
  const batchesRef   = useRef(null);

  useEffect(() => {
    if (user) navigate(`/${tenantSlug}/student`, { replace: true });
  }, [user]);

  useEffect(() => {
    fetch(`/api/tenant/${tenantSlug}`).then(r => r.ok ? r.json() : null).then(t => { if (t) setTenant(t); }).catch(() => {});
    fetch(`/api/public/${tenantSlug}/courses`).then(r => r.json()).then(setCourses).catch(() => {});
    fetch(`/api/public/${tenantSlug}/batches`).then(r => r.json()).then(setBatches).catch(() => {});
    fetch(`/api/public/${tenantSlug}/live-classes`).then(r => r.json()).then(setLiveClasses).catch(() => {});
    fetch(`/api/login-banners?role=student`).then(r => r.ok ? r.json() : []).then(setBanners).catch(() => {});
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

  const isDark = (() => {
    try {
      const c = brandColor.replace('#','');
      const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
      return (r*0.299 + g*0.587 + b*0.114) < 140;
    } catch { return true; }
  })();
  const onBrand = isDark ? '#ffffff' : '#1a1a2e';

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#f1f5f9' }}>

      {/* ── STICKY NAV ────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-xl' : ''}`}
        style={{ background: scrolled ? brandColor : 'transparent' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
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
            <span className="font-black text-base text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {agencyName}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            {[['Courses', coursesRef], ['Batches', batchesRef], ['Schedule', scheduleRef]].map(([lbl, ref]) => (
              <button key={lbl} onClick={() => scrollTo(ref)}
                className="text-sm font-semibold text-white/80 hover:text-white transition-colors" style={{ textShadow:'0 1px 3px rgba(0,0,0,0.3)' }}>
                {lbl}
              </button>
            ))}
          </div>
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

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 pb-8 overflow-hidden"
        style={{ background: `linear-gradient(150deg, ${brandColor} 0%, ${brandColor}ee 50%, ${brandColor}cc 100%)` }}>

        {/* BG mesh pattern */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
          <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
          {/* Grid dots */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full relative">
          <div className="grid lg:grid-cols-2 gap-10 items-center">

            {/* ── LEFT: Copy ───────────────────────────────────────── */}
            <div className="relative z-10">
              {/* Agency logo + name */}
              <div className="flex items-center gap-3 mb-8">
                <div style={{ border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px', display:'inline-block' }}>
                  <LogoDisplay
                    logoUrl={logoUrl}
                    fit={tenant?.logo_fit || 'contain'}
                    bg={logoUrl ? (tenant?.logo_bg || 'white') : 'transparent'}
                    padding={tenant?.logo_padding != null ? Number(tenant.logo_padding) : 8}
                    brandColor={brandColor}
                    initials={logoText}
                    shape={tenant?.logo_shape || 'rounded'}
                    size={56}
                  />
                </div>
                <div>
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Official Academy</p>
                  <p className="text-white font-black text-lg leading-tight">{agencyName}</p>
                </div>
              </div>

              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.2)' }}>
                🏆 Trusted by 10,000+ Students Worldwide
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black text-white leading-[1.08] mb-5"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.2)' }}>
                Ace Your<br />
                <span style={{ color: '#fde68a' }}>IELTS · PTE · TOEFL</span><br />
                & Language Exams
              </h1>
              <p className="text-white/75 text-base sm:text-lg mb-6 leading-relaxed max-w-md">
                Live expert coaching, full mock tests, and personalised study plans — everything you need to hit your target score.
              </p>

              {/* Exam chips */}
              <div className="flex flex-wrap gap-2 mb-8">
                {EXAM_CATS.map(cat => (
                  <button key={cat}
                    onClick={() => { setCatFilter(cat); scrollTo(coursesRef); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
                    <span>{CAT_ICONS[cat]}</span>
                    <span>{cat === 'SPOKEN_ENGLISH' ? 'Spoken English' : cat}</span>
                  </button>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <button onClick={() => openEnroll(null)}
                  className="px-7 py-3.5 rounded-xl font-black text-base shadow-2xl hover:shadow-3xl hover:-translate-y-0.5 transition-all"
                  style={{ background: 'white', color: brandColor }}>
                  🚀 Start Free Today
                </button>
                <button onClick={() => scrollTo(coursesRef)}
                  className="px-7 py-3.5 rounded-xl font-bold text-base border-2 border-white/30 text-white hover:bg-white/10 transition-all">
                  Explore Courses →
                </button>
              </div>
            </div>

            {/* ── RIGHT: Floating Achievement Cards ────────────────── */}
            <div className="relative hidden lg:flex items-center justify-center h-[500px]">
              {/* IELTS Score Card */}
              <div className="absolute top-4 right-10 w-56 rounded-2xl p-5 shadow-2xl bg-white hero-float-1">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: CAT_GRAD.IELTS }}>🇬🇧</div>
                  <div>
                    <p className="text-[11px] text-slate-400 font-semibold">IELTS Academic</p>
                    <p className="text-sm font-black text-slate-800">Overall Band</p>
                  </div>
                </div>
                <div className="text-5xl font-black mb-1" style={{ color: CAT_COLORS.IELTS }}>8.0</div>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {[['L','8.0'],['R','8.0'],['W','7.5'],['S','8.5']].map(([m,s]) => (
                    <div key={m} className="text-center rounded-lg py-1" style={{ background: CAT_COLORS.IELTS + '12' }}>
                      <div className="text-[9px] font-black" style={{ color: CAT_COLORS.IELTS }}>{m}</div>
                      <div className="text-[11px] font-black text-slate-700">{s}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-[10px] text-slate-400 font-semibold">Score achieved by our student</span>
                </div>
              </div>

              {/* PTE Score Card */}
              <div className="absolute top-36 left-2 w-44 rounded-2xl p-4 shadow-2xl bg-white hero-float-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2"
                  style={{ background: CAT_GRAD.PTE }}>🎓</div>
                <p className="text-[11px] text-slate-400 font-semibold">PTE Academic</p>
                <div className="text-4xl font-black my-1" style={{ color: CAT_COLORS.PTE }}>90</div>
                <div className="text-xs text-slate-500 font-semibold">Overall Score</div>
                <div className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                  style={{ background: CAT_COLORS.PTE + '15', color: CAT_COLORS.PTE }}>Target: 79+</div>
              </div>

              {/* TOEFL Card */}
              <div className="absolute bottom-28 right-6 w-44 rounded-2xl p-4 shadow-2xl bg-white hero-float-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-2"
                  style={{ background: CAT_GRAD.TOEFL }}>🌐</div>
                <p className="text-[11px] text-slate-400 font-semibold">TOEFL iBT</p>
                <div className="text-4xl font-black my-1" style={{ color: CAT_COLORS.TOEFL }}>110</div>
                <div className="text-xs text-slate-500 font-semibold">iBT Score</div>
                <div className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                  style={{ background: CAT_COLORS.TOEFL + '15', color: CAT_COLORS.TOEFL }}>Target: 100+</div>
              </div>

              {/* Student milestone card */}
              <div className="absolute bottom-6 left-6 w-48 rounded-2xl p-4 shadow-2xl bg-white hero-float-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl bg-amber-50">🏆</div>
                  <div>
                    <div className="text-xl font-black text-slate-900">10,000+</div>
                    <div className="text-[11px] text-slate-400 font-semibold">Students Trained</div>
                  </div>
                </div>
                <div className="mt-2 flex -space-x-2">
                  {['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6'].map((c,i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: c }}>
                      {String.fromCharCode(65+i)}
                    </div>
                  ))}
                  <div className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black bg-slate-100 text-slate-500">+99k</div>
                </div>
              </div>

              {/* German / French mini badge */}
              <div className="absolute top-8 left-16 rounded-2xl px-4 py-3 shadow-xl bg-white hero-float-5 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: CAT_GRAD.GERMAN }}>🇩🇪</div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">German</p>
                  <p className="text-sm font-black text-slate-800">B2 Level</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── STATS STRIP ───────────────────────────────────────── */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map(({ v, l }) => (
              <div key={l} className="rounded-2xl px-5 py-4 text-center"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}>
                <div className="text-2xl sm:text-3xl font-black text-white">{v}</div>
                <div className="text-xs text-white/60 font-semibold mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/30 animate-bounce text-xl">↓</div>
      </section>

      {/* ── BANNERS ────────────────────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 -mt-6 relative z-10">
          <BannerStrip banners={banners} brandColor={brandColor} />
        </section>
      )}

      {/* ── EXAM CATEGORIES STRIP ─────────────────────────────────── */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">We Prepare You For</h2>
            <p className="text-slate-400 text-sm mt-2">Click any exam to see related courses</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {EXAM_CATS.map(cat => (
              <button key={cat}
                onClick={() => { setCatFilter(cat); scrollTo(coursesRef); }}
                className="group rounded-2xl p-4 text-center text-white hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 relative overflow-hidden shadow-md"
                style={{ background: CAT_GRAD[cat] }}>
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
                <div className="text-3xl mb-2 relative">{CAT_ICONS[cat]}</div>
                <div className="text-xs font-black relative">{cat === 'SPOKEN_ENGLISH' ? 'Spoken' : cat}</div>
                <div className="text-[10px] mt-1 opacity-75 relative leading-tight">
                  {CAT_TARGET[cat].replace('Target: ', '')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES ───────────────────────────────────────────────── */}
      <section ref={coursesRef} className="py-20 px-4 scroll-mt-16"
        style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #ffffff 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: brandColor + '15', color: brandColor }}>Our Courses</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">Choose Your Path to Success</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto">Expert preparation for every major exam and language goal.</p>
          </div>

          {/* Category filter pills */}
          {categories.length > 2 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${catFilter === cat
                    ? 'text-white border-transparent shadow-md scale-105'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400 bg-white'}`}
                  style={catFilter === cat ? { background: cat === 'ALL' ? brandColor : (CAT_COLORS[cat] || brandColor) } : {}}>
                  {cat !== 'ALL' && (CAT_ICONS[cat] || '📚')} {cat === 'ALL' ? 'All Courses' : cat}
                </button>
              ))}
            </div>
          )}

          {/* Course grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.length === 0 && (
              <div className="col-span-3 text-center py-20 text-slate-400">
                <div className="text-5xl mb-4">📚</div>
                <p className="font-bold text-lg text-slate-500">Courses coming soon!</p>
                <p className="text-sm mt-1">Check back shortly or sign up to be notified.</p>
                <button onClick={() => openEnroll(null)}
                  className="mt-5 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: brandColor }}>
                  Notify Me →
                </button>
              </div>
            )}
            {filteredCourses.map(course => {
              const grad = CAT_GRAD[course.category] || CAT_GRAD.OTHER;
              const col  = CAT_COLORS[course.category] || brandColor;
              const mods = CAT_MODULES[course.category] || [];
              return (
                <div key={course.id}
                  className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col border border-white">
                  {/* Full-gradient header */}
                  <div className="px-5 pt-5 pb-6 text-white relative overflow-hidden" style={{ background: grad }}>
                    {/* Decorative circles */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/5" />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-3xl mb-2">{CAT_ICONS[course.category] || '📚'}</div>
                          <div className="text-[11px] font-bold opacity-70 uppercase tracking-wide mb-0.5">{course.category}</div>
                          <h3 className="font-black text-base leading-snug pr-2">{course.title}</h3>
                        </div>
                        {CAT_TARGET[course.category] && (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl flex-shrink-0 mt-1"
                            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                            {CAT_TARGET[course.category]}
                          </span>
                        )}
                      </div>
                      {/* Module chips */}
                      {mods.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {mods.map(m => (
                            <span key={m} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Card body */}
                  <div className="p-5 flex flex-col flex-1">
                    {course.description && (
                      <p className="text-xs text-slate-500 leading-relaxed flex-1 line-clamp-3 mb-4">{course.description}</p>
                    )}
                    {!course.description && <div className="flex-1" />}
                    <div className="flex items-end justify-between pt-3 border-t border-slate-100">
                      <div>
                        <div className="text-2xl font-black text-slate-900">{fmt(course.price)}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          {course.duration_weeks ? `${course.duration_weeks}-week course` : 'full course fee'}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 items-end">
                        <button onClick={() => openEnroll(course)}
                          className="px-4 py-2 rounded-xl text-xs font-black text-white hover:opacity-90 hover:shadow-md transition-all"
                          style={{ background: col }}>
                          Enroll Now →
                        </button>
                        <button onClick={() => openDetail(course.id)}
                          className="text-[11px] font-semibold hover:underline"
                          style={{ color: col }}>
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ACTIVE BATCHES ────────────────────────────────────────── */}
      <section ref={batchesRef} className="py-20 px-4 scroll-mt-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: brandColor + '15', color: brandColor }}>Running Batches</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">Join an Active Batch</h2>
            <p className="text-slate-500 mt-3">Live, structured programs with expert faculty and cohort learning.</p>
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-16 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="text-5xl mb-4">📅</div>
              <p className="font-black text-slate-700 text-lg mb-2">Batches Starting Soon</p>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">New live batch programs are being scheduled. Sign up to get notified when enrollment opens.</p>
              <button onClick={() => navigate(`/${tenantSlug}/login`)}
                className="mt-6 px-6 py-2.5 rounded-xl text-white text-sm font-black shadow hover:opacity-90 transition"
                style={{ background: brandColor }}>
                🔔 Get Notified →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
              {batches.map((b, idx) => {
                const col = CAT_COLORS[b.category] || brandColor;
                const grad = CAT_GRAD[b.category] || `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`;
                const enrolledSeats = parseInt(b.enrolled) || 0;
                const isOpen = expandedBatch === b.id;
                const seatPct = b.max_students > 0 ? Math.min(100, Math.round(enrolledSeats / b.max_students * 100)) : 0;
                const timeStr = b.class_time ? b.class_time.slice(0,5) : '—';
                const endTime = (() => {
                  if (!b.class_time || !b.duration_minutes) return '';
                  const [h, m] = b.class_time.split(':').map(Number);
                  const totalM = h * 60 + m + parseInt(b.duration_minutes);
                  return ` – ${String(Math.floor(totalM/60)).padStart(2,'0')}:${String(totalM%60).padStart(2,'0')}`;
                })();
                const days = parseDays(b.schedule_days).join(' · ') || 'Daily';

                return (
                  <div key={b.id} className="bg-white">

                    {/* ── COLLAPSED ROW (always visible) ── */}
                    <button
                      onClick={() => setExpandedBatch(isOpen ? null : b.id)}
                      className="w-full flex items-center gap-0 text-left hover:bg-slate-50 transition-colors group focus:outline-none"
                    >
                      {/* Left colour strip */}
                      <div className="w-1 self-stretch flex-shrink-0 rounded-l-sm" style={{ background: grad }} />

                      <div className="flex-1 flex items-center gap-3 px-4 py-4 min-w-0">
                        {/* Category icon circle */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
                          style={{ background: col + '18' }}>
                          {CAT_ICONS[b.category] || '📚'}
                        </div>

                        {/* Name + course */}
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-slate-900 text-sm leading-tight truncate">{b.name}</div>
                          <div className="text-[11px] text-slate-400 font-medium truncate">{b.course_title}</div>
                        </div>

                        {/* Meta pills — hidden on mobile */}
                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                            ⏰ {timeStr}{endTime}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                            📆 {days}
                          </span>
                          {b.max_students > 0 && (
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                              style={{ background: col + '12', color: col }}>
                              👥 {enrolledSeats}/{b.max_students}
                            </span>
                          )}
                        </div>

                        {/* Live badge + price */}
                        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>Live
                          </span>
                          {b.course_price > 0 && (
                            <span className="text-sm font-black text-slate-800">{fmt(b.course_price)}</span>
                          )}
                        </div>

                        {/* Chevron */}
                        <div className="flex-shrink-0 ml-1 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                          style={{ background: isOpen ? col + '18' : '#f1f5f9' }}>
                          <svg className="w-3.5 h-3.5 transition-transform duration-300" style={{ color: isOpen ? col : '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </div>
                    </button>

                    {/* ── EXPANDED DETAIL PANEL ── */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1" style={{ borderTop: `1px solid ${col}20`, background: col + '04' }}>
                        {/* Description */}
                        {b.description && (
                          <p className="text-xs text-slate-500 mb-4 leading-relaxed">{b.description}</p>
                        )}

                        {/* Detail grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          {[
                            ['🗓 Dates',    `${fmtDate(b.start_date)}${b.end_date ? ' → '+fmtDate(b.end_date) : ''}`],
                            ['⏰ Timings',  `${timeStr}${endTime} (${b.duration_minutes || 60} min)`],
                            ['📆 Schedule', days],
                            b.trainer_name && ['👨‍🏫 Trainer', b.trainer_name],
                            b.max_students && ['👥 Seats',   `${enrolledSeats} enrolled · ${b.max_students - enrolledSeats} left`],
                            b.course_price > 0 && ['💰 Fee',  fmt(b.course_price)],
                          ].filter(Boolean).map(([label, val]) => (
                            <div key={label} className="bg-white rounded-xl px-3 py-2.5 border border-slate-100 shadow-sm">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
                              <div className="text-xs font-bold text-slate-800 leading-snug">{val}</div>
                            </div>
                          ))}
                        </div>

                        {/* Seat bar */}
                        {b.max_students > 0 && (
                          <div className="mb-4">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                              <span>Seats filling fast</span>
                              <span>{seatPct}% filled</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${seatPct}%`, background: grad }} />
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => openDetail(b.course_id)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black border-2 transition-all hover:shadow-sm"
                            style={{ borderColor: col, color: col, background: col + '08' }}>
                            📖 Course Details
                          </button>
                          <button
                            onClick={() => openEnroll({ title: b.name })}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-white hover:opacity-90 hover:shadow-md transition-all"
                            style={{ background: grad }}>
                            ✅ Join This Batch →
                          </button>
                          <span className="text-[11px] text-slate-400 ml-auto hidden sm:block">
                            Starts {fmtDate(b.start_date)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── UPCOMING LIVE CLASSES ──────────────────────────────────── */}
      {liveClasses.length > 0 && (
        <section ref={scheduleRef} className="py-20 px-4 scroll-mt-16"
          style={{ background: '#f8fafc' }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
                style={{ background: brandColor + '15', color: brandColor }}>Class Schedule</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">Upcoming Live Classes</h2>
              <p className="text-slate-500 mt-3">Preview classes open to all — enroll to join as a full member.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
              {liveClasses.map((lc, i) => {
                const col = CAT_COLORS[lc.category] || brandColor;
                return (
                  <div key={lc.id}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${i < liveClasses.length-1 ? 'border-b border-slate-100' : ''}`}>
                    {/* Date pill */}
                    <div className="flex-shrink-0 text-center w-14 rounded-xl py-2.5"
                      style={{ background: col + '12' }}>
                      <div className="text-[10px] font-black uppercase" style={{ color: col }}>
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
                          style={{ background: col+'15', color: col }}>
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
                );
              })}
            </div>
            <div className="text-center mt-6">
              <button onClick={() => openEnroll(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 hover:shadow-lg transition-all"
                style={{ background: brandColor }}>
                Enroll to Join All Classes →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── WHY CHOOSE US ──────────────────────────────────────────── */}
      <section className="py-20 px-4 relative overflow-hidden"
        style={{ background: `linear-gradient(150deg, ${brandColor}f8 0%, ${brandColor}e0 50%, ${brandColor}f8 100%)` }}>
        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid2" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid2)" />
          </svg>
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)' }}>Why Students Love Us</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">Everything You Need to Succeed</h2>
            <p className="text-white/60 mt-3">From first lesson to exam day — we've got you covered.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i}
                className="group rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 cursor-default"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {f.icon}
                </div>
                <h3 className="font-black text-white text-base mb-2">{f.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white text-center relative overflow-hidden">
        {/* Subtle bg */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${brandColor}10 0%, transparent 70%)` }} />
        <div className="max-w-2xl mx-auto relative">
          <div className="mx-auto mb-6 shadow-lg inline-flex rounded-2xl overflow-hidden border-2"
            style={{ borderColor: brandColor + '30' }}>
            <LogoDisplay
              logoUrl={logoUrl}
              fit={tenant?.logo_fit || 'contain'}
              bg={tenant?.logo_bg || 'white'}
              padding={tenant?.logo_padding != null ? Number(tenant.logo_padding) : 8}
              brandColor={brandColor}
              initials={logoText}
              shape={tenant?.logo_shape || 'rounded'}
              size={72}
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
            style={{ background: brandColor + '12', color: brandColor }}>
            🎓 Join {agencyName} Today
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 leading-tight">
            Ready to Achieve Your<br />Dream Score?
          </h2>
          <p className="text-slate-500 mb-8 text-base leading-relaxed">
            Join thousands of students already learning with {agencyName}.<br />
            Sign up free — no credit card required.
          </p>
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
          {/* Social proof */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <div className="flex -space-x-2">
              {['#3b82f6','#10b981','#f59e0b','#ec4899'].map((c,i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white"
                  style={{ background: c }}>
                  {String.fromCharCode(65+i)}
                </div>
              ))}
            </div>
            <span>Join <strong className="text-slate-600">10,000+</strong> students already enrolled</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="py-8 px-4 border-t border-slate-100 bg-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center font-black text-[10px]"
              style={{ background: brandColor, color: onBrand }}>
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : logoText}
            </div>
            <span className="font-semibold text-slate-600">{agencyName}</span>
            {tenant?.city && <span>· {tenant.city}</span>}
          </div>
          <div className="flex items-center gap-4">
            {tenant?.email && <a href={`mailto:${tenant.email}`} className="hover:text-slate-600 transition-colors">{tenant.email}</a>}
            {tenant?.phone && <a href={`tel:${tenant.phone}`} className="hover:text-slate-600 transition-colors">{tenant.phone}</a>}
          </div>
          <span>Powered by <strong className="text-slate-500">TestPrep Platform</strong></span>
        </div>
      </footer>

      {/* ── AUTH MODAL ────────────────────────────────────────────── */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        tenantSlug={tenantSlug}
        agencyName={agencyName}
        brandColor={brandColor}
        defaultMode={authMode}
        prefilledCourse={selectedCourse}
      />

      {/* ── COURSE DETAIL MODAL ───────────────────────────────────── */}
      <CourseDetailModal
        courseId={detailCourseId}
        open={!!detailCourseId}
        onClose={() => setDetailCourseId(null)}
        accent={brandColor}
        onAuthRequired={handleAuthRequired}
      />

      {/* ── Animations ────────────────────────────────────────────── */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFloat1 {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%     { transform: translateY(-10px) rotate(0.5deg); }
        }
        @keyframes heroFloat2 {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%     { transform: translateY(-14px) rotate(-0.5deg); }
        }
        @keyframes heroFloat3 {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%     { transform: translateY(-8px) rotate(0.3deg); }
        }
        @keyframes heroFloat4 {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-12px); }
        }
        @keyframes heroFloat5 {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%     { transform: translateY(-6px) rotate(-0.3deg); }
        }
        .hero-float-1 { animation: heroFloat1 5s ease-in-out infinite; }
        .hero-float-2 { animation: heroFloat2 6s ease-in-out infinite 0.8s; }
        .hero-float-3 { animation: heroFloat3 4.5s ease-in-out infinite 1.2s; }
        .hero-float-4 { animation: heroFloat4 5.5s ease-in-out infinite 0.4s; }
        .hero-float-5 { animation: heroFloat5 4s ease-in-out infinite 1.8s; }
      `}</style>
    </div>
  );
}
