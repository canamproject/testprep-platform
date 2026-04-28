import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';

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
function Students({ accent }) {
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.get('/partner/students').then(setStudents);
  useEffect(() => { load(); }, []);

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
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Courses</th><th>Total Paid</th><th>LMS ID</th><th>Joined</th></tr></thead>
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
function Enrollments({ accent }) {
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
                    {e.payment_status === 'pending' && (
                      <button onClick={() => markPaid(e.id)} className="text-xs font-semibold text-emerald-600 hover:underline">Mark Paid</button>
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', value: '', min_order: '', max_uses: 100, expires_at: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.get('/partner/coupons').then(setCoupons);
  useEffect(() => { load(); }, []);

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
        <h2 className="text-xl font-black text-slate-900">My Coupons</h2>
        <button className="btn-primary" style={{ background: accent }} onClick={() => setShowForm(!showForm)}>+ Create Coupon</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {showForm && (
        <div className="card mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div><label>Coupon Code</label><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
            <div><label>Discount Type</label><select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}><option value="percentage">Percentage %</option><option value="fixed">Fixed ₹</option></select></div>
            <div><label>Value</label><input type="number" required value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
            <div><label>Min Order (₹)</label><input type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} /></div>
            <div><label>Max Uses</label><input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} /></div>
            <div><label>Expires At</label><input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div>
            <div className="col-span-3 flex gap-2"><button type="submit" className="btn-success">Create Coupon</button><button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button></div>
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
              <div className="text-slate-400">Min Order</div>
              <div>{c.min_order > 0 ? fmt(c.min_order) : 'No minimum'}</div>
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
    </div>
  );
}

// ── BRANDING ─────────────────────────────────────────────────
function Branding({ user, accent }) {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Branding Configuration</h2>
      <div className="card mb-6">
        <div className="flex items-center gap-4 p-4 rounded-xl mb-6" style={{ background: accent + '10', border: `1px solid ${accent}30` }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{ background: accent }}>{user.logo_initials}</div>
          <div>
            <div className="text-xl font-black text-slate-900">{user.agency_name}</div>
            <div className="text-sm font-mono" style={{ color: accent }}>testprep.com/agent/{user.slug}</div>
            <div className="text-sm text-slate-400 mt-1">{user.agency_email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">Brand Color</div><div className="flex items-center gap-2"><div className="w-6 h-6 rounded" style={{ background: accent }} />{accent}</div></div>
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">Commission Rate</div>{user.commission_rate}% partner / {100 - user.commission_rate}% platform</div>
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">City</div>{user.city || '—'}</div>
          <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs font-bold text-slate-400 uppercase mb-1">Phone</div>{user.agency_phone || '—'}</div>
        </div>
      </div>
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-2">White-Label Info</h3>
        <p className="text-sm text-slate-500 mb-3">Your portal is completely white-labeled. Students see only your branding. The underlying LMS (TestPrepGPT.ai) is never visible.</p>
        <div className="space-y-2 text-sm">
          {[
            ['Student-facing URL', `/agent/${user.slug}`],
            ['Admin login URL', `/agent/${user.slug}/login`],
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

// ── BATCHES (Partner) ───────────────────────────────────────
function PartnerBatches({ accent }) {
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    course_id: '', name: '', description: '',
    start_date: '', end_date: '', schedule_days: 'Mon,Tue,Wed,Thu,Fri',
    class_time: '09:00', duration_minutes: 60,
    trainer_name: '', max_students: 20
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBatches();
    api.get('/courses').then(setCourses);
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
              <label className="label">Trainer Name</label>
              <input className="input" placeholder="Trainer name" value={form.trainer_name} onChange={e => setForm({...form, trainer_name: e.target.value})} />
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
function OnlinePurchases({ accent }) {
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
                        <button onClick={() => markPaid(p.id)}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold text-white transition hover:opacity-90"
                          style={{ background: accent }}>
                          Mark Paid
                        </button>
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

// ── MAIN ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'students', icon: '👥', label: 'Students' },
  { id: 'enrollments', icon: '📚', label: 'Enrollments' },
  { id: 'purchases', icon: '🛒', label: 'Online Bookings' },
  { id: 'batches', icon: '📅', label: 'Batches' },
  { id: 'liveclasses', icon: '📺', label: 'Live Classes' },
  { id: 'earnings', icon: '💵', label: 'Earnings' },
  { id: 'claim', icon: '✅', label: 'Claim Commission' },
  { id: 'crm', icon: '📋', label: 'CRM / Leads' },
  { id: 'coupons', icon: '🏷️', label: 'Coupons' },
  { id: 'branding', icon: '🎨', label: 'Branding' },
];

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [section, setSection] = useState('overview');
  const accent = user?.brand_color || '#1e40af';
  const commRate = user?.commission_rate || 60;

  const panels = {
    overview: <Overview accent={accent} />,
    students: <Students accent={accent} />,
    enrollments: <Enrollments accent={accent} />,
    purchases: <OnlinePurchases accent={accent} />,
    batches: <PartnerBatches accent={accent} />,
    liveclasses: <PartnerLiveClasses accent={accent} />,
    earnings: <Earnings accent={accent} commRate={commRate} />,
    claim: <Claim accent={accent} />,
    crm: <CRM accent={accent} />,
    coupons: <Coupons accent={accent} />,
    branding: <Branding user={user} accent={accent} />,
  };

  return (
    <DashLayout
      bgColor={accent}
      sidebar={{
        logo: (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-white text-sm">{user?.logo_initials || 'P'}</div>
              <div className="text-white font-bold text-sm truncate">{user?.agency_name}</div>
            </div>
            <div className="text-xs text-white/50 font-mono">testprep.com/agent/{user?.slug}</div>
          </div>
        ),
        items: SECTIONS.map(s => (
          <NavItem key={s.id} active={section === s.id} onClick={() => setSection(s.id)} icon={s.icon} label={s.label} accent="rgba(255,255,255,0.9)" />
        ))
      }}
      headerRight={
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
          <span>Partner Portal — {user?.agency_name}</span>
        </div>
      }
    >
      {panels[section]}
    </DashLayout>
  );
}
