import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-700', purple: 'bg-purple-50 text-purple-600' };
  return (
    <div className="stat-card">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ status }) {
  const map = { active: 'badge-green', paid: 'badge-green', approved: 'badge-blue', pending: 'badge-amber', pending_approval: 'badge-amber', on_hold: 'badge-amber', suspended: 'badge-red', rejected: 'badge-red', completed: 'badge-blue', cancelled: 'badge-gray' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace('_', ' ')}</span>;
}

// ── OVERVIEW ────────────────────────────────────────────────
function Overview() {
  const [stats, setStats] = useState(null);
  const [agencies, setAgencies] = useState([]);
  useEffect(() => {
    api.get('/admin/stats').then(setStats);
    api.get('/admin/agencies').then(setAgencies);
  }, []);
  if (!stats) return <div className="text-slate-400 text-sm">Loading...</div>;
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Platform Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Gross Revenue" value={fmt(stats.total_revenue)} />
        <StatCard label="Platform Share (40%)" value={fmt(stats.total_revenue * 0.4)} color="green" />
        <StatCard label="Active Agencies" value={stats.active_agencies} color="purple" />
        <StatCard label="Total Students" value={Number(stats.total_students).toLocaleString()} color="blue" />
        <StatCard label="Pending Payouts" value={fmt(stats.pending_payouts)} sub={`${stats.pending_payout_count} requests`} color="amber" />
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Agency Performance</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agency</th><th>Subpath</th><th>Status</th><th>Students</th><th>Revenue</th><th>Commission</th><th>Platform Share</th></tr></thead>
            <tbody>
              {agencies.map(ag => (
                <tr key={ag.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: ag.brand_color }}>{ag.logo_initials}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{ag.name}</div>
                        <div className="text-xs text-slate-400">{ag.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">/agent/{ag.slug}</span></td>
                  <td><Badge status={ag.status} /></td>
                  <td className="font-semibold">{ag.student_count}</td>
                  <td className="font-semibold">{fmt(ag.total_revenue)}</td>
                  <td>{ag.commission_rate}% / {100 - ag.commission_rate}%</td>
                  <td className="font-semibold text-emerald-600">{fmt(ag.total_revenue * (100 - ag.commission_rate) / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── AGENCIES ────────────────────────────────────────────────
function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', email: '', phone: '', city: '', brand_color: '#1e40af', commission_rate: 60 });
  const [msg, setMsg] = useState('');

  const load = () => api.get('/admin/agencies').then(setAgencies);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/agencies', { ...form, logo_initials: form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() });
      setMsg('Agency created!'); setShowForm(false); load();
      setForm({ name: '', slug: '', email: '', phone: '', city: '', brand_color: '#1e40af', commission_rate: 60 });
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Agencies <span className="text-base font-normal text-slate-400 ml-2">{agencies.length} total</span></h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Agency</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">New Agency</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div><label>Agency Name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>URL Slug</label><input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="brightpath" /></div>
            <div><label>Email</label><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>City</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><label>Brand Color</label><input type="color" value={form.brand_color} onChange={e => setForm({ ...form, brand_color: e.target.value })} className="h-10 cursor-pointer" /></div>
            <div><label>Commission % (Partner gets)</label><input type="number" min="1" max="99" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-success">Create Agency</button>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agencies.map(ag => (
          <div key={ag.id} className="card relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ag.brand_color }} />
            <div className="flex items-center gap-3 mt-2 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ background: ag.brand_color }}>{ag.logo_initials}</div>
              <div>
                <div className="font-bold text-slate-900">{ag.name}</div>
                <div className="text-xs text-slate-400">{ag.city} · {ag.email}</div>
              </div>
            </div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <Badge status={ag.status} />
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">/agent/{ag.slug}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-slate-50 pt-4">
              <div className="text-center"><div className="text-lg font-black text-slate-900">{ag.student_count}</div><div className="text-xs text-slate-400">Students</div></div>
              <div className="text-center"><div className="text-lg font-black text-slate-900">{fmt(ag.total_revenue).replace('₹', '').split(',')[0]}L</div><div className="text-xs text-slate-400">Revenue</div></div>
              <div className="text-center"><div className="text-lg font-black text-slate-900">{ag.commission_rate}%</div><div className="text-xs text-slate-400">Commission</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ALL STUDENTS ─────────────────────────────────────────────
function AllStudents() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('');
  useEffect(() => { api.get('/admin/students').then(setStudents); }, []);
  const filtered = students.filter(s => !filter || s.agency_name?.toLowerCase().includes(filter.toLowerCase()) || s.name?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">All Students <span className="text-base font-normal text-slate-400 ml-2">{students.length} total</span></h2>
        <input placeholder="Filter by name or agency..." className="w-56" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Agency</th><th>Phone</th><th>Courses</th><th>Total Paid</th><th>LMS ID</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">{s.name?.[0]}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-400">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="text-xs font-bold px-2 py-1 rounded" style={{ background: s.brand_color + '20', color: s.brand_color }}>{s.agency_name}</span></td>
                  <td className="text-slate-500">{s.phone}</td>
                  <td className="font-semibold">{s.enrollment_count} course{s.enrollment_count !== 1 ? 's' : ''}</td>
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

// ── ALL ENROLLMENTS ──────────────────────────────────────────
function AllEnrollments() {
  const [enrollments, setEnrollments] = useState([]);
  useEffect(() => { api.get('/admin/enrollments').then(setEnrollments); }, []);
  const totalRev = enrollments.filter(e => e.payment_status === 'paid').reduce((a, e) => a + Number(e.fee_paid), 0);

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-2">All Enrollments</h2>
      <p className="text-sm text-slate-500 mb-6">Total paid revenue across all agencies: <strong className="text-emerald-600">{fmt(totalRev)}</strong></p>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Category</th><th>Agency</th><th>Fee</th><th>Payment</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id}>
                  <td>
                    <div className="font-semibold">{e.student_name}</div>
                    <div className="text-xs text-slate-400">{e.student_email}</div>
                  </td>
                  <td className="font-medium max-w-48"><div className="truncate">{e.course_title}</div></td>
                  <td><span className="badge badge-blue">{e.category}</span></td>
                  <td><span className="text-xs font-bold" style={{ color: e.brand_color }}>{e.agency_name}</span></td>
                  <td className="font-semibold">{fmt(e.fee_paid)}</td>
                  <td><Badge status={e.payment_status} /></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${e.progress_percent}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{e.progress_percent}%</span>
                    </div>
                  </td>
                  <td><Badge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── REVENUE ──────────────────────────────────────────────────
function Revenue() {
  const [agencies, setAgencies] = useState([]);
  useEffect(() => { api.get('/admin/agencies').then(setAgencies); }, []);
  const total = agencies.reduce((a, ag) => a + Number(ag.total_revenue), 0);

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Revenue Analytics</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Gross Revenue" value={fmt(total)} />
        <StatCard label="Platform Net (~40%)" value={fmt(agencies.reduce((a, ag) => a + ag.total_revenue * (100 - ag.commission_rate) / 100, 0))} color="green" />
        <StatCard label="Partner Payouts" value={fmt(agencies.reduce((a, ag) => a + ag.total_revenue * ag.commission_rate / 100, 0))} color="amber" />
      </div>
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-5">Revenue by Agency</h3>
        {agencies.map(ag => {
          const pct = total > 0 ? Math.round(Number(ag.total_revenue) / total * 100) : 0;
          return (
            <div key={ag.id} className="mb-5">
              <div className="flex justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: ag.brand_color }} />
                  <span className="font-semibold text-slate-800">{ag.name}</span>
                  <span className="text-slate-400">({ag.commission_rate}% commission)</span>
                </div>
                <span className="font-bold text-slate-900">{fmt(ag.total_revenue)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ag.brand_color }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Partner: {fmt(ag.total_revenue * ag.commission_rate / 100)}</span>
                <span>Platform: {fmt(ag.total_revenue * (100 - ag.commission_rate) / 100)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── COMMISSIONS ──────────────────────────────────────────────
function Commissions() {
  const [payouts, setPayouts] = useState([]);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/payouts').then(setPayouts);
  useEffect(() => { load(); }, []);

  const updatePayout = async (id, status) => {
    await api.put(`/admin/payouts/${id}`, { status });
    setMsg(`Payout ${status}`); load();
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Commission Payouts</h2>
      {msg && <div className="mb-4 p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-sm">{msg}</div>}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Agency</th><th>Students</th><th>Amount</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: p.brand_color }}>{p.slug?.slice(0, 2).toUpperCase()}</div>
                      <span className="font-semibold">{p.agency_name}</span>
                    </div>
                  </td>
                  <td>{p.eligible_students} eligible</td>
                  <td className="font-black text-slate-900 text-base">{fmt(p.amount)}</td>
                  <td className="text-slate-400 text-xs">{p.requested_at?.split('T')[0]}</td>
                  <td><Badge status={p.status} /></td>
                  <td>
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <button className="btn-success text-xs px-3 py-1" onClick={() => updatePayout(p.id, 'approved')}>Approve</button>
                        <button className="btn-danger text-xs px-3 py-1" onClick={() => updatePayout(p.id, 'rejected')}>Reject</button>
                      </div>
                    )}
                    {p.status === 'approved' && (
                      <button className="btn-primary text-xs px-3 py-1" onClick={() => updatePayout(p.id, 'paid')}>Mark Paid</button>
                    )}
                    {(p.status === 'paid' || p.status === 'rejected') && (
                      <span className="text-xs text-slate-400">{p.processed_at?.split('T')[0] || '—'}</span>
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

// ── COUPONS ──────────────────────────────────────────────────
function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('class'); // 'class' | 'discount'
  const [discountCoupons, setDiscountCoupons] = useState([]);
  const [form, setForm] = useState({
    code: '', agency_id: '', description: '',
    access_type: 'class_count', allowed_count: 5,
    max_redemptions: 100, expires_at: ''
  });
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/admin/class-coupons').then(setCoupons).catch(() => {});
    api.get('/admin/coupons').then(setDiscountCoupons).catch(() => {});
  };
  useEffect(() => { load(); api.get('/admin/agencies').then(setAgencies); }, []);

  const genCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/class-coupons', form);
      setMsg('Coupon created successfully!');
      setShowForm(false);
      setForm({ code: '', agency_id: '', description: '', access_type: 'class_count', allowed_count: 5, max_redemptions: 100, expires_at: '' });
      load();
    } catch (e) { setMsg(e.message); }
  };

  const toggleActive = async (c) => {
    await api.put(`/admin/class-coupons/${c.id}`, { ...c, is_active: c.is_active ? 0 : 1 });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Coupons</h2>
        {tab === 'class' && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Create Class-Access Coupon</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['class','🎓 Class-Access Coupons'],['discount','🏷️ Discount Coupons']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {l}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">{msg}</div>}

      {/* Class-access coupon creation form */}
      {tab === 'class' && showForm && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-1">Create Class-Access Coupon</h3>
          <p className="text-xs text-slate-400 mb-4">Give this code to a partner. Students use it to unlock free class access without purchasing the course.</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Coupon Code *</label>
              <div className="flex gap-2">
                <input className="input flex-1" required placeholder="e.g. DEMO2024" value={form.code}
                  onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
                <button type="button" className="btn text-xs px-2" onClick={() => setForm({...form, code: genCode()})}>Gen</button>
              </div>
            </div>
            <div>
              <label className="label">Agency (leave blank = all)</label>
              <select className="input" value={form.agency_id} onChange={e => setForm({...form, agency_id: e.target.value})}>
                <option value="">All Agencies</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Access Type</label>
              <select className="input" value={form.access_type} onChange={e => setForm({...form, access_type: e.target.value})}>
                <option value="class_count">Number of Classes</option>
                <option value="hour_count">Hours of Content</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
            {form.access_type !== 'unlimited' && (
              <div>
                <label className="label">{form.access_type === 'class_count' ? 'Classes Allowed' : 'Hours Allowed'}</label>
                <input type="number" className="input" min="1" value={form.allowed_count}
                  onChange={e => setForm({...form, allowed_count: +e.target.value})} />
              </div>
            )}
            <div>
              <label className="label">Max Student Redemptions</label>
              <input type="number" className="input" min="1" value={form.max_redemptions}
                onChange={e => setForm({...form, max_redemptions: +e.target.value})} />
            </div>
            <div>
              <label className="label">Expires On (optional)</label>
              <input type="date" className="input" value={form.expires_at}
                onChange={e => setForm({...form, expires_at: e.target.value})} />
            </div>
            <div className="col-span-3">
              <label className="label">Description / Note for partner</label>
              <input className="input" placeholder="e.g. Free trial for May batch students" value={form.description}
                onChange={e => setForm({...form, description: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary">Create Coupon</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Class-access coupons list */}
      {tab === 'class' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Agency</th><th>Access</th><th>Redeemed</th><th>Expires</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg text-sm inline-block">{c.code}</div>
                      {c.description && <div className="text-xs text-slate-400 mt-1">{c.description}</div>}
                    </td>
                    <td className="text-sm">{c.agency_name || <span className="text-slate-400">All</span>}</td>
                    <td>
                      <span className="badge badge-blue">
                        {c.access_type === 'unlimited' ? 'Unlimited' : `${c.allowed_count} ${c.access_type === 'class_count' ? 'classes' : 'hours'}`}
                      </span>
                    </td>
                    <td className="text-sm">{c.used_count} / {c.max_redemptions}</td>
                    <td className="text-xs text-slate-400">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                    <td><Badge status={c.is_active ? 'active' : 'cancelled'} /></td>
                    <td>
                      <button onClick={() => toggleActive(c)}
                        className={`text-xs px-2 py-1 rounded border ${c.is_active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && <tr><td colSpan="7" className="text-center text-slate-400 py-8">No class-access coupons yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discount coupons list (existing) */}
      {tab === 'discount' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Agency</th><th>Type</th><th>Value</th><th>Used</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>
                {discountCoupons.map(c => (
                  <tr key={c.id}>
                    <td><span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg text-sm">{c.code}</span></td>
                    <td><span className="text-xs font-bold" style={{ color: c.brand_color }}>{c.agency_name}</span></td>
                    <td><span className="badge badge-blue">{c.discount_type}</span></td>
                    <td className="font-bold">{c.discount_type === 'percentage' ? `${c.value}%` : fmt(c.value)}</td>
                    <td>{c.used_count} / {c.max_uses}</td>
                    <td className="text-slate-400 text-xs">{c.expires_at}</td>
                    <td><Badge status={c.is_active ? 'active' : 'cancelled'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LMS BRIDGE ───────────────────────────────────────────────
function LmsBridge() {
  const [students, setStudents] = useState([]);
  useEffect(() => { api.get('/admin/students').then(setStudents); }, []);
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-2">LMS Bridge</h2>
      <p className="text-sm text-slate-500 mb-6">The LMS domain (testprepgpt.ai) is never exposed to students. All access is via internal SSO tokens proxied through this middleware.</p>
      <div className="card mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">SSO Flow Architecture</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {[['Student Login', '#3b82f6'], ['→', ''], ['White-Label Portal', '#64748b'], ['→', ''], ['JWT Token Gen', '#8b5cf6'], ['→', ''], ['Internal API Proxy', '#64748b'], ['→', ''], ['LMS (Hidden)', '#10b981']].map(([label, color], i) => (
            label === '→'
              ? <span key={i} className="text-slate-300 text-xl font-light">→</span>
              : <div key={i} className="px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: color }}>{label}</div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4">LMS URL: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">HIDDEN — server-side only (process.env.LMS_BASE_URL)</span></p>
      </div>
      <div className="card">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Student → LMS Mappings</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Agency</th><th>LMS User ID</th><th>SSO Status</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td><div className="font-semibold">{s.name}</div><div className="text-xs text-slate-400">{s.email}</div></td>
                  <td><span className="text-xs font-bold" style={{ color: s.brand_color }}>{s.agency_name}</span></td>
                  <td><span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{s.lms_user_id}</span></td>
                  <td><span className="badge badge-green">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── COURSES ADMIN ────────────────────────────────────────────
function CoursesAdmin() {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'IELTS', description: '', price: '', duration_weeks: 12 });
  const [msg, setMsg] = useState('');
  const load = () => api.get('/courses').then(setCourses);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/courses', form);
      setMsg('Course added!'); setShowForm(false); load();
    } catch (e) { setMsg(e.message); }
  };

  const cats = ['IELTS', 'PTE', 'TOEFL', 'GERMAN', 'FRENCH', 'SPOKEN_ENGLISH', 'OTHER'];
  const catColors = { IELTS: 'badge-blue', PTE: 'badge-green', TOEFL: 'badge-purple', GERMAN: 'badge-amber', FRENCH: 'badge-red', SPOKEN_ENGLISH: 'badge-blue', OTHER: 'badge-gray' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Courses <span className="text-base font-normal text-slate-400 ml-2">{courses.length} total</span></h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Course</button>
      </div>
      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{msg}</div>}
      {showForm && (
        <div className="card mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label>Course Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label>Price (₹)</label><input type="number" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <div><label>Duration (weeks)</label><input type="number" value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: e.target.value })} /></div>
            <div><label>Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="col-span-2 flex gap-2"><button type="submit" className="btn-success">Add Course</button><button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button></div>
          </form>
        </div>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Price</th><th>Duration</th></tr></thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.title}</td>
                  <td><span className={`badge ${catColors[c.category] || 'badge-gray'}`}>{c.category}</span></td>
                  <td className="font-bold text-slate-900">{fmt(c.price)}</td>
                  <td className="text-slate-500">{c.duration_weeks} weeks</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── BATCHES MANAGEMENT ────────────────────────────────────────
function BatchesAdmin() {
  const [batches, setBatches] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    agency_id: '', course_id: '', name: '', description: '',
    start_date: '', end_date: '', schedule_days: 'Mon,Tue,Wed,Thu,Fri',
    class_time: '09:00', duration_minutes: 60,
    trainer_name: '', max_students: 20, jitsi_room_prefix: ''
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBatches();
    api.get('/admin/agencies').then(setAgencies);
    api.get('/courses').then(setCourses);
  }, []);

  const loadBatches = () => api.get('/admin/batches').then(setBatches);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/batches', form);
      setMsg('Batch created!'); setShowForm(false); loadBatches();
      setForm({ agency_id: '', course_id: '', name: '', description: '',
        start_date: '', end_date: '', schedule_days: 'Mon,Tue,Wed,Thu,Fri',
        class_time: '09:00', duration_minutes: 60,
        trainer_name: '', max_students: 20, jitsi_room_prefix: '' });
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Batches <span className="text-base font-normal text-slate-400 ml-2">{batches.length} total</span></h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Create Batch</button>
      </div>

      {msg && <div className="mb-4 text-sm text-red-600">{msg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Create New Batch</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Agency</label>
              <select className="input" required value={form.agency_id} onChange={e => setForm({...form, agency_id: e.target.value})}>
                <option value="">Select Agency</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
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
              <label className="label">Start Date</label>
              <input type="date" className="input" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
            <div>
              <label className="label">Class Time</label>
              <input type="time" className="input" required value={form.class_time} onChange={e => setForm({...form, class_time: e.target.value})} />
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input type="number" className="input" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="label">Max Students</label>
              <input type="number" className="input" value={form.max_students} onChange={e => setForm({...form, max_students: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="label">Trainer Name</label>
              <input className="input" placeholder="Trainer name" value={form.trainer_name} onChange={e => setForm({...form, trainer_name: e.target.value})} />
            </div>
            <div className="col-span-3">
              <label className="label">Description</label>
              <textarea className="input" rows="2" placeholder="Batch description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary">Create Batch</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Batch</th><th>Agency</th><th>Course</th><th>Schedule</th><th>Students</th><th>Status</th><th>Meeting ID</th></tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{b.name}</div>
                    <div className="text-xs text-slate-400">{b.trainer_name || 'No trainer assigned'}</div>
                  </td>
                  <td>{b.agency_name}</td>
                  <td>{b.course_title}</td>
                  <td>
                    <div className="text-sm">{b.schedule_days}</div>
                    <div className="text-xs text-slate-400">{b.class_time} ({b.duration_minutes} min)</div>
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

// ── LIVE CLASSES ──────────────────────────────────────────────
function LiveClassesAdmin() {
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const EMPTY_FORM = { batch_id: '', title: '', description: '', scheduled_at: '', duration_minutes: 60, class_mode: 'interactive', auto_record: false, faculty_id: '' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState({ text: '', ok: false });

  useEffect(() => {
    loadClasses();
    api.get('/admin/batches').then(setBatches);
    api.get('/admin/faculty').then(setFacultyList).catch(() => {});
  }, []);

  const loadClasses = () => api.get('/live-classes').then(setClasses);

  // Auto-generate title when batch or datetime changes
  const autoTitle = () => {
    const batch = batches.find(b => String(b.id) === String(form.batch_id));
    if (!batch || !form.scheduled_at) return '';
    const dt = new Date(form.scheduled_at);
    const datePart = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${batch.agency_name || ''} – ${batch.name} – ${datePart} ${timePart}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, title: form.title || autoTitle() };
      await api.post('/live-classes', payload);
      setMsg({ text: 'Live class scheduled!', ok: true });
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadClasses();
    } catch (err) { setMsg({ text: err.message, ok: false }); }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/admin/live-classes/${id}/approve`, {});
      loadClasses();
    } catch (err) { alert(err.message); }
  };

  const handleEndClass = async (c) => {
    if (!confirm(`End "${c.title}"? This will close the class for all participants.`)) return;
    try {
      await api.put(`/live-classes/${c.id}`, {
        title: c.title, description: c.description,
        scheduled_at: c.scheduled_at, duration_minutes: c.duration_minutes,
        class_mode: c.class_mode, status: 'ended'
      });
      loadClasses();
    } catch (err) { alert(err.message); }
  };

  const statusColor = (s) => ({
    pending_approval: 'bg-amber-100 text-amber-700',
    scheduled: 'bg-blue-100 text-blue-700',
    live: 'bg-green-100 text-green-700',
    ended: 'bg-slate-100 text-slate-500',
    cancelled: 'bg-red-100 text-red-600',
  }[s] || 'bg-slate-100 text-slate-500');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Live Classes <span className="text-base font-normal text-slate-400 ml-2">{classes.length} total</span></h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Schedule Class</button>
      </div>

      {msg.text && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'text-red-600'}`}>{msg.text}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Schedule Live Class</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Batch *</label>
              <select className="input" required value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">Select Batch</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.course_title})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date & Time *</label>
              <input type="datetime-local" className="input" required value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <label className="label">Assign Faculty</label>
              <select className="input" value={form.faculty_id} onChange={e => setForm({ ...form, faculty_id: e.target.value })}>
                <option value="">— None (admin-led) —</option>
                {facultyList.map(f => <option key={f.id} value={f.id}>{f.name} ({f.email})</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Class Title</label>
              <input className="input" placeholder={autoTitle() || 'Auto-generated from agency + batch + time'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              {!form.title && form.batch_id && form.scheduled_at && (
                <p className="text-xs text-slate-400 mt-1">Will be: <em>{autoTitle()}</em></p>
              )}
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" className="input" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="label">Class Mode</label>
              <select className="input" value={form.class_mode} onChange={e => setForm({ ...form, class_mode: e.target.value })}>
                <option value="interactive">Interactive (2-way video)</option>
                <option value="broadcast">Broadcast (1-way only)</option>
              </select>
            </div>
            <div>
              <label className="label">Auto Record</label>
              <select className="input" value={form.auto_record} onChange={e => setForm({ ...form, auto_record: e.target.value === 'true' })}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="label">Description</label>
              <textarea className="input" rows="2" placeholder="Class description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary">Schedule Class</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Class</th><th>Batch</th><th>Faculty</th><th>Scheduled</th><th>Mode</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {classes.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{c.title}</div>
                    {c.description && <div className="text-xs text-slate-400">{c.description.slice(0, 50)}{c.description.length > 50 ? '…' : ''}</div>}
                  </td>
                  <td>{c.batch_name}</td>
                  <td>
                    {c.faculty_name
                      ? <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">{c.faculty_name}</span>
                      : <span className="text-xs text-slate-400">Admin-led</span>}
                  </td>
                  <td>
                    <div className="text-sm">{new Date(c.scheduled_at).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400">{new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td><span className="badge badge-blue">{c.class_mode}</span></td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>
                      {c.status === 'pending_approval' ? '⏳ Pending Approval' : c.status === 'live' ? '🔴 Live' : c.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5 flex-wrap">
                      {c.status === 'pending_approval' && (
                        <button className="text-xs px-3 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition" onClick={() => handleApprove(c.id)}>
                          ✓ Approve
                        </button>
                      )}
                      {(c.status === 'scheduled' || c.status === 'live') && (
                        <button className="btn-primary text-xs" onClick={() => window.open(`/live-class/${c.id}`, '_blank')}>
                          {c.status === 'live' ? '🔴 Join Live' : 'Start Class'}
                        </button>
                      )}
                      {c.status === 'live' && (
                        <button className="text-xs px-3 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition" onClick={() => handleEndClass(c)}>
                          ⏹ End Class
                        </button>
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

// ── FACULTY ADMIN ────────────────────────────────────────────
function FacultyAdmin() {
  const [faculty, setFaculty] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', agency_id: '' });
  const [msg, setMsg] = useState('');

  const load = () => api.get('/admin/faculty').then(setFaculty);
  useEffect(() => {
    load();
    api.get('/admin/agencies').then(setAgencies);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/faculty', form);
      setMsg(res.message || 'Faculty created! Default password: Faculty@123');
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', agency_id: '' });
      load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">Faculty <span className="text-base font-normal text-slate-400 ml-2">{faculty.length} total</span></h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Faculty</button>
      </div>

      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">{msg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Create Faculty Account</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" required placeholder="Instructor name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required placeholder="faculty@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="Mobile number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Agency *</label>
              <select className="input" required value={form.agency_id} onChange={e => setForm({ ...form, agency_id: e.target.value })}>
                <option value="">Select agency</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Default password: <strong>Faculty@123</strong> — faculty should change after first login</p>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary">Create Faculty</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Agency</th><th>Batches</th><th>Joined</th></tr></thead>
            <tbody>
              {faculty.map(f => (
                <tr key={f.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">{f.name?.[0]}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-400">{f.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">{f.email}</td>
                  <td className="text-sm text-slate-600">{f.agency_name || '—'}</td>
                  <td><span className="badge badge-blue">{f.batch_count} batches</span></td>
                  <td className="text-xs text-slate-400">{new Date(f.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {faculty.length === 0 && (
                <tr><td colSpan="5" className="text-center text-slate-400 py-8">No faculty members yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ALL USERS ─────────────────────────────────────────────────
const ROLE_COLORS = {
  super_admin:   'bg-red-100 text-red-700',
  partner_admin: 'bg-blue-100 text-blue-700',
  faculty:       'bg-purple-100 text-purple-700',
  student:       'bg-emerald-100 text-emerald-700',
};
const ROLE_LABELS = {
  super_admin: 'Super Admin', partner_admin: 'Partner Admin',
  faculty: 'Faculty', student: 'Student',
};

function AllUsers() {
  const [users, setUsers]       = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRole]   = useState('');
  const [editing, setEditing]   = useState(null); // user being edited
  const [editForm, setEditForm] = useState({});
  const [editMsg, setEditMsg]   = useState('');
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (roleFilter) qs.set('role', roleFilter);
    if (search)     qs.set('search', search);
    api.get(`/admin/users?${qs}`).then(u => { setUsers(u); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); api.get('/admin/agencies').then(setAgencies); }, [roleFilter]);

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, agency_id: u.agency_id || '', password: '' });
    setEditMsg('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/admin/users/${editing.id}`, editForm);
      setEditing(null);
      load();
    } catch (err) { setEditMsg(err.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (u) => {
    const action = u.is_active ? 'disable' : 'enable';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${u.name}"?`)) return;
    try {
      await api.put(`/admin/users/${u.id}/toggle-active`, {});
      load();
    } catch (err) { alert(err.message); }
  };

  const counts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">All Users <span className="text-base font-normal text-slate-400 ml-2">{users.length} total</span></h2>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Object.entries(ROLE_LABELS).map(([r, l]) => (
              <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[r]}`}>
                {l}: {counts[r] || 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="input flex-1"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
          />
          <select className="input sm:w-48" value={roleFilter} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
          </select>
          <button className="btn-primary whitespace-nowrap" onClick={load}>Search</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Agency</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="text-sm">{u.agency_name || <span className="text-slate-400">—</span>}</td>
                  <td className="text-sm">{u.phone || <span className="text-slate-400">—</span>}</td>
                  <td className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {u.is_active ? '● Active' : '● Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button
                        className="text-xs px-3 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
                        onClick={() => openEdit(u)}>
                        ✏️ Edit
                      </button>
                      <button
                        className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                        onClick={() => handleToggle(u)}>
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900">Edit User</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {editMsg && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{editMsg}</p>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" required value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="+91 98765 43210" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <select className="input" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                    {Object.entries(ROLE_LABELS).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Agency</label>
                  <select className="input" value={editForm.agency_id} onChange={e => setEditForm({ ...editForm, agency_id: e.target.value })}>
                    <option value="">— No Agency —</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="label">New Password <span className="text-slate-300 font-normal">(leave blank to keep current)</span></label>
                <input
                  type="password"
                  className="input"
                  placeholder="Min 6 characters"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────
const SECTIONS = [
  { id: 'overview',    icon: '📊', label: 'Overview' },
  { id: 'agencies',   icon: '🏢', label: 'Agencies' },
  { id: 'users',      icon: '👤', label: 'All Users' },
  { id: 'students',   icon: '👥', label: 'Students' },
  { id: 'enrollments',icon: '📚', label: 'Enrollments' },
  { id: 'batches',    icon: '📅', label: 'Batches' },
  { id: 'faculty',    icon: '🎓', label: 'Faculty' },
  { id: 'liveclasses',icon: '📺', label: 'Live Classes' },
  { id: 'revenue',    icon: '💰', label: 'Revenue' },
  { id: 'commissions',icon: '📤', label: 'Commissions' },
  { id: 'coupons',    icon: '🏷️', label: 'Coupons' },
  { id: 'courses',    icon: '📖', label: 'Courses' },
  { id: 'lms',        icon: '🔗', label: 'LMS Bridge' },
];

export default function AdminDashboard() {
  const [section, setSection] = useState('overview');

  const panels = {
    overview: <Overview />,
    agencies: <Agencies />,
    users: <AllUsers />,
    students: <AllStudents />,
    enrollments: <AllEnrollments />,
    batches: <BatchesAdmin />,
    faculty: <FacultyAdmin />,
    liveclasses: <LiveClassesAdmin />,
    revenue: <Revenue />,
    commissions: <Commissions />,
    coupons: <AdminCoupons />,
    courses: <CoursesAdmin />,
    lms: <LmsBridge />,
  };

  return (
    <DashLayout
      bgColor="#0f172a"
      sidebar={{
        logo: (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center font-black text-white text-sm">TP</div>
              <div className="text-white font-bold text-sm">TestPrep Admin</div>
            </div>
            <div className="text-xs text-white/40 font-mono">Super Admin Panel</div>
          </div>
        ),
        items: SECTIONS.map(s => (
          <NavItem key={s.id} active={section === s.id} onClick={() => setSection(s.id)} icon={s.icon} label={s.label} accent="#ef4444" />
        ))
      }}
      headerRight={
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>testprep.com — Master Admin</span>
        </div>
      }
    >
      {panels[section]}
    </DashLayout>
  );
}
