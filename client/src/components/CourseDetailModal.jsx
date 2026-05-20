import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const CAT_COLORS = {
  IELTS: '#3b82f6', PTE: '#10b981', TOEFL: '#8b5cf6',
  GERMAN: '#f59e0b', FRENCH: '#ec4899', SPOKEN_ENGLISH: '#06b6d4', OTHER: '#64748b',
};
const CAT_ICONS = {
  IELTS: '🎓', PTE: '📝', TOEFL: '🏆', GERMAN: '🇩🇪',
  FRENCH: '🇫🇷', SPOKEN_ENGLISH: '🗣️', OTHER: '📚',
};

// What's included per category for live class courses
const CAT_INCLUDES = {
  IELTS: [
    { icon: '📺', text: 'Live interactive classes (Mon–Fri)' },
    { icon: '📝', text: 'Listening, Reading, Writing & Speaking modules' },
    { icon: '🏆', text: 'Full IELTS mock tests with band prediction' },
    { icon: '📊', text: 'Weekly progress reports & weak-area feedback' },
    { icon: '👨‍🏫', text: 'Expert certified trainers' },
    { icon: '🎥', text: 'Class recordings for revision' },
  ],
  PTE: [
    { icon: '📺', text: 'Live interactive PTE classes' },
    { icon: '📝', text: 'Speaking, Writing, Reading & Listening prep' },
    { icon: '🏆', text: 'Full PTE mock tests with score prediction' },
    { icon: '📊', text: 'Section-wise score tracking' },
    { icon: '🤖', text: 'AI-based pronunciation feedback' },
    { icon: '🎥', text: 'Class recordings for revision' },
  ],
  GERMAN: [
    { icon: '📺', text: 'Live German classes with native-level trainers' },
    { icon: '📝', text: 'Grammar, Vocabulary, Reading & Speaking' },
    { icon: '🏆', text: 'Mock tests aligned to Goethe / TestDaF pattern' },
    { icon: '📊', text: 'Level progression tracking (A1 → B2)' },
    { icon: '🇩🇪', text: 'Exam certification guidance' },
    { icon: '🎥', text: 'Class recordings for revision' },
  ],
  FRENCH: [
    { icon: '📺', text: 'Live French classes with expert trainers' },
    { icon: '📝', text: 'Grammaire, Vocabulaire, Expression & Compréhension' },
    { icon: '🏆', text: 'DELF / DALF pattern mock tests' },
    { icon: '📊', text: 'Level-wise progress tracking' },
    { icon: '🇫🇷', text: 'Exam strategy & certification guidance' },
    { icon: '🎥', text: 'Class recordings for revision' },
  ],
  TOEFL: [
    { icon: '📺', text: 'Live interactive TOEFL classes' },
    { icon: '📝', text: 'Reading, Listening, Speaking & Writing modules' },
    { icon: '🏆', text: 'Full iBT mock tests with score prediction' },
    { icon: '📊', text: 'Performance analytics per section' },
    { icon: '👨‍🏫', text: 'Expert certified trainers' },
    { icon: '🎥', text: 'Class recordings for revision' },
  ],
  SPOKEN_ENGLISH: [
    { icon: '📺', text: 'Daily live spoken English practice sessions' },
    { icon: '🗣️', text: 'Pronunciation, fluency & confidence building' },
    { icon: '📝', text: 'Grammar corrections & vocabulary building' },
    { icon: '🎯', text: 'Real-life conversation scenarios' },
    { icon: '📊', text: 'Weekly fluency assessment' },
    { icon: '🎥', text: 'Session recordings for self-review' },
  ],
  OTHER: [
    { icon: '📺', text: 'Live interactive classes with expert faculty' },
    { icon: '📝', text: 'Comprehensive study material' },
    { icon: '🏆', text: 'Mock tests & assessments' },
    { icon: '📊', text: 'Progress tracking & feedback' },
    { icon: '👨‍🏫', text: 'Certified trainers' },
    { icon: '🎥', text: 'Class recordings for revision' },
  ],
};

const DAY_ABBR = { Mon:'Mo',Tue:'Tu',Wed:'We',Thu:'Th',Fri:'Fr',Sat:'Sa',Sun:'Su' };
function parseDays(str) {
  if (!str) return [];
  return str.split(',').map(d => (DAY_ABBR[d.trim()] || d.trim()));
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
}

