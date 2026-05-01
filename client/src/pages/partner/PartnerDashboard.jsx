import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';
import { logoShapeStyle } from '../admin/AdminDashboard';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Badge({ status }) {
  const map = { active: 'badge-green', paid: 'badge-green', approved: 'badge-blue', pending: 'badge-amber', on_hold: 'badge-amber', completed: 'badge-purple', cancelled: 'badge-gray', new: 'badge-blue', contacted: 'badge-amber', demo_done: 'badge-purple', enrolled: 'badge-green', lost: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace('_', ' ')}</span>;
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
  const signupUrl = `${base}/${slug}/signup`;

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
  const load = () => api.get('/partner/enrollments').then(setEnrollments);
  useEffect(() => {
    load();
    api.get('/partner/students').then(setStudents);
    api.get('/courses').then(setCourses);
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Enrollments</h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Enroll Student</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}
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
              {enrollments.map(e => (
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
function Branding({ user, accent, logoUrl, onLogoChange }) {
  const slug = user?.slug || user?.agency_slug || '';
  const commRate = user?.commission_rate || 0;
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const handleLogoFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setUploadMsg('Image must be under 2MB'); return; }
    setUploading(true); setUploadMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        const res = await api.post('/partner/logo', { logo_url: dataUrl });
        onLogoChange(res.logo_url);
        setUploadMsg('Logo updated!');
      } catch (err) {
        setUploadMsg(err.message);
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Branding Configuration</h2>

      {/* Logo Upload */}
      <div className="card mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Institute Logo</h3>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 flex-shrink-0"
            style={{ background: accent + '10' }}>
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
              : <span className="text-2xl font-black text-white w-full h-full flex items-center justify-center rounded-2xl" style={{ background: accent }}>{user?.logo_initials || 'P'}</span>
            }
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 mb-3">Upload a PNG, JPG or SVG logo (max 2 MB). It appears in the sidebar and top bar across the entire app.</p>
            <label className="inline-block cursor-pointer px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: accent }}>
              {uploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} disabled={uploading} />
            </label>
            {logoUrl && (
              <button className="ml-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition"
                onClick={async () => {
                  await api.post('/partner/logo', { logo_url: '' });
                  onLogoChange(null); setUploadMsg('Logo removed.');
                }}>
                Remove
              </button>
            )}
            {uploadMsg && <p className={`mt-2 text-xs ${uploadMsg.includes('!') ? 'text-emerald-600' : 'text-red-500'}`}>{uploadMsg}</p>}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-4 p-4 rounded-xl mb-6" style={{ background: accent + '10', border: `1px solid ${accent}30` }}>
          {logoUrl
            ? <img src={logoUrl} alt="logo" className="w-16 h-16 rounded-2xl object-contain p-1" style={{ background: accent + '20' }} />
            : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{ background: accent }}>{user?.logo_initials}</div>
          }
          <div>
            <div className="text-xl font-black text-slate-900">{user?.agency_name}</div>
            <div className="text-sm font-mono" style={{ color: accent }}>testprep.com/{slug}</div>
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
  const signupUrl = `${base}/${slug}/signup`;
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

// ── BATCHES (Partner) ───────────────────────────────────────
function PartnerBatches({ accent }) {
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [showForm, setShowForm] = useState(false);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">My Batches <span className="text-base font-normal text-slate-400 ml-2">{batches.length} total</span></h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Create Batch</button>
      </div>

      {msg && <div className="mb-4 text-sm text-red-600">{msg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Create New Batch</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Course</label>
              <select className="input" required value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})}>
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Batch Name</label>
              <input className="input" required placeholder="e.g., IELTS April Morning" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="label">Assign Faculty</label>
              {facultyList.length > 0 ? (
                <select className="input" value={form.trainer_id}
                  onChange={e => {
                    const f = facultyList.find(f => String(f.id) === e.target.value);
                    setForm({ ...form, trainer_id: e.target.value, trainer_name: f?.name || '' });
                  }}>
                  <option value="">No faculty assigned</option>
                  {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              ) : (
                <input className="input" placeholder="Trainer name (add faculty first)" value={form.trainer_name}
                  onChange={e => setForm({ ...form, trainer_name: e.target.value })} />
              )}
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div>
              <label className="label">Class Time</label>
              <input type="time" className="input" required value={form.class_time} onChange={e => setForm({...form, class_time: e.target.value})} />
            </div>
            <div>
              <label className="label">Max Students</label>
              <input type="number" className="input" value={form.max_students} onChange={e => setForm({...form, max_students: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary" style={{ background: accent }}>Create Batch</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Batch</th><th>Course</th><th>Schedule</th><th>Students</th><th>Status</th><th>Meeting ID</th></tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{b.name}</div>
                    <div className="text-xs text-slate-400">{b.trainer_name || 'No trainer assigned'}</div>
                  </td>
                  <td>{b.course_title}</td>
                  <td>
                    <div className="text-sm">{b.class_time} ({b.duration_minutes} min)</div>
                    <div className="text-xs text-slate-400">{b.schedule_days}</div>
                  </td>
                  <td className="font-semibold">{b.enrolled_students || 0} / {b.max_students}</td>
                  <td><Badge status={b.status} /></td>
                  <td><span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{b.jitsi_meeting_id?.slice(0, 20)}...</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

// ── MAIN ─────────────────────────────────────────────────────
const ALL_SECTIONS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'students', icon: '👥', label: 'Students' },
  { id: 'enrollments', icon: '📚', label: 'Enrollments' },
  { id: 'purchases', icon: '🛒', label: 'Online Bookings' },
  { id: 'batches', icon: '📅', label: 'Batches' },
  { id: 'faculty', icon: '🎓', label: 'Faculty' },
  { id: 'liveclasses', icon: '📺', label: 'Live Classes' },
  { id: 'studentprogress', icon: '🏆', label: 'Student Progress' },
  { id: 'earnings', icon: '💵', label: 'Earnings' },
  { id: 'claim', icon: '✅', label: 'Claim Commission' },
  { id: 'crm', icon: '📋', label: 'CRM / Leads' },
  { id: 'coupons', icon: '🏷️', label: 'Coupons' },
  { id: 'branding', icon: '🎨', label: 'Branding' },
  { id: 'agencyprofile', icon: '🏢', label: 'Agency Profile' },
  { id: 'paymentconfig', icon: '💳', label: 'Payment Config' },
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
    faculty: <PartnerFaculty accent={accent} />,
    liveclasses: <PartnerLiveClasses accent={accent} />,
    studentprogress: <StudentProgressOverview accent={accent} />,
    earnings: <Earnings accent={accent} commRate={commRate} />,
    claim: <Claim accent={accent} />,
    crm: <CRM accent={accent} />,
    coupons: <Coupons accent={accent} />,
    branding: <Branding user={user} accent={accent} logoUrl={logoUrl} onLogoChange={setLogoUrl} />,
    agencyprofile: <AgencyProfile accent={accent} user={user} />,
    paymentconfig: <PartnerPaymentConfig accent={accent} />,
  };

  // Logo shape + size
  const logoShape = portalSettings?.logo_shape ?? user?.logo_shape ?? 'rounded';
  const logoShapeSt = logoShapeStyle(logoShape);
  const logoPx = layoutType === 1 ? 48 : 60;
  const logoBorder = layoutType === 2 ? { border: '2px solid #e2e8f0', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { background: 'rgba(255,255,255,0.18)' };
  const nameColor = layoutType === 2 ? 'text-slate-800 font-black text-base' : 'text-white font-bold text-sm';
  const subColor = layoutType === 2 ? 'text-slate-400' : 'text-white/50';

  const shareLink = () => {
    const base = window.location.origin;
    const url = `${base}/${slug}/signup`;
    const msg = `Take the first step toward your dream career today.\n👉 Sign up / log in to our online coaching academy and get started instantly.\n🚀 Learn, grow, and achieve your goals with ${user?.agency_name || 'us'}\n🔗 Click here to begin: ${url}`;
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
            <div style={{ width: logoPx, height: logoPx, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexShrink: 0, ...logoShapeSt, ...logoBorder }}>
              {logoUrl
                ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                : <span style={{ fontWeight: 900, fontSize: 20, color: layoutType === 2 ? accent : 'white' }}>{user?.logo_initials || 'P'}</span>
              }
            </div>
            <div className={`font-bold truncate mb-0.5 ${nameColor}`}>{user?.agency_name}</div>
            <div className={`text-xs font-mono mb-2 ${subColor}`}>{window.location.hostname}/{slug}</div>
            <button onClick={shareLink}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-90"
              style={{ background: 'rgba(37,211,102,0.9)', color: '#fff' }}>
              📱 Share My Link
            </button>
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
