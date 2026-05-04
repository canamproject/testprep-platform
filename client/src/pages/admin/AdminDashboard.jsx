import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
// Parse DB datetime as local time (strip Z so JS doesn't shift by UTC offset)
const parseDT = (s) => s ? new Date(s.slice(0, 19)) : new Date(0);
const fmtDate = (s) => parseDT(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (s) => parseDT(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
// Convert DB datetime string to datetime-local input value (local time)
const toInputDT = (s) => s ? s.slice(0, 16) : '';

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
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white overflow-hidden" style={{ background: ag.brand_color }}>
                        {ag.logo_url ? <img src={ag.logo_url} alt="logo" className="w-full h-full object-contain p-0.5 bg-white" /> : ag.logo_initials}
                      </div>
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
function AgencyLogoUpload({ agency, onDone }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await api.post(`/admin/agencies/${agency.id}/logo`, { logo_url: ev.target.result });
        onDone();
      } catch (err) {
        alert(err.message);
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };
  return (
    <label className="cursor-pointer text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
      {uploading ? '…' : agency.logo_url ? '🖼 Change Logo' : '📷 Upload Logo'}
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

const PARTNER_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'students', label: 'Students', icon: '👥' },
  { id: 'enrollments', label: 'Enrollments', icon: '📋' },
  { id: 'purchases', label: 'Online Bookings', icon: '🛒' },
  { id: 'batches', label: 'Batches', icon: '🗂️' },
  { id: 'faculty', label: 'Faculty', icon: '👨‍🏫' },
  { id: 'liveclasses', label: 'Live Classes', icon: '📺' },
  { id: 'earnings', label: 'Earnings', icon: '💰' },
  { id: 'claim', label: 'Claim Commission', icon: '💸' },
  { id: 'crm', label: 'CRM / Leads', icon: '🤝' },
  { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  { id: 'branding', label: 'Branding', icon: '🎨' },
  { id: 'agencyprofile', label: 'Agency Profile', icon: '🏢' },
  { id: 'paymentconfig', label: 'Payment Config', icon: '⚙️' },
];

const LAYOUT_OPTIONS = [
  { id: 1, label: 'Classic', desc: 'Solid brand-color sidebar', preview: 'bg-gradient-to-b from-blue-700 to-blue-800' },
  { id: 2, label: 'Light', desc: 'White sidebar, clean minimal', preview: 'bg-white border border-slate-200' },
  { id: 3, label: 'Bold', desc: 'Gradient sidebar, large logo', preview: 'bg-gradient-to-b from-blue-600 to-blue-900' },
];

const LOGO_SHAPES = [
  { id: 'rounded', label: 'Rounded', style: { borderRadius: '12px' } },
  { id: 'circle',  label: 'Circle',  style: { borderRadius: '50%' } },
  { id: 'oval',    label: 'Oval',    style: { borderRadius: '50%', transform: 'scaleX(1.35)' } },
  { id: 'square',  label: 'Square',  style: { borderRadius: '0' } },
];

export function logoShapeStyle(shape) {
  return LOGO_SHAPES.find(s => s.id === shape)?.style || { borderRadius: '12px' };
}

// ── PORTAL PREVIEW ────────────────────────────────────────────
function PortalPreview({ agency, visibleSections, layoutType, logoShape, onClose }) {
  const lt = Number(layoutType) || 1;
  const accent = agency.brand_color || '#1e40af';

  function darken(hex, amt) {
    try {
      const n = parseInt(hex.replace('#',''), 16);
      const r = Math.max(0,(n>>16)-amt), g = Math.max(0,((n>>8)&255)-amt), b = Math.max(0,(n&255)-amt);
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    } catch { return hex; }
  }

  const sidebarBg = lt === 2
    ? '#f8fafc'
    : lt === 3
      ? `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 30)} 100%)`
      : accent;
  const isDark = lt !== 2;
  const textPrimary = isDark ? 'rgba(255,255,255,0.95)' : '#1e293b';
  const textSub = isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8';
  const navBg = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';
  const navText = isDark ? 'rgba(255,255,255,0.9)' : '#475569';

  const shapeStyle = logoShapeStyle(logoShape);
  const logoSize = lt === 1 ? 48 : 60;
  const visibleList = visibleSections.length > 0
    ? PARTNER_SECTIONS.filter(s => visibleSections.includes(s.id))
    : PARTNER_SECTIONS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-base">Portal Preview — {agency.name}</h3>
            <p className="text-xs text-slate-400">This is how the partner dashboard will look. Changes are not live yet.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Preview window */}
        <div className="flex" style={{ height: 480 }}>
          {/* Simulated Sidebar */}
          <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 200, background: sidebarBg }}>
            {/* Logo area */}
            <div className="p-4" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
              <div className="flex items-center justify-center mb-2">
                <div style={{ width: logoSize, height: logoSize, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.15)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...shapeStyle }}>
                  {agency.logo_url
                    ? <img src={agency.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                    : <span style={{ fontWeight: 900, fontSize: 20, color: isDark ? 'white' : accent }}>{agency.logo_initials || agency.name?.[0]}</span>
                  }
                </div>
              </div>
              <div style={{ color: textPrimary, fontWeight: 700, fontSize: 13, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{agency.name}</div>
              <div style={{ color: textSub, fontSize: 10, textAlign: 'center', fontFamily: 'monospace' }}>/{agency.slug}</div>
              <div style={{ marginTop: 8, background: 'rgba(37,211,102,0.85)', borderRadius: 8, padding: '5px 8px', fontSize: 10, fontWeight: 700, color: '#fff', textAlign: 'center' }}>📱 Share My Link</div>
            </div>
            {/* Nav items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
              {visibleList.slice(0, 12).map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, marginBottom: 1,
                  background: i === 0 ? navBg : 'transparent',
                  color: i === 0 ? (isDark ? 'white' : accent) : navText,
                  fontSize: 12, fontWeight: i === 0 ? 700 : 500, cursor: 'default',
                  ...(lt !== 2 && i === 0 ? { borderLeft: `3px solid rgba(255,255,255,0.9)` } : {})
                }}>
                  <span style={{ fontSize: 14 }}>{s.icon || '•'}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Simulated Content Area */}
          <div className="flex-1 bg-slate-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100">
              <div className="w-24 h-3 bg-slate-200 rounded-full" />
              <div className="flex items-center gap-2">
                <div className="w-16 h-6 bg-red-100 rounded-lg" />
                <div className="w-20 h-5 bg-slate-100 rounded" />
                <div className="w-8 h-8 rounded-full bg-slate-200" />
              </div>
            </div>
            <div className="p-4">
              <div className="w-40 h-5 bg-slate-700 rounded mb-4" />
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[...Array(4)].map((_,i) => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="w-20 h-2 bg-slate-200 rounded mb-2" />
                    <div className="w-16 h-5 rounded" style={{ background: accent + '30' }} />
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <div className="w-32 h-3 bg-slate-200 rounded mb-3" />
                {[...Array(3)].map((_,i) => (
                  <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-24 h-2.5 bg-slate-100 rounded" />
                    <div className="flex-1 h-2.5 bg-slate-100 rounded" />
                    <div className="w-12 h-2.5 rounded" style={{ background: accent + '40' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Layout: <strong className="text-slate-700">{LAYOUT_OPTIONS.find(l=>l.id===lt)?.label || 'Classic'}</strong></span>
            <span>Logo: <strong className="text-slate-700">{LOGO_SHAPES.find(s=>s.id===logoShape)?.label || 'Rounded'}</strong></span>
            <span>Sections: <strong className="text-slate-700">{visibleList.length} visible</strong></span>
          </div>
          <button onClick={onClose} className="ml-auto px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition">
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

function AgencyEditModal({ agency, onClose, onSaved }) {
  const [form, setForm] = useState({ name: agency.name||'', email: agency.email||'', phone: agency.phone||'', city: agency.city||'', brand_color: agency.brand_color||'#1e40af', commission_rate: agency.commission_rate||60, status: agency.status||'active' });
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('edit');
  const [msg, setMsg] = useState('');
  const [resetting, setResetting] = useState(false);
  // Portal settings state
  const defaultSections = (() => {
    try { return agency.visible_sections ? JSON.parse(agency.visible_sections) : PARTNER_SECTIONS.map(s => s.id); } catch { return PARTNER_SECTIONS.map(s => s.id); }
  })();
  const [visibleSections, setVisibleSections] = useState(defaultSections);
  const [layoutType, setLayoutType] = useState(Number(agency.layout_type) || 1);
  const [logoShape, setLogoShape] = useState(agency.logo_shape || 'rounded');
  const [showPreview, setShowPreview] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalMsg, setPortalMsg] = useState('');

  useEffect(() => {
    api.get(`/admin/agencies/${agency.id}/history`).then(setHistory).catch(() => {});
  }, [agency.id]);

  const savePortalSettings = async () => {
    setPortalSaving(true); setPortalMsg('');
    try {
      await api.put(`/admin/agencies/${agency.id}/portal-settings`, { visible_sections: visibleSections, layout_type: layoutType, logo_shape: logoShape });
      setPortalMsg('✅ Portal settings saved!');
      onSaved();
      setTimeout(() => setPortalMsg(''), 2500);
    } catch (e) { setPortalMsg(e.message); }
    finally { setPortalSaving(false); }
  };

  const toggleSection = (id) => {
    setVisibleSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/agencies/${agency.id}`, form);
      setMsg('✅ Agency updated!');
      onSaved();
    } catch (e) { setMsg(e.message); }
  };

  const resetEdits = async () => {
    setResetting(true);
    try {
      await api.put(`/admin/agencies/${agency.id}/reset-edits`, {});
      setMsg('✅ Partner edit count reset to 0.');
      api.get(`/admin/agencies/${agency.id}/history`).then(setHistory);
      onSaved();
    } catch (e) { setMsg(e.message); }
    finally { setResetting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-black text-slate-900 text-lg">{agency.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Admin Edit · Partner edits used: <strong className={agency.partner_edit_count >= 2 ? 'text-red-600' : 'text-amber-600'}>{agency.partner_edit_count || 0}/2</strong></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-slate-100 flex-shrink-0">
          {[['edit','✏️ Edit'],['portal','🎨 Portal'],['history','📋 History']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition ${tab===t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{msg}</div>}

          {tab === 'edit' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Agency Name</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><label className="label">Email</label><input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><label className="label">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div><label className="label">City</label><input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
                <div><label className="label">Commission % (Partner)</label><input type="number" min="1" max="99" value={form.commission_rate} onChange={e => setForm({...form, commission_rate: Number(e.target.value)})} /></div>
                <div>
                  <label className="label">Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="label">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.brand_color} onChange={e => setForm({...form, brand_color: e.target.value})} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200" />
                    <span className="text-sm font-mono text-slate-600">{form.brand_color}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button type="submit" className="btn-primary">💾 Save Changes</button>
                {(agency.partner_edit_count || 0) > 0 && (
                  <button type="button" onClick={resetEdits} disabled={resetting}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition disabled:opacity-50">
                    {resetting ? 'Resetting...' : '🔓 Reset Partner Edit Limit'}
                  </button>
                )}
                <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              </div>
            </form>
          )}

          {tab === 'portal' && (
            <div className="space-y-6">

              {/* Preview Button */}
              <button onClick={() => setShowPreview(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-700 font-bold text-sm hover:bg-blue-50 transition">
                👁️ Preview Partner Portal
              </button>

              {/* Layout Selector */}
              <div>
                <p className="text-sm font-black text-slate-800 mb-1">Portal Layout</p>
                <p className="text-xs text-slate-500 mb-3">Choose the visual style for this partner's dashboard.</p>
                <div className="grid grid-cols-3 gap-3">
                  {LAYOUT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setLayoutType(opt.id)}
                      className={`rounded-2xl border-2 overflow-hidden text-left transition ${layoutType === opt.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}>
                      {/* Mini sidebar preview */}
                      <div className="flex h-20">
                        <div className={`w-8 h-full ${opt.preview} flex flex-col gap-1 p-1`}>
                          <div className={`w-full h-2 rounded ${opt.id === 2 ? 'bg-slate-200' : 'bg-white/30'}`} />
                          <div className={`w-full h-1.5 rounded ${opt.id === 2 ? 'bg-blue-400' : 'bg-white/50'}`} />
                          <div className={`w-3/4 h-1.5 rounded ${opt.id === 2 ? 'bg-slate-200' : 'bg-white/20'}`} />
                          <div className={`w-3/4 h-1.5 rounded ${opt.id === 2 ? 'bg-slate-200' : 'bg-white/20'}`} />
                          <div className={`w-3/4 h-1.5 rounded ${opt.id === 2 ? 'bg-slate-200' : 'bg-white/20'}`} />
                        </div>
                        <div className="flex-1 bg-slate-50 p-1.5">
                          <div className="w-full h-2 bg-slate-200 rounded mb-1" />
                          <div className="w-3/4 h-1.5 bg-slate-100 rounded" />
                        </div>
                      </div>
                      <div className="p-2 border-t border-slate-100">
                        <p className="text-xs font-black text-slate-800">{opt.label}</p>
                        <p className="text-xs text-slate-400 leading-tight">{opt.desc}</p>
                      </div>
                      {layoutType === opt.id && <div className="text-center text-xs font-bold text-blue-600 pb-1.5">✓ Selected</div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo Shape */}
              <div>
                <p className="text-sm font-black text-slate-800 mb-1">Logo Shape</p>
                <p className="text-xs text-slate-500 mb-3">Controls how the partner's logo appears in their sidebar.</p>
                <div className="grid grid-cols-4 gap-3">
                  {LOGO_SHAPES.map(shape => {
                    const bg = agency.brand_color || '#1e40af';
                    return (
                      <button key={shape.id} onClick={() => setLogoShape(shape.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition ${logoShape === shape.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div style={{ width: 44, height: 44, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'white', fontWeight: 900, fontSize: 16, ...shape.style }}>
                          {agency.logo_url
                            ? <img src={agency.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                            : (agency.logo_initials || agency.name?.[0] || 'P')
                          }
                        </div>
                        <span className={`text-xs font-bold ${logoShape === shape.id ? 'text-blue-600' : 'text-slate-500'}`}>{shape.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visible Sections */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-black text-slate-800">Visible Menu Items</p>
                  <div className="flex gap-2">
                    <button onClick={() => setVisibleSections(PARTNER_SECTIONS.map(s=>s.id))} className="text-xs text-blue-600 hover:underline">All</button>
                    <button onClick={() => setVisibleSections(['overview'])} className="text-xs text-slate-400 hover:underline">None</button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3">Unchecked items are hidden from this partner's sidebar. Overview is always available.</p>
                <div className="grid grid-cols-2 gap-2">
                  {PARTNER_SECTIONS.map(s => {
                    const checked = visibleSections.includes(s.id);
                    const isCore = s.id === 'overview';
                    return (
                      <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition
                        ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50 opacity-60'}
                        ${isCore ? 'cursor-not-allowed' : ''}`}>
                        <input type="checkbox" checked={checked} disabled={isCore}
                          onChange={() => !isCore && toggleSection(s.id)}
                          className="rounded accent-blue-600" />
                        <span className="text-sm font-semibold text-slate-700">{s.label}</span>
                        {isCore && <span className="text-xs text-slate-400 ml-auto">required</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {portalMsg && <p className={`text-xs font-bold ${portalMsg.includes('✅') ? 'text-emerald-600' : 'text-red-500'}`}>{portalMsg}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(true)}
                  className="flex-1 py-3 rounded-xl font-black text-sm border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition">
                  👁️ Preview First
                </button>
                <button onClick={savePortalSettings} disabled={portalSaving}
                  className="flex-1 py-3 rounded-xl font-black text-white text-sm bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50">
                  {portalSaving ? 'Saving...' : '💾 Save & Go Live'}
                </button>
              </div>
            </div>
          )}

          {showPreview && (
            <PortalPreview
              agency={{ ...agency, brand_color: form.brand_color || agency.brand_color }}
              visibleSections={visibleSections}
              layoutType={layoutType}
              logoShape={logoShape}
              onClose={() => setShowPreview(false)}
            />
          )}

          {tab === 'history' && (
            <div>
              {history.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No edits recorded yet.</p>
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
                              <span className="font-bold text-slate-500 capitalize w-28 flex-shrink-0">{field.replace(/_/g, ' ')}:</span>
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
    </div>
  );
}

function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editModal, setEditModal] = useState(null);
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
            <div className="flex items-center gap-3 mt-2 mb-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{ background: ag.brand_color }}>
                {ag.logo_url
                  ? <img src={ag.logo_url} alt="logo" className="w-full h-full object-contain p-1 bg-white" />
                  : <span className="text-lg font-black text-white">{ag.logo_initials}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">{ag.name}</div>
                <div className="text-xs text-slate-400 truncate">{ag.city} · {ag.email}</div>
              </div>
            </div>
            <div className="flex gap-2 mb-3 flex-wrap items-center">
              <Badge status={ag.status} />
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">/agent/{ag.slug}</span>
              <AgencyLogoUpload agency={ag} onDone={load} />
              <button onClick={() => setEditModal(ag)}
                className="text-xs font-bold px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                ✏️ Edit
              </button>
              <button onClick={() => setEditModal({ ...ag, _historyOnly: true })}
                className="text-xs font-bold px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                📋 History
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-slate-50 pt-4">
              <div className="text-center"><div className="text-lg font-black text-slate-900">{ag.student_count}</div><div className="text-xs text-slate-400">Students</div></div>
              <div className="text-center"><div className="text-lg font-black text-slate-900">{fmt(ag.total_revenue).replace('₹', '').split(',')[0]}L</div><div className="text-xs text-slate-400">Revenue</div></div>
              <div className="text-center"><div className="text-lg font-black text-slate-900">{ag.commission_rate}%</div><div className="text-xs text-slate-400">Commission</div></div>
            </div>
            {(ag.partner_edit_count || 0) > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-50">
                <span className={`text-xs font-bold ${ag.partner_edit_count >= 2 ? 'text-red-600' : 'text-amber-600'}`}>
                  {ag.partner_edit_count >= 2 ? '🔒 Partner edits locked (2/2)' : `⚡ Partner edits: ${ag.partner_edit_count}/2`}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {editModal && (
        <AgencyEditModal
          agency={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { load(); }}
        />
      )}
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
  const [tab, setTab] = useState('classes'); // 'classes' | 'platform'
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editClass, setEditClass] = useState(null); // class being edited
  // Real-time Zoom participant counts: { [classId]: { enrolled, demo, total, source, lastFetched } }
  const [zoomCounts, setZoomCounts] = useState({});
  const zoomPollRef = React.useRef(null);
  const TIMEZONES = [
    { value: 'Asia/Kolkata',      label: '🇮🇳 India (IST, UTC+5:30)' },
    { value: 'America/New_York',  label: '🇺🇸 New York (EST/EDT)' },
    { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (PST/PDT)' },
    { value: 'America/Chicago',   label: '🇺🇸 Chicago (CST/CDT)' },
    { value: 'Europe/London',     label: '🇬🇧 London (GMT/BST)' },
    { value: 'Europe/Paris',      label: '🇫🇷 Paris (CET/CEST)' },
    { value: 'Asia/Dubai',        label: '🇦🇪 Dubai (GST, UTC+4)' },
    { value: 'Asia/Singapore',    label: '🇸🇬 Singapore (SGT, UTC+8)' },
    { value: 'Asia/Tokyo',        label: '🇯🇵 Tokyo (JST, UTC+9)' },
    { value: 'Australia/Sydney',  label: '🇦🇺 Sydney (AEDT/AEST)' },
    { value: 'Pacific/Auckland',  label: '🇳🇿 Auckland (NZDT/NZST)' },
    { value: 'UTC',               label: '🌐 UTC (Universal)' },
  ];
  const EMPTY_FORM = { batch_id: '', title: '', description: '', scheduled_at: '', duration_minutes: 60, class_mode: 'interactive', auto_record: false, faculty_id: '', timezone: 'Asia/Kolkata' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [activePlatform, setActivePlatform] = useState('jitsi');

  useEffect(() => {
    loadClasses();
    api.get('/admin/batches').then(setBatches);
    api.get('/admin/faculty').then(setFacultyList).catch(() => {});
    api.get('/admin/live-platform-config').then(d => setActivePlatform(d.platform || 'jitsi')).catch(() => {});
  }, []);

  const loadClasses = () => api.get('/live-classes').then(data => {
    setClasses(data);
    return data;
  });

  // Fetch real-time Zoom participant counts for all live Zoom classes
  const fetchZoomCounts = (classList) => {
    const liveZoom = (classList || classes).filter(c => c.status === 'live' && c.platform === 'zoom');
    liveZoom.forEach(c => {
      api.get(`/admin/live-classes/${c.id}/zoom-participants`)
        .then(data => setZoomCounts(prev => ({ ...prev, [c.id]: { ...data, lastFetched: Date.now() } })))
        .catch(() => {});
    });
  };

  // Auto-poll every 30s while any Zoom class is live
  React.useEffect(() => {
    const liveZoom = classes.filter(c => c.status === 'live' && c.platform === 'zoom');
    if (liveZoom.length > 0) {
      fetchZoomCounts(classes);
      zoomPollRef.current = setInterval(() => fetchZoomCounts(classes), 30000);
    }
    return () => { if (zoomPollRef.current) clearInterval(zoomPollRef.current); };
  }, [classes.map(c => `${c.id}:${c.status}`).join(',')]);

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

  const handleStartClass = async (c) => {
    try {
      await api.put(`/admin/live-classes/${c.id}/start`, {});
      const updated = await loadClasses();   // refresh so status badge turns 🔴 LIVE
      // For Zoom: immediately fetch participant count
      if (c.platform === 'zoom') {
        setTimeout(() => fetchZoomCounts(updated || classes), 3000); // 3s delay for Zoom to register
      }
      // Open the meeting
      if (c.platform === 'zoom' && c.zoom_start_url) {
        window.open(c.zoom_start_url, '_blank');
      } else {
        window.open(`/live-class/${c.id}`, '_blank');
      }
    } catch (err) { alert(err.message); }
  };

  const handleEndClass = async (c) => {
    if (!confirm(`End "${c.title}"? This will close the class for all participants.`)) return;
    try {
      await api.put(`/admin/live-classes/${c.id}/end`, {});
      loadClasses();
    } catch (err) { alert(err.message); }
  };

  const openEdit = (c) => setEditClass({
    id: c.id, title: c.title, description: c.description || '',
    scheduled_at: toInputDT(c.scheduled_at),
    duration_minutes: c.duration_minutes, class_mode: c.class_mode,
  });

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/live-classes/${editClass.id}`, {
        ...editClass, status: undefined,
      });
      setEditClass(null); loadClasses();
      setMsg({ text: 'Class updated!', ok: true });
    } catch (err) { setMsg({ text: err.message, ok: false }); }
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
      {/* Tab strip */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-1">
        {[
          { id: 'classes',  label: '📅 Schedule & Classes' },
          { id: 'platform', label: `🎥 Platform Settings${activePlatform === 'zoom' ? ' · Zoom 🔵' : ' · Jitsi 🟢'}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'platform' && <LivePlatformSettings />}
      {tab !== 'platform' && <>

      {/* Edit Class Modal */}
      {editClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-900 text-lg">Edit Live Class</h3>
              <button onClick={() => setEditClass(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date & Time *</label>
                  <input type="datetime-local" className="input" required
                    value={editClass.scheduled_at}
                    onChange={e => setEditClass({ ...editClass, scheduled_at: e.target.value })} />
                </div>
                <div>
                  <label className="label">Duration (min)</label>
                  <input type="number" className="input" min="15"
                    value={editClass.duration_minutes}
                    onChange={e => setEditClass({ ...editClass, duration_minutes: +e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={editClass.title}
                  onChange={e => setEditClass({ ...editClass, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Class Mode</label>
                <select className="input" value={editClass.class_mode}
                  onChange={e => setEditClass({ ...editClass, class_mode: e.target.value })}>
                  <option value="interactive">Interactive (2-way video)</option>
                  <option value="broadcast">Broadcast (1-way only)</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows="2" value={editClass.description}
                  onChange={e => setEditClass({ ...editClass, description: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
                <button type="button" className="btn-ghost" onClick={() => setEditClass(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">Live Classes <span className="text-base font-normal text-slate-400 ml-2">{classes.length} total</span></h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active platform: <span className={`font-bold ${activePlatform === 'zoom' ? 'text-blue-600' : 'text-emerald-600'}`}>
              {activePlatform === 'zoom' ? '🔵 Zoom' : '🟢 Jitsi Meet'}
            </span>
            <button onClick={() => setTab('platform')} className="ml-2 text-blue-500 hover:underline text-xs">Change →</button>
          </p>
        </div>
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
              <label className="label">Timezone</label>
              <select className="input" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
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
              <tr><th>Class</th><th>Batch</th><th>Faculty</th><th>Scheduled</th><th>Platform</th><th>Status</th><th>👥 Live Participants</th><th>Actions</th></tr>
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
                    <div className="text-sm">{fmtDate(c.scheduled_at)}</div>
                    <div className="text-xs text-slate-400">{fmtTime(c.scheduled_at)}</div>
                    {c.timezone && c.timezone !== 'Asia/Kolkata' && (
                      <div className="text-[10px] text-blue-500 font-medium">{c.timezone.split('/')[1]?.replace('_',' ')}</div>
                    )}
                    {(!c.timezone || c.timezone === 'Asia/Kolkata') && (
                      <div className="text-[10px] text-slate-400">IST</div>
                    )}
                  </td>
                  <td>
                    {c.platform === 'zoom'
                      ? <div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🔵 Zoom</span>
                          {c.zoom_password && <div className="text-[10px] text-slate-400 mt-0.5">PWD: {c.zoom_password}</div>}
                        </div>
                      : <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">🟢 Jitsi</span>
                    }
                  </td>
                  <td>
                    {c.status === 'live' ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                          🔴 LIVE
                        </span>
                        {c.started_at && (
                          <div className="text-[10px] text-red-500 font-semibold mt-1">
                            Started {new Date(c.started_at.slice?.(0,19) ?? c.started_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>
                        {c.status === 'pending_approval' ? '⏳ Pending' : c.status}
                      </span>
                    )}
                  </td>
                  <td>
                    {c.status === 'live' ? (() => {
                      // Zoom: use real-time Zoom API counts; Jitsi: use DB attendance counts
                      const zc = c.platform === 'zoom' ? zoomCounts[c.id] : null;
                      const enrolledCount = zc ? zc.enrolled : (c.enrolled_live_count ?? 0);
                      const demoCount     = zc ? zc.demo    : (c.demo_live_count    ?? 0);
                      const total         = enrolledCount + demoCount;
                      const isZoomLive    = c.platform === 'zoom';
                      const loading       = isZoomLive && !zc;
                      return (
                        <div className="space-y-1">
                          {loading ? (
                            <div className="text-[10px] text-slate-400 animate-pulse">Fetching from Zoom…</div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                <span className="text-xs font-bold text-green-700">{enrolledCount} enrolled</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                <span className="text-xs font-bold text-amber-600">{demoCount} demo</span>
                              </div>
                              {total === 0 && <div className="text-[10px] text-slate-400">No one in yet</div>}
                              {isZoomLive && zc && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className={`text-[9px] font-semibold ${
                                    ['zoom_inmeet','zoom_dashboard'].includes(zc.source) ? 'text-blue-500'
                                    : zc.source === 'db_attendance' ? 'text-amber-500'
                                    : 'text-red-400'
                                  }`}
                                    title={zc.zoom_api_error ? `Zoom API: ${zc.zoom_api_error}` : zc.source}>
                                    {['zoom_inmeet','zoom_dashboard'].includes(zc.source)
                                      ? '🔵 Zoom' : zc.source === 'db_attendance' ? '🟡 DB' : '⚠ err'}
                                  </span>
                                  <button
                                    title={`Refresh counts\n${zc.zoom_api_error ? 'Zoom error: ' + zc.zoom_api_error : ''}\nParticipants: ${(zc.participants||[]).map(p=>p.name).join(', ') || 'none'}`}
                                    className="text-[10px] text-slate-400 hover:text-blue-500"
                                    onClick={() => api.get(`/admin/live-classes/${c.id}/zoom-participants`)
                                      .then(data => setZoomCounts(prev => ({ ...prev, [c.id]: { ...data, lastFetched: Date.now() } })))
                                      .catch(() => {})}>
                                    🔄
                                  </button>
                                  {zc.participants?.length > 0 && (
                                    <span className="text-[8px] text-slate-400 block w-full" title={zc.participants.map(p=>`${p.name}${p.enrolled?' ✓':' (demo)'}`).join(', ')}>
                                      {zc.participants.map(p => p.name?.split(' ')[0]).join(', ')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })() : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1.5 flex-wrap">
                      {c.status === 'pending_approval' && (
                        <button className="text-xs px-3 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition" onClick={() => handleApprove(c.id)}>
                          ✓ Approve
                        </button>
                      )}
                      {(c.status === 'scheduled' || c.status === 'pending_approval' || c.status === 'live') && (
                        <button className="text-xs px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition" onClick={() => openEdit(c)}>
                          ✏️ Edit
                        </button>
                      )}
                      {(c.status === 'scheduled' || c.status === 'live') && (
                        <button className="btn-primary text-xs" onClick={() => handleStartClass(c)}>
                          {c.status === 'live'
                            ? (c.platform === 'zoom' ? '🔴 Join Zoom' : '🔴 Join Live')
                            : (c.platform === 'zoom' ? '🔵 Start Zoom' : 'Start Class')}
                        </button>
                      )}
                      {c.status === 'live' && (
                        <button className="text-xs px-3 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition" onClick={() => handleEndClass(c)}>
                          ⏹ End
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
      </>}
    </div>
  );
}

// ── LIVE PLATFORM SETTINGS ────────────────────────────────────
function LivePlatformSettings() {
  const [cfg, setCfg] = useState(null);
  const [platform, setPlatform] = useState('jitsi');
  const [activeZoomId, setActiveZoomId] = useState(null);
  const [zoomList, setZoomList] = useState([]);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [showAddZoom, setShowAddZoom] = useState(false);
  const [editZoom, setEditZoom] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [saving, setSaving] = useState(false);
  const ZOOM_EMPTY = { label: '', account_email: 'canamproject23@gmail.com', account_id: '', client_id: '', client_secret: '', is_paid: false };
  const [zoomForm, setZoomForm] = useState(ZOOM_EMPTY);

  const load = () => api.get('/admin/live-platform-config').then(d => {
    setCfg(d);
    setPlatform(d.platform || 'jitsi');
    setActiveZoomId(d.active_zoom_config_id || null);
    setZoomList(d.zoom_configs || []);
  }).catch(() => {});

  useEffect(() => { load(); }, []);

  const savePlatform = async (p, zid) => {
    setSaving(true);
    try {
      await api.put('/admin/live-platform-config', { platform: p, active_zoom_config_id: zid });
      setMsg({ text: `✅ Saved — live classes will now use ${p === 'zoom' ? 'Zoom' : 'Jitsi'}`, ok: true });
      load();
    } catch (e) { setMsg({ text: '❌ ' + e.message, ok: false }); }
    finally { setSaving(false); }
  };

  const handleAddZoom = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/zoom-configs', zoomForm);
      setMsg({ text: '✅ Zoom account added', ok: true });
      setShowAddZoom(false);
      setZoomForm(ZOOM_EMPTY);
      load();
    } catch (e) { setMsg({ text: '❌ ' + e.message, ok: false }); }
  };

  const handleEditZoom = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/zoom-configs/${editZoom.id}`, editZoom);
      setMsg({ text: '✅ Zoom account updated', ok: true });
      setEditZoom(null);
      load();
    } catch (e) { setMsg({ text: '❌ ' + e.message, ok: false }); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this Zoom account?')) return;
    await api.delete(`/admin/zoom-configs/${id}`);
    setMsg({ text: '✅ Removed', ok: true });
    load();
  };

  const handleActivate = async (id) => {
    try {
      await api.put(`/admin/zoom-configs/${id}/activate`, {});
      setMsg({ text: '✅ Zoom account activated — platform switched to Zoom', ok: true });
      load();
    } catch (e) { setMsg({ text: '❌ ' + e.message, ok: false }); }
  };

  const handleTest = async (id) => {
    setTesting(id);
    setTestResult(prev => ({ ...prev, [id]: null }));
    try {
      const r = await api.post(`/admin/zoom-configs/${id}/test`, {});
      setTestResult(prev => ({ ...prev, [id]: { ok: true, msg: `✅ Connected! ${r.zoom_user} · ${r.plan}` } }));
    } catch (e) {
      setTestResult(prev => ({ ...prev, [id]: { ok: false, msg: '❌ ' + e.message } }));
    } finally { setTesting(null); }
  };

  const ZoomForm = ({ data, setData, onSubmit, onCancel, title }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        {/* Setup guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5 text-xs text-blue-800">
          <p className="font-black mb-1">📋 How to get Zoom API credentials (free):</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Go to <a href="https://marketplace.zoom.us" target="_blank" rel="noreferrer" className="underline font-semibold">marketplace.zoom.us</a> → Sign in with <strong>canamproject23@gmail.com</strong></li>
            <li>Click <strong>Develop → Build App</strong> → Choose <strong>"Server-to-Server OAuth"</strong></li>
            <li>Name your app (e.g. "TestPrep Live") → <strong>Create</strong></li>
            <li>Copy <strong>Account ID</strong>, <strong>Client ID</strong>, <strong>Client Secret</strong> from the credentials tab</li>
            <li>Under <em>Scopes</em>, add: <code>meeting:write:admin</code> and <code>user:read:admin</code></li>
            <li>Click <strong>Activate</strong> your app</li>
          </ol>
          <p className="mt-2 text-amber-700 font-semibold">⚠️ Free Zoom: 40-min limit for 3+ participants. Upgrade to Pro for unlimited.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Account Label *</label>
              <input className="input" placeholder="e.g. Main Account (Free)" required value={data.label} onChange={e => setData({ ...data, label: e.target.value })} />
            </div>
            <div>
              <label className="label">Zoom Email</label>
              <input className="input" type="email" placeholder="canamproject23@gmail.com" value={data.account_email} onChange={e => setData({ ...data, account_email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Account ID *</label>
            <input className="input font-mono text-xs" placeholder="xxxxxx..." required value={data.account_id} onChange={e => setData({ ...data, account_id: e.target.value })} />
          </div>
          <div>
            <label className="label">Client ID *</label>
            <input className="input font-mono text-xs" placeholder="xxxxxx..." required value={data.client_id} onChange={e => setData({ ...data, client_id: e.target.value })} />
          </div>
          <div>
            <label className="label">Client Secret *</label>
            <input className="input font-mono text-xs" type="password" placeholder={data.id ? '(leave blank to keep existing)' : 'xxxxxx...'} value={data.client_secret} onChange={e => setData({ ...data, client_secret: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={data.is_paid} onChange={e => setData({ ...data, is_paid: e.target.checked })} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm font-semibold text-slate-700">This is a <span className="text-blue-600">Pro / Paid</span> Zoom account (no 40-min limit)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">Save Zoom Account</button>
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-900 text-lg">🎥 Live Class Platform</h3>
          <p className="text-xs text-slate-400 mt-0.5">Choose how live classes are hosted across all partners</p>
        </div>
      </div>

      {msg.text && (
        <div className={`text-sm px-4 py-2.5 rounded-xl font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {msg.text}
        </div>
      )}

      {/* Platform Selector */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { id: 'jitsi', label: 'Jitsi Meet', icon: '🟢', desc: 'Free, open-source, no account needed. Meetings via 8×8.vc. No time limits.', badge: 'Free · No setup', badgeColor: 'bg-emerald-100 text-emerald-700' },
          { id: 'zoom',  label: 'Zoom',       icon: '🔵', desc: 'Professional video meetings via Zoom API. Free plan: 40-min limit for groups. Pro: unlimited.', badge: zoomList.some(z => z.is_paid) ? 'Pro Account Ready' : 'Free / Pro', badgeColor: zoomList.some(z => z.is_paid) ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700' },
        ].map(p => (
          <button key={p.id} onClick={() => { setPlatform(p.id); if (p.id === 'jitsi') savePlatform('jitsi', null); }}
            className={`p-5 rounded-2xl border-2 text-left transition-all ${platform === p.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{p.icon}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.badgeColor}`}>{p.badge}</span>
            </div>
            <div className="font-black text-slate-900 mb-1">{p.label}</div>
            <div className="text-xs text-slate-500">{p.desc}</div>
            {platform === p.id && (
              <div className="mt-2 text-xs font-black text-blue-600">✓ Currently Active</div>
            )}
          </button>
        ))}
      </div>

      {/* Zoom Accounts Section */}
      {platform === 'zoom' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-black text-slate-900">Zoom Accounts</h4>
              <p className="text-xs text-slate-400">Add multiple Zoom accounts (switch anytime)</p>
            </div>
            <button onClick={() => setShowAddZoom(true)} className="btn-primary text-sm">+ Add Zoom Account</button>
          </div>

          {zoomList.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🔵</div>
              <p className="font-semibold text-slate-600">No Zoom accounts configured</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">Add your Zoom Server-to-Server OAuth credentials to get started.</p>
              <button onClick={() => setShowAddZoom(true)} className="btn-primary">+ Add Zoom Account</button>
            </div>
          ) : (
            <div className="space-y-3">
              {zoomList.map(z => (
                <div key={z.id} className={`rounded-xl border-2 p-4 transition ${z.is_active ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900">{z.label}</span>
                        {z.is_active && <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full">✓ ACTIVE</span>}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${z.is_paid ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-600'}`}>
                          {z.is_paid ? '💎 Pro/Paid' : '🆓 Free Plan'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{z.account_email}</div>
                      {testResult[z.id] && (
                        <div className={`text-xs mt-1.5 font-semibold ${testResult[z.id].ok ? 'text-emerald-600' : 'text-red-500'}`}>
                          {testResult[z.id].msg}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <button onClick={() => handleTest(z.id)} disabled={testing === z.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50 font-semibold">
                        {testing === z.id ? '⏳ Testing...' : '🔌 Test'}
                      </button>
                      {!z.is_active && (
                        <button onClick={() => handleActivate(z.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                          Activate
                        </button>
                      )}
                      <button onClick={() => setEditZoom({ ...z, client_secret: '' })}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                        ✏️
                      </button>
                      <button onClick={() => handleDelete(z.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
                        🗑️
                      </button>
                    </div>
                  </div>
                  {z.is_active && (
                    <div className="mt-3 pt-3 border-t border-blue-200 flex items-center justify-between">
                      <p className="text-xs text-blue-700 font-semibold">This account creates all new Zoom meetings</p>
                      <button onClick={() => savePlatform('zoom', z.id)} disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-black hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Saving...' : '💾 Save & Go Live'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!zoomList.some(z => z.is_paid) && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-black mb-1">⚠️ Free Zoom Plan Limitations</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Group meetings limited to <strong>40 minutes</strong></li>
                <li>Max <strong>100 participants</strong> per meeting</li>
                <li>Upgrade to <strong>Zoom Pro ($14.99/mo)</strong> for unlimited time</li>
              </ul>
              <p className="mt-2">To upgrade: log into <a href="https://zoom.us/billing" target="_blank" rel="noreferrer" className="underline font-bold">zoom.us/billing</a> with your Zoom account</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Zoom modals */}
      {showAddZoom && (
        <ZoomForm data={zoomForm} setData={setZoomForm} onSubmit={handleAddZoom}
          onCancel={() => { setShowAddZoom(false); setZoomForm(ZOOM_EMPTY); }}
          title="Add Zoom Account" />
      )}
      {editZoom && (
        <ZoomForm data={editZoom} setData={setEditZoom} onSubmit={handleEditZoom}
          onCancel={() => setEditZoom(null)}
          title="Edit Zoom Account" />
      )}
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

// ── PAYMENT CONFIG (Global + Partner Overrides) ───────────────
function PaymentConfigForm({ form, setForm, saving, onSave, msg, accentColor = '#1e40af' }) {
  const handleQR = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, qr_code_image: ev.target.result }));
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-5">
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

      <button onClick={onSave} disabled={saving}
        className="w-full py-3 rounded-xl font-black text-white text-sm transition disabled:opacity-50"
        style={{ background: accentColor }}>
        {saving ? 'Saving...' : 'Save Payment Config'}
      </button>
    </div>
  );
}

const EMPTY_FORM = { upi_id:'', upi_name:'', qr_code_image:'', payment_link:'', mobile_number:'', mobile_instructions:'' };

function PaymentConfig() {
  const [tab, setTab] = useState('global');
  const [globalForm, setGlobalForm] = useState(EMPTY_FORM);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [globalMsg, setGlobalMsg] = useState('');
  const [agencies, setAgencies] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [permToggles, setPermToggles] = useState({});
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideForm, setOverrideForm] = useState(EMPTY_FORM);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');

  const loadAll = () => {
    api.get('/admin/global-payment-config').then(d => {
      if (d) setGlobalForm({
        upi_id: d.upi_id||'', upi_name: d.upi_name||'',
        qr_code_image: d.qr_code_image||'', payment_link: d.payment_link||'',
        mobile_number: d.mobile_number||'', mobile_instructions: d.mobile_instructions||'',
      });
    }).catch(() => {});
    api.get('/admin/agencies').then(ags => {
      setAgencies(ags);
      const perms = {};
      ags.forEach(a => { perms[a.id] = !!a.can_configure_payment; });
      setPermToggles(perms);
    }).catch(() => {});
    api.get('/admin/payment-config').then(rows => {
      const m = {};
      rows.forEach(r => { m[r.agency_id] = r; });
      setOverrides(m);
    }).catch(() => {});
  };
  useEffect(loadAll, []);

  const saveGlobal = async () => {
    setGlobalSaving(true); setGlobalMsg('');
    try {
      await api.put('/admin/global-payment-config', globalForm);
      setGlobalMsg('Saved!');
      setTimeout(() => setGlobalMsg(''), 2000);
    } catch (e) { setGlobalMsg(e.message); }
    finally { setGlobalSaving(false); }
  };

  const togglePerm = async (agId, current) => {
    const next = current ? 0 : 1;
    setPermToggles(p => ({ ...p, [agId]: !!next }));
    try {
      await api.put(`/admin/agencies/${agId}/payment-permission`, { can_configure_payment: next });
    } catch (e) {
      setPermToggles(p => ({ ...p, [agId]: !!current }));
    }
  };

  const openOverride = (ag) => {
    const cfg = overrides[ag.id] || {};
    setOverrideForm({
      upi_id: cfg.upi_id||'', upi_name: cfg.upi_name||'',
      qr_code_image: cfg.qr_code_image||'', payment_link: cfg.payment_link||'',
      mobile_number: cfg.mobile_number||'', mobile_instructions: cfg.mobile_instructions||'',
    });
    setOverrideModal(ag);
    setOverrideMsg('');
  };

  const saveOverride = async () => {
    setOverrideSaving(true); setOverrideMsg('');
    try {
      await api.put(`/admin/payment-config/${overrideModal.id}`, overrideForm);
      setOverrides(prev => ({ ...prev, [overrideModal.id]: { ...overrideForm, agency_id: overrideModal.id } }));
      setOverrideMsg('Saved!');
      setTimeout(() => { setOverrideModal(null); setOverrideMsg(''); }, 1200);
    } catch (e) { setOverrideMsg(e.message); }
    finally { setOverrideSaving(false); }
  };

  const globalHasConfig = !!(globalForm.upi_id || globalForm.qr_code_image || globalForm.payment_link || globalForm.mobile_number);

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-1">Payment Configuration</h2>
      <p className="text-sm text-slate-500 mb-5">Set one global payment method for all students. Optionally grant specific partners their own override.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['global','🌐 Global Default'],['partners','🏢 Partner Overrides']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab===id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'global' && (
        <div className="max-w-lg">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-black text-blue-800">This is the default payment method for ALL students</p>
            <p className="text-xs text-blue-600 mt-1">Every student will see these payment details unless their agency has been granted an override below.</p>
          </div>
          {!globalHasConfig && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold">
              No global config saved yet — students will see "Payment not set up" until you save at least one method below.
            </div>
          )}
          <PaymentConfigForm form={globalForm} setForm={setGlobalForm} saving={globalSaving} onSave={saveGlobal} msg={globalMsg} accentColor="#0f172a" />
        </div>
      )}

      {tab === 'partners' && (
        <div>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-black text-amber-800">Partner overrides are disabled by default</p>
            <p className="text-xs text-amber-700 mt-1">Toggle the switch to allow a specific partner to configure their own payment method for their students. When disabled, the global default applies.</p>
          </div>
          <div className="grid gap-4">
            {agencies.map(ag => {
              const hasPerm = !!permToggles[ag.id];
              const cfg = overrides[ag.id];
              const methods = [
                cfg?.upi_id && '💳 UPI',
                cfg?.qr_code_image && '📷 QR',
                cfg?.payment_link && '🔗 Link',
                cfg?.mobile_number && '📱 Mobile',
              ].filter(Boolean);
              return (
                <div key={ag.id} className={`card flex items-center gap-4 transition ${hasPerm ? 'ring-2 ring-emerald-300' : ''}`}>
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-white text-sm overflow-hidden"
                    style={{ background: ag.brand_color }}>
                    {ag.logo_url ? <img src={ag.logo_url} className="w-full h-full object-contain" alt="" /> : ag.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">{ag.name}</p>
                    {hasPerm
                      ? methods.length > 0
                        ? <p className="text-xs text-emerald-600 mt-0.5">Override: {methods.join(' · ')}</p>
                        : <p className="text-xs text-amber-500 mt-0.5">Override enabled — no config set yet</p>
                      : <p className="text-xs text-slate-400 mt-0.5">Using global default</p>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    {hasPerm && (
                      <button onClick={() => openOverride(ag)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition">
                        {cfg ? 'Edit Override' : 'Set Override'}
                      </button>
                    )}
                    <button onClick={() => togglePerm(ag.id, hasPerm)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                        ${hasPerm ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                        ${hasPerm ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">Override Config — {overrideModal.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">This will override the global default for this partner's students only</p>
              </div>
              <button onClick={() => setOverrideModal(null)} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
            </div>
            <div className="p-5">
              <PaymentConfigForm form={overrideForm} setForm={setOverrideForm} saving={overrideSaving} onSave={saveOverride} msg={overrideMsg} accentColor={overrideModal.brand_color || '#1e40af'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN PAYMENTS ────────────────────────────────────────────
function AdminPayments() {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/admin/payments').then(rows => { setProofs(rows); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAction = async (id, status, note='') => {
    try {
      await api.put(`/admin/payments/${id}`, { status, admin_note: note });
      setActionMsg(status === 'verified' ? '✅ Payment verified! Enrollment marked as paid.' : '❌ Payment rejected.');
      setViewing(null);
      load();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (e) { setActionMsg(e.message); }
  };

  const methodIcon = { upi:'💳', qr:'📷', link:'🔗', mobile:'📱', other:'💸' };
  const statusColor = { pending:'badge-amber', verified:'badge-green', rejected:'badge-red' };

  const filtered = filter === 'all' ? proofs : proofs.filter(p => p.status === filter);
  const stats = {
    total: proofs.length,
    pending: proofs.filter(p => p.status==='pending').length,
    verified: proofs.filter(p => p.status==='verified').length,
    rejected: proofs.filter(p => p.status==='rejected').length,
    amount: proofs.filter(p => p.status==='verified').reduce((a,p) => a+Number(p.amount||0), 0),
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Payment Records</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Proofs</p><p className="text-2xl font-black">{stats.total}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Pending Review</p><p className="text-2xl font-black text-amber-500">{stats.pending}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Verified</p><p className="text-2xl font-black text-emerald-600">{stats.verified}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Collected</p><p className="text-2xl font-black text-blue-600">{fmt(stats.amount)}</p></div>
      </div>

      {actionMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold">{actionMsg}</div>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all','pending','verified','rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition
              ${filter===f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {f} {f!=='all' && `(${stats[f]})`}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <div className="text-center py-8 text-slate-400 text-sm">Loading...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Agency</th><th>Course</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-slate-400 py-6">No payment records found</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-sm">{p.student_name}</div>
                      <div className="text-xs text-slate-400">{p.student_email}</div>
                    </td>
                    <td className="text-sm">{p.agency_name}</td>
                    <td className="text-sm">{p.course_title || '—'}</td>
                    <td className="font-black">{fmt(p.amount)}</td>
                    <td><span className="text-base">{methodIcon[p.payment_method] || '💸'}</span> <span className="text-xs text-slate-500">{p.payment_method}</span></td>
                    <td>
                      {p.proof_image
                        ? <span className="text-emerald-600 text-xs font-bold">✅ Uploaded</span>
                        : <span className="text-red-500 text-xs font-bold">⚠️ Missing</span>
                      }
                    </td>
                    <td className="text-xs text-slate-400">{p.created_at?.split('T')[0]}</td>
                    <td><span className={`badge ${statusColor[p.status]}`}>{p.status}</span></td>
                    <td>
                      <button onClick={() => setViewing(p)}
                        className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof detail modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">Payment Proof</h3>
                <p className="text-xs text-slate-400 mt-0.5">{viewing.student_name} · {viewing.agency_name}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Amount</p><p className="font-black text-slate-900">{fmt(viewing.amount)}</p></div>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Method</p><p className="font-semibold">{methodIcon[viewing.payment_method]} {viewing.payment_method}</p></div>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Course</p><p className="font-semibold">{viewing.course_title || '—'}</p></div>
                <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Date</p><p className="font-semibold">{viewing.created_at?.split('T')[0]}</p></div>
              </div>

              {viewing.student_phone && (
                <div className="p-3 bg-slate-50 rounded-xl text-sm"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Phone</p><p>{viewing.student_phone}</p></div>
              )}

              {viewing.notes && (
                <div className="p-3 bg-blue-50 rounded-xl text-sm"><p className="text-xs font-bold text-blue-700 uppercase mb-1">Notes from Student</p><p className="text-blue-800">{viewing.notes}</p></div>
              )}

              {viewing.proof_image ? (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Payment Receipt <span className="text-emerald-600">✅ Uploaded</span></p>
                  <img src={viewing.proof_image} alt="proof" className="w-full rounded-xl border border-slate-200 object-contain max-h-64" />
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-sm font-black text-red-700">⚠️ No Receipt Uploaded</p>
                  <p className="text-xs text-red-500 mt-1">Course should NOT be issued without a valid receipt.</p>
                </div>
              )}

              {viewing.verified_at && (
                <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-700">
                  <span className="font-bold">Verified</span> on {viewing.verified_at?.split('T')[0]}
                  {viewing.verified_by_name && <> by <span className="font-bold">{viewing.verified_by_name}</span></>}
                </div>
              )}

              {viewing.admin_note && (
                <div className="p-3 bg-red-50 rounded-xl text-sm"><p className="text-xs font-bold text-red-700 uppercase mb-1">Admin Note</p><p className="text-red-800">{viewing.admin_note}</p></div>
              )}

              <span className={`badge ${statusColor[viewing.status]}`}>{viewing.status}</span>

              {viewing.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={() => handleAction(viewing.id, 'verified')}
                    className="py-2.5 rounded-xl font-black text-white text-sm bg-emerald-500 hover:bg-emerald-600 transition">
                    ✅ Verify
                  </button>
                  <button onClick={() => {
                    const note = window.prompt('Rejection reason (optional):') || '';
                    handleAction(viewing.id, 'rejected', note);
                  }} className="py-2.5 rounded-xl font-black text-white text-sm bg-red-500 hover:bg-red-600 transition">
                    ❌ Reject
                  </button>
                </div>
              )}
            </div>
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
  { id: 'coupons',        icon: '🏷️', label: 'Coupons' },
  { id: 'courses',        icon: '📖', label: 'Courses' },
  { id: 'lms',            icon: '🔗', label: 'LMS Bridge' },
  { id: 'paymentconfig',  icon: '⚙️', label: 'Payment Config' },
  { id: 'payments',       icon: '💸', label: 'All Payments' },
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
    paymentconfig: <PaymentConfig />,
    payments: <AdminPayments />,
  };

  return (
    <DashLayout
      bgColor="#0f172a"
      onLiveClasses={() => setSection('liveclasses')}
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
