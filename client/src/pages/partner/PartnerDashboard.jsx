import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';
import { logoShapeStyle } from '../admin/AdminDashboard';
import MaskedContact, { maskEmail, maskPhone } from '../../components/MaskedContact';
import LogoDisplay from '../../components/LogoDisplay';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Badge({ status }) {
  const map = { active: 'badge-green', paid: 'badge-green', approved: 'badge-blue', pending: 'badge-amber', on_hold: 'badge-amber', completed: 'badge-purple', cancelled: 'badge-gray', new: 'badge-blue', contacted: 'badge-amber', demo_done: 'badge-purple', enrolled: 'badge-green', lost: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace('_', ' ')}</span>;
}

// ── SHARED FILTER COMPONENTS ─────────────────────────────────
function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  const count = selected.length;
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all whitespace-nowrap
          ${count > 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
        {label}
        {count > 0 && <span className="bg-blue-600 text-white text-[9px] font-black px-1 rounded-full min-w-[16px] text-center leading-none">{count}</span>}
        <span className="text-[10px] opacity-40 ml-0.5">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl min-w-[160px] max-h-52 overflow-y-auto py-1.5">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-slate-400 italic">No options</div>}
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const lbl = typeof opt === 'string' ? opt : opt.label;
            const checked = selected.includes(val);
            return (
              <label key={val} className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-xs transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(val)} className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0" />
                <span className={checked ? 'font-bold text-blue-700' : 'text-slate-700'}>{lbl}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterRow({ onApply, onClear, appliedCount, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
      {children}
      <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
        {appliedCount > 0 && (
          <button type="button" onClick={onClear}
            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-all">
            ✕ Clear
          </button>
        )}
        <button type="button" onClick={onApply}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-all">
          🔍 Search
        </button>
      </div>
    </div>
  );
}

// ── OVERVIEW ────────────────────────────────────────────────
function Overview({ accent }) {
  const [stats, setStats] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  useEffect(() => {
    api.get('/partner/stats').then(setStats);
    api.get('/partner/enrollments').then(e => setEnrollments(e.slice(0, 5)));
  }, []);
  if (!stats) return <div className="text-slate-400 text-sm">Loading...</div>;
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Partner Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          ['Total Students', stats.total_students],
          ['Paid Students', stats.paid_students],
          ['Total Revenue', fmt(stats.total_revenue)],
          [`My Earnings (${stats.commission_rate}%)`, fmt(stats.partner_earnings)],
        ].map(([label, val]) => (
          <div key={label} className="stat-card">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-black text-slate-900">{val}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Platform Cut ({100 - stats.commission_rate}%)</p>
          <p className="text-2xl font-black text-slate-900">{fmt(stats.platform_cut)}</p>
        </div>
        <div className="stat-card" style={{ border: `1px solid ${accent}40`, background: accent + '08' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: accent }}>Pending Payout Request</p>
          <p className="text-2xl font-black text-slate-900">{fmt(stats.pending_payout)}</p>
        </div>
      </div>
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Recent Enrollments</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Fee</th><th>Payment</th></tr></thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.student_name}</td>
                  <td className="text-slate-500 text-xs">{e.course_title}</td>
                  <td className="font-bold">{fmt(e.fee_paid)}</td>
                  <td><Badge status={e.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── STUDENTS ─────────────────────────────────────────────────
function Students({ accent, partnerPhone, agencyName, slug }) {
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.get('/partner/students').then(setStudents);
  useEffect(() => { load(); }, []);

  const base = window.location.origin;
  const signupUrl = `${base}/${slug}`;

  const waStudent = (s, text) => {
    if (!s.phone) return alert('No phone number for this student.');
    const phone = s.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const waShareLink = (s) => waStudent(s,
    `Hi ${s.name}! Take the first step toward your dream career today.\n👉 Sign up / log in to our online coaching academy and get started instantly.\n🚀 Learn, grow, and achieve your goals with ${agencyName || 'us'}\n🔗 Click here to begin: ${signupUrl}`
  );

  const waCoursePayReminder = (s) =>
    waStudent(s, `Hi ${s.name}! Your enrollment payment is pending. Please complete your payment to activate your course access. Contact us for help.`);


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/partner/students', form);
      setMsg(`Student registered! Default password: ${res.default_password}`);
      setShowForm(false); setForm({ name: '', email: '', phone: '' }); load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">My Students <span className="text-base font-normal text-slate-400 ml-2">{students.length} registered</span></h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Register Student</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm whitespace-pre-line">{msg}</div>}
      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Register New Student</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div><label>Full Name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Email</label><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="col-span-3 flex gap-2">
              <button type="submit" className="btn-success">Register</button>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Courses</th><th>Total Paid</th><th>LMS ID</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: accent }}>{s.name?.[0]}</div>
                      <span className="font-semibold">{s.name}</span>
                    </div>
                  </td>
                  <td className="text-slate-500">{s.email}</td>
                  <td className="text-slate-500">{s.phone}</td>
                  <td className="font-semibold">{s.enrollment_count}</td>
                  <td className="font-semibold text-emerald-600">{fmt(s.total_paid)}</td>
                  <td><span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{s.lms_user_id || '—'}</span></td>
                  <td className="text-slate-400 text-xs">{s.created_at?.split('T')[0]}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => waShareLink(s)}
                        title="Send signup link"
                        className="text-xs px-2 py-1 rounded-lg font-semibold text-white transition hover:opacity-90"
                        style={{ background: '#25D366' }}>📱</button>
                      {Number(s.total_paid) === 0 && (
                        <button onClick={() => waCoursePayReminder(s)}
                          title="Send payment reminder"
                          className="text-xs px-2 py-1 rounded-lg font-semibold text-white bg-amber-500 hover:bg-amber-600 transition">💳</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ENROLLMENTS ──────────────────────────────────────────────
function Enrollments({ accent, partnerPhone }) {
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_id: '', course_id: '', fee_paid: '', coupon_code: '' });
  const [msg, setMsg] = useState('');
  const [activeSection, setActiveSection] = useState('online'); // 'live' | 'online'

  // ── Filters ──────────────────────────────────────────────────
  const [search, setSearch]       = useState('');
  const [catF,   setCatF]         = useState([]);
  const [statusF, setStatusF]     = useState([]);
  const [applied, setApplied]     = useState(null);

  const handleSearch = () => setApplied({ search, catF, statusF });
  const handleClear  = () => { setSearch(''); setCatF([]); setStatusF([]); setApplied(null); };
  const appliedCount = applied ? (applied.search ? 1 : 0) + applied.catF.length + applied.statusF.length : 0;

  const CAT_OPTIONS    = ['IELTS','PTE','TOEFL','GERMAN','FRENCH','SPOKEN_ENGLISH','OTHER'];
  const STATUS_OPTIONS = ['paid','pending'];

  const load = () => api.get('/partner/enrollments').then(setEnrollments);
  useEffect(() => {
    load();
    api.get('/partner/students').then(setStudents);
    api.get('/courses').then(setCourses);
  }, []);

  const filtered = enrollments.filter(e => {
    if (!applied) return true;
    if (applied.search && !e.student_name?.toLowerCase().includes(applied.search.toLowerCase()) &&
        !e.course_title?.toLowerCase().includes(applied.search.toLowerCase())) return false;
    if (applied.catF.length    && !applied.catF.includes(e.category))        return false;
    if (applied.statusF.length && !applied.statusF.includes(e.payment_status)) return false;
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/partner/enrollments', { ...form, fee_paid: Number(form.fee_paid) });
      setMsg(`Enrolled! ${res.discount_applied > 0 ? `Coupon applied: -${fmt(res.discount_applied)}` : ''}`);
      setShowForm(false); setForm({ student_id: '', course_id: '', fee_paid: '', coupon_code: '' }); load();
    } catch (e) { setMsg(e.message); }
  };

  const markPaid = async (id) => {
    await api.put(`/partner/enrollments/${id}/payment`, {});
    load();
  };

  const waPayReminder = (e) => {
    if (!e.student_phone) return alert('No phone number for this student.');
    const phone = e.student_phone.replace(/\D/g, '');
    const msg = `Hi ${e.student_name}! Your payment of ₹${e.fee_paid} for "${e.course_title}" is pending. Please complete your payment to activate your access. Contact us if you need help or a discount coupon.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const catColors = { IELTS: 'badge-blue', PTE: 'badge-green', TOEFL: 'badge-purple', GERMAN: 'badge-amber', FRENCH: 'badge-red', SPOKEN_ENGLISH: 'badge-blue', OTHER: 'badge-gray' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-slate-900">Enrollments</h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Enroll Student</button>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveSection('live')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${activeSection === 'live' ? 'text-white border-current' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          style={activeSection === 'live' ? { background: accent, borderColor: accent } : {}}>
          🎯 Live Classes
        </button>
        <button
          onClick={() => setActiveSection('online')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${activeSection === 'online' ? 'text-white border-current' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          style={activeSection === 'online' ? { background: accent, borderColor: accent } : {}}>
          📚 Online Learning
        </button>
      </div>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}

      {activeSection === 'live' && (
        <div className="card p-6 text-center mb-6">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-bold text-slate-700 text-base">Live Class Enrollments</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Manage batch enrollments from the <strong>Batches</strong> section using the "Enroll Student" button per batch.</p>
          <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
            Go to <strong>My Batches</strong> → click <strong>+ Enroll Student</strong> on any batch row
          </div>
        </div>
      )}

      {activeSection === 'online' && <>

      {/* ── Filter bar ── */}
      <FilterRow onApply={handleSearch} onClear={handleClear} appliedCount={appliedCount}>
        <input
          type="text" placeholder="Search student / course…" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-white w-44" />
        <MultiSelectDropdown label="Category"       options={CAT_OPTIONS}    selected={catF}    onChange={setCatF} />
        <MultiSelectDropdown label="Payment Status" options={STATUS_OPTIONS} selected={statusF} onChange={setStatusF} />
        {applied && (
          <span className="text-[11px] text-slate-400 font-medium">
            {filtered.length} of {enrollments.length} shown
          </span>
        )}
      </FilterRow>

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">New Enrollment</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label>Student</label>
              <select required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}
              </select>
            </div>
            <div>
              <label>Course</label>
              <select required value={form.course_id} onChange={e => {
                const c = courses.find(c => c.id === Number(e.target.value));
                setForm({ ...form, course_id: e.target.value, fee_paid: c?.price || '' });
              }}>
                <option value="">Select course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title} — {fmt(c.price)}</option>)}
              </select>
            </div>
            <div><label>Fee Paid (₹)</label><input type="number" required value={form.fee_paid} onChange={e => setForm({ ...form, fee_paid: e.target.value })} /></div>
            <div><label>Coupon Code (optional)</label><input value={form.coupon_code} onChange={e => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} placeholder="e.g. BRIGHT20" /></div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="btn-success">Confirm Enrollment</button>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Category</th><th>Fee</th><th>Discount</th><th>Payment</th><th>Progress</th><th>Enrolled</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center text-slate-400 text-sm py-8">
                  {applied ? 'No enrollments match your filters.' : 'No enrollments yet.'}
                </td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.student_name}</td>
                  <td className="text-xs max-w-40"><div className="truncate font-medium">{e.course_title}</div></td>
                  <td><span className={`badge ${catColors[e.category] || 'badge-gray'}`}>{e.category}</span></td>
                  <td className="font-bold">{fmt(e.fee_paid)}</td>
                  <td className="text-emerald-600">{Number(e.discount_amount) > 0 ? `-${fmt(e.discount_amount)}` : '—'}</td>
                  <td><Badge status={e.payment_status} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${e.progress_percent}%`, background: accent }} />
                      </div>
                      <span className="text-xs text-slate-400">{e.progress_percent}%</span>
                    </div>
                  </td>
                  <td className="text-slate-400 text-xs">{e.enrolled_at?.split('T')[0]}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {e.payment_status === 'pending' && (
                        <>
                          <button onClick={() => markPaid(e.id)} className="text-xs font-semibold text-emerald-600 hover:underline">Mark Paid</button>
                          <button onClick={() => waPayReminder(e)}
                            className="text-xs px-2 py-0.5 rounded-lg font-semibold text-white transition hover:opacity-90"
                            style={{ background: '#25D366' }}>📱 Remind</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </> /* end activeSection === 'online' */}
    </div>
  );
}

