import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';

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
  const [enrollments, setEnrollments] = useState([]);
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
      setEnrollments((dash.enrollments || []).map(e => e.course_id));
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
              setEnrollments(prev => [...prev, course.id]);
              onEnrolled?.();
            } catch (e) { setMsg('Payment verification failed: ' + e.message); }
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: accent },
        }).open();
      } else {
        setMsg(`✅ ${res.message}`);
        setEnrollments(prev => [...prev, course.id]);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Course Catalog</h2>
        <div className="flex gap-2">
          <input
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-40"
            placeholder="Coupon code"
            value={coupon}
            onChange={e => setCoupon(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {msg}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filter === cat ? 'text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            style={filter === cat ? { background: catColors[cat] || accent } : {}}>
            {catIcons[cat] || ''} {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map(course => {
          const enrolled = enrollments.includes(course.id);
          const color = catColors[course.category] || accent;
          return (
            <div key={course.id} className="card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
              <div className="flex items-start gap-3 mt-2 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: color + '18' }}>
                  {catIcons[course.category] || '📚'}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900">{course.title}</div>
                  <div className="text-xs text-slate-400">{course.duration_weeks} weeks · {course.category.replace('_', ' ')}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-black" style={{ color }}>{fmt(course.price)}</div>
                  {coupon && <div className="text-xs text-emerald-600 font-medium">Coupon applied</div>}
                </div>
              </div>

              {course.description && (
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{course.description}</p>
              )}

              {enrolled ? (
                <div className="w-full py-2.5 rounded-xl text-sm text-center font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  ✓ Already Enrolled
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePurchase(course)}
                    disabled={buying === course.id}
                    className="flex-1 py-2.5 text-white font-bold rounded-xl text-sm transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: color }}>
                    {buying === course.id ? 'Processing...' : `Enroll Now — ${fmt(course.price)}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="card text-center py-12 text-slate-400">No courses available in this category.</div>
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
              <div key={b.id} className="card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />
                <div className="flex items-start justify-between mt-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{catIcons[b.category] || '📚'}</span>
                      <h3 className="font-bold text-slate-900">{b.name}</h3>
                      {b.already_joined && <span className="badge badge-green text-xs">Joined</span>}
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
                      <div className="text-center text-xs text-emerald-600 font-bold p-3">✓ Joined</div>
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
  const isLive = (scheduledAt) => Math.abs(new Date() - parseDT(scheduledAt)) / 60000 < 60;
  const canJoin = (scheduledAt) => (parseDT(scheduledAt) - new Date()) / 60000 <= 15;

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-2">Live Classes</h2>
      <p className="text-sm text-slate-400 mb-4">Your enrolled classes + previews available for other courses</p>

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
        {/* Active coupons summary */}
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
          <p className="text-slate-400">No upcoming live classes scheduled</p>
          <p className="text-sm text-slate-400 mt-1">Check back soon — all partner classes appear here as free 15-min previews</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map(c => {
            const live = isLive(c.scheduled_at) || c.status === 'live';
            const joinable = canJoin(c.scheduled_at) || c.status === 'live';
            const isDemo = !c.is_enrolled;
            return (
              <div key={c.id} className="card relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${live ? 'bg-red-500 animate-pulse' : isDemo ? 'bg-amber-400' : 'bg-slate-200'}`} />
                <div className="flex items-start justify-between mt-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{c.title}</h3>
                      {live && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE NOW</span>}
                      {isDemo && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">15-MIN PREVIEW</span>}
                      {!isDemo && <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Enrolled</span>}
                    </div>
                    <p className="text-sm text-slate-500 mb-3">{c.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>📅 {parseDT(c.scheduled_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
                      <span>🕐 {parseDT(c.scheduled_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</span>
                      <span>⏱️ {c.duration_minutes} min</span>
                      {c.agency_name && <span>🏫 {c.agency_name}</span>}
                      {c.batch_name && <span>🎓 {c.batch_name}</span>}
                      <span className="badge badge-blue">{c.class_mode}</span>
                    </div>
                    {isDemo && (
                      <p className="text-xs text-amber-600 mt-2">
                        Watch 15 min free, then purchase to continue
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
                    {joinable ? (
                      <button
                        className="px-5 py-2 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90"
                        style={{ background: isDemo ? '#f59e0b' : accent }}
                        onClick={() => window.open(`/live-class/${c.id}`, '_blank')}
                      >
                        {isDemo ? '▶ Preview (15 min)' : live ? 'Join Now' : 'Enter Class'}
                      </button>
                    ) : (
                      <div className="text-center">
                        <span className="text-xs text-slate-400 block">Starts in</span>
                        <span className="text-sm font-semibold text-slate-600">{Math.ceil((parseDT(c.scheduled_at)-new Date())/3600000)}h</span>
                      </div>
                    )}
                    {isDemo && (
                      <button
                        className="px-5 py-2 rounded-lg font-semibold text-sm border-2 transition-all hover:opacity-90"
                        style={{ borderColor: accent, color: accent }}
                        onClick={() => navigate('/student', { state: { tab: 'catalog' } })}
                      >
                        Buy Course
                      </button>
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

// ── MY COURSES (Dashboard) ───────────────────────────────────
function Dashboard({ enrollments, accent, user }) {
  const paidCount = enrollments.filter(e => e.payment_status==='paid').length;
  const avgProgress = enrollments.length ? Math.round(enrollments.reduce((a,e) => a+Number(e.progress_percent),0)/enrollments.length) : 0;
  return (
    <div>
      <div className="rounded-2xl p-6 mb-6 text-white" style={{background:`linear-gradient(135deg,${accent},${accent}dd)`}}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl font-black">{user?.agency_logo||'TP'}</div>
          <div>
            <div className="text-lg font-black">Welcome back, {user?.name?.split(' ')[0]}!</div>
            <div className="text-white/70 text-sm">{user?.agency_name}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[[enrollments.length,'Courses Enrolled'],[paidCount,'Courses Active'],[avgProgress+'%','Avg Progress']].map(([v,l]) => (
            <div key={l} className="bg-white/15 rounded-xl p-3 text-center">
              <div className="text-2xl font-black">{v}</div>
              <div className="text-xs text-white/70 mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-bold text-slate-700 mb-4">My Courses</h3>
      {enrollments.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-slate-500 font-semibold">No courses yet</p>
          <p className="text-sm text-slate-400 mt-1">Browse the Course Catalog to enroll in a course.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enrollments.map(e => (
            <div key={e.id} className="card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{background:catColors[e.category]||accent}} />
              <div className="flex items-start gap-3 mt-2 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:(catColors[e.category]||accent)+'15'}}>
                  {catIcons[e.category]||'📚'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{e.course_title}</div>
                  <div className="text-xs text-slate-400">{e.duration_weeks} weeks · {e.category}</div>
                </div>
                <span className={`badge ${e.payment_status==='paid'?'badge-green':'badge-amber'}`}>{e.payment_status}</span>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Progress</span><span className="font-semibold">{e.progress_percent}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{width:`${e.progress_percent}%`,background:catColors[e.category]||accent}} />
                </div>
              </div>
              {e.payment_status==='paid' ? (
                <StartLearningBtn enrollmentId={e.id} accent={catColors[e.category]||accent} />
              ) : (
                <div className="px-4 py-2.5 rounded-xl text-sm text-center font-semibold bg-slate-50 text-slate-400 border border-dashed border-slate-200">
                  Complete payment to unlock
                </div>
              )}
            </div>
          ))}
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

// ── PAYMENTS ─────────────────────────────────────────────────
function Payments({ enrollments }) {
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
            <thead><tr><th>Course</th><th>Category</th><th>Fee</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.course_title}</td>
                  <td><span className="badge badge-blue">{e.category}</span></td>
                  <td className="font-black">{fmt(e.fee_paid)}</td>
                  <td><span className={`badge ${e.payment_status==='paid'?'badge-green':'badge-amber'}`}>{e.payment_status}</span></td>
                  <td className="text-slate-400 text-xs">{e.enrolled_at?.split('T')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

  const accent     = enrollments[0]?.brand_color || user?.brand_color || '#1e40af';
  const agencyLogo = enrollments[0]?.logo_initials || 'TP';
  const agencyName = enrollments[0]?.agency_name || user?.agency_name || 'TestPrep';
  const enrichedUser = { ...user, brand_color: accent, agency_logo: agencyLogo, agency_name: agencyName };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;

  const panels = {
    dashboard:   <Dashboard enrollments={enrollments} accent={accent} user={enrichedUser} />,
    catalog:     <CourseCatalog accent={accent} user={enrichedUser} onEnrolled={loadEnrollments} />,
    batches:     <BatchBrowser accent={accent} user={enrichedUser} />,
    liveclasses: <StudentLiveClasses accent={accent} />,
    payments:    <Payments enrollments={enrollments} />,
    profile:     <Profile user={enrichedUser} />,
  };

  return (
    <DashLayout
      bgColor={accent}
      onLiveClasses={() => setSection('liveclasses')}
      sidebar={{
        logo: (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-white text-sm">{agencyLogo}</div>
              <div className="text-white font-bold text-sm">{agencyName}</div>
            </div>
            <div className="text-xs text-white/50">Student Portal</div>
          </div>
        ),
        items: (
          <>
            <NavItem active={section==='dashboard'}   onClick={() => setSection('dashboard')}   icon="🏠" label="My Courses"    accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='catalog'}     onClick={() => setSection('catalog')}     icon="🛒" label="Buy Courses"   accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='batches'}     onClick={() => setSection('batches')}     icon="📅" label="Book Batches"  accent="rgba(255,255,255,0.9)" />
            <NavItem active={section==='liveclasses'} onClick={() => setSection('liveclasses')} icon="📺" label="Live Classes"  accent="rgba(255,255,255,0.9)" />
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
