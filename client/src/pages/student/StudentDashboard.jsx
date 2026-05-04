import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';
import StudentProgress from './StudentProgress';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const catIcons  = { IELTS:'📝', PTE:'🖥️', TOEFL:'🌐', GERMAN:'🇩🇪', FRENCH:'🇫🇷', SPOKEN_ENGLISH:'🗣️', OTHER:'📚' };
const catColors = { IELTS:'#3b82f6', PTE:'#10b981', TOEFL:'#8b5cf6', GERMAN:'#f59e0b', FRENCH:'#ef4444', SPOKEN_ENGLISH:'#06b6d4', OTHER:'#64748b' };

function Badge({ status }) {
  const map = { active:'badge-green', paid:'badge-green', pending:'badge-amber', on_hold:'badge-amber', completed:'badge-purple', cancelled:'badge-gray', full:'badge-green', demo:'badge-amber' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace('_',' ')}</span>;
}

// ── RAZORPAY LOADER ─────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── COURSE CATALOG ──────────────────────────────────────────
function CourseCatalog({ accent, user, onEnrolled }) {
  const [courses, setCourses]     = useState([]);
  const [enrollments, setEnrollments] = useState({}); // map: course_id → enrollment obj
  const [loading, setLoading]     = useState(true);
  const [buying, setBuying]       = useState(null); // course id being purchased
  const [coupon, setCoupon]       = useState('');
  const [msg, setMsg]             = useState('');
  const [filter, setFilter]       = useState('ALL');

  useEffect(() => {
    Promise.all([
      api.get('/catalog'),
      api.get('/student/dashboard'),
    ]).then(([cats, dash]) => {
      setCourses(cats);
      // Store full enrollment info per course_id, keyed by course_id
      // If a course has multiple enrollments, prefer paid over pending
      const map = {};
      (dash.enrollments || []).forEach(e => {
        const existing = map[e.course_id];
        if (!existing || e.payment_status === 'paid') map[e.course_id] = e;
      });
      setEnrollments(map);
    }).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (course) => {
    setBuying(course.id);
    setMsg('');
    try {
      const res = await api.post('/student/purchase', { course_id: course.id, coupon_code: coupon || undefined });

      if (res.gateway === 'razorpay') {
        const ok = await loadRazorpayScript();
        if (!ok) { setMsg('Could not load payment gateway. Try again.'); setBuying(null); return; }
        new window.Razorpay({
          key: res.key_id,
          amount: res.amount * 100,
          currency: 'INR',
          name: user?.agency_name || 'TestPrep Platform',
          description: res.course_title,
          order_id: res.order_id,
          handler: async (payment) => {
            try {
              await api.post('/student/verify-payment', {
                ...payment, course_id: course.id, amount: res.amount, discount: res.discount
              });
              setMsg(`✅ Payment successful! You are now enrolled in ${res.course_title}.`);
              setEnrollments(prev => ({ ...prev, [course.id]: { course_id: course.id, payment_status: 'paid' } }));
              onEnrolled?.();
            } catch (e) { setMsg('Payment verification failed: ' + e.message); }
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: accent },
        }).open();
      } else {
        setMsg(`✅ ${res.message}`);
        setEnrollments(prev => ({ ...prev, [course.id]: { course_id: course.id, payment_status: 'pending' } }));
        onEnrolled?.();
      }
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setBuying(null);
    }
  };

  const categories = ['ALL', ...new Set(courses.map(c => c.category))];
  const visible = filter === 'ALL' ? courses : courses.filter(c => c.category === filter);

  if (loading) return <div className="text-slate-400 text-sm">Loading courses...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900">Course Catalog 🎯</h2>
          <p className="text-xs text-slate-400 mt-0.5">Pick a course and start your journey</p>
        </div>
        <input
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': accent }}
          placeholder="🎟️ Coupon"
          value={coupon}
          onChange={e => setCoupon(e.target.value.toUpperCase())}
        />
      </div>

      {msg && (
        <div className={`mb-4 p-4 rounded-2xl text-sm font-semibold ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {msg}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${filter === cat ? 'text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            style={filter === cat ? { background: catColors[cat] || accent } : {}}>
            {catIcons[cat] || ''} {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map(course => {
          const enr = enrollments[course.id];
          const isPaid    = enr?.payment_status === 'paid';
          const isPending = enr && !isPaid;
          const color = catColors[course.category] || accent;
          const topColor = isPaid ? '#10b981' : isPending ? '#f59e0b' : color;
          return (
            <div key={course.id} className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all">
              {/* Gradient header */}
              <div className="h-24 flex items-end px-4 pb-3 relative"
                style={{ background: `linear-gradient(135deg, ${topColor}22 0%, ${topColor}08 100%)` }}>
                <div className="absolute top-3 right-3">
                  {isPaid && <span className="text-[10px] font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full">✅ Owned</span>}
                  {isPending && <span className="text-[10px] font-black bg-amber-500 text-white px-2.5 py-1 rounded-full">⏳ Pending</span>}
                </div>
                <div className="flex items-end gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm border-2 border-white bg-white">
                    {catIcons[course.category] || '📚'}
                  </div>
                  <div>
                    <div className="font-black text-slate-900 leading-tight">{course.title}</div>
                    <div className="text-xs text-slate-400">{course.duration_weeks}w · {course.category.replace('_',' ')}</div>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4 pt-2">
                {course.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{course.description}</p>
                )}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl font-black" style={{ color: topColor }}>{fmt(course.price)}</div>
                  {coupon && <div className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">🎟️ Coupon ready</div>}
                </div>
                {isPending ? (
                  <PayNowFromCard
                    enrollment={{ ...enr, course_title: course.title, fee_paid: course.price }}
                    accent={color}
                    onSuccess={() => setEnrollments(prev => ({ ...prev, [course.id]: { ...prev[course.id], payment_status: 'paid' } }))}
                    label="🔓 Complete Payment to Unlock"
                  />
                ) : isPaid ? (
                  <div className="space-y-2">
                    <div className="w-full py-2.5 rounded-2xl text-sm text-center font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✅ Purchased — learning unlocked
                    </div>
                    <button onClick={() => handlePurchase(course)} disabled={buying === course.id}
                      className="w-full py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 transition disabled:opacity-50">
                      {buying === course.id ? 'Processing...' : `🔄 Purchase Again`}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handlePurchase(course)} disabled={buying === course.id}
                    className="w-full py-3 text-white font-black rounded-2xl text-sm transition hover:opacity-90 disabled:opacity-50 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
                    {buying === course.id ? '⏳ Processing...' : `🚀 Enroll Now — ${fmt(course.price)}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 text-center py-14 text-slate-400">
          <div className="text-4xl mb-2">🔍</div>
          <p className="font-semibold">No courses in this category yet</p>
        </div>
      )}
    </div>
  );
}

// ── BATCH BROWSER ────────────────────────────────────────────
function BatchBrowser({ accent, user }) {
  const [batches, setBatches]   = useState([]);
  const [myBatches, setMyBatches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [joining, setJoining]   = useState(null);
  const [msg, setMsg]           = useState('');
  const [tab, setTab]           = useState('available'); // available | mine

  const load = useCallback(() => {
    Promise.all([
      api.get('/student/available-batches'),
      api.get('/student/my-batches'),
    ]).then(([avail, mine]) => {
      setBatches(avail);
      setMyBatches(mine);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (batchId) => {
    setJoining(batchId);
    setMsg('');
    try {
      const res = await api.post('/student/join-batch', { batch_id: batchId });
      setMsg('✅ ' + res.message);
      load();
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setJoining(null);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">Loading batches...</div>;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Batches & Class Booking</h2>

      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {msg}
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6 gap-1 w-fit">
        {[['available','Available Batches'],['mine','My Batches']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab===k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            {l} {k === 'mine' && myBatches.length > 0 && <span className="ml-1 bg-emerald-500 text-white text-xs rounded-full px-1.5 py-0.5">{myBatches.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'available' && (
        <div className="space-y-4">
          {batches.some(b => b.already_joined) && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold flex items-center gap-2 mb-2">
              ✅ Batches you've already joined are shown with a green badge — check "My Batches" tab to see them.
            </div>
          )}
          {batches.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-slate-500 font-semibold">No active batches available</p>
              <p className="text-sm text-slate-400 mt-1">Your academy hasn't scheduled any batches yet.</p>
            </div>
          ) : batches.map(b => {
            const color = catColors[b.category] || b.brand_color || accent;
            const isFull = b.enrolled_count >= b.max_students;
            return (
              <div key={b.id} className={`card relative overflow-hidden ${b.already_joined ? 'opacity-75' : ''}`}>
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: b.already_joined ? '#10b981' : color }} />
                {b.already_joined && (
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">✓ JOINED</div>
                )}
                <div className="flex items-start justify-between mt-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-lg">{catIcons[b.category] || '📚'}</span>
                      <h3 className="font-bold text-slate-900">{b.name}</h3>
                      {isFull && !b.already_joined && <span className="badge badge-gray text-xs">Full</span>}
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{b.course_title}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Schedule</div>
                        <div className="font-semibold">{b.schedule_days || 'Mon–Fri'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Time</div>
                        <div className="font-semibold">{b.class_time ? b.class_time.slice(0,5) : '—'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Duration</div>
                        <div className="font-semibold">{b.duration_minutes} min</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Starts</div>
                        <div className="font-semibold">{b.start_date?.split('T')[0] || '—'}</div>
                      </div>
                    </div>

                    {b.trainer_name && (
                      <div className="mt-2 text-xs text-slate-500">👨‍🏫 Trainer: <span className="font-semibold">{b.trainer_name}</span></div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                      <span>👥 {b.enrolled_count}/{b.max_students} students</span>
                      {b.upcoming_classes > 0 && <span>📅 {b.upcoming_classes} upcoming classes</span>}
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    {b.already_joined ? (
                      <div className="text-center text-xs text-emerald-600 font-bold px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">✓ Joined</div>
                    ) : (
                      <button
                        onClick={() => handleJoin(b.id)}
                        disabled={joining === b.id || isFull}
                        className="px-5 py-2.5 text-white font-bold rounded-xl text-sm transition hover:opacity-90 disabled:opacity-40"
                        style={{ background: isFull ? '#94a3b8' : color }}>
                        {joining === b.id ? 'Joining...' : isFull ? 'Full' : 'Join Batch'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'mine' && (
        <div className="space-y-4">
          {myBatches.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">🎓</p>
              <p className="text-slate-500 font-semibold">You haven't joined any batches yet</p>
              <p className="text-sm text-slate-400 mt-1">Browse available batches and join one to start attending live classes.</p>
            </div>
          ) : myBatches.map(b => {
            const color = catColors[b.category] || b.brand_color || accent;
            return (
              <div key={b.id} className="card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
                <div className="flex items-start justify-between mt-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{catIcons[b.category] || '📚'}</span>
                      <h3 className="font-bold text-slate-900">{b.batch_name}</h3>
                      <Badge status={b.access_type} />
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{b.course_title}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Schedule</div>
                        <div className="font-semibold">{b.schedule_days || 'Mon–Fri'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Time</div>
                        <div className="font-semibold">{b.class_time ? b.class_time.slice(0,5) : '—'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Duration</div>
                        <div className="font-semibold">{b.duration_minutes} min</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-slate-400 font-medium mb-0.5">Upcoming</div>
                        <div className="font-semibold">{b.upcoming_classes} classes</div>
                      </div>
                    </div>
                    {b.trainer_name && (
                      <div className="mt-2 text-xs text-slate-500">👨‍🏫 Trainer: <span className="font-semibold">{b.trainer_name}</span></div>
                    )}
                    {b.demo_expires_at && (
                      <p className="text-xs text-amber-600 mt-2 font-medium">⚠️ Demo expires: {new Date(b.demo_expires_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LIVE CLASSES ─────────────────────────────────────────────
function StudentLiveClasses({ accent }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myCoupons, setMyCoupons] = useState([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState({ text: '', ok: false });
  const navigate = useNavigate();

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/student/all-classes').catch(() => []),
      api.get('/student/my-coupons').catch(() => []),
    ]).then(([cls, coupons]) => {
      setClasses(cls);
      setMyCoupons(coupons);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const redeemCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const res = await api.post('/student/redeem-coupon', { code: couponInput.trim() });
      setCouponMsg({ text: res.message, ok: true });
      setCouponInput('');
      loadAll();
    } catch (e) {
      setCouponMsg({ text: e.message, ok: false });
    }
  };

  const parseDT = (s) => s ? new Date(s.slice(0, 19)) : new Date(0);
  // A class is "live" if: DB says live, OR started_at is set (admin clicked start), OR within 60 min of scheduled time
  const isLive = (c) => c.status === 'live' || !!c.started_at || Math.abs(new Date() - parseDT(c.scheduled_at)) / 60000 < 60;
  const canJoin = (c) => c.status === 'live' || !!c.started_at || (parseDT(c.scheduled_at) - new Date()) / 60000 <= 15;
  const demoMinutes = (c) => c.platform === 'zoom' ? 5 : 15;

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>;

  const enrolled = classes.filter(c => c.is_enrolled);
  const demo     = classes.filter(c => !c.is_enrolled);

  const ClassCard = ({ c }) => {
    const live    = isLive(c);
    const joinable = canJoin(c);
    const isDemo  = !c.is_enrolled;
    const mins    = demoMinutes(c);
    const minsLeft = Math.max(0, Math.ceil((parseDT(c.scheduled_at) - new Date()) / 60000));
    const hoursLeft = Math.ceil(minsLeft / 60);

    return (
      <div key={c.id} className={`rounded-2xl overflow-hidden relative ${
        isDemo && live
          ? 'border-2 border-red-400 shadow-lg shadow-red-100'
          : isDemo
          ? 'border-2 border-amber-300 shadow-sm'
          : live
          ? 'border-2 border-green-400 shadow-lg shadow-green-100'
          : 'border border-slate-200 shadow-sm'
      } bg-white`}>

        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${
          live && !isDemo ? 'bg-green-500 animate-pulse'
          : live && isDemo ? 'bg-red-500 animate-pulse'
          : isDemo ? 'bg-amber-400'
          : 'bg-slate-200'
        }`} />

        {/* LIVE + DEMO banner — full width, very prominent */}
        {live && isDemo && (
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping inline-block" />
              <span className="text-white font-black text-sm tracking-wide">🔴 LIVE NOW</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/40">
                🎁 FREE {mins}-MIN DEMO · NOT ENROLLED
              </span>
            </div>
          </div>
        )}
        {live && !isDemo && (
          <div className="flex items-center justify-between px-4 py-2"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping inline-block" />
              <span className="text-white font-black text-sm tracking-wide">🟢 CLASS IS LIVE</span>
            </div>
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">✅ You're Enrolled</span>
          </div>
        )}
        {!live && isDemo && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-100">
            <span className="text-amber-700 text-xs font-black">🎁 FREE {mins}-MIN DEMO AVAILABLE · NOT ENROLLED</span>
            <span className="text-amber-500 text-xs font-semibold">
              {minsLeft <= 60 ? `Starts in ${minsLeft}m` : `Starts in ${hoursLeft}h`}
            </span>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-base mb-1 truncate">{c.title}</h3>
              {c.description && <p className="text-sm text-slate-500 mb-2 line-clamp-1">{c.description}</p>}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
                <span>📅 {parseDT(c.scheduled_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
                <span>🕐 {parseDT(c.scheduled_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
                  <span className="ml-1 font-medium text-blue-500">
                    {c.timezone === 'Asia/Kolkata' || !c.timezone ? 'IST' : c.timezone.split('/')[1]?.replace('_',' ')}
                  </span>
                </span>
                <span>⏱️ {c.duration_minutes} min</span>
                {c.agency_name && <span>🏫 {c.agency_name}</span>}
                {c.batch_name  && <span>🎓 {c.batch_name}</span>}
              </div>

              {/* Demo enroll CTA below info */}
              {isDemo && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">
                    {c.course_title} · <span className="font-bold text-slate-700">₹{Number(c.course_price||0).toLocaleString('en-IN')}</span>
                  </span>
                  <button
                    className="text-xs px-3 py-1 rounded-full font-bold border-2 transition hover:opacity-80"
                    style={{ borderColor: accent, color: accent }}
                    onClick={() => navigate('/student', { state: { tab: 'catalog' } })}>
                    Enroll →
                  </button>
                </div>
              )}
            </div>

            {/* Right CTA */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              {joinable ? (
                <button
                  className={`px-5 py-2.5 rounded-xl font-black text-white text-sm transition-all hover:scale-105 shadow-md ${
                    live && isDemo ? 'shadow-red-200' : live ? 'shadow-green-200' : ''
                  }`}
                  style={{
                    background: isDemo
                      ? (live ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#f59e0b,#d97706)')
                      : (live ? 'linear-gradient(135deg,#16a34a,#15803d)' : accent)
                  }}
                  onClick={() => window.open(`/live-class/${c.id}`, '_blank')}>
                  {isDemo
                    ? (live ? `▶ Join Demo` : `▶ Preview`)
                    : (live ? '▶ Join Now' : 'Enter Class')}
                </button>
              ) : (
                <div className="text-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Starts in</span>
                  <span className="text-sm font-black text-slate-700">{hoursLeft > 0 ? `${hoursLeft}h` : `${minsLeft}m`}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-1">Live Classes</h2>
      <p className="text-sm text-slate-400 mb-4">Enrolled classes first · Free demo available for others</p>

      {/* Coupon redemption box */}
      <div className="card mb-5 p-4" style={{border:`1px solid ${accent}30`, background:`${accent}06`}}>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:accent}}>Got a Class-Access Coupon?</p>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Enter coupon code (e.g. DEMO2024)"
            value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && redeemCoupon()} />
          <button className="px-4 py-2 rounded-xl text-white font-bold text-sm hover:opacity-90 transition"
            style={{background:accent}} onClick={redeemCoupon}>
            Redeem
          </button>
        </div>
        {couponMsg.text && (
          <p className={`text-xs mt-2 font-medium ${couponMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
            {couponMsg.ok ? '✓ ' : '✗ '}{couponMsg.text}
          </p>
        )}
        {myCoupons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {myCoupons.map(c => (
              <div key={c.code} className="flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1 text-xs">
                <span className="font-mono font-bold text-slate-700">{c.code}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {c.access_type === 'unlimited' ? 'Unlimited' : `${c.remaining} ${c.access_type === 'class_count' ? 'classes left' : 'hours left'}`}
                </span>
                {c.expires_at && <span className="text-slate-400">· exp {new Date(c.expires_at).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📺</p>
          <p className="text-slate-500 font-semibold">No live or upcoming classes right now</p>
          <p className="text-sm text-slate-400 mt-1">Check back soon — all partner classes appear here with free demo access</p>
        </div>
      ) : (
        <>
          {/* ── Enrolled classes ── */}
          {enrolled.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">Your Enrolled Classes</h3>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{enrolled.length}</span>
              </div>
              <div className="space-y-3">
                {enrolled.map(c => <ClassCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {/* ── Demo / not enrolled classes ── */}
          {demo.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">Other Live Classes — Free Demo</h3>
                <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{demo.length}</span>
              </div>
              <div className="space-y-3">
                {demo.map(c => <ClassCard key={c.id} c={c} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── MOTIVATIONAL HELPERS ─────────────────────────────────────
const SUGGEST = {
  IELTS:          ['PTE Academic', 'Spoken English', 'TOEFL'],
  PTE:            ['IELTS', 'TOEFL', 'Spoken English'],
  TOEFL:          ['IELTS', 'PTE Academic'],
  GERMAN:         ['French', 'IELTS', 'Spoken English'],
  FRENCH:         ['German', 'IELTS', 'Spoken English'],
  SPOKEN_ENGLISH: ['IELTS', 'PTE Academic', 'TOEFL'],
  OTHER:          ['IELTS', 'PTE Academic'],
};
const COUNTRY_TIP = {
  IELTS: 'Required for UK, Canada, Australia, New Zealand admissions.',
  PTE:   'Accepted by 3,000+ institutions in UK, Australia & Canada.',
  TOEFL: 'Preferred by US & European universities.',
  GERMAN:'Opens doors to Germany & Austria — free education!',
  FRENCH:'Gateway to France, Belgium & Francophone Africa.',
  SPOKEN_ENGLISH: 'Essential for global workplaces & interviews.',
};
function motivation(pct) {
  if (pct === 0)   return { icon: '🚀', text: "Start today — every expert was once a beginner!", color: '#64748b' };
  if (pct < 25)    return { icon: '💪', text: "Great start! Consistency beats intensity — keep going!", color: '#3b82f6' };
  if (pct < 50)    return { icon: '📈', text: "You're building momentum! Don't break the streak.", color: '#6366f1' };
  if (pct < 75)    return { icon: '⭐', text: "More than halfway! Finish strong — the goal is close.", color: '#f59e0b' };
  if (pct < 100)   return { icon: '🔥', text: "Final stretch! A few more sessions to reach your goal.", color: '#f97316' };
  return            { icon: '🏆', text: "Course complete! You crushed it. Time for the next challenge.", color: '#10b981' };
}

// ── MY COURSES (Dashboard) ───────────────────────────────────
function Dashboard({ enrollments, accent, user, onNavigate }) {
  const [myBatches, setMyBatches] = useState([]);
  const paidCount   = enrollments.filter(e => e.payment_status === 'paid').length;
  const pendingCount = enrollments.filter(e => e.payment_status !== 'paid').length;
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((a, e) => a + Number(e.progress_percent), 0) / enrollments.length)
    : 0;

  useEffect(() => {
    api.get('/student/my-batches').then(setMyBatches).catch(() => {});
  }, []);

  const myCategories = [...new Set(enrollments.map(e => e.category).filter(Boolean))];
  const suggestions  = [...new Set(myCategories.flatMap(c => SUGGEST[c] || []))].filter(s => !myCategories.includes(s)).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 60%, ${accent}99 100%)` }}>
        {/* decorative blobs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20" style={{ background: 'white' }} />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full opacity-10" style={{ background: 'white' }} />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center text-2xl font-black shadow-lg backdrop-blur-sm flex-shrink-0">
              {user?.agency_logo || '🎓'}
            </div>
            <div>
              <div className="text-xl font-black leading-tight">Hey {user?.name?.split(' ')[0]} 👋</div>
              <div className="text-white/75 text-sm font-medium">{user?.agency_name} · Student Portal</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { v: enrollments.length, l: 'Courses', icon: '📚' },
              { v: myBatches.length,   l: 'Batches', icon: '📅' },
              { v: avgProgress + '%',  l: 'Progress', icon: '📈' },
            ].map(({ v, l, icon }) => (
              <div key={l} className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 text-center">
                <div className="text-lg mb-0.5">{icon}</div>
                <div className="text-xl font-black leading-none">{v}</div>
                <div className="text-[11px] text-white/70 mt-0.5 font-medium">{l}</div>
              </div>
            ))}
          </div>
          {enrollments.length > 0 && (
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1.5 font-semibold">
                <span>Overall Progress</span><span>{avgProgress}%</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 bg-white" style={{ width: `${avgProgress}%` }} />
              </div>
              <p className="text-xs text-white/65 mt-2">{motivation(avgProgress).icon} {motivation(avgProgress).text}</p>
            </div>
          )}
          {/* Pending payment alert */}
          {pendingCount > 0 && (
            <div className="mt-4 bg-white/15 border border-white/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">⚠️ {pendingCount} course{pendingCount > 1 ? 's' : ''} awaiting payment</div>
              <button onClick={() => onNavigate('payments')}
                className="text-xs font-black bg-white/90 px-3 py-1.5 rounded-xl hover:bg-white transition flex-shrink-0"
                style={{ color: accent }}>Pay Now →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Enrolled Courses ────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-slate-900 text-base">My Courses</h3>
            <p className="text-xs text-slate-400">{paidCount} active · {pendingCount} pending payment</p>
          </div>
          <button onClick={() => onNavigate('catalog')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-white shadow-sm transition hover:opacity-90"
            style={{ background: accent }}>
            + Browse More
          </button>
        </div>
        {enrollments.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 text-center py-14 px-6">
            <div className="text-5xl mb-3">🎓</div>
            <p className="text-slate-700 font-black text-lg">Start your learning journey!</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Pick a course and unlock your potential.</p>
            <button onClick={() => onNavigate('catalog')}
              className="px-6 py-2.5 rounded-2xl text-white text-sm font-black shadow-lg hover:opacity-90 transition"
              style={{ background: accent }}>
              🚀 Explore Courses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrollments.map(e => {
              const color = catColors[e.category] || accent;
              const pct   = Number(e.progress_percent) || 0;
              const mot   = motivation(pct);
              const isPaid = e.payment_status === 'paid';
              return (
                <div key={e.id} className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-white transition-all hover:shadow-md">
                  {/* Coloured header strip */}
                  <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm" style={{ background: color + '15' }}>
                        {catIcons[e.category] || '📚'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-900 truncate text-sm">{e.course_title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{e.duration_weeks}w · {e.category?.replace('_',' ')}</div>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-600'}`}>
                        {isPaid ? '✅ Active' : '🔒 Locked'}
                      </span>
                    </div>

                    {isPaid ? (
                      <>
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1.5 font-semibold">
                            <span className="text-slate-500">Progress</span>
                            <span style={{ color }}>{pct}%</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}99,${color})` }} />
                          </div>
                        </div>
                        <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: mot.color }}>
                          <span>{mot.icon}</span><span className="font-medium">{mot.text}</span>
                        </p>
                        {COUNTRY_TIP[e.category] && pct < 30 && (
                          <p className="text-xs text-slate-400 mb-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                            🌍 {COUNTRY_TIP[e.category]}
                          </p>
                        )}
                        <StartLearningBtn enrollmentId={e.id} accent={color} />
                      </>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-3 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                          <span className="text-xl">🔒</span>
                          <div>
                            <p className="text-xs font-black text-amber-800">Course Locked</p>
                            <p className="text-[11px] text-amber-600">Complete payment to start learning</p>
                          </div>
                        </div>
                        <PayNowFromCard
                          enrollment={e}
                          accent={color}
                          label="🔓 Complete Payment to Unlock"
                          onSuccess={() => window.location.reload()}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booked Batches */}
      {myBatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">📅 My Batches ({myBatches.length})</h3>
            <button onClick={() => onNavigate('batches')} className="text-xs font-bold hover:underline" style={{ color: accent }}>View All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myBatches.map(b => {
              const color = catColors[b.category] || accent;
              const total = (b.upcoming_classes || 0) + (b.attended_classes || 0);
              const attended = b.attended_classes || 0;
              const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
              const mot = motivation(pct);
              return (
                <div key={b.id} className="card relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: color }} />
                  <div className="flex items-start gap-3 mt-2 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: color + '18' }}>
                      📅
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{b.batch_name}</div>
                      <div className="text-xs text-slate-400">{b.course_title} · {b.schedule_days || 'Mon–Fri'} {b.class_time?.slice(0,5)}</div>
                    </div>
                    <span className="badge badge-green flex-shrink-0">Booked ✓</span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Classes Attended</span>
                      <span className="font-black" style={{ color }}>{attended} / {total || '—'}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}bb,${color})` }} />
                    </div>
                  </div>

                  <p className="text-xs mb-3 flex items-center gap-1.5 font-medium" style={{ color: mot.color }}>
                    <span>{mot.icon}</span>
                    <span>{b.upcoming_classes > 0 ? `${b.upcoming_classes} upcoming class${b.upcoming_classes>1?'es':''} — don't miss them!` : mot.text}</span>
                  </p>

                  <button onClick={() => onNavigate('liveclasses')}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                    style={{ background: color }}>
                    📺 Go to Live Classes
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested programs */}
      {suggestions.length > 0 && (
        <div className="card" style={{ border: `1px solid ${accent}30`, background: `${accent}06` }}>
          <p className="text-xs font-black uppercase tracking-wide mb-3" style={{ color: accent }}>🎯 Recommended Next Steps</p>
          <p className="text-sm text-slate-600 mb-3">Based on your current learning path, these programs can help you reach your study-abroad goals faster:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button key={s} onClick={() => onNavigate('catalog')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition hover:text-white"
                style={{ borderColor: accent, color: accent }}
                onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = accent; }}>
                {catIcons[s.replace(' ','_').toUpperCase()] || '📖'} {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">💡 Many top universities accept multiple test scores — a higher band in 2 exams doubles your admission chances.</p>
        </div>
      )}
    </div>
  );
}

function StartLearningBtn({ enrollmentId, accent }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const handleStart = async () => {
    setLoading(true);
    try {
      await api.post(`/student/sso/${enrollmentId}`, {});
      setMsg('Launching learning portal...');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  return (
    <>
      {msg && <div className="text-xs text-emerald-600 font-semibold mb-2 text-center">{msg}</div>}
      <button onClick={handleStart} disabled={loading}
        className="w-full py-2.5 text-white font-bold rounded-xl text-sm transition hover:opacity-90 disabled:opacity-50"
        style={{background:accent}}>
        {loading ? 'Connecting...' : '▶ Start Learning'}
      </button>
    </>
  );
}

// ── PAY NOW FROM CARD (inline trigger) ───────────────────────
function PayNowFromCard({ enrollment, accent, onSuccess, label }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full py-3 rounded-2xl text-sm font-black text-white transition hover:opacity-90 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
        {label || '💳 Pay Now'}
      </button>
      {open && (
        <PayNowModal
          enrollment={enrollment}
          accent={accent}
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); onSuccess(); }}
        />
      )}
    </>
  );
}

// ── PAY NOW MODAL ─────────────────────────────────────────────
function PayNowModal({ enrollment, onClose, onSuccess, accent }) {
  const [cfg, setCfg] = useState(null);
  const [method, setMethod] = useState('');
  const [proofImg, setProofImg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/student/payment-config').then(c => {
      setCfg(c);
      // auto-select first available method
      if (c.upi_id) setMethod('upi');
      else if (c.qr_code_image) setMethod('qr');
      else if (c.payment_link) setMethod('link');
      else if (c.mobile_number) setMethod('mobile');
    }).catch(() => setCfg({}));
  }, []);

  const handleProof = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProofImg(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!method) return setErr('Please select a payment method');
    if (!proofImg) return setErr('Payment receipt screenshot is required to unlock your course.');
    setSubmitting(true); setErr('');
    try {
      await api.post('/student/payment-proof', {
        enrollment_id: enrollment.id,
        amount: enrollment.fee_paid,
        payment_method: method,
        proof_image: proofImg,
        notes: notes || null,
      });
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const methods = cfg ? [
    cfg.upi_id && { key:'upi', label:'UPI', icon:'💳', desc: `Pay to ${cfg.upi_id}${cfg.upi_name ? ` (${cfg.upi_name})` : ''}` },
    cfg.qr_code_image && { key:'qr', label:'QR Code', icon:'📷', desc:'Scan QR code to pay' },
    cfg.payment_link && { key:'link', label:'Payment Link', icon:'🔗', desc:'Pay via payment gateway' },
    cfg.mobile_number && { key:'mobile', label:'Mobile Pay', icon:'📱', desc:`Pay to ${cfg.mobile_number}` },
  ].filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900">Pay Now</h3>
            <p className="text-xs text-slate-500 mt-0.5">{enrollment.course_title} · {fmt(enrollment.fee_paid)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-black text-emerald-600 text-lg">Submitted!</p>
            <p className="text-sm text-slate-500 mt-1">Your payment proof is under review.</p>
          </div>
        ) : cfg === null ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading payment options...</div>
        ) : methods.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">⚙️</div>
            <p className="text-slate-600 font-semibold">Payment methods not configured yet.</p>
            <p className="text-sm text-slate-400 mt-1">Please contact your academy for payment details.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Method selection */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                {methods.map(m => (
                  <button key={m.key} onClick={() => setMethod(m.key)}
                    className={`p-3 rounded-xl border-2 text-left transition ${method===m.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="text-xl mb-1">{m.icon}</div>
                    <div className="text-xs font-bold text-slate-800">{m.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Method details */}
            {method === 'upi' && cfg.upi_id && (
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs font-bold text-blue-700 mb-1">UPI Payment</p>
                <p className="font-mono font-black text-blue-900 text-lg select-all">{cfg.upi_id}</p>
                {cfg.upi_name && <p className="text-sm text-blue-700 mt-1">Name: {cfg.upi_name}</p>}
                <p className="text-xs text-blue-600 mt-2">Send {fmt(enrollment.fee_paid)} and upload screenshot below.</p>
              </div>
            )}
            {method === 'qr' && cfg.qr_code_image && (
              <div className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-xs font-bold text-slate-600 mb-2">Scan QR Code</p>
                <img src={cfg.qr_code_image} alt="QR" className="w-48 h-48 object-contain mx-auto rounded-xl border border-slate-200" />
                <p className="text-xs text-slate-500 mt-2">Pay {fmt(enrollment.fee_paid)} and upload screenshot below.</p>
              </div>
            )}
            {method === 'link' && cfg.payment_link && (
              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs font-bold text-emerald-700 mb-2">Payment Link</p>
                <a href={cfg.payment_link} target="_blank" rel="noopener noreferrer"
                  className="block w-full py-2.5 bg-emerald-600 text-white text-center font-bold rounded-xl text-sm hover:bg-emerald-700 transition">
                  Open Payment Page →
                </a>
                <p className="text-xs text-emerald-600 mt-2 text-center">After payment, upload your receipt below.</p>
              </div>
            )}
            {method === 'mobile' && cfg.mobile_number && (
              <div className="p-4 bg-purple-50 rounded-xl">
                <p className="text-xs font-bold text-purple-700 mb-1">Mobile Payment</p>
                <p className="font-mono font-black text-purple-900 text-lg">{cfg.mobile_number}</p>
                {cfg.mobile_instructions && <p className="text-sm text-purple-700 mt-2">{cfg.mobile_instructions}</p>}
                <p className="text-xs text-purple-600 mt-2">Send {fmt(enrollment.fee_paid)} and upload screenshot below.</p>
              </div>
            )}

            {/* Proof upload — MANDATORY */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Upload Payment Receipt <span className="text-red-500">*</span>
                <span className="text-red-500 font-semibold normal-case ml-1">Required</span>
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2 font-semibold">
                Your course is unlocked only after admin verifies your receipt. Receipt is mandatory.
              </p>
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition
                ${proofImg ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50 hover:bg-red-100'}`}>
                {proofImg
                  ? <img src={proofImg} alt="proof" className="h-full w-full object-contain rounded-xl p-1" />
                  : <>
                      <span className="text-2xl mb-1">📎</span>
                      <span className="text-xs text-red-600 font-semibold">Click to upload payment screenshot</span>
                    </>
                }
                <input type="file" accept="image/*" className="hidden" onChange={handleProof} />
              </label>
              {proofImg && <button onClick={() => setProofImg('')} className="text-xs text-red-500 mt-1 hover:underline">Remove</button>}
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Notes <span className="font-normal text-slate-300">(optional)</span></p>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Transaction ID, reference number..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {err && <p className="text-xs text-red-500 font-semibold">{err}</p>}

            <button onClick={handleSubmit} disabled={submitting || !method || !proofImg}
              className="w-full py-3 rounded-xl font-black text-white text-sm transition disabled:opacity-50"
              style={{ background: accent || '#2563eb' }}>
              {submitting ? 'Submitting...' : !proofImg ? '📎 Upload Receipt to Submit' : '✅ Submit Payment Proof'}
            </button>

            <button
              onClick={() => {
                const phone = (cfg?.agency_phone || '').replace(/\D/g, '');
                const msg = `Hi${cfg?.agency_name ? ` ${cfg.agency_name}` : ''}! I'm interested in "${enrollment.course_title}" (₹${enrollment.fee_paid}). Could you please share a discount coupon code for me? Thank you!`;
                if (phone) {
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                } else {
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: '#25D366' }}>
              <span>📱</span> Ask for Discount Coupon on WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PAYMENTS ─────────────────────────────────────────────────
function Payments({ enrollments, accent, onRefresh }) {
  const [payModal, setPayModal] = useState(null);
  const totalPaid = enrollments.filter(e => e.payment_status==='paid').reduce((a,e) => a+Number(e.fee_paid),0);
  const totalPending = enrollments.filter(e => e.payment_status==='pending').reduce((a,e) => a+Number(e.fee_paid),0);
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Payment History</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Paid</p><p className="text-2xl font-black text-emerald-600">{fmt(totalPaid)}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Pending</p><p className="text-2xl font-black text-amber-500">{fmt(totalPending)}</p></div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Course</th><th>Category</th><th>Fee</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.course_title}</td>
                  <td><span className="badge badge-blue">{e.category}</span></td>
                  <td className="font-black">{fmt(e.fee_paid)}</td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="badge badge-blue text-[10px]">✓ Enrolled</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${e.payment_status==='paid'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>
                        {e.payment_status==='paid' ? '✅ Paid' : '⏳ Payment Pending'}
                      </span>
                    </div>
                  </td>
                  <td className="text-slate-400 text-xs">{e.enrolled_at?.split('T')[0]}</td>
                  <td>
                    {e.payment_status === 'pending' && (
                      <button onClick={() => setPayModal(e)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black text-white transition hover:opacity-90"
                        style={{ background: accent || '#2563eb' }}>
                        Pay Now
                      </button>
                    )}
                    {e.payment_status === 'paid' && <span className="text-xs text-emerald-600 font-semibold">✓ Paid</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payModal && (
        <PayNowModal
          enrollment={payModal}
          accent={accent}
          onClose={() => setPayModal(null)}
          onSuccess={() => { setPayModal(null); onRefresh && onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── PROFILE ──────────────────────────────────────────────────
function Profile({ user }) {
  const accent = user?.brand_color || '#1e40af';
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">My Profile</h2>
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{background:accent}}>{user?.name?.[0]}</div>
          <div>
            <div className="text-xl font-black text-slate-900">{user?.name}</div>
            <div className="text-sm text-slate-400">{user?.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['Phone',user?.phone||'—'],['Academy',user?.agency_name],['City',user?.city||'—'],['LMS ID',user?.lms_user_id]].map(([k,v]) => (
            <div key={k} className="p-3 bg-slate-50 rounded-xl">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{border:`1px solid ${accent}30`,background:accent+'06'}}>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{color:accent}}>Your Academy</div>
        <div className="font-bold text-slate-900 mb-1">{user?.agency_name}</div>
        <div className="text-sm text-slate-500">Portal: <span className="font-mono text-xs">/agent/{user?.slug}</span></div>
        <div className="text-xs text-slate-400 mt-2">Contact: {user?.agency_email}</div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('dashboard');
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Support navigation from LiveClassRoom paywall: navigate('/student', { state: { tab: 'catalog' } })
  useEffect(() => {
    const state = window.history.state?.usr;
    if (state?.tab) setSection(state.tab);
  }, []);

  const loadEnrollments = useCallback(() => {
    api.get('/student/dashboard').then(data => {
      setEnrollments(data.enrollments || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  const accent        = enrollments[0]?.brand_color || user?.brand_color || '#1e40af';
  const agencyLogo    = enrollments[0]?.logo_initials || 'TP';
  const agencyLogoUrl = enrollments[0]?.agency_logo_url || user?.logo_url || null;
  const agencyName    = enrollments[0]?.agency_name || user?.agency_name || 'TestPrep';
  const enrichedUser  = { ...user, brand_color: accent, agency_logo: agencyLogo, agency_name: agencyName };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;

  const panels = {
    dashboard:   <Dashboard enrollments={enrollments} accent={accent} user={enrichedUser} onNavigate={setSection} />,
    catalog:     <CourseCatalog accent={accent} user={enrichedUser} onEnrolled={loadEnrollments} />,
    batches:     <BatchBrowser accent={accent} user={enrichedUser} />,
    liveclasses: <StudentLiveClasses accent={accent} />,
    progress:    <StudentProgress accent={accent} initialTab="plan" />,
    tests:       <StudentProgress accent={accent} initialTab="tests" />,
    payments:    <Payments enrollments={enrollments} accent={accent} onRefresh={loadEnrollments} />,
    profile:     <Profile user={enrichedUser} />,
  };

  return (
    <DashLayout
      bgColor={accent}
      onLiveClasses={() => setSection('liveclasses')}
      sidebar={{
        mobileTitle: agencyName,
        logo: (
          <div className="flex flex-col items-center text-center py-2">
            {agencyLogoUrl
              ? <img src={agencyLogoUrl} alt="logo"
                  className="rounded-2xl object-contain bg-white/15 p-1.5 mb-2 shadow-lg"
                  style={{ width: 72, height: 72 }} />
              : <div className="rounded-2xl bg-white/25 flex items-center justify-center font-black text-white shadow-lg mb-2"
                  style={{ width: 72, height: 72, fontSize: 28 }}>
                  {agencyLogo?.slice(0,1) || '🎓'}
                </div>
            }
            <div className="text-white font-black text-sm leading-tight">{agencyName}</div>
            <div className="text-xs text-white/50 mt-0.5">Student Portal</div>
          </div>
        ),
        items: (
          <>
            <NavItem active={section==='dashboard'}   onClick={() => setSection('dashboard')}   icon="🏠" label="My Courses"    accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='catalog'}     onClick={() => setSection('catalog')}     icon="🛒" label="Buy Courses"   accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='batches'}     onClick={() => setSection('batches')}     icon="📅" label="Book Batches"  accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='liveclasses'} onClick={() => setSection('liveclasses')} icon="📺" label="Live Classes"  accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='progress'}    onClick={() => setSection('progress')}    icon="📊" label="My Progress"   accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='tests'}       onClick={() => setSection('tests')}       icon="📝" label="Tests & Mocks" accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='payments'}    onClick={() => setSection('payments')}    icon="💳" label="Payments"      accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='profile'}     onClick={() => setSection('profile')}     icon="👤" label="Profile"       accent="rgba(255,255,255,0.9)" />
          </>
        )
      }}
      headerRight={
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{background:accent}} />
          <span>Student — {agencyName}</span>
        </div>
      }
    >
      {panels[section]}
    </DashLayout>
  );
}