// ── EARNINGS ─────────────────────────────────────────────────
function Earnings({ accent, commRate }) {
  const [earnings, setEarnings] = useState([]);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/partner/earnings').then(setEarnings);
    api.get('/partner/stats').then(setStats);
  }, []);
  const totalEarned = earnings.reduce((a, e) => a + Number(e.partner_earning), 0);
  const catColors = { IELTS: 'badge-blue', PTE: 'badge-green', TOEFL: 'badge-purple', GERMAN: 'badge-amber', FRENCH: 'badge-red', SPOKEN_ENGLISH: 'badge-blue', OTHER: 'badge-gray' };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Earnings Breakdown</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Gross Collections</p><p className="text-2xl font-black">{stats ? fmt(stats.total_revenue) : '...'}</p></div>
        <div className="stat-card" style={{ border: `1px solid ${accent}30`, background: accent + '06' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: accent }}>Your Earnings ({commRate}%)</p>
          <p className="text-2xl font-black">{fmt(totalEarned)}</p>
        </div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Platform Share ({100 - commRate}%)</p><p className="text-2xl font-black">{stats ? fmt(stats.platform_cut) : '...'}</p></div>
      </div>
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Per-Student Breakdown</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Category</th><th>Fee Paid</th><th>Your Earning</th><th>Platform</th><th>Date</th></tr></thead>
            <tbody>
              {earnings.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.student_name}</td>
                  <td className="text-xs max-w-40"><div className="truncate">{e.course_title}</div></td>
                  <td><span className={`badge ${catColors[e.category] || 'badge-gray'}`}>{e.category}</span></td>
                  <td className="font-semibold">{fmt(e.fee_paid)}</td>
                  <td className="font-black text-emerald-600">{fmt(e.partner_earning)}</td>
                  <td className="text-slate-400">{fmt(e.platform_cut)}</td>
                  <td className="text-slate-400 text-xs">{e.payment_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CLAIM ────────────────────────────────────────────────────
function Claim({ accent }) {
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => { api.get('/partner/payouts').then(setPayouts); api.get('/partner/stats').then(setStats); };
  useEffect(() => { load(); }, []);

  const claim = async () => {
    try {
      const res = await api.post('/partner/payouts/claim', {});
      setMsg(`Claim submitted! Amount: ${fmt(res.amount)}. Admin will review within 24 hours.`); load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Commission Claims</h2>
      {msg && <div className="mb-4 p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-sm">{msg}</div>}
      {stats && (
        <div className="card mb-6" style={{ border: `1.5px solid ${accent}40`, background: accent + '06' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: accent }}>Claimable Amount</p>
              <p className="text-3xl font-black text-slate-900">{fmt(stats.partner_earnings)}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.paid_students} paid students · {stats.commission_rate}% commission rate</p>
            </div>
            <button className="px-6 py-3 text-white font-bold rounded-xl transition hover:opacity-90 shadow-lg" style={{ background: accent }} onClick={claim}>
              Request Payout →
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Payout History</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Amount</th><th>Students</th><th>Requested</th><th>Processed</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id}>
                  <td className="font-black text-slate-900">{fmt(p.amount)}</td>
                  <td>{p.eligible_students}</td>
                  <td className="text-slate-400 text-xs">{p.requested_at?.split('T')[0]}</td>
                  <td className="text-slate-400 text-xs">{p.processed_at?.split('T')[0] || '—'}</td>
                  <td><Badge status={p.status} /></td>
                  <td className="text-slate-400 text-xs">{p.admin_note || '—'}</td>
                </tr>
              ))}
              {payouts.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">No payout requests yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CRM ──────────────────────────────────────────────────────
function CRM({ accent }) {
  const [leads, setLeads] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', course_interest: '', notes: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.get('/partner/leads').then(setLeads);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/partner/leads', form);
    setMsg('Lead added!'); setShowForm(false); setForm({ name: '', email: '', phone: '', course_interest: '', notes: '' }); load();
  };

  const updateStatus = async (id, status) => {
    await api.put(`/partner/leads/${id}`, { status }); load();
  };

  const stages = ['new', 'contacted', 'demo_done', 'enrolled', 'lost'];
  const stageLabels = { new: 'New Leads', contacted: 'Contacted', demo_done: 'Demo Done', enrolled: 'Enrolled', lost: 'Lost' };
  const stageColors = { new: '#3b82f6', contacted: '#f59e0b', demo_done: '#8b5cf6', enrolled: '#10b981', lost: '#ef4444' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">CRM — Lead Tracking <span className="text-base font-normal text-slate-400 ml-2">{leads.length} total</span></h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Add Lead</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {showForm && (
        <div className="card mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div><label>Name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>Course Interest</label><input value={form.course_interest} onChange={e => setForm({ ...form, course_interest: e.target.value })} placeholder="IELTS, PTE..." /></div>
            <div className="col-span-2"><label>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="col-span-3 flex gap-2"><button type="submit" className="btn-success">Add Lead</button><button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button></div>
          </form>
        </div>
      )}
      <div className="grid grid-cols-5 gap-3">
        {stages.map(stage => (
          <div key={stage} className="bg-slate-50 rounded-2xl p-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: stageColors[stage] }} />
              {stageLabels[stage]}
              <span className="ml-auto text-slate-400">{leads.filter(l => l.status === stage).length}</span>
            </div>
            {leads.filter(l => l.status === stage).map(lead => (
              <div key={lead.id} className="bg-white rounded-xl p-3 mb-2 border border-slate-100 shadow-sm">
                <div className="font-semibold text-sm text-slate-900 mb-1">{lead.name}</div>
                <div className="text-xs text-slate-400 mb-2">{lead.course_interest}</div>
                <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-full" value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}>
                  {stages.map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
                </select>
              </div>
            ))}
            {leads.filter(l => l.status === stage).length === 0 && (
              <div className="text-xs text-slate-300 text-center py-4">Empty</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COUPONS ──────────────────────────────────────────────────
function Coupons({ accent }) {
  const [coupons, setCoupons] = useState([]);
  const [classCoupons, setClassCoupons] = useState([]);
  const [tab, setTab] = useState('class');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', value: '', min_order: '', max_uses: 100, expires_at: '' });
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(null);
  const load = () => {
    api.get('/partner/coupons').then(setCoupons).catch(() => {});
    api.get('/partner/class-coupons').then(setClassCoupons).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/partner/coupons', form);
      setMsg('Coupon created!'); setShowForm(false); load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Coupons</h2>
        {tab === 'discount' && (
          <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Create Discount Coupon</button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {[['class','🎓 Class-Access (from Admin)'],['discount','🏷️ Discount Coupons']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t ? 'text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            style={tab===t ? {background:accent} : {}}>
            {l}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}

      {/* Class-access coupons from admin */}
      {tab === 'class' && (
        <div>
          <p className="text-sm text-slate-400 mb-4">These codes are created by the admin and assigned to your academy. Share them with students so they can join live classes for free (limited access).</p>
          {classCoupons.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">
              <p className="text-3xl mb-2">🎟️</p>
              <p>No class-access coupons assigned to your academy yet.</p>
              <p className="text-sm mt-1">Contact the admin to create one for you.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {classCoupons.map(c => (
                <div key={c.id} className="card relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{background:accent}} />
                  <div className="flex items-start justify-between mt-2">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-black text-2xl text-slate-900 bg-slate-100 px-4 py-1.5 rounded-xl border-2 border-dashed border-slate-300">{c.code}</span>
                        <button onClick={() => copyCode(c.code)}
                          className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-slate-50"
                          style={{borderColor:accent, color:accent}}>
                          {copied === c.code ? '✓ Copied!' : 'Copy'}
                        </button>
                      </div>
                      {c.description && <p className="text-sm text-slate-500 mb-2">{c.description}</p>}
                      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                        <span className="badge badge-blue">
                          {c.access_type === 'unlimited' ? 'Unlimited' : `${c.allowed_count} ${c.access_type === 'class_count' ? 'classes' : 'hours'} per student`}
                        </span>
                        <span>{c.used_count}/{c.max_redemptions} redeemed</span>
                        {c.expires_at && <span>Expires {new Date(c.expires_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Discount coupons */}
      {tab === 'discount' && (
        <>
          {showForm && (
            <div className="card mb-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
                <div><label className="label">Coupon Code</label><input className="input" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
                <div><label className="label">Discount Type</label><select className="input" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}><option value="percentage">Percentage %</option><option value="fixed">Fixed ₹</option></select></div>
                <div><label className="label">Value</label><input className="input" type="number" required value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
                <div><label className="label">Min Order (₹)</label><input className="input" type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} /></div>
                <div><label className="label">Max Uses</label><input className="input" type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} /></div>
                <div><label className="label">Expires At</label><input className="input" type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div>
                <div className="col-span-3 flex gap-2"><button type="submit" className="btn-primary" style={{background:accent}}>Create Coupon</button><button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map(c => (
              <div key={c.id} className="card">
                <div className="text-center mb-4">
                  <div className="inline-block font-mono font-black text-xl bg-slate-100 px-4 py-2 rounded-xl text-slate-900 border-2 border-dashed border-slate-200">{c.code}</div>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-slate-400">Discount</div>
                  <div className="font-bold text-emerald-600">{c.discount_type === 'percentage' ? `${c.value}% off` : `₹${c.value} off`}</div>
                  <div className="text-slate-400">Used</div>
                  <div>{c.used_count} / {c.max_uses}</div>
                  <div className="text-slate-400">Expires</div>
                  <div className="text-xs">{c.expires_at || 'No expiry'}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── BRANDING ─────────────────────────────────────────────────
const FIT_OPTIONS_P = [
  { value: 'contain', label: 'Contain', desc: 'Show full logo', icon: '⬜' },
  { value: 'cover',   label: 'Cover',   desc: 'Fill & crop', icon: '🔳' },
  { value: 'fill',    label: 'Fill',    desc: 'Stretch', icon: '▬' },
];
const BG_OPTIONS_P = [
  { value: 'white',       label: 'White',       desc: 'White background' },
  { value: 'transparent', label: 'Transparent', desc: 'No background' },
  { value: 'brand',       label: 'Brand Color', desc: 'Your brand color' },
  { value: 'light',       label: 'Light Tint',  desc: 'Subtle color wash' },
];
const PAD_OPTIONS_P = [{ value:0,label:'None' },{ value:6,label:'Small' },{ value:12,label:'Medium' },{ value:18,label:'Large' }];
const SHAPE_OPTIONS_P = [
  { id:'rounded',label:'Rounded' },{ id:'circle',label:'Circle' },{ id:'square',label:'Square' },{ id:'oval',label:'Oval' },
];

function Branding({ user, accent, logoUrl, onLogoChange }) {
  const slug     = user?.slug || user?.agency_slug || '';
  const commRate = user?.commission_rate || 0;
  const initials = user?.logo_initials || user?.agency_name?.slice(0,2).toUpperCase() || 'P';

  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [dragging, setDragging] = useState(false);

  // Local logo appearance state (loaded from user, editable)
  const [fit,     setFit]     = useState(user?.logo_fit     || 'contain');
  const [bg,      setBg]      = useState(user?.logo_bg      || 'white');
  const [padding, setPadding] = useState(user?.logo_padding != null ? Number(user.logo_padding) : 8);
  const [shape,   setShape]   = useState(user?.logo_shape   || 'rounded');
  const [saving,  setSaving]  = useState(false);

  const uploadFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg('❌ Image must be under 2 MB'); return; }
    setUploading(true); setMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await api.post('/partner/logo', { logo_url: ev.target.result });
        onLogoChange(res.logo_url);
        setMsg('✅ Logo uploaded!');
      } catch (e) { setMsg('❌ ' + e.message); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const saveAppearance = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/partner/logo', { logo_fit: fit, logo_bg: bg, logo_padding: padding });
      setMsg('✅ Appearance saved!');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setSaving(false); }
  };

  const PREVIEW_SIZES = [{ label: 'Sidebar', size: 64 }, { label: 'Nav', size: 40 }, { label: 'Badge', size: 28 }];

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Branding Configuration</h2>

      {/* ── Logo Editor ── */}
      <div className="card mb-6">
        <h3 className="font-black text-slate-900 mb-1">🖼 Institute Logo</h3>
        <p className="text-sm text-slate-400 mb-5">PNG or SVG with transparent background works best. Adjust how it looks below.</p>

        {/* Upload drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); uploadFile(e.dataTransfer.files[0]); }}
          className={`relative rounded-2xl border-2 border-dashed p-6 transition mb-5 flex flex-col items-center gap-3
            ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 bg-slate-50/60'}`}>

          {/* Live preview at multiple sizes */}
          <div className="flex items-end gap-5 mb-1">
            {PREVIEW_SIZES.map(p => (
              <div key={p.label} className="flex flex-col items-center gap-1.5">
                <LogoDisplay logoUrl={logoUrl} fit={fit} bg={bg} padding={padding}
                  brandColor={accent} initials={initials} shape={shape} size={p.size} />
                <span className="text-[10px] text-slate-400 font-medium">{p.label}</span>
              </div>
            ))}
            {/* Dark sidebar context preview */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="rounded-xl p-2 flex items-center justify-center"
                style={{ background: accent, width: 64, height: 64 }}>
                <LogoDisplay logoUrl={logoUrl} fit={fit} bg={bg} padding={padding}
                  brandColor={accent} initials={initials} shape={shape} size={44} />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">On Brand</span>
            </div>
          </div>

          <label className={`cursor-pointer px-5 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 ${uploading ? 'opacity-60' : ''}`}
            style={{ background: accent }}>
            {uploading ? '⏳ Uploading…' : logoUrl ? '🔄 Change Logo' : '📁 Upload Logo'}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden" disabled={uploading}
              onChange={e => uploadFile(e.target.files[0])} />
          </label>
          <p className="text-xs text-slate-400">PNG, SVG or JPG · Max 2 MB · Drag & drop supported</p>
          {logoUrl && (
            <button onClick={async () => {
              await api.post('/partner/logo', { logo_url: '' });
              onLogoChange(null); setMsg('Logo removed.');
            }} className="text-xs text-red-500 hover:text-red-700 font-semibold underline">
              Remove logo
            </button>
          )}
        </div>

        {/* Appearance controls */}
        <div className="space-y-5">
          {/* Background */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Logo Background</p>
            <div className="grid grid-cols-2 gap-2">
              {BG_OPTIONS_P.map(opt => {
                const preview = opt.value === 'white' ? '#fff' : opt.value === 'brand' ? accent
                  : opt.value === 'light' ? accent + '1a'
                  : 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px';
                return (
                  <button key={opt.value} onClick={() => setBg(opt.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition
                      ${bg === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-slate-200" style={{ background: preview }} />
                    <div>
                      <p className={`text-xs font-bold ${bg === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                      <p className="text-[10px] text-slate-400">{opt.desc}</p>
                    </div>
                    {bg === opt.value && <span className="ml-auto text-blue-600">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fit */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Logo Fit</p>
            <div className="flex gap-2">
              {FIT_OPTIONS_P.map(opt => (
                <button key={opt.value} onClick={() => setFit(opt.value)}
                  className={`flex-1 p-3 rounded-xl border-2 text-center transition
                    ${fit === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="text-base mb-0.5">{opt.icon}</div>
                  <p className={`text-xs font-bold ${fit === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                  <p className="text-[10px] text-slate-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Padding */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Inner Padding</p>
            <div className="flex gap-2">
              {PAD_OPTIONS_P.map(opt => (
                <button key={opt.value} onClick={() => setPadding(opt.value)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition
                    ${padding === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shape */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Logo Shape</p>
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_OPTIONS_P.map(s => (
                <button key={s.id} onClick={() => setShape(s.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition
                    ${shape === s.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <LogoDisplay logoUrl={logoUrl} fit={fit} bg={bg} padding={padding}
                    brandColor={accent} initials={initials} shape={s.id} size={36} />
                  <span className={`text-[10px] font-bold ${shape === s.id ? 'text-blue-600' : 'text-slate-500'}`}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {msg && <p className={`text-sm font-semibold ${msg.includes('✅') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
          <button onClick={saveAppearance} disabled={saving}
            className="w-full py-2.5 rounded-xl font-black text-white text-sm transition hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}>
            {saving ? 'Saving…' : '💾 Save Logo Appearance'}
          </button>
        </div>
      </div>

      {/* Agency Profile Card */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 p-4 rounded-xl mb-5" style={{ background: accent + '10', border: `1px solid ${accent}30` }}>
          <LogoDisplay logoUrl={logoUrl} fit={fit} bg={bg} padding={padding}
            brandColor={accent} initials={initials} shape={shape} size={64} />
          <div>
            <div className="text-xl font-black text-slate-900">{user?.agency_name}</div>
            <div className="text-sm font-mono" style={{ color: accent }}>{window.location.hostname}/{slug}</div>
            <div className="text-sm text-slate-400 mt-1">{user?.agency_email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">Brand Color</div><div className="flex items-center gap-2"><div className="w-6 h-6 rounded" style={{ background: accent }} />{accent}</div></div>
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">Commission Rate</div>{commRate}% partner / {100 - commRate}% platform</div>
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">City</div>{user?.city || '—'}</div>
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">Phone</div>{user?.agency_phone || '—'}</div>
        </div>
      </div>
      <div className="card mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Student Signup Link</h3>
        <p className="text-sm text-slate-500 mb-3">Share this link with prospective students. They'll sign up under your institute automatically.</p>
        <SignupLinkBox slug={slug} accent={accent} agencyName={user?.agency_name} />
      </div>
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-2">White-Label Info</h3>
        <p className="text-sm text-slate-500 mb-3">Your portal is completely white-labeled. Students see only your branding.</p>
        <div className="space-y-2 text-sm">
          {[
            ['Student portal', `/${slug}`],
            ['Student signup', `/${slug}/signup`],
            ['Partner login', `/${slug}/login`],
            ['LMS exposure', 'None — fully hidden'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-4 p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 w-40 flex-shrink-0">{k}</span>
              <span className="font-mono text-xs text-slate-700">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PARTNER PAYMENT CONFIG ────────────────────────────────────
function PartnerPaymentConfig({ accent }) {
  const [cfg, setCfg] = useState(null);
  const [permitted, setPermitted] = useState(null);
  const [form, setForm] = useState({ upi_id:'', upi_name:'', qr_code_image:'', payment_link:'', mobile_number:'', mobile_instructions:'' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/partner/payment-config').then(d => {
      setPermitted(true);
      setCfg(d);
      if (d) setForm({
        upi_id: d.upi_id||'', upi_name: d.upi_name||'',
        qr_code_image: d.qr_code_image||'', payment_link: d.payment_link||'',
        mobile_number: d.mobile_number||'', mobile_instructions: d.mobile_instructions||'',
      });
    }).catch(e => {
      if (e.message?.includes('403') || e.message?.toLowerCase().includes('permission')) setPermitted(false);
    });
  }, []);

  const handleQR = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, qr_code_image: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/partner/payment-config', form);
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  if (permitted === null) return <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>;

  if (permitted === false) return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-4">Payment Configuration</h2>
      <div className="card max-w-lg">
        <div className="flex flex-col items-center text-center p-6 gap-3">
          <span className="text-5xl">🔒</span>
          <h3 className="text-lg font-black text-slate-800">Payment Config Locked</h3>
          <p className="text-sm text-slate-500">Your payment method is managed by the platform admin. Students will see the admin-configured payment details.</p>
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-2 font-semibold mt-2">Contact the platform admin if you need to configure a custom payment method for your students.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-2">Payment Configuration</h2>
      <p className="text-sm text-slate-500 mb-5">These payment details will be shown to your students when they click Pay Now.</p>
      <div className="max-w-lg space-y-5">
        <div className="p-4 bg-blue-50 rounded-xl space-y-3">
          <p className="text-xs font-black text-blue-700 uppercase tracking-wide">💳 UPI Payment</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">UPI ID</label>
              <input value={form.upi_id} onChange={e => setForm(f=>({...f,upi_id:e.target.value}))}
                placeholder="name@upi" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Account Name</label>
              <input value={form.upi_name} onChange={e => setForm(f=>({...f,upi_name:e.target.value}))}
                placeholder="Recipient name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
          <p className="text-xs font-black text-slate-700 uppercase tracking-wide">📷 QR Code</p>
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition
            ${form.qr_code_image ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:bg-slate-100'}`}>
            {form.qr_code_image
              ? <img src={form.qr_code_image} alt="QR" className="h-full object-contain rounded-lg p-1" />
              : <><span className="text-3xl mb-1">📷</span><span className="text-xs text-slate-500">Click to upload QR code image</span></>
            }
            <input type="file" accept="image/*" className="hidden" onChange={handleQR} />
          </label>
          {form.qr_code_image && (
            <button onClick={() => setForm(f=>({...f,qr_code_image:''}))} className="text-xs text-red-500 hover:underline">Remove QR</button>
          )}
        </div>

        <div className="p-4 bg-emerald-50 rounded-xl">
          <p className="text-xs font-black text-emerald-700 uppercase tracking-wide mb-2">🔗 Payment Link</p>
          <input value={form.payment_link} onChange={e => setForm(f=>({...f,payment_link:e.target.value}))}
            placeholder="https://rzp.io/l/... or any payment URL"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>

        <div className="p-4 bg-purple-50 rounded-xl space-y-3">
          <p className="text-xs font-black text-purple-700 uppercase tracking-wide">📱 Mobile Pay (Paytm / PhonePe / GPay)</p>
          <input value={form.mobile_number} onChange={e => setForm(f=>({...f,mobile_number:e.target.value}))}
            placeholder="+91 98765 43210"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          <textarea value={form.mobile_instructions} onChange={e => setForm(f=>({...f,mobile_instructions:e.target.value}))}
            placeholder="e.g. Send to this number via Paytm. Add your name in remarks."
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
        </div>

        {msg && <p className={`text-xs font-bold ${msg==='Saved!' ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl font-black text-white text-sm transition disabled:opacity-50"
          style={{ background: accent }}>
          {saving ? 'Saving...' : 'Save Payment Config'}
        </button>
      </div>
    </div>
  );
}

// ── SIGNUP LINK BOX ─────────────────────────────────────────
function SignupLinkBox({ slug, accent, agencyName }) {
  const [copied, setCopied] = useState(false);
  const base = window.location.origin;
  const signupUrl = `${base}/${slug}`;
  const shareMsg = `Take the first step toward your dream career today.\n👉 Sign up / log in to our online coaching academy and get started instantly.\n🚀 Learn, grow, and achieve your goals with ${agencyName || 'our Academy'}\n🔗 Click here to begin: ${signupUrl}`;
  const copy = () => { navigator.clipboard.writeText(signupUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const shareWA = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
  const shareEmail = () => window.open(`mailto:?subject=Join ${agencyName || 'Our Academy'}&body=${encodeURIComponent(shareMsg)}`, '_blank');
  return (
    <div>
      <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed" style={{ borderColor: accent + '60', background: accent + '08' }}>
        <span className="font-mono text-xs text-slate-700 flex-1 truncate">{signupUrl}</span>
        <button onClick={copy}
          className="flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: accent }}>
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={shareWA}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: '#25D366' }}>
          <span>📱</span> WhatsApp
        </button>
        <button onClick={shareEmail}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: '#6366f1' }}>
          <span>✉️</span> Email
        </button>
      </div>
    </div>
  );
}

// ── ENROLL STUDENT MODAL (per batch) ────────────────────────
function EnrollStudentModal({ batch, accent, students, onClose, onSuccess }) {
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [studentId, setStudentId] = useState('');
  const [newStudent, setNewStudent] = useState({ name: '', email: '', phone: '' });
  const [accessType, setAccessType] = useState('full');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const payload = { access_type: accessType };
      if (mode === 'existing') {
        if (!studentId) { setMsg('Please select a student.'); setSubmitting(false); return; }
        payload.student_id = Number(studentId);
      } else {
        if (!newStudent.name || !newStudent.email) { setMsg('Name and email are required.'); setSubmitting(false); return; }
        payload.new_student = newStudent;
      }
      await api.post(`/batches/${batch.id}/enroll`, payload);
      setMsg('');
      onSuccess('Student enrolled successfully!');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900">Enroll Student</h3>
            <p className="text-xs text-slate-500 mt-0.5">{batch.name} · {batch.course_title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {[['existing', 'Existing Student'], ['new', 'Add New Student']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all ${mode === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                {l}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Select Student</label>
              <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
                <option value="">Choose a student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}
              </select>
              {students.length === 0 && <p className="text-xs text-slate-400 mt-1">No students found. Add students first or use "Add New Student".</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Full Name *</label>
                <input className="input" required placeholder="Student name" value={newStudent.name}
                  onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Email *</label>
                <input type="email" className="input" required placeholder="student@email.com" value={newStudent.email}
                  onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Phone</label>
                <input className="input" placeholder="Mobile number" value={newStudent.phone}
                  onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
              </div>
            </div>
          )}

          {/* Access type */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Access Type</label>
            <div className="flex gap-3">
              {[
                { v: 'full', l: '✅ Full', desc: 'Permanent enrolled access' },
                { v: 'demo', l: '🎯 Demo', desc: 'Full trial access to all classes' },
              ].map(({ v, l, desc }) => (
                <label key={v} className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 cursor-pointer transition flex-1 justify-center text-sm font-bold
                  ${accessType === v ? 'border-current text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  style={accessType === v ? { background: accent, borderColor: accent } : {}}>
                  <input type="radio" name="access_type" value={v} checked={accessType === v}
                    onChange={() => setAccessType(v)} className="hidden" />
                  <span>{l}</span>
                  <span className={`text-[10px] font-medium leading-tight text-center ${accessType === v ? 'text-white/80' : 'text-slate-400'}`}>{desc}</span>
                </label>
              ))}
            </div>
          </div>

          {msg && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{msg}</div>}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting}
              className="flex-1 py-3 rounded-xl font-black text-white text-sm transition hover:opacity-90 disabled:opacity-50"
              style={{ background: accent }}>
              {submitting ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BATCHES (Partner) ───────────────────────────────────────
function PartnerBatches({ accent }) {
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [enrollModal, setEnrollModal] = useState(null); // batch object
  const [editDates, setEditDates] = useState(null); // batch id being date-edited
  const [form, setForm] = useState({
    course_id: '', name: '', description: '',
    start_date: '', end_date: '', schedule_days: 'Mon,Tue,Wed,Thu,Fri',
    class_time: '09:00', duration_minutes: 60,
    trainer_id: '', trainer_name: '', max_students: 20
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBatches();
    api.get('/courses').then(setCourses);
    api.get('/partner/faculty').then(setFacultyList).catch(() => {});
    api.get('/partner/students').then(setStudents).catch(() => {});
  }, []);

  const loadBatches = () => api.get('/partner/batches').then(setBatches);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/partner/batches', form);
      setMsg('Batch created!'); setShowForm(false); loadBatches();
      setForm({ course_id: '', name: '', description: '',
        start_date: '', end_date: '', schedule_days: 'Mon,Tue,Wed,Thu,Fri',
        class_time: '09:00', duration_minutes: 60,
        trainer_name: '', max_students: 20 });
    } catch (e) { setMsg(e.message); }
  };

  // Split batches into Live Classes (have start_date + class_time) and others
  const liveBatches = batches.filter(b => b.start_date && b.class_time);
  const onlineBatches = batches.filter(b => !b.start_date || !b.class_time);

  const [expandedBatch, setExpandedBatch] = useState(null);

  const EditDatesInline = ({ batch, accent: col, onSave, onCancel }) => {
    const [sd, setSd] = useState(batch.start_date ? batch.start_date.slice(0,10) : '');
    const [ed, setEd] = useState(batch.end_date ? batch.end_date.slice(0,10) : '');
    const [saving, setSaving] = useState(false);
    const handleSave = async () => {
      setSaving(true);
      try { await api.put(`/partner/batches/${batch.id}`, { start_date: sd, end_date: ed }); onSave(); }
      catch (e) { alert(e.message); setSaving(false); }
    };
    return (
      <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start Date</label>
          <input type="date" value={sd} onChange={e => setSd(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2" style={{ '--tw-ring-color': col }} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End Date</label>
          <input type="date" value={ed} onChange={e => setEd(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2" style={{ '--tw-ring-color': col }} />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 rounded-lg text-xs font-black text-white transition hover:opacity-90"
          style={{ background: col }}>{saving ? 'Saving…' : '✅ Save'}</button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
      </div>
    );
  };

  const CAT_COLORS_P = { IELTS:'#2563eb', PTE:'#059669', TOEFL:'#7c3aed', GERMAN:'#d97706', FRENCH:'#db2777', SPOKEN_ENGLISH:'#0891b2', OTHER:'#475569' };
  const CAT_ICONS_P  = { IELTS:'🇬🇧', PTE:'🎓', TOEFL:'🌐', GERMAN:'🇩🇪', FRENCH:'🇫🇷', SPOKEN_ENGLISH:'🗣️', OTHER:'📚' };
  const fmtD = s => s ? new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const parseDayAbbr = str => (str||'').split(',').map(d=>({Mon:'Mo',Tue:'Tu',Wed:'We',Thu:'Th',Fri:'Fr',Sat:'Sa',Sun:'Su'})[d.trim()]||d.trim());

  const BatchAccordion = ({ rows, sectionLabel }) => (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100 bg-white">
      {rows.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-10">
          <div className="text-3xl mb-2">📭</div>
          No {sectionLabel} batches yet.
        </div>
      ) : rows.map(b => {
        const col = CAT_COLORS_P[b.category] || accent;
        const isOpen = expandedBatch === b.id;
        const enrolled = parseInt(b.enrolled_students) || 0;
        const maxS = parseInt(b.max_students) || 0;
        const seatPct = maxS > 0 ? Math.min(100, Math.round(enrolled / maxS * 100)) : 0;
        const timeStr = b.class_time ? b.class_time.slice(0,5) : '—';
        const endTime = (() => {
          if (!b.class_time || !b.duration_minutes) return '';
          const [h,m] = b.class_time.split(':').map(Number);
          const tot = h*60 + m + parseInt(b.duration_minutes);
          return ` – ${String(Math.floor(tot/60)).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`;
        })();
        const days = parseDayAbbr(b.schedule_days).join(' · ') || 'Daily';

        return (
          <div key={b.id} className="bg-white">
            {/* ── Collapsed row ── */}
            <button
              onClick={() => setExpandedBatch(isOpen ? null : b.id)}
              className="w-full flex items-center gap-0 text-left hover:bg-slate-50 transition-colors focus:outline-none group">
              <div className="w-1 self-stretch flex-shrink-0" style={{ background: col }} />
              <div className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: col + '18' }}>
                  {CAT_ICONS_P[b.category] || '📚'}
                </div>
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-black text-slate-900 text-sm truncate">{b.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{b.course_title}</div>
                </div>
                {/* Pills */}
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full whitespace-nowrap">⏰ {timeStr}{endTime}</span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full whitespace-nowrap">📆 {days}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: col+'12', color: col }}>👥 {enrolled}/{maxS}</span>
                </div>
                {/* Status + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                  <span className={`hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status==='active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {b.status==='active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}{b.status}
                  </span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{ background: isOpen ? col+'18' : '#f1f5f9' }}>
                    <svg className="w-3.5 h-3.5 transition-transform duration-300" style={{ color: isOpen ? col : '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* ── Expanded panel ── */}
            {isOpen && (
              <div className="px-5 pb-5 pt-2" style={{ borderTop:`1px solid ${col}20`, background: col+'04' }}>
                {/* Detail grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    ['🗓 Dates',    `${fmtD(b.start_date)}${b.end_date ? ' → '+fmtD(b.end_date) : ' (Ongoing)'}`],
                    ['⏰ Timings',  `${timeStr}${endTime} · ${b.duration_minutes||60} min`],
                    ['📆 Days',     days],
                    b.trainer_name && ['👨‍🏫 Trainer', b.trainer_name],
                    ['👥 Seats',    `${enrolled} enrolled · ${Math.max(0, maxS-enrolled)} remaining`],
                    ['📋 Status',   b.status],
                  ].filter(Boolean).map(([lbl, val]) => (
                    <div key={lbl} className="bg-white rounded-xl px-3 py-2.5 border border-slate-100 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{lbl}</div>
                      <div className="text-xs font-bold text-slate-800 leading-snug">{val}</div>
                    </div>
                  ))}
                </div>
                {/* Seat bar */}
                {maxS > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                      <span>Seat occupancy</span><span>{seatPct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${seatPct}%`, background: col }} />
                    </div>
                  </div>
                )}
                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setEnrollModal(b)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-white hover:opacity-90 transition shadow-sm"
                    style={{ background: col }}>
                    ➕ Enroll Student
                  </button>
                  <button
                    onClick={() => { setEditDates(b.id); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black border-2 transition hover:shadow-sm"
                    style={{ borderColor: col, color: col, background: col+'08' }}>
                    ✏️ Edit Dates
                  </button>
                </div>
                {/* Inline date edit */}
                {editDates === b.id && (
                  <EditDatesInline batch={b} accent={col} onSave={() => { setEditDates(null); loadBatches(); }} onCancel={() => setEditDates(null)} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">My Batches <span className="text-base font-normal text-slate-400 ml-2">{batches.length} batches assigned</span></h2>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
          🔒 Batch creation is managed by admin
        </div>
      </div>

      {msg && <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm">{msg}</div>}

      {/* ── Section 1: Live Classes ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎯</span>
          <h3 className="text-base font-black text-slate-900">Live Classes</h3>
          <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">{liveBatches.length} batches</span>
          <span className="text-[11px] text-slate-400 ml-1">— click a row to expand &amp; enroll students</span>
        </div>
        <BatchAccordion rows={liveBatches} sectionLabel="live" />
      </div>

      {/* ── Section 2: Online Learning ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📚</span>
          <h3 className="text-base font-black text-slate-900">Online Learning</h3>
          <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">{onlineBatches.length} batches</span>
        </div>
        <BatchAccordion rows={onlineBatches} sectionLabel="online" />
      </div>

      {/* Enroll modal */}
      {enrollModal && (
        <EnrollStudentModal
          batch={enrollModal}
          accent={accent}
          students={students}
          onClose={() => setEnrollModal(null)}
          onSuccess={(successMsg) => {
            setMsg(successMsg);
            setEnrollModal(null);
            loadBatches();
          }}
        />
      )}
    </div>
  );
}

// ── LIVE CLASSES (Partner) ───────────────────────────────────
function PartnerLiveClasses({ accent }) {
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    batch_id: '', title: '', description: '',
    scheduled_at: '', duration_minutes: 60,
    class_mode: 'interactive'
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadClasses();
    api.get('/partner/batches').then(setBatches);
  }, []);

  const loadClasses = () => api.get('/live-classes').then(setClasses);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/live-classes', form);
      setMsg('Live class scheduled!'); setShowForm(false); loadClasses();
      setForm({ batch_id: '', title: '', description: '',
        scheduled_at: '', duration_minutes: 60, class_mode: 'interactive' });
    } catch (e) { setMsg(e.message); }
  };

  const isLive = (scheduledAt) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diff = Math.abs(now - scheduled) / (1000 * 60);
    return diff < 60;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Live Classes <span className="text-base font-normal text-slate-400 ml-2">{classes.length} scheduled</span></h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Schedule Class</button>
      </div>

      {msg && <div className="mb-4 text-sm text-red-600">{msg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Schedule Live Class</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Batch</label>
              <select className="input" required value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})}>
                <option value="">Select Batch</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Title</label>
              <input className="input" required placeholder="e.g., Reading Session 1" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>
            <div>
              <label className="label">Date & Time</label>
              <input type="datetime-local" className="input" required value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" className="input" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={form.class_mode} onChange={e => setForm({...form, class_mode: e.target.value})}>
                <option value="interactive">Interactive</option>
                <option value="broadcast">Broadcast</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary" style={{ background: accent }}>Schedule</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Class</th><th>Batch</th><th>Scheduled</th><th>Mode</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {classes.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{c.title}</div>
                    <div className="text-xs text-slate-400">{c.description?.slice(0, 40)}...</div>
                  </td>
                  <td>{c.batch_name}</td>
                  <td>{new Date(c.scheduled_at).toLocaleString()}</td>
                  <td><span className="badge badge-blue">{c.class_mode}</span></td>
                  <td><Badge status={c.status} /></td>
                  <td>
                    {(isLive(c.scheduled_at) || c.status === 'live') && (
                      <button className="btn-primary text-xs" style={{ background: accent }} onClick={() => window.open(`/live-class/${c.id}`, '_blank')}>
                        Start Class
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ONLINE PURCHASES ─────────────────────────────────────────
function OnlinePurchases({ accent, partnerPhone }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/partner/purchases').then(setPurchases).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const markPaid = async (id) => {
    try {
      await api.put(`/partner/enrollments/${id}/payment`, {});
      setMsg('Payment marked as paid!');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(e.message); }
  };

  const waPayReminder = (p) => {
    if (!p.student_phone) return alert('No phone number for this student.');
    const phone = p.student_phone.replace(/\D/g, '');
    const msg = `Hi ${p.student_name}! Your payment of ₹${p.fee_paid} for "${p.course_title}" is pending. Please complete your payment to activate your access. Contact us if you need help.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const paid = purchases.filter(p => p.payment_status === 'paid');
  const pending = purchases.filter(p => p.payment_status === 'pending');

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-2">Online Purchases & Bookings</h2>
      <p className="text-sm text-slate-500 mb-6">Students who self-enrolled via the course catalog.</p>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Enrollments</p>
          <p className="text-2xl font-black text-slate-900">{purchases.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Paid</p>
          <p className="text-2xl font-black text-emerald-600">{paid.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Pending Payment</p>
          <p className="text-2xl font-black text-amber-500">{pending.length}</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-amber-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pending Payment Confirmation ({pending.length})
          </h3>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Course</th><th>Amount</th><th>Enrolled</th><th>Action</th></tr></thead>
                <tbody>
                  {pending.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold">{p.student_name}</div>
                        <div className="text-xs text-slate-400">{p.student_email}</div>
                      </td>
                      <td>
                        <div className="font-medium text-sm">{p.course_title}</div>
                        <span className="badge badge-blue text-xs">{p.category}</span>
                      </td>
                      <td className="font-black">{fmt(p.fee_paid)}</td>
                      <td className="text-xs text-slate-400">{p.enrolled_at?.split('T')[0]}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => markPaid(p.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-bold text-white transition hover:opacity-90"
                            style={{ background: accent }}>
                            Mark Paid
                          </button>
                          <button onClick={() => waPayReminder(p)}
                            className="text-xs px-3 py-1.5 rounded-lg font-bold text-white transition hover:opacity-90"
                            style={{ background: '#25D366' }}>
                            📱 Remind
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <h3 className="text-sm font-bold text-slate-700 mb-3">All Purchases</h3>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8">No purchases yet. Share your catalog link with students!</td></tr>
              ) : purchases.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="font-semibold">{p.student_name}</div>
                    <div className="text-xs text-slate-400">{p.student_email}</div>
                  </td>
                  <td className="text-sm">{p.course_title}</td>
                  <td className="font-bold">{fmt(p.fee_paid)}</td>
                  <td><Badge status={p.payment_status} /></td>
                  <td className="text-xs text-slate-400">{p.enrolled_at?.split('T')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── FACULTY ──────────────────────────────────────────────────
function PartnerFaculty({ accent }) {
  const [faculty, setFaculty] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [assignModal, setAssignModal] = useState(null); // faculty obj
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState('');

  const loadFaculty = () => api.get('/partner/faculty').then(setFaculty);
  useEffect(() => {
    loadFaculty();
    api.get('/partner/batches').then(setBatches);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/partner/faculty', form);
      setMsg(res.message || 'Faculty created! Default password: Faculty@123');
      setShowForm(false);
      setForm({ name: '', email: '', phone: '' });
      loadFaculty();
    } catch (e) { setMsg(e.message); }
  };

  const handleAssign = async (batchId, trainerId) => {
    try {
      await api.put(`/partner/batches/${batchId}/assign-faculty`, { trainer_id: trainerId });
      setMsg('Faculty assigned to batch!');
      setAssignModal(null);
      loadFaculty();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Faculty <span className="text-base font-normal text-slate-400 ml-2">{faculty.length} instructors</span></h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>
          + Add Faculty
        </button>
      </div>

      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">{msg}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Add Faculty Member</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" required placeholder="Instructor name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required placeholder="instructor@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="Mobile" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Default password: <strong>Faculty@123</strong></p>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary" style={{ background: accent }}>Create Faculty</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Faculty</th><th>Email</th><th>Batches</th><th>Actions</th></tr></thead>
            <tbody>
              {faculty.map(f => (
                <tr key={f.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: accent }}>{f.name?.[0]}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-400">{f.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">{f.email}</td>
                  <td><span className="badge badge-blue">{f.batch_count} batches</span></td>
                  <td>
                    <button
                      className="text-sm font-medium px-3 py-1 rounded-lg border transition-colors hover:bg-slate-50"
                      style={{ borderColor: accent, color: accent }}
                      onClick={() => setAssignModal(f)}>
                      Assign to Batch
                    </button>
                  </td>
                </tr>
              ))}
              {faculty.length === 0 && (
                <tr><td colSpan="4" className="text-center text-slate-400 py-8">No faculty yet. Add your first instructor above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign to Batch Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900">Assign {assignModal.name} to Batch</h3>
              <button onClick={() => setAssignModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {batches.map(b => (
                <button key={b.id} onClick={() => handleAssign(b.id, assignModal.id)}
                  className="w-full text-left p-3 rounded-xl border hover:border-current transition-colors flex items-center justify-between"
                  style={{ '--hover-color': accent }}>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{b.name}</div>
                    <div className="text-xs text-slate-400">{b.course_title} · {b.status}</div>
                  </div>
                  {b.trainer_name && (
                    <span className="text-xs text-slate-400">Current: {b.trainer_name}</span>
                  )}
                </button>
              ))}
              {batches.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No batches found</p>}
            </div>
            <button onClick={() => setAssignModal(null)}
              className="mt-4 w-full py-2 rounded-xl border text-slate-600 text-sm hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PHONE INPUT WITH COUNTRY CODE ────────────────────────────
const COUNTRY_CODES = [
  { code: '+91', country: '🇮🇳 India' },
  { code: '+1',  country: '🇺🇸 USA/Canada' },
  { code: '+44', country: '🇬🇧 UK' },
  { code: '+61', country: '🇦🇺 Australia' },
  { code: '+64', country: '🇳🇿 New Zealand' },
  { code: '+971', country: '🇦🇪 UAE' },
  { code: '+65', country: '🇸🇬 Singapore' },
  { code: '+60', country: '🇲🇾 Malaysia' },
  { code: '+49', country: '🇩🇪 Germany' },
  { code: '+33', country: '🇫🇷 France' },
];

function PhoneInput({ value, onChange, className }) {
  const parsePhone = (v) => {
    const found = COUNTRY_CODES.find(c => v?.startsWith(c.code));
    return found
      ? { cc: found.code, num: v.slice(found.code.length).trim() }
      : { cc: '+91', num: v || '' };
  };
  const { cc, num } = parsePhone(value);
  const update = (newCc, newNum) => onChange(`${newCc} ${newNum}`);
  return (
    <div className="flex gap-1">
      <select value={cc} onChange={e => update(e.target.value, num)}
        className="border border-slate-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-36 flex-shrink-0">
        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.country} ({c.code})</option>)}
      </select>
      <input value={num} onChange={e => update(cc, e.target.value)}
        placeholder="Mobile number"
        className={className || 'flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'} />
    </div>
  );
}

// ── AGENCY PROFILE ────────────────────────────────────────────
function AgencyProfile({ accent, user: partnerUser }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = () => {
    api.get('/partner/agency-profile').then(p => {
      setProfile(p);
      setForm({ name: p.name||'', email: p.email||'', phone: p.phone||'', city: p.city||'', brand_color: p.brand_color||'#1e40af' });
      setLogoPreview(p.logo_url||null);
    });
    api.get('/partner/agency-profile/history').then(setHistory).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErr('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const payload = { ...form };
      if (logoPreview !== profile.logo_url) payload.logo_url = logoPreview;
      const res = await api.put('/partner/agency-profile', payload);
      setMsg(`✅ Profile updated! ${res.edits_remaining} edit${res.edits_remaining !== 1 ? 's' : ''} remaining.`);
      setEditing(false);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (!profile || !form) return <div className="text-slate-400 text-sm">Loading...</div>;

  const editsUsed = profile.partner_edit_count || 0;
  const editsLeft = Math.max(0, 2 - editsUsed);
  const locked = editsUsed >= 2;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Agency Profile</h2>

      {/* Caution / Status Banner */}
      {locked ? (
        <div className="mb-6 p-5 rounded-2xl border-2 border-red-300 bg-red-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🔒</span>
            <div>
              <p className="text-lg font-black text-red-700">Profile Editing Locked</p>
              <p className="text-sm font-semibold text-red-600 mt-1">You have used all 2 allowed edits. Only the platform administrator can make further changes to your agency profile.</p>
              <p className="text-sm text-red-500 mt-2">Contact support to request an edit reset.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-5 rounded-2xl border-2 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <p className="text-lg font-black text-amber-800">
                {editsLeft === 2 ? 'You have 2 edits available' : `⚡ Only ${editsLeft} edit remaining!`}
              </p>
              <p className="text-sm font-bold text-amber-700 mt-1">
                You can edit your agency profile a maximum of <strong>2 times</strong>. After that, only the admin can make changes.
              </p>
              <p className="text-sm text-amber-600 mt-1">
                Please review all changes carefully before saving. Edits used: <strong>{editsUsed}/2</strong>
              </p>
              <div className="flex gap-1 mt-2">
                {[0,1].map(i => (
                  <div key={i} className={`h-2.5 w-16 rounded-full ${i < editsUsed ? 'bg-red-500' : 'bg-amber-200'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold">{msg}</div>}
      {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">{err}</div>}

      {/* Profile card */}
      <div className="card mb-6">
        <div className="flex items-start gap-5 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex items-center justify-center"
              style={{ background: (editing ? form.brand_color : profile.brand_color) + '20' }}>
              {(editing ? logoPreview : profile.logo_url)
                ? <img src={editing ? logoPreview : profile.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
                : <span className="text-2xl font-black text-white w-full h-full flex items-center justify-center rounded-2xl"
                    style={{ background: editing ? form.brand_color : profile.brand_color }}>
                    {profile.logo_initials || 'P'}
                  </span>
              }
            </div>
            {editing && !locked && (
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50">
                📷
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
              </label>
            )}
          </div>
          <div className="flex-1">
            {!editing ? (
              <div>
                <h3 className="text-xl font-black text-slate-900">{profile.name}</h3>
                <p className="text-sm text-slate-500">{profile.city} · {profile.email}</p>
                <p className="text-sm text-slate-500">{profile.phone}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-5 h-5 rounded" style={{ background: profile.brand_color }} />
                  <span className="text-xs text-slate-500 font-mono">{profile.brand_color}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Agency Name *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({...form, city: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Phone (with country code)</label>
                  <PhoneInput value={form.phone} onChange={v => setForm({...form, phone: v})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.brand_color} onChange={e => setForm({...form, brand_color: e.target.value})}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200" />
                    <span className="text-sm font-mono text-slate-600">{form.brand_color}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!locked && (
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: accent }}>
                ✏️ Edit Profile ({editsLeft} edit{editsLeft !== 1 ? 's' : ''} left)
              </button>
            ) : (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50">
                  {saving ? 'Saving...' : '✅ Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setErr(''); setLogoPreview(profile.logo_url); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit History */}
      <div className="card">
        <button onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full text-left">
          <h3 className="text-sm font-bold text-slate-700">📋 Edit History ({history.length} changes)</h3>
          <span className="text-slate-400 text-xs">{showHistory ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showHistory && (
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No edits recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map(h => {
                  let changes = {};
                  try { changes = JSON.parse(h.changes_json); } catch {}
                  return (
                    <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${h.changed_by_role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {h.changed_by_role === 'super_admin' ? '👑 Admin' : '🏢 Partner'}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{h.changed_by_name}</span>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(h.changed_at).toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(changes).map(([field, val]) => (
                          <div key={field} className="text-xs text-slate-600 flex gap-2">
                            <span className="font-bold text-slate-500 capitalize w-24 flex-shrink-0">{field.replace('_', ' ')}:</span>
                            {val.action ? (
                              <span className="text-purple-600 font-semibold">{val.action}</span>
                            ) : (
                              <span>
                                <span className="text-red-500 line-through mr-1">{String(val.from).slice(0,40)}</span>
                                <span className="text-emerald-600 font-semibold">→ {String(val.to).slice(0,40)}</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── STUDENT PROGRESS OVERVIEW (Partner) ─────────────────────
function StudentProgressOverview({ accent }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null); // student detail
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/partner/students/progress-overview').then(setData).catch(() => setData([]));
  }, []);

  const loadDetail = async (studentId) => {
    setLoadingDetail(true);
    try {
      const d = await api.get(`/partner/students/${studentId}/progress`);
      setDetail(d);
      setSelected(studentId);
    } catch (e) { setDetail(null); }
    finally { setLoadingDetail(false); }
  };

  const examColors = { IELTS:'#3b82f6', PTE:'#10b981', GERMAN_A1:'#f59e0b', GERMAN_A2:'#f97316', GERMAN_B1:'#8b5cf6', GERMAN_B2:'#ec4899', FRENCH_A1:'#ef4444' };
  const scoreLabel = (exam, score) => {
    if (!score) return '—';
    if (exam?.startsWith('IELTS')) return `${score} Band`;
    if (exam === 'PTE') return `${score} PTE`;
    return `${score}%`;
  };

  if (!data) return <div className="text-slate-400 text-sm py-8 text-center">Loading student progress...</div>;

  const students = Array.isArray(data) ? data : (data.students || []);
  const examTypes = ['ALL', ...new Set(students.map(s => s.target_exam).filter(Boolean))];
  const visible = filter === 'ALL' ? students : students.filter(s => s.target_exam === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">Student Progress & Analytics 📊</h2>
          <p className="text-sm text-slate-400 mt-0.5">Target planning, test scores, and attendance across all students</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-slate-100 rounded-xl px-3 py-1.5">
          <span className="text-slate-500">Total Students:</span>
          <span className="font-black text-slate-900">{students.length}</span>
        </div>
      </div>

      {/* Summary KPI Row */}
      {students.length > 0 && (() => {
        const withTarget = students.filter(s => s.target_exam);
        const withTests = students.filter(s => s.tests_taken > 0);
        const avgAttendance = students.length ? Math.round(students.reduce((a, s) => a + (Number(s.attendance_rate) || 0), 0) / students.length) : 0;
        const avgScore = withTests.length ? Math.round(withTests.reduce((a, s) => a + (Number(s.avg_score) || 0), 0) / withTests.length) : 0;
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { icon: '🎯', label: 'With Target Set', val: `${withTarget.length}`, sub: `${Math.round(withTarget.length/students.length*100)}% of students`, color: '#6366f1' },
              { icon: '📝', label: 'Tests Taken', val: `${students.reduce((a,s) => a + (Number(s.tests_taken)||0), 0)}`, sub: `Across all students`, color: '#3b82f6' },
              { icon: '📈', label: 'Avg Test Score', val: avgScore ? `${avgScore}%` : '—', sub: `Among tested students`, color: '#10b981' },
              { icon: '📅', label: 'Avg Attendance', val: `${avgAttendance}%`, sub: `Live class attendance`, color: '#f59e0b' },
            ].map(k => (
              <div key={k.label} className="rounded-2xl p-4 border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{k.icon}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{k.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: k.color }}>{k.val}</div>
                <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Exam filter tabs */}
      {examTypes.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {examTypes.map(ex => (
            <button key={ex} onClick={() => setFilter(ex)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${filter===ex ? 'text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              style={filter===ex ? { background: examColors[ex] || accent } : {}}>
              {ex.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Student table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Target Exam</th>
                <th>Target Score</th>
                <th>Avg Score</th>
                <th>Tests Taken</th>
                <th>Attendance</th>
                <th>Target Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">
                  {students.length === 0
                    ? 'No students have set targets yet. Encourage students to use the Progress tab.'
                    : 'No students match this filter.'}
                </td></tr>
              ) : visible.map(s => {
                const examColor = examColors[s.target_exam] || accent;
                const attPct = Number(s.attendance_rate) || 0;
                const attColor = attPct >= 80 ? '#10b981' : attPct >= 50 ? '#f59e0b' : '#ef4444';
                const scoreGap = s.target_score && s.avg_score ? Math.round(Number(s.target_score) - Number(s.avg_score)) : null;
                return (
                  <tr key={s.student_id} className={selected === s.student_id ? 'bg-blue-50' : ''}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: accent }}>{s.student_name?.[0]}</div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{s.student_name}</div>
                          <div className="text-xs text-slate-400">{s.student_email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.target_exam
                        ? <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: examColor }}>{s.target_exam.replace('_',' ')}</span>
                        : <span className="text-xs text-slate-300">Not set</span>}
                    </td>
                    <td className="font-bold text-sm">
                      {s.target_score ? <span style={{ color: examColor }}>{scoreLabel(s.target_exam, s.target_score)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      {s.avg_score != null
                        ? <div>
                            <span className="font-bold text-sm">{scoreLabel(s.target_exam, Math.round(s.avg_score))}</span>
                            {scoreGap != null && <span className={`text-xs ml-1 ${scoreGap > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {scoreGap > 0 ? `↑${scoreGap} to go` : '✓ On target'}
                            </span>}
                          </div>
                        : <span className="text-slate-300 text-xs">No tests yet</span>}
                    </td>
                    <td className="text-center font-bold">{s.tests_taken || 0}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${attPct}%`, background: attColor }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: attColor }}>{attPct}%</span>
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">
                      {s.target_date ? new Date(s.target_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      <button
                        onClick={() => selected === s.student_id ? setSelected(null) : loadDetail(s.student_id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition hover:text-white"
                        style={{ borderColor: accent, color: selected === s.student_id ? 'white' : accent, background: selected === s.student_id ? accent : '' }}>
                        {selected === s.student_id ? 'Close' : 'Details'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Panel */}
      {selected && (
        <div className="mt-6 card border-2" style={{ borderColor: accent + '40' }}>
          {loadingDetail ? (
            <div className="text-center py-8 text-slate-400">Loading student details...</div>
          ) : detail ? (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white" style={{ background: accent }}>
                    {detail.student?.name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-black text-slate-900">{detail.student?.name}</div>
                    <div className="text-xs text-slate-400">{detail.student?.email} · {detail.student?.phone || 'No phone'}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
              </div>

              {/* Target summary */}
              {detail.target && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Target Exam', val: detail.target.exam_type?.replace('_',' ') || '—', color: examColors[detail.target.exam_type] || accent },
                    { label: 'Target Score', val: scoreLabel(detail.target.exam_type, detail.target.target_score), color: '#6366f1' },
                    { label: 'Study Hours/Day', val: detail.target.daily_study_hours ? `${detail.target.daily_study_hours}h/day` : '—', color: '#10b981' },
                    { label: 'Target Date', val: detail.target.target_date ? new Date(detail.target.target_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—', color: '#f59e0b' },
                  ].map(k => (
                    <div key={k.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">{k.label}</div>
                      <div className="font-black text-sm" style={{ color: k.color }}>{k.val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Module scores */}
              {detail.module_scores && Object.keys(detail.module_scores).length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-3">Module Performance</h4>
                  <div className="space-y-2">
                    {Object.entries(detail.module_scores).map(([mod, score]) => {
                      const pct = Number(score) || 0;
                      const barColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={mod} className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 w-32 flex-shrink-0 font-medium">{mod}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className="text-xs font-black w-10 text-right" style={{ color: barColor }}>{Math.round(pct)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent test history */}
              {detail.recent_tests && detail.recent_tests.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-3">Recent Tests</h4>
                  <div className="space-y-2">
                    {detail.recent_tests.slice(0, 5).map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-800">{t.test_name}</span>
                          <span className="text-xs text-slate-400 ml-2">{t.exam_type}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black" style={{ color: Number(t.percentage_score) >= 70 ? '#10b981' : '#f59e0b' }}>
                            {Math.round(t.percentage_score)}%
                          </span>
                          <span className="text-xs text-slate-400">{t.taken_at?.split('T')[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!detail.target && !detail.recent_tests?.length && (
                <div className="text-center py-6 text-slate-400">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="font-semibold">No progress data yet</p>
                  <p className="text-xs mt-1">Student hasn't set a target or taken any tests</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">Could not load student details.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DATA PRIVACY AUDIT ───────────────────────────────────────
function DataPrivacyAudit({ accent }) {
  const [data, setData]         = useState(null);
  const [flaggedOnly, setFO]    = useState(false);
  const load = (fo) => api.get(`/admin/contact-audit${fo ? '?flagged_only=1' : ''}`).then(setData).catch(() => {});
  useEffect(() => { load(false); }, []);

  const fmtDT = (s) => {
    const d = new Date(s.slice(0, 19));
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  };
  const actionIcon = { reveal: '👁', call: '📞', email: '📧', whatsapp: '💬' };
  const stats = data?.stats || {};
  const logs  = data?.logs  || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">🔒 Your Data Privacy Audit</h2>
          <p className="text-sm text-slate-500 mt-0.5">Every time anyone on the platform views your students' contact details — you see it here.</p>
        </div>
        <button onClick={() => { const f = !flaggedOnly; setFO(f); load(f); }}
          className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${flaggedOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>
          {flaggedOnly ? '🚨 Flagged Only' : 'All Access'} {stats.flagged > 0 && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded-full text-[10px] font-black">{stats.flagged}</span>}
        </button>
      </div>

      {/* Trust banner */}
      <div className="mb-5 rounded-2xl overflow-hidden">
        <div className="p-5 flex gap-4 items-start"
          style={{ background: `linear-gradient(135deg, ${accent}15 0%, ${accent}08 100%)`, border: `1px solid ${accent}30` }}>
          <span className="text-3xl flex-shrink-0">🛡️</span>
          <div className="flex-1">
            <p className="font-black text-slate-900 text-base mb-1">Your Student Data is 100% Protected</p>
            <p className="text-slate-600 text-sm leading-relaxed mb-3">
              Contact details (phone &amp; email) are <strong>masked everywhere</strong> on this platform. Nobody can see them without it being permanently logged below — including the platform team itself.
              This is a first-of-its-kind data privacy guarantee in EdTech.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ['🎨 White-Label', 'Your brand everywhere'],
                ['🔒 Contact Masking', 'All access is audited'],
                ['⚡ Instant Payments', 'UPI · QR · Link'],
                ['📊 Live Analytics', 'Real-time dashboards'],
              ].map(([title, sub]) => (
                <div key={title} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-100">
                  <span className="text-xs font-bold text-slate-800">{title}</span>
                  <span className="text-[10px] text-slate-400">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[['👁 Reveals', stats.reveals||0], ['📞 Calls', stats.calls||0], ['📧 Emails', stats.emails||0], ['💬 WhatsApp', stats.whatsapps||0], ['Today', stats.today||0], ['🚨 Flagged', stats.flagged||0, true]].map(([lbl, val, red]) => (
          <div key={lbl} className="stat-card text-center" style={red && val>0 ? {borderColor:'#fca5a5',background:'#fff1f2'} : {}}>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{lbl}</p>
            <p className={`text-xl font-black ${red && val>0 ? 'text-red-600' : 'text-slate-900'}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Contact Access Log — your students only</h3>
        {!data ? <div className="text-slate-400 text-sm py-4">Loading…</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Action</th><th>Accessed By</th><th>Role</th><th>Your Student</th><th>Time</th><th>Status</th></tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">No contact access events yet — your data is safe!</td></tr>}
                {logs.map(l => (
                  <tr key={l.id} className={l.is_flagged ? 'bg-red-50' : ''}>
                    <td><span className="text-lg">{actionIcon[l.action_type]||'👁'}</span><span className="text-xs text-slate-500 ml-1">{l.action_type}</span></td>
                    <td>
                      <div className="font-semibold text-sm">{l.viewer_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{l.viewer_ip}</div>
                    </td>
                    <td><span className={`badge ${l.viewer_role === 'super_admin' ? 'badge-red' : 'badge-blue'}`}>{l.viewer_role?.replace('_',' ')}</span></td>
                    <td className="font-medium text-sm">{l.target_student_name}</td>
                    <td className="text-xs text-slate-400 whitespace-nowrap">{fmtDT(l.created_at)}</td>
                    <td>
                      {l.is_flagged
                        ? <div><span className="badge badge-red">🚨 Flagged</span><div className="text-[10px] text-red-600 mt-0.5">{l.flag_reason}</div></div>
                        : <span className="badge badge-green">✅ Normal</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HELP & SUPPORT (Partner) ─────────────────────────────────
const DEPT_META_P = [
  { id:'account_manager', icon:'👤', label:'Account Manager',  color:'#3b82f6', bg:'#eff6ff' },
  { id:'commission',      icon:'💰', label:'Commission Team',   color:'#f59e0b', bg:'#fffbeb' },
  { id:'academic',        icon:'🎓', label:'Academic Support',  color:'#10b981', bg:'#f0fdf4' },
  { id:'tech',            icon:'⚙️', label:'Tech Support',      color:'#8b5cf6', bg:'#f5f3ff' },
];
const STATUS_COLORS_P = {
  open:        { label:'Open',        color:'#ef4444', bg:'#fef2f2' },
  in_progress: { label:'In Progress', color:'#f59e0b', bg:'#fffbeb' },
  resolved:    { label:'Resolved',    color:'#10b981', bg:'#f0fdf4' },
  closed:      { label:'Closed',      color:'#64748b', bg:'#f8fafc' },
};

function PartnerSupport({ accent, user }) {
  const [tab, setTab]           = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [tickets, setTickets]   = useState([]);
  const [form, setForm]         = useState({ department:'general', subject:'', message:'' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState('');

  useEffect(() => { api.get('/support/contacts').then(setContacts).catch(() => {}); }, []);
  useEffect(() => { if (tab==='tickets') api.get('/support/tickets/mine').then(setTickets).catch(() => {}); }, [tab]);

  const submitTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg('');
    try {
      const r = await api.post('/support/tickets', form);
      setSubmitMsg(`✅ Ticket submitted! Reference: ${r.ticket_no}`);
      setForm({ department:'general', subject:'', message:'' });
      setTimeout(() => setSubmitMsg(''), 5000);
    } catch (e) { setSubmitMsg('❌ ' + e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ background: accent + '22', color: accent }}>🎧</div>
        <div>
          <h2 className="text-xl font-black text-slate-900">Help & Support</h2>
          <p className="text-xs text-slate-500">Contact our team or raise a support ticket</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['contacts','📋 Contact Details'],['submit','✉️ Submit Query'],['tickets','🎫 My Tickets']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-bold transition"
            style={tab===t ? {background:accent, color:'#fff'} : {background:'#f1f5f9',color:'#475569'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Contact Details */}
      {tab === 'contacts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEPT_META_P.map(d => {
            const c = contacts.find(x => x.department === d.id) || {};
            return (
              <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: d.bg, color: d.color }}>{d.icon}</div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{d.label}</p>
                    {c.working_hours && <p className="text-xs text-slate-400">🕐 {c.working_hours}</p>}
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {c.contact_name && <p className="font-semibold text-slate-800">👤 {c.contact_name}</p>}
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-blue-600 hover:underline font-medium">📧 {c.email}</a>}
                  {c.phone && <p className="text-slate-700">📞 {c.phone}</p>}
                  {c.whatsapp && <a href={`https://wa.me/${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-emerald-600 hover:underline font-medium">💬 {c.whatsapp}</a>}
                  {c.notes && <p className="text-xs text-slate-500 italic mt-2 border-t border-slate-100 pt-2">{c.notes}</p>}
                  {!c.email && !c.phone && !c.contact_name && <p className="text-xs text-slate-400 italic">Contact details not set yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Query */}
      {tab === 'submit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl">
          <h3 className="font-black text-slate-900 mb-4">✉️ Submit a Support Query</h3>
          <form onSubmit={submitTicket} className="space-y-4">
            <div>
              <label className="label">Department</label>
              <select value={form.department} onChange={e => setForm(f=>({...f,department:e.target.value}))}>
                <option value="general">General</option>
                {DEPT_META_P.map(d => <option key={d.id} value={d.id}>{d.icon} {d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Subject</label>
              <input required value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))}
                placeholder="Brief description of your query" />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea required rows={5} value={form.message}
                onChange={e => setForm(f=>({...f,message:e.target.value}))}
                placeholder={`Agency: ${user?.agency_name || ''}\n\nDescribe your query in detail…`}
                className="w-full" />
            </div>
            {submitMsg && <p className={`text-sm font-semibold ${submitMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{submitMsg}</p>}
            <button type="submit" disabled={submitting} className="btn-primary"
              style={{'--btn-bg': accent}}>
              {submitting ? 'Submitting…' : '📨 Submit Query'}
            </button>
          </form>
        </div>
      )}

      {/* My Tickets */}
      {tab === 'tickets' && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <p className="text-4xl mb-3">🎫</p>
              <p className="font-bold">No tickets yet</p>
              <p className="text-sm">Submit a query to see it here</p>
            </div>
          ) : tickets.map(t => {
            const sm = STATUS_COLORS_P[t.status] || STATUS_COLORS_P.open;
            const dm = DEPT_META_P.find(d=>d.id===t.department);
            return (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono font-bold text-slate-400">{t.ticket_no}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                      {dm && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: dm.bg, color: dm.color }}>{dm.icon} {dm.label}</span>}
                    </div>
                    <p className="font-black text-slate-900 text-sm">{t.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{t.message}</p>
                    {t.admin_reply && (
                      <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                        <span className="font-bold">Reply from Admin:</span> {t.admin_reply}
                        {t.admin_replied_at && <span className="text-blue-400 ml-2">· {new Date(t.admin_replied_at).toLocaleDateString('en-IN')}</span>}
                      </div>
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

// ── SHARING & REFERRAL PANEL ─────────────────────────────────
function SharingPanel({ accent, user, commRate }) {
  const slug = user?.slug || user?.agency_slug || '';
  const signupUrl = `${window.location.origin}/${slug}`;
  const [copied, setCopied] = useState(false);
  const [copiedWhat, setCopiedWhat] = useState('');

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setCopiedWhat(label);
      setTimeout(() => { setCopied(false); setCopiedWhat(''); }, 2500);
    });
  };

  const waMsg = `🎓 Join ${user?.agency_name || 'our academy'} and start your exam prep today!\n\nTop courses: IELTS · PTE · German · French\n\nEnrol now 👇\n${signupUrl}`;
  const smsMsg = `Join ${user?.agency_name || 'our academy'} for expert IELTS & PTE coaching. Enrol: ${signupUrl}`;

  const EARN_STEPS = [
    { icon: '🔗', title: 'Share Your Link', desc: 'Send your unique academy link to students via WhatsApp, Instagram or word-of-mouth.' },
    { icon: '📝', title: 'Student Enrols', desc: 'Student signs up via your link and purchases a course or batch seat.' },
    { icon: '💰', title: 'You Earn', desc: `You earn ${commRate}% commission on every confirmed payment — automatically tracked.` },
    { icon: '🏦', title: 'Claim Payout', desc: 'Request payout anytime from the Claim Commission tab. Processed within 3 working days.' },
  ];

  const CHANNEL_TEMPLATES = [
    {
      channel: 'WhatsApp',
      icon: '💬',
      color: '#25D366',
      msg: waMsg,
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank'),
    },
    {
      channel: 'WhatsApp Status',
      icon: '📸',
      color: '#128C7E',
      msg: `Copy this text and post as your WhatsApp Status:\n\n${waMsg}`,
      action: () => copy(waMsg, 'WhatsApp message'),
    },
    {
      channel: 'SMS / Text',
      icon: '📱',
      color: '#6366f1',
      msg: smsMsg,
      action: () => copy(smsMsg, 'SMS message'),
    },
    {
      channel: 'Instagram Bio',
      icon: '📷',
      color: '#e1306c',
      msg: signupUrl,
      action: () => copy(signupUrl, 'Link'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 mb-1">📣 Share & Grow</h2>
        <p className="text-sm text-slate-400">Spread the word, enrol students and earn commission — all in one place.</p>
      </div>

      {/* Your unique link */}
      <div className="rounded-2xl p-5 border-2 shadow-sm" style={{ borderColor: accent+'40', background: accent+'06' }}>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Your Academy Signup Link</div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0 flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm">
            <span className="text-[11px] text-slate-400 flex-shrink-0">🔗</span>
            <span className="text-sm font-bold text-slate-800 truncate">{signupUrl}</span>
          </div>
          <button onClick={() => copy(signupUrl, 'Link')}
            className="px-4 py-2.5 rounded-xl text-xs font-black text-white transition hover:opacity-90 flex-shrink-0"
            style={{ background: accent }}>
            {copied && copiedWhat === 'Link' ? '✅ Copied!' : '📋 Copy Link'}
          </button>
        </div>
        {copied && copiedWhat === 'Link' && (
          <p className="text-xs text-emerald-600 font-semibold mt-2">✅ Link copied to clipboard — paste it anywhere!</p>
        )}
      </div>

      {/* Commission model */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-900">💵 How You Earn</h3>
          <span className="text-lg font-black px-3 py-1 rounded-full text-white" style={{ background: accent }}>{commRate}% commission</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
          {EARN_STEPS.map((s, i) => (
            <div key={i} className="p-4 text-center hover:bg-slate-50 transition">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="font-black text-slate-900 text-sm mb-1">{s.title}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Example earnings */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <h3 className="font-black text-slate-900 mb-4">📊 Earnings Example</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Students/month','Course Fee','Your Earning','Yearly Income'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-slate-400 uppercase pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[5,10,20,50].map(n => {
                const fee = 15000;
                const earn = Math.round(n * fee * commRate / 100);
                return (
                  <tr key={n} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="py-2.5 pr-4 font-bold text-slate-800">{n} students</td>
                    <td className="py-2.5 pr-4 text-slate-500">₹{fee.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 pr-4 font-black" style={{ color: accent }}>₹{earn.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 font-black text-emerald-600">₹{(earn*12).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">* Based on ₹15,000 average course fee. Actual earnings depend on course prices and enrollment volume.</p>
      </div>

      {/* Share channel templates */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <h3 className="font-black text-slate-900 mb-4">🚀 Share via Channel</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHANNEL_TEMPLATES.map(c => (
            <div key={c.channel} className="rounded-xl border border-slate-100 p-4 hover:shadow-sm transition">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{c.icon}</span>
                <span className="font-black text-slate-900 text-sm">{c.channel}</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed font-mono bg-slate-50 rounded-lg p-2">{c.msg.slice(0,100)}…</p>
              <button onClick={c.action}
                className="w-full py-2 rounded-lg text-xs font-black text-white transition hover:opacity-90"
                style={{ background: c.color }}>
                {c.channel.includes('WhatsApp') && !c.channel.includes('Status') ? '📲 Send on WhatsApp' : '📋 Copy Message'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-2xl p-5 border border-amber-100 bg-amber-50">
        <h3 className="font-black text-amber-900 mb-3">💡 Top Tips to Enrol More Students</h3>
        <ul className="space-y-2 text-sm text-amber-800">
          {[
            'Post your link as a WhatsApp status every Monday morning — reach 100+ contacts at once',
            'Add your link to your Instagram / Facebook bio so every visitor sees it',
            'Offer a free demo class to hesitant students — once they attend, conversion is very high',
            'Follow up with leads within 2 hours of their first enquiry (use the CRM tab)',
            'Create urgency: "Only 5 seats left in this batch" messages work very well',
            'Ask satisfied students to refer 2 friends — word-of-mouth is your strongest channel',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="font-black text-amber-500 flex-shrink-0">{i+1}.</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────
const ALL_SECTIONS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'students', icon: '👥', label: 'Students' },
  { id: 'enrollments', icon: '📚', label: 'Enrollments' },
  { id: 'purchases', icon: '🛒', label: 'Online Bookings' },
  { id: 'batches', icon: '📅', label: 'Batches' },
  // Faculty is admin-only — hidden from partner panel
  { id: 'liveclasses', icon: '📺', label: 'Live Classes' },
  { id: 'studentprogress', icon: '🏆', label: 'Student Progress' },
  { id: 'sharing', icon: '📣', label: 'Share & Grow' },
  { id: 'earnings', icon: '💵', label: 'Earnings' },
  { id: 'claim', icon: '✅', label: 'Claim Commission' },
  { id: 'crm', icon: '📋', label: 'CRM / Leads' },
  { id: 'coupons', icon: '🏷️', label: 'Coupons' },
  { id: 'branding', icon: '🎨', label: 'Branding' },
  { id: 'agencyprofile', icon: '🏢', label: 'Agency Profile' },
  { id: 'paymentconfig', icon: '💳', label: 'Payment Config' },
  { id: 'dataprivacy',   icon: '🔒', label: 'Data Privacy' },
  { id: 'support',       icon: '🎧', label: 'Help & Support' },
];

async function extractDominantColor(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 40; canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;
        const map = {};
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i+3]; if (a < 100) continue;
          const r = Math.round(data[i]/32)*32, g = Math.round(data[i+1]/32)*32, b = Math.round(data[i+2]/32)*32;
          if (r > 220 && g > 220 && b > 220) continue;
          if (r < 30 && g < 30 && b < 30) continue;
          const k = `${r},${g},${b}`;
          map[k] = (map[k]||0) + 1;
        }
        const top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0];
        if (!top) return resolve(null);
        const [r,g,b] = top[0].split(',').map(Number);
        resolve(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [section, setSection] = useState('overview');
  const [logoUrl, setLogoUrl] = useState(user?.logo_url || null);
  const [portalSettings, setPortalSettings] = useState(null); // fetched fresh from server

  // Fetch fresh portal settings on mount — picks up admin changes without re-login
  useEffect(() => {
    api.get('/partner/agency-profile').then(d => {
      if (d) setPortalSettings({
        visible_sections: d.visible_sections,
        layout_type: d.layout_type != null ? Number(d.layout_type) : null,
        logo_shape: d.logo_shape || 'rounded',
      });
    }).catch(() => {});
  }, []);

  const accent = user?.brand_color || '#1e40af';
  const commRate = user?.commission_rate || 60;
  const slug = user?.slug || user?.agency_slug || '';

  // Coerce to number — MySQL2 may return integers as strings depending on config
  const rawLayout = portalSettings?.layout_type ?? (user?.layout_type != null ? Number(user.layout_type) : null);
  const layoutType = rawLayout != null ? Number(rawLayout) : 1;

  // Compute visible sections from fresh server data
  let visibleIds = null;
  try {
    const raw = portalSettings !== null
      ? portalSettings?.visible_sections
      : user?.visible_sections;
    if (raw) visibleIds = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : null;
  } catch {}
  const SECTIONS = Array.isArray(visibleIds) && visibleIds.length > 0
    ? ALL_SECTIONS.filter(s => visibleIds.includes(s.id))
    : ALL_SECTIONS;

  // If current section was hidden, fall back to first visible
  const activeSection = SECTIONS.find(s => s.id === section) ? section : SECTIONS[0]?.id || 'overview';

  // Sidebar theme based on layout type
  const sidebarTheme = layoutType === 2 ? 'light' : layoutType === 3 ? 'bold' : 'dark';
  const navAccent = layoutType === 2 ? accent : 'rgba(255,255,255,0.9)';
  const navTheme = layoutType === 2 ? 'light' : 'dark';

  const panels = {
    overview: <Overview accent={accent} />,
    students: <Students accent={accent} partnerPhone={user?.agency_phone} agencyName={user?.agency_name} slug={slug} />,
    enrollments: <Enrollments accent={accent} partnerPhone={user?.agency_phone} />,
    purchases: <OnlinePurchases accent={accent} partnerPhone={user?.agency_phone} />,
    batches: <PartnerBatches accent={accent} />,
    sharing: <SharingPanel accent={accent} user={user} commRate={commRate} />,
    // faculty: removed — managed by admin only
    liveclasses: <PartnerLiveClasses accent={accent} />,
    studentprogress: <StudentProgressOverview accent={accent} />,
    earnings: <Earnings accent={accent} commRate={commRate} />,
    claim: <Claim accent={accent} />,
    crm: <CRM accent={accent} />,
    coupons: <Coupons accent={accent} />,
    branding: <Branding user={user} accent={accent} logoUrl={logoUrl} onLogoChange={setLogoUrl} />,
    agencyprofile: <AgencyProfile accent={accent} user={user} />,
    paymentconfig: <PartnerPaymentConfig accent={accent} />,
    dataprivacy:   <DataPrivacyAudit accent={accent} />,
    support:       <PartnerSupport accent={accent} user={user} />,
  };

  // Logo shape + size
  const logoShape = portalSettings?.logo_shape ?? user?.logo_shape ?? 'rounded';
  const logoShapeSt = logoShapeStyle(logoShape);
  const logoPx = layoutType === 1 ? 48 : 60;
  const logoBorder = layoutType === 2 ? { border: '2px solid #e2e8f0', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { background: 'rgba(255,255,255,0.18)' };
  const nameColor = layoutType === 2 ? 'text-slate-800 font-black text-base' : 'text-white font-bold text-sm';
  const subColor = layoutType === 2 ? 'text-slate-400' : 'text-white/50';

  const signupUrl = `${window.location.origin}/${slug}`;
  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(signupUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const shareLink = () => {
    const msg = `🎓 Join ${user?.agency_name || 'our academy'} and kickstart your exam prep!\n\nEnrol now 👇\n${signupUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <DashLayout
      bgColor={accent}
      accentColor={accent}
      sidebarTheme={sidebarTheme}
      logoUrl={null}
      onLiveClasses={() => setSection('liveclasses')}
      sidebar={{
        logo: (
          <div>
            {/* Logo with shape */}
            <div style={{ marginBottom: 10 }}>
              <LogoDisplay
                logoUrl={logoUrl}
                fit={user?.logo_fit || 'contain'}
                bg={user?.logo_bg || 'white'}
                padding={user?.logo_padding != null ? Number(user.logo_padding) : 8}
                brandColor={accent}
                initials={user?.logo_initials || user?.agency_name?.slice(0,2).toUpperCase() || 'P'}
                shape={user?.logo_shape || 'rounded'}
                size={logoPx}
              />
            </div>
            <div className={`font-bold truncate mb-0.5 ${nameColor}`}>{user?.agency_name}</div>
            <div className={`text-xs font-mono mb-1.5 ${subColor}`}>{window.location.hostname}/{slug}</div>
            {/* Copy + Share buttons */}
            <div className="flex gap-1.5 w-full">
              <button onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition"
                style={{ background: linkCopied ? 'rgba(22,163,74,0.9)' : 'rgba(255,255,255,0.18)', color: '#fff' }}>
                {linkCopied ? '✅ Copied!' : '🔗 Copy Link'}
              </button>
              <button onClick={shareLink}
                className="flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                style={{ background: 'rgba(37,211,102,0.85)', color: '#fff' }}
                title="Share via WhatsApp">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
            </div>
          </div>
        ),
        items: SECTIONS.map(s => (
          <NavItem key={s.id} active={activeSection === s.id} onClick={() => setSection(s.id)} icon={s.icon} label={s.label} accent={navAccent} theme={navTheme} />
        ))
      }}
      headerRight={
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
          <span>Partner Portal — {user?.agency_name}</span>
        </div>
      }
    >
      {panels[activeSection]}
    </DashLayout>
  );
}