// ── Purchase Button (shows for logged-in students) ────────────────────────────
function PurchaseBtn({ label, price, onClick, loading, done, accent, small }) {
  const base = small
    ? 'text-xs px-3 py-1.5 rounded-lg font-bold transition-all'
    : 'text-sm px-4 py-2 rounded-xl font-bold transition-all';
  if (done) return <span className={`${base} bg-emerald-50 text-emerald-700 border border-emerald-200`}>✅ Purchased</span>;
  return (
    <button onClick={onClick} disabled={loading}
      className={`${base} text-white hover:opacity-90 hover:shadow-md disabled:opacity-50`}
      style={{ background: accent }}>
      {loading ? '…' : `${label} · ${fmt(price)}`}
    </button>
  );
}

export default function CourseDetailModal({
  courseId,
  open,
  onClose,
  accent = '#1e40af',
  tenantSlug,
  // If not logged in, caller provides these to show auth prompt
  onAuthRequired,
  // If logged in student
  onEnrolled,
}) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [curriculum, setCurriculum]   = useState(null);
  const [batches, setBatches]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [openModules, setOpenModules] = useState({});
  const [purchasing, setPurchasing]   = useState({});
  const [purchased, setPurchased]     = useState({ enrollments: [], modulePurchases: [], lecturePurchases: [] });
  const [msg, setMsg]                 = useState('');

  useEffect(() => {
    if (!open || !courseId) return;
    setLoading(true); setMsg(''); setBatches([]);
    fetch(`/api/courses/${courseId}/curriculum`)
      .then(r => r.json()).then(data => {
        setCurriculum(data);
        // Open first module by default
        if (data.modules?.length) setOpenModules({ [data.modules[0].id]: true });
        setLoading(false);
      }).catch(() => setLoading(false));

    // Fetch batches for this course (from public API)
    const slug = tenantSlug || window.location.pathname.split('/')[1] || '';
    if (slug) {
      fetch(`/api/public/${slug}/batches`)
        .then(r => r.json())
        .then(all => setBatches((all || []).filter(b => String(b.course_id) === String(courseId))))
        .catch(() => {});
    }

    // Load student purchases if logged in
    if (isStudent) {
      api.get('/student/my-purchases').then(d => setPurchased({
        enrollments: [], // will be merged from parent
        modulePurchases: d.modulePurchases || [],
        lecturePurchases: d.lecturePurchases || [],
      })).catch(() => {});
    }
  }, [open, courseId, isStudent]);

  // Load enrollment status
  useEffect(() => {
    if (!isStudent || !open) return;
    api.get('/student/dashboard').then(d => {
      setPurchased(prev => ({ ...prev, enrollments: d.enrollments || [] }));
    }).catch(() => {});
  }, [open, isStudent]);

  if (!open) return null;

  const toggleModule = (id) => setOpenModules(p => ({ ...p, [id]: !p[id] }));

  const isEnrolled = (cid) => purchased.enrollments.some(e => e.course_id === cid && e.status === 'active');
  const hasMod = (mid) => purchased.modulePurchases.some(p => p.module_id === mid);
  const hasLec = (lid) => purchased.lecturePurchases.some(p => p.lecture_id === lid);

  const doPurchase = async (type, id, price) => {
    if (!isStudent) { onAuthRequired?.(); return; }
    if (price === 0 || price === null) { return; }
    const key = `${type}_${id}`;
    setPurchasing(p => ({ ...p, [key]: true }));
    setMsg('');
    try {
      let res;
      if (type === 'course') res = await api.post('/student/purchase', { course_id: id });
      else if (type === 'module') res = await api.post('/student/purchase-module', { module_id: id });
      else res = await api.post('/student/purchase-lecture', { lecture_id: id });
      setMsg(`✅ ${res.message || 'Purchase requested!'}`);
      // Refresh purchases
      const d = await api.get('/student/my-purchases');
      setPurchased(prev => ({ ...prev, modulePurchases: d.modulePurchases, lecturePurchases: d.lecturePurchases }));
      if (type === 'course') onEnrolled?.();
    } catch (e) { setMsg(`❌ ${e.message}`); }
    finally { setPurchasing(p => ({ ...p, [key]: false })); }
  };

  const cat = curriculum?.category;
  const catColor = CAT_COLORS[cat] || accent;
  const enrolled = curriculum ? isEnrolled(curriculum.id) : false;

  return (
    <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        style={{ animation: 'slideUp 0.25s ease' }}>

        {/* ── Header ── */}
        <div className="relative flex-shrink-0 p-6 pb-4 text-white"
          style={{ background: `linear-gradient(135deg, ${catColor}e8, ${accent}dd)` }}>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm hover:bg-white/30">
            ✕
          </button>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-48 bg-white/20 rounded" />
              <div className="h-4 w-32 bg-white/10 rounded" />
            </div>
          ) : curriculum ? (
            <>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full mb-2 inline-block"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                {CAT_ICONS[cat] || '📚'} {cat}
              </span>
              <h2 className="text-xl font-black leading-tight pr-8">{curriculum.title}</h2>
              {curriculum.description && (
                <p className="text-sm text-white/75 mt-1.5 line-clamp-2">{curriculum.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {curriculum.duration_weeks && (
                  <span className="text-xs text-white/70">📅 {curriculum.duration_weeks} weeks</span>
                )}
                {curriculum.totalLectures > 0 && (
                  <span className="text-xs text-white/70">🎬 {curriculum.totalLectures} lectures</span>
                )}
                {curriculum.totalDuration > 0 && (
                  <span className="text-xs text-white/70">⏱ {fmtDuration(curriculum.totalDuration)} total</span>
                )}
              </div>
            </>
          ) : <p className="text-white/60">Course not found</p>}
        </div>

        {/* ── Price + Full Course Buy ── */}
        {curriculum && (
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap bg-slate-50">
            <div>
              <div className="text-2xl font-black text-slate-900">{fmt(curriculum.price)}</div>
              <div className="text-xs text-slate-400 font-semibold">Full course · all modules included</div>
            </div>
            <div className="flex items-center gap-2">
              {enrolled ? (
                <span className="text-sm font-black px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700">
                  ✅ Enrolled
                </span>
              ) : isStudent ? (
                <PurchaseBtn
                  label="Buy Full Course"
                  price={curriculum.price}
                  onClick={() => doPurchase('course', curriculum.id, curriculum.price)}
                  loading={purchasing[`course_${curriculum.id}`]}
                  done={enrolled}
                  accent={accent}
                />
              ) : (
                <button onClick={() => onAuthRequired?.('course', curriculum)}
                  className="px-5 py-2.5 rounded-xl text-sm font-black text-white hover:opacity-90 hover:shadow-md transition-all"
                  style={{ background: accent }}>
                  🚀 Enroll Now · {fmt(curriculum.price)}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Msg ── */}
        {msg && (
          <div className={`mx-6 mt-3 flex-shrink-0 p-3 rounded-xl text-sm font-semibold ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {msg}
          </div>
        )}

        {/* ── Curriculum ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {!curriculum && !loading && (
            <div className="text-center py-16 text-slate-400">No curriculum data found.</div>
          )}

          {curriculum?.modules?.length === 0 && (
            <div className="py-4 space-y-5">
              {/* What's Included */}
              <div>
                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{ background: accent }}>✓</span>
                  What's Included
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(CAT_INCLUDES[curriculum.category] || CAT_INCLUDES.OTHER).map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="text-xs font-medium text-slate-700 leading-snug">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Batches for this course */}
              {batches.length > 0 && (
                <div>
                  <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                    <span className="text-base">📅</span> Available Batches
                    <span className="text-xs font-normal text-slate-400 ml-1">({batches.length} active)</span>
                  </h3>
                  <div className="space-y-2">
                    {batches.map(b => {
                      const days = parseDays(b.schedule_days).join(' · ') || 'Mon–Fri';
                      const timeStr = (b.class_time || b.schedule_time || '').slice(0,5) || '—';
                      const durMins = parseInt(b.duration_minutes) || 0;
                      const endTime = (b.class_time || b.schedule_time) && durMins
                        ? (() => { const [h,m] = (b.class_time || b.schedule_time).split(':').map(Number); const t = h*60+m+durMins; return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; })()
                        : '';
                      return (
                        <div key={b.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-900 truncate">{b.name}</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {timeStr !== '—' && <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">⏰ {timeStr}{endTime ? ` – ${endTime}` : ''}</span>}
                              <span className="text-[11px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">📆 {days}</span>
                              {b.start_date && <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Starts {fmtDate(b.start_date)}</span>}
                              {b.max_students > 0 && <span className="text-[11px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full">👥 {b.enrolled || 0}/{b.max_students} seats</span>}
                            </div>
                          </div>
                          {b.trainer_name && <div className="text-xs text-slate-400 flex-shrink-0">👨‍🏫 {b.trainer_name}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Curriculum note */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-xs font-bold text-amber-700">Detailed Curriculum</p>
                  <p className="text-xs text-amber-600 mt-0.5">Session-wise study plan will be shared after enrollment.</p>
                </div>
              </div>
            </div>
          )}

          {curriculum?.modules?.map((mod, mi) => {
            const modOpen = openModules[mod.id];
            const modOwned = enrolled || hasMod(mod.id);
            return (
              <div key={mod.id} className="mt-3 rounded-2xl border border-slate-200 overflow-hidden">
                {/* Module header */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => toggleModule(mod.id)}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
                    style={{ background: accent }}>
                    {mi + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{mod.title}</span>
                      {mod.is_free_preview ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">FREE</span>
                      ) : modOwned ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">✓ Owned</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {mod.lectures?.length > 0 && (
                        <span className="text-[11px] text-slate-400">{mod.lectures.length} lectures</span>
                      )}
                      {mod.lectures?.length > 0 && (
                        <span className="text-[11px] text-slate-400">
                          {fmtDuration(mod.lectures.reduce((s, l) => s + (l.duration_minutes || 0), 0))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!modOwned && mod.price && !enrolled && (
                      isStudent ? (
                        <PurchaseBtn
                          label="Buy Module"
                          price={mod.price}
                          onClick={e => { e.stopPropagation(); doPurchase('module', mod.id, mod.price); }}
                          loading={purchasing[`module_${mod.id}`]}
                          done={modOwned}
                          accent={catColor}
                          small
                        />
                      ) : (
                        <button onClick={e => { e.stopPropagation(); onAuthRequired?.('module', mod, curriculum); }}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold text-white hover:opacity-90"
                          style={{ background: catColor }}>
                          {fmt(mod.price)}
                        </button>
                      )
                    )}
                    <span className="text-slate-400 text-sm">{modOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {modOpen && mod.description && (
                  <div className="px-4 pb-2 text-xs text-slate-500 border-t border-slate-100 pt-2 bg-slate-50/50">
                    {mod.description}
                  </div>
                )}

                {modOpen && mod.lectures?.map((lec, li) => {
                  const lecOwned = enrolled || modOwned || hasLec(lec.id) || lec.is_free_preview;
                  return (
                    <div key={lec.id}
                      className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                        lec.is_free_preview ? 'bg-emerald-100 text-emerald-600'
                          : lecOwned ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {lec.is_free_preview ? '▶' : lecOwned ? '▶' : '🔒'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-semibold ${lecOwned ? 'text-slate-900' : 'text-slate-500'}`}>
                            {mi + 1}.{li + 1} {lec.title}
                          </span>
                          {lec.is_free_preview && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">FREE PREVIEW</span>
                          )}
                        </div>
                        {lec.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{lec.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lec.duration_minutes > 0 && (
                          <span className="text-[11px] text-slate-400">{fmtDuration(lec.duration_minutes)}</span>
                        )}
                        {!lecOwned && lec.price && (
                          isStudent ? (
                            <PurchaseBtn
                              label="Buy"
                              price={lec.price}
                              onClick={() => doPurchase('lecture', lec.id, lec.price)}
                              loading={purchasing[`lecture_${lec.id}`]}
                              done={hasLec(lec.id)}
                              accent={catColor}
                              small
                            />
                          ) : (
                            <button onClick={() => onAuthRequired?.('lecture', lec, curriculum)}
                              className="text-[10px] px-2.5 py-1 rounded-lg font-bold text-white hover:opacity-90"
                              style={{ background: catColor }}>
                              {fmt(lec.price)}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}

                {modOpen && mod.lectures?.length === 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 italic">
                    No lectures added yet.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform: translateY(30px); }
          to   { opacity:1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
