import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Badge({ status }) {
  const map = { active: 'badge-green', paid: 'badge-green', pending: 'badge-amber', on_hold: 'badge-amber', completed: 'badge-purple', cancelled: 'badge-gray' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace('_', ' ')}</span>;
}

const catIcons = { IELTS: '📝', PTE: '🖥️', TOEFL: '🌐', GERMAN: '🇩🇪', FRENCH: '🇫🇷', SPOKEN_ENGLISH: '🗣️', OTHER: '📚' };
const catColors = { IELTS: '#3b82f6', PTE: '#10b981', TOEFL: '#8b5cf6', GERMAN: '#f59e0b', FRENCH: '#ef4444', SPOKEN_ENGLISH: '#06b6d4', OTHER: '#64748b' };

// ── LIVE CLASSES ─────────────────────────────────────────────
function StudentLiveClasses({ accent }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await api.get('/live-classes/upcoming');
      setClasses(data);
    } catch (e) {
      console.error('Failed to load classes:', e);
    } finally {
      setLoading(false);
    }
  };

  const isLive = (scheduledAt) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diff = Math.abs(now - scheduled) / (1000 * 60); // minutes
    return diff < 60; // Within 60 minutes
  };

  const canJoin = (scheduledAt) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffMinutes = (scheduled - now) / (1000 * 60);
    // Can join 15 minutes before scheduled time
    return diffMinutes <= 15;
  };

  if (loading) return <div className="text-slate-400">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">My Live Classes</h2>

      {classes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400">No upcoming live classes scheduled</p>
          <p className="text-sm text-slate-500 mt-2">Check back later for new sessions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map(c => (
            <div key={c.id} className="card relative overflow-hidden">
              {/* Status indicator */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${isLive(c.scheduled_at) || c.status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />

              <div className="flex items-start justify-between mt-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-slate-900">{c.title}</h3>
                    {(isLive(c.scheduled_at) || c.status === 'live') && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium animate-pulse">
                        LIVE NOW
                      </span>
                    )}
                    {c.access_type === 'demo' && (
                      <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        DEMO
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 mb-3">{c.description}</p>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1 text-slate-600">
                      <span>📅</span>
                      <span>{new Date(c.scheduled_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <span>🕐</span>
                      <span>{new Date(c.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <span>⏱️</span>
                      <span>{c.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <span>🎓</span>
                      <span>{c.batch_name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <span className="badge badge-blue">{c.class_mode}</span>
                    </div>
                  </div>

                  {c.access_type === 'demo' && c.demo_expires_at && (
                    <p className="text-xs text-amber-600 mt-2">
                      Demo access expires: {new Date(c.demo_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="ml-4">
                  {canJoin(c.scheduled_at) || c.status === 'live' ? (
                    <button
                      className="btn-primary px-6 py-2"
                      style={{ background: accent }}
                      onClick={() => window.open(`/live-class/${c.id}`, '_blank')}
                    >
                      {isLive(c.scheduled_at) || c.status === 'live' ? 'Join Now' : 'Enter Class'}
                    </button>
                  ) : (
                    <div className="text-center">
                      <span className="text-xs text-slate-400 block">Starts in</span>
                      <span className="text-sm font-semibold text-slate-600">
                        {Math.ceil((new Date(c.scheduled_at) - new Date()) / (1000 * 60 * 60))} hours
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ enrollments, accent, user }) {
  const paidCount = enrollments.filter(e => e.payment_status === 'paid').length;
  const totalPaid = enrollments.filter(e => e.payment_status === 'paid').reduce((a, e) => a + Number(e.fee_paid), 0);
  const avgProgress = enrollments.length > 0 ? Math.round(enrollments.reduce((a, e) => a + Number(e.progress_percent), 0) / enrollments.length) : 0;

  return (
    <div>
      {/* Branded welcome */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}dd)` }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl font-black">{user?.agency_logo || 'TP'}</div>
          <div>
            <div className="text-lg font-black">Welcome back, {user?.name?.split(' ')[0]}!</div>
            <div className="text-white/70 text-sm">{user?.agency_name}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <div className="text-2xl font-black">{enrollments.length}</div>
            <div className="text-xs text-white/70 mt-0.5">Courses Enrolled</div>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <div className="text-2xl font-black">{paidCount}</div>
            <div className="text-xs text-white/70 mt-0.5">Courses Active</div>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <div className="text-2xl font-black">{avgProgress}%</div>
            <div className="text-xs text-white/70 mt-0.5">Avg Progress</div>
          </div>
        </div>
      </div>

      {/* Course cards */}
      <h3 className="text-sm font-bold text-slate-700 mb-4">My Courses</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {enrollments.map(e => (
          <div key={e.id} className="card relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: catColors[e.category] || accent }} />
            <div className="flex items-start gap-3 mt-2 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: (catColors[e.category] || accent) + '15' }}>
                {catIcons[e.category] || '📚'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">{e.course_title}</div>
                <div className="text-xs text-slate-400">{e.duration_weeks} weeks · {e.category}</div>
              </div>
              <Badge status={e.payment_status} />
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Progress</span><span className="font-semibold">{e.progress_percent}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${e.progress_percent}%`, background: catColors[e.category] || accent }} />
              </div>
            </div>

            {/* Start Learning button */}
            {e.payment_status === 'paid' ? (
              <StartLearningBtn enrollmentId={e.id} accent={catColors[e.category] || accent} courseName={e.course_title} />
            ) : (
              <div className="px-4 py-2.5 rounded-xl text-sm text-center font-semibold bg-slate-50 text-slate-400 border border-dashed border-slate-200">
                Complete payment to unlock access
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StartLearningBtn({ enrollmentId, accent, courseName }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleStart = async () => {
    setLoading(true);
    try {
      await api.post(`/student/sso/${enrollmentId}`, {});
      setMsg('Launching your learning portal...');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.message);
    } finally { setLoading(false); }
  };

  return (
    <>
      {msg && <div className="text-xs text-emerald-600 font-semibold mb-2 text-center">{msg}</div>}
      <button onClick={handleStart} disabled={loading}
        className="w-full py-2.5 text-white font-bold rounded-xl text-sm transition hover:opacity-90 disabled:opacity-50"
        style={{ background: accent }}>
        {loading ? 'Connecting...' : '▶ Start Learning'}
      </button>
    </>
  );
}

// ── PAYMENTS ─────────────────────────────────────────────────
function Payments({ enrollments }) {
  const totalPaid = enrollments.filter(e => e.payment_status === 'paid').reduce((a, e) => a + Number(e.fee_paid), 0);
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Payment History</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Paid</p><p className="text-2xl font-black text-emerald-600">{fmt(totalPaid)}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Pending</p><p className="text-2xl font-black text-amber-500">{fmt(enrollments.filter(e => e.payment_status === 'pending').reduce((a, e) => a + Number(e.fee_paid), 0))}</p></div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Course</th><th>Category</th><th>Fee</th><th>Status</th><th>Enrolled</th></tr></thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.course_title}</td>
                  <td><span className="badge badge-blue">{e.category}</span></td>
                  <td className="font-black">{fmt(e.fee_paid)}</td>
                  <td><Badge status={e.payment_status} /></td>
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
function Profile({ user, enrollments }) {
  const accent = user?.brand_color || '#1e40af';
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">My Profile</h2>
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{ background: accent }}>{user?.name?.[0]}</div>
          <div>
            <div className="text-xl font-black text-slate-900">{user?.name}</div>
            <div className="text-sm text-slate-400">{user?.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['Phone', user?.phone || '—'], ['Academy', user?.agency_name], ['City', user?.city || '—'], ['LMS ID', user?.lms_user_id]].map(([k, v]) => (
            <div key={k} className="p-3 bg-slate-50 rounded-xl">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ border: `1px solid ${accent}30`, background: accent + '06' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: accent }}>Your Academy</div>
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
  const [section, setSection] = useState('dashboard');
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/dashboard').then(data => {
      setEnrollments(data.enrollments || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const accent = enrollments[0]?.brand_color || user?.brand_color || '#1e40af';
  const agencyLogo = enrollments[0]?.logo_initials || 'TP';
  const agencyName = enrollments[0]?.agency_name || user?.agency_name || 'TestPrep';
  const enrichedUser = { ...user, brand_color: accent, agency_logo: agencyLogo, agency_name: agencyName };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;

  const panels = {
    dashboard: <Dashboard enrollments={enrollments} accent={accent} user={enrichedUser} />,
    liveclasses: <StudentLiveClasses accent={accent} />,
    payments: <Payments enrollments={enrollments} />,
    profile: <Profile user={enrichedUser} enrollments={enrollments} />,
  };

  return (
    <DashLayout
      bgColor={accent}
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
            <NavItem active={section === 'dashboard'} onClick={() => setSection('dashboard')} icon="🏠" label="My Courses" accent="rgba(255,255,255,0.9)" />
            <NavItem active={section === 'liveclasses'} onClick={() => setSection('liveclasses')} icon="📺" label="Live Classes" accent="rgba(255,255,255,0.9)" />
            <NavItem active={section === 'payments'} onClick={() => setSection('payments')} icon="💳" label="Payments" accent="rgba(255,255,255,0.9)" />
            <NavItem active={section === 'profile'} onClick={() => setSection('profile')} icon="👤" label="Profile" accent="rgba(255,255,255,0.9)" />
          </>
        )
      }}
      headerRight={
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
          <span>Student — {agencyName}</span>
        </div>
      }
    >
      {panels[section]}
    </DashLayout>
  );
}
