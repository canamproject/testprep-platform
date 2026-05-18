import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';
import MaskedContact from '../../components/MaskedContact';
import LogoDisplay, { SHAPE_RADIUS, logoBgColor } from '../../components/LogoDisplay';

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

// ── SHARED FILTER COMPONENTS ─────────────────────────────────
// Multi-select dropdown — compact, click-outside aware
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

// Compact filter row — all filters in one line + Search button
function FilterRow({ onApply, onClear, appliedCount, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
      {children}
      <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
        {appliedCount > 0 && (
          <button type="button" onClick={onClear}
            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-all">
            ✕ Clear
            <span className="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">{appliedCount}</span>
          </button>
        )}
        <button type="button" onClick={onApply}
          className="flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
          🔍 Search
        </button>
      </div>
    </div>
  );
}

// Compact search input
function SearchInput({ value, onChange, placeholder = 'Search…', width = 'w-44' }) {
  return (
    <div className="relative flex-shrink-0">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`${width} pl-7 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300`} />
    </div>
  );
}

// Compact date range
function DateRange({ from, to, onFrom, onTo }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</span>
      <input type="date" value={from} onChange={e => onFrom(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-32" />
      <span className="text-slate-300 text-xs">→</span>
      <input type="date" value={to} onChange={e => onTo(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-32" />
    </div>
  );
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
                      <LogoDisplay
                        logoUrl={ag.logo_url} fit={ag.logo_fit || 'contain'} bg={ag.logo_bg || 'white'}
                        padding={ag.logo_padding != null ? Number(ag.logo_padding) : 4}
                        brandColor={ag.brand_color} initials={ag.logo_initials || ag.name?.[0]}
                        shape={ag.logo_shape || 'rounded'} size={32}
                      />
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

// ── COPY SIGNUP LINK (used in both Admin agencies & Partner sidebar) ────
function CopySignupLink({ slug, agencyName, compact = false }) {
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const signupUrl = `${window.location.origin}/${slug}`;

  const doCopy = () => {
    navigator.clipboard.writeText(signupUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const doWhatsApp = () => {
    const msg = `🎓 Join ${agencyName || 'our academy'} and kickstart your exam prep!\n\nSign up here 👇\n${signupUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (compact) {
    // Compact horizontal version for agency profile sidebar
    return (
      <div className="w-full flex gap-1.5 mt-1">
        <button onClick={doCopy}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition"
          style={{ background: copied ? '#16a34a' : '#f1f5f9', color: copied ? '#fff' : '#475569' }}>
          {copied ? '✅ Copied!' : '🔗 Copy Link'}
        </button>
        <button onClick={doWhatsApp}
          className="flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
          style={{ background: 'rgba(37,211,102,0.15)', color: '#16a34a' }}
          title="Share via WhatsApp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>
      </div>
    );
  }

  // Full card version for admin agency cards
  return (
    <div className="mt-2 pt-3 border-t border-slate-100">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Student Signup Link</p>
      <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl p-2 border border-slate-200 mb-2">
        <span className="text-[10px] text-slate-500 font-mono flex-1 truncate">{signupUrl}</span>
        <button onClick={doCopy}
          className="text-[10px] font-black px-2.5 py-1 rounded-lg transition flex-shrink-0"
          style={{ background: copied ? '#16a34a' : '#1e40af', color: '#fff' }}>
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
      </div>
      <button onClick={doWhatsApp}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-90"
        style={{ background: 'rgba(37,211,102,0.12)', color: '#16a34a', border: '1px solid rgba(37,211,102,0.3)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Share via WhatsApp
      </button>
    </div>
  );
}

// ── LOGO APPEARANCE EDITOR (admin portal tab + partner branding) ────────────
const FIT_OPTIONS = [
  { value: 'contain', label: 'Contain', desc: 'Show full logo', icon: '⬜' },
  { value: 'cover',   label: 'Cover',   desc: 'Fill frame (may crop)', icon: '🔳' },
  { value: 'fill',    label: 'Fill',    desc: 'Stretch to fit', icon: '▬' },
];
const BG_OPTIONS = [
  { value: 'white',       label: 'White',       desc: 'Clean white bg' },
  { value: 'transparent', label: 'Transparent', desc: 'Logo only, no bg' },
  { value: 'brand',       label: 'Brand Color', desc: 'Uses your brand color' },
  { value: 'light',       label: 'Light Tint',  desc: 'Subtle color wash' },
];
const PADDING_OPTIONS = [
  { value: 0,  label: 'None' },
  { value: 6,  label: 'Small' },
  { value: 12, label: 'Medium' },
  { value: 18, label: 'Large' },
];

function LogoAppearanceEditor({ agency, localFit, localBg, localPadding, localShape,
  onChangeFit, onChangeBg, onChangePadding, onChangeShape,
  onLogoUpload, onLogoRemove, uploading }) {

  const brandColor = agency?.brand_color || '#1e40af';
  const logoUrl    = agency?.logo_url;
  const initials   = agency?.logo_initials || agency?.name?.[0] || 'P';
  const dropRef    = useRef();
  const [dragging, setDragging] = useState(false);

  // Preview sizes
  const previews = [
    { label: 'Sidebar',  size: 60 },
    { label: 'Nav',      size: 40 },
    { label: 'Small',    size: 28 },
  ];

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onLogoUpload(file);
  };

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div>
        <p className="text-sm font-black text-slate-800 mb-1">Logo Image</p>
        <p className="text-xs text-slate-400 mb-3">PNG or SVG with transparent background works best. Max 2 MB.</p>
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 transition cursor-pointer
            ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>

          {/* Preview in all sizes */}
          <div className="flex items-end gap-4 mb-1">
            {previews.map(p => (
              <div key={p.label} className="flex flex-col items-center gap-1.5">
                <LogoDisplay
                  logoUrl={logoUrl} fit={localFit} bg={localBg} padding={localPadding}
                  brandColor={brandColor} initials={initials} shape={localShape} size={p.size}
                />
                <span className="text-[10px] text-slate-400 font-medium">{p.label}</span>
              </div>
            ))}
          </div>

          <label className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 ${uploading ? 'opacity-60' : ''}`}
            style={{ background: brandColor }}>
            {uploading ? '⏳ Uploading…' : logoUrl ? '🔄 Change Logo' : '📁 Upload Logo'}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden" disabled={uploading}
              onChange={e => e.target.files[0] && onLogoUpload(e.target.files[0])} />
          </label>
          <p className="text-[11px] text-slate-400">or drag & drop here</p>

          {logoUrl && (
            <button onClick={onLogoRemove}
              className="text-xs text-red-500 hover:text-red-700 font-semibold underline transition">
              Remove logo
            </button>
          )}
        </div>
      </div>

      {/* Background */}
      <div>
        <p className="text-sm font-black text-slate-800 mb-1">Logo Background</p>
        <p className="text-xs text-slate-400 mb-3">Choose what sits behind your logo in the container.</p>
        <div className="grid grid-cols-2 gap-2">
          {BG_OPTIONS.map(opt => {
            const preview = opt.value === 'white' ? '#fff'
              : opt.value === 'brand' ? brandColor
              : opt.value === 'light' ? brandColor + '1a'
              : 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px'; // checkerboard for transparent
            const isSelected = localBg === opt.value;
            return (
              <button key={opt.value} onClick={() => onChangeBg(opt.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-slate-200"
                  style={{ background: preview }} />
                <div>
                  <p className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                  <p className="text-[10px] text-slate-400">{opt.desc}</p>
                </div>
                {isSelected && <span className="ml-auto text-blue-600 text-sm">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fit mode */}
      <div>
        <p className="text-sm font-black text-slate-800 mb-1">Logo Fit</p>
        <p className="text-xs text-slate-400 mb-3">Controls how the image fills the container.</p>
        <div className="flex gap-2">
          {FIT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => onChangeFit(opt.value)}
              className={`flex-1 p-3 rounded-xl border-2 text-center transition ${localFit === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="text-lg mb-1">{opt.icon}</div>
              <p className={`text-xs font-bold ${localFit === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Padding */}
      <div>
        <p className="text-sm font-black text-slate-800 mb-1">Inner Padding</p>
        <p className="text-xs text-slate-400 mb-3">Space between the logo image and its container edge.</p>
        <div className="flex gap-2">
          {PADDING_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => onChangePadding(opt.value)}
              className={`flex-1 py-2 rounded-xl border-2 text-center text-xs font-bold transition
                ${localPadding === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shape (reuse existing shapes) */}
      <div>
        <p className="text-sm font-black text-slate-800 mb-1">Logo Shape</p>
        <div className="grid grid-cols-4 gap-2">
          {LOGO_SHAPES.map(shape => (
            <button key={shape.id} onClick={() => onChangeShape(shape.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition ${localShape === shape.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <LogoDisplay
                logoUrl={logoUrl} fit={localFit} bg={localBg} padding={localPadding}
                brandColor={brandColor} initials={initials} shape={shape.id} size={36}
              />
              <span className={`text-[10px] font-bold ${localShape === shape.id ? 'text-blue-600' : 'text-slate-500'}`}>{shape.label}</span>
            </button>
          ))}
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
                <LogoDisplay
                  logoUrl={agency.logo_url}
                  fit={agency.logo_fit || 'contain'}
                  bg={agency.logo_bg || 'white'}
                  padding={agency.logo_padding != null ? Number(agency.logo_padding) : 8}
                  brandColor={accent}
                  initials={agency.logo_initials || agency.name?.[0]}
                  shape={logoShape}
                  size={logoSize}
                />
              </div>
              <div style={{ color: textPrimary, fontWeight: 700, fontSize: 13, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{agency.name}</div>
              <div style={{ color: textSub, fontSize: 10, textAlign: 'center', fontFamily: 'monospace' }}>/{agency.slug}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                <div style={{ flex: 1, background: isDark ? 'rgba(255,255,255,0.18)' : '#f1f5f9', borderRadius: 8, padding: '5px 6px', fontSize: 9, fontWeight: 700, color: isDark ? '#fff' : '#475569', textAlign: 'center' }}>🔗 Copy Link</div>
                <div style={{ background: 'rgba(37,211,102,0.85)', borderRadius: 8, padding: '5px 8px', fontSize: 9, fontWeight: 700, color: '#fff' }}>📱</div>
              </div>
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
  // Logo appearance state
  const [logoFit,     setLogoFit]     = useState(agency.logo_fit     || 'contain');
  const [logoBg,      setLogoBg]      = useState(agency.logo_bg      || 'white');
  const [logoPadding, setLogoPadding] = useState(agency.logo_padding != null ? Number(agency.logo_padding) : 8);
  const [logoUploading, setLogoUploading] = useState(false);
  const [localAgency, setLocalAgency] = useState(agency); // tracks live logo_url changes
  const [showPreview, setShowPreview] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalMsg, setPortalMsg] = useState('');
  // Partner admin password
  const [partnerUser, setPartnerUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleLogoUpload = (file) => {
    if (file.size > 2 * 1024 * 1024) { setPortalMsg('❌ Image must be under 2 MB'); return; }
    setLogoUploading(true); setPortalMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await api.post(`/admin/agencies/${agency.id}/logo`, { logo_url: ev.target.result });
        setLocalAgency(a => ({ ...a, logo_url: res.logo_url }));
        setPortalMsg('✅ Logo uploaded!');
        onSaved();
      } catch (e) { setPortalMsg('❌ ' + e.message); }
      finally { setLogoUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoRemove = async () => {
    setLogoUploading(true);
    try {
      await api.post(`/admin/agencies/${agency.id}/logo`, { logo_url: '' });
      setLocalAgency(a => ({ ...a, logo_url: null }));
      setPortalMsg('✅ Logo removed.');
      onSaved();
    } catch (e) { setPortalMsg('❌ ' + e.message); }
    finally { setLogoUploading(false); }
  };

  useEffect(() => {
    api.get(`/admin/agencies/${agency.id}/history`).then(setHistory).catch(() => {});
    api.get(`/admin/agencies/${agency.id}/partner-user`).then(r => setPartnerUser(r.user)).catch(() => {});
  }, [agency.id]);

  const resetPartnerPassword = async () => {
    if (!newPassword) return;
    setPwSaving(true); setPwMsg('');
    try {
      await api.put(`/admin/agencies/${agency.id}/partner-password`, { password: newPassword });
      setPwMsg('✅ Password updated!');
      setNewPassword('');
      setTimeout(() => setPwMsg(''), 3000);
    } catch (e) { setPwMsg('❌ ' + e.message); }
    finally { setPwSaving(false); }
  };

  const savePortalSettings = async () => {
    setPortalSaving(true); setPortalMsg('');
    try {
      await api.put(`/admin/agencies/${agency.id}/portal-settings`, {
        visible_sections: visibleSections,
        layout_type: layoutType,
        logo_shape: logoShape,
        logo_fit: logoFit,
        logo_bg: logoBg,
        logo_padding: logoPadding,
      });
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
              {/* Partner Admin Credentials */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                <p className="text-sm font-black text-slate-800 flex items-center gap-2">🔑 Partner Admin Login</p>
                {partnerUser ? (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-sm flex-shrink-0">
                        {partnerUser.name?.[0]?.toUpperCase() || 'P'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{partnerUser.name}</p>
                        <p className="text-xs text-slate-500 truncate">{partnerUser.email}</p>
                      </div>
                    </div>
                    <div>
                      <label className="label">Set New Password</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 6 chars)"
                            className="w-full pr-10"
                          />
                          <button type="button" onClick={() => setShowPassword(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm">
                            {showPassword ? '🙈' : '👁️'}
                          </button>
                        </div>
                        <button type="button" onClick={resetPartnerPassword}
                          disabled={pwSaving || !newPassword}
                          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0">
                          {pwSaving ? 'Saving…' : '🔒 Update'}
                        </button>
                      </div>
                      {pwMsg && <p className={`text-xs mt-1 font-semibold ${pwMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{pwMsg}</p>}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">No partner admin user found for this agency.</p>
                )}
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

              {/* Logo Appearance (full editor) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                <p className="text-sm font-black text-slate-800 mb-0.5">🖼 Logo Appearance</p>
                <p className="text-xs text-slate-400 mb-4">Upload a logo and fine-tune how it looks across the partner portal.</p>
                <LogoAppearanceEditor
                  agency={localAgency}
                  localFit={logoFit}   localBg={logoBg}   localPadding={logoPadding}  localShape={logoShape}
                  onChangeFit={setLogoFit}  onChangeBg={setLogoBg}
                  onChangePadding={setLogoPadding}  onChangeShape={setLogoShape}
                  onLogoUpload={handleLogoUpload}  onLogoRemove={handleLogoRemove}
                  uploading={logoUploading}
                />
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
              <LogoDisplay
                logoUrl={ag.logo_url} fit={ag.logo_fit || 'contain'} bg={ag.logo_bg || 'white'}
                padding={ag.logo_padding != null ? Number(ag.logo_padding) : 8}
                brandColor={ag.brand_color} initials={ag.logo_initials || ag.name?.[0]}
                shape={ag.logo_shape || 'rounded'} size={48}
              />
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
            {/* Copy Signup Link */}
            <CopySignupLink slug={ag.slug} agencyName={ag.name} />
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
  // ── Filters ─────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [agencyF,       setAgencyF]       = useState([]);   // selected agency names
  const [enrolF,        setEnrolF]        = useState([]);   // '0','1','2+'
  const [paidF,         setPaidF]         = useState([]);   // 'paid','unpaid'
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [sortBy,        setSortBy]        = useState('newest');

  useEffect(() => { api.get('/admin/students').then(setStudents); }, []);

  // Derived filter options from data
  const agencyOptions = [...new Set(students.map(s => s.agency_name).filter(Boolean))].sort();

  // ── Applied snapshot (only updates on Search click) ────────
  const [applied, setApplied] = useState(null);
  const handleSearch = () => setApplied({ search, agencyF, enrolF, paidF, dateFrom, dateTo });
  const handleClear  = () => { setSearch(''); setAgencyF([]); setEnrolF([]); setPaidF([]); setDateFrom(''); setDateTo(''); setApplied(null); };
  const f = applied || {};
  const appliedCount = !applied ? 0 : [f.search, f.agencyF?.length, f.enrolF?.length, f.paidF?.length, f.dateFrom, f.dateTo].filter(Boolean).length;

  const filtered = students
    .filter(s => {
      if (!applied) return true;
      if (f.search && !s.name?.toLowerCase().includes(f.search.toLowerCase()) && !s.email?.toLowerCase().includes(f.search.toLowerCase()) && !s.agency_name?.toLowerCase().includes(f.search.toLowerCase()) && !s.phone?.includes(f.search)) return false;
      if (f.agencyF?.length && !f.agencyF.includes(s.agency_name)) return false;
      if (f.enrolF?.length) {
        const n = s.enrollment_count || 0;
        if (!f.enrolF.some(v => v === '0' ? n === 0 : v === '1' ? n === 1 : n >= 2)) return false;
      }
      if (f.paidF?.length) {
        const hasPaid = Number(s.total_paid) > 0;
        if (!f.paidF.some(v => v === 'paid' ? hasPaid : !hasPaid)) return false;
      }
      if (f.dateFrom && s.created_at < f.dateFrom) return false;
      if (f.dateTo   && s.created_at > f.dateTo + 'T23:59:59') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest')    return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'courses')   return (b.enrollment_count || 0) - (a.enrollment_count || 0);
      if (sortBy === 'paid')      return Number(b.total_paid) - Number(a.total_paid);
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-3">All Students
        <span className="text-base font-normal text-slate-400 ml-2">{applied ? `${filtered.length} of ${students.length}` : students.length}</span>
      </h2>

      <FilterRow onApply={handleSearch} onClear={handleClear} appliedCount={appliedCount}>
        <SearchInput value={search} onChange={setSearch} placeholder="Name, email, phone…" width="w-48" />
        {agencyOptions.length > 0 && (
          <MultiSelectDropdown label="Agency" options={agencyOptions} selected={agencyF} onChange={setAgencyF} />
        )}
        <MultiSelectDropdown label="Courses" options={[{value:'0',label:'0 courses'},{value:'1',label:'1 course'},{value:'2+',label:'2+ courses'}]} selected={enrolF} onChange={setEnrolF} />
        <MultiSelectDropdown label="Revenue" options={[{value:'paid',label:'Has paid'},{value:'unpaid',label:'₹0 paid'}]} selected={paidF} onChange={setPaidF} />
        <DateRange from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none text-slate-600 flex-shrink-0">
          <option value="newest">↕ Newest</option>
          <option value="oldest">↕ Oldest</option>
          <option value="courses">↕ Most courses</option>
          <option value="paid">↕ Highest paid</option>
        </select>
      </FilterRow>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Agency</th><th>🔒 Contact (masked)</th><th>Courses</th><th>Total Paid</th><th>LMS ID</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-6 text-sm">No students match the selected filters</td></tr>}
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">{s.name?.[0]}</div>
                      <div className="font-semibold text-slate-900">{s.name}</div>
                    </div>
                  </td>
                  <td><span className="text-xs font-bold px-2 py-1 rounded" style={{ background: s.brand_color + '20', color: s.brand_color }}>{s.agency_name}</span></td>
                  <td><MaskedContact studentId={s.id} email={s.email} phone={s.phone} /></td>
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
  // ── Filters ─────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [agencyF,     setAgencyF]     = useState([]);
  const [categoryF,   setCategoryF]   = useState([]);
  const [paymentF,    setPaymentF]    = useState([]);
  const [statusF,     setStatusF]     = useState([]);
  const [progressF,   setProgressF]   = useState([]);  // 'none','low','mid','high'
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [feeMin,      setFeeMin]      = useState('');
  const [feeMax,      setFeeMax]      = useState('');
  const [sortBy,      setSortBy]      = useState('newest');

  useEffect(() => { api.get('/admin/enrollments').then(setEnrollments); }, []);

  // Derived options
  const agencyOptions   = [...new Set(enrollments.map(e => e.agency_name).filter(Boolean))].sort();
  const categoryOptions = [...new Set(enrollments.map(e => e.category).filter(Boolean))].sort();

  // ── Applied snapshot (only updates on Search click) ────────
  const [applied, setApplied] = useState(null);
  const handleSearch = () => setApplied({ search, agencyF, categoryF, paymentF, statusF, progressF, feeMin, feeMax, dateFrom, dateTo });
  const handleClear  = () => { setSearch(''); setAgencyF([]); setCategoryF([]); setPaymentF([]); setStatusF([]); setProgressF([]); setFeeMin(''); setFeeMax(''); setDateFrom(''); setDateTo(''); setApplied(null); };
  const f = applied || {};
  const appliedCount = !applied ? 0 : [f.search, f.agencyF?.length, f.categoryF?.length, f.paymentF?.length, f.statusF?.length, f.progressF?.length, f.feeMin, f.feeMax, f.dateFrom, f.dateTo].filter(Boolean).length;

  const filtered = enrollments
    .filter(e => {
      if (!applied) return true;
      if (f.search && !e.student_name?.toLowerCase().includes(f.search.toLowerCase()) && !e.student_email?.toLowerCase().includes(f.search.toLowerCase()) && !e.course_title?.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.agencyF?.length   && !f.agencyF.includes(e.agency_name)) return false;
      if (f.categoryF?.length && !f.categoryF.includes(e.category)) return false;
      if (f.paymentF?.length  && !f.paymentF.includes(e.payment_status)) return false;
      if (f.statusF?.length   && !f.statusF.includes(e.status)) return false;
      if (f.progressF?.length) {
        const p = e.progress_percent || 0;
        if (!f.progressF.some(v => v==='none'?p===0 : v==='low'?p>0&&p<50 : v==='mid'?p>=50&&p<80 : p>=80)) return false;
      }
      if (f.feeMin && Number(e.fee_paid) < Number(f.feeMin)) return false;
      if (f.feeMax && Number(e.fee_paid) > Number(f.feeMax)) return false;
      if (f.dateFrom && e.enrolled_at < f.dateFrom) return false;
      if (f.dateTo   && e.enrolled_at > f.dateTo + 'T23:59:59') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest')   return new Date(a.enrolled_at) - new Date(b.enrolled_at);
      if (sortBy === 'fee_high') return Number(b.fee_paid) - Number(a.fee_paid);
      if (sortBy === 'fee_low')  return Number(a.fee_paid) - Number(b.fee_paid);
      if (sortBy === 'progress') return (b.progress_percent||0) - (a.progress_percent||0);
      return new Date(b.enrolled_at||0) - new Date(a.enrolled_at||0);
    });

  const totalRev    = enrollments.filter(e => e.payment_status === 'paid').reduce((a, e) => a + Number(e.fee_paid), 0);
  const filteredRev = filtered.filter(e => e.payment_status === 'paid').reduce((a, e) => a + Number(e.fee_paid), 0);

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-xl font-black text-slate-900">All Enrollments
          <span className="text-base font-normal text-slate-400 ml-2">{applied ? `${filtered.length} of ${enrollments.length}` : enrollments.length}</span>
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Revenue: <strong className="text-emerald-600">{fmt(applied ? filteredRev : totalRev)}</strong>
          {applied && <span className="text-slate-400"> of {fmt(totalRev)} total</span>}
        </p>
      </div>

      <FilterRow onApply={handleSearch} onClear={handleClear} appliedCount={appliedCount}>
        <SearchInput value={search} onChange={setSearch} placeholder="Student, course…" width="w-44" />
        {agencyOptions.length > 0 && (
          <MultiSelectDropdown label="Agency" options={agencyOptions} selected={agencyF} onChange={setAgencyF} />
        )}
        {categoryOptions.length > 0 && (
          <MultiSelectDropdown label="Category" options={categoryOptions} selected={categoryF} onChange={setCategoryF} />
        )}
        <MultiSelectDropdown label="Payment" options={['paid','pending','rejected']} selected={paymentF} onChange={setPaymentF} />
        <MultiSelectDropdown label="Status" options={['active','completed','cancelled']} selected={statusF} onChange={setStatusF} />
        <MultiSelectDropdown label="Progress" options={[{value:'none',label:'0%'},{value:'low',label:'1–49%'},{value:'mid',label:'50–79%'},{value:'high',label:'80%+'}]} selected={progressF} onChange={setProgressF} />
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Fee ₹</span>
          <input type="number" value={feeMin} onChange={e => setFeeMin(e.target.value)} placeholder="Min"
            className="w-16 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <span className="text-slate-300 text-xs">–</span>
          <input type="number" value={feeMax} onChange={e => setFeeMax(e.target.value)} placeholder="Max"
            className="w-16 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <DateRange from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none text-slate-600 flex-shrink-0">
          <option value="newest">↕ Newest</option>
          <option value="oldest">↕ Oldest</option>
          <option value="fee_high">↕ Fee High→Low</option>
          <option value="fee_low">↕ Fee Low→High</option>
          <option value="progress">↕ Progress</option>
        </select>
      </FilterRow>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Category</th><th>Agency</th><th>Fee</th><th>Payment</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-6 text-sm">No enrollments match the selected filters</td></tr>}
              {filtered.map(e => (
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
// ── Module templates by category ─────────────────────────────
const MODULE_TEMPLATES = {
  IELTS: [
    { title: 'Introduction to IELTS', lectures: ['Exam Overview & Format', 'Band Score System', 'Test Day Tips'] },
    { title: 'Listening Skills', lectures: ['Section 1 – Conversations', 'Section 2 – Monologue', 'Section 3 – Academic', 'Section 4 – Lecture', 'Practice Test 1'] },
    { title: 'Reading Skills', lectures: ['True/False/Not Given', 'Matching Headings', 'Summary Completion', 'Multiple Choice', 'Practice Test 2'] },
    { title: 'Writing Task 1', lectures: ['Bar Charts & Line Graphs', 'Pie Charts & Tables', 'Process Diagrams', 'Maps & Plans', 'Sample Essays'] },
    { title: 'Writing Task 2', lectures: ['Opinion Essays', 'Discussion Essays', 'Problem-Solution Essays', 'Advantage-Disadvantage', 'Feedback & Corrections'] },
    { title: 'Speaking', lectures: ['Part 1 – Introduction', 'Part 2 – Cue Card', 'Part 3 – Discussion', 'Pronunciation Tips', 'Mock Speaking Tests'] },
    { title: 'Grammar & Vocabulary', lectures: ['Cohesive Devices', 'Academic Word List', 'Complex Sentences', 'Collocations'] },
    { title: 'Full Mock Tests', lectures: ['Mock Test 1 – Full Paper', 'Mock Test 2 – Full Paper', 'Mock Test 3 – Full Paper'] },
  ],
  PTE: [
    { title: 'Introduction to PTE Academic', lectures: ['Exam Format Overview', 'Scoring System', 'Test Center Tips'] },
    { title: 'Speaking & Writing', lectures: ['Read Aloud', 'Repeat Sentence', 'Describe Image', 'Re-tell Lecture', 'Answer Short Question', 'Summarize Written Text', 'Essay Writing'] },
    { title: 'Reading', lectures: ['Multiple Choice Single', 'Multiple Choice Multiple', 'Re-order Paragraphs', 'Fill in the Blanks', 'Reading & Writing FIB'] },
    { title: 'Listening', lectures: ['Summarize Spoken Text', 'MCQ Listening', 'Fill Blanks (Listening)', 'Highlight Correct Summary', 'Select Missing Word', 'Highlight Incorrect Words', 'Write from Dictation'] },
    { title: 'AI-Scored Practice', lectures: ['Pronunciation Drills', 'Fluency Practice', 'AI Feedback Sessions'] },
    { title: 'Full Mock Tests', lectures: ['Mock Test 1', 'Mock Test 2', 'Mock Test 3'] },
  ],
  TOEFL: [
    { title: 'Introduction to TOEFL iBT', lectures: ['Test Format & Timing', 'Scoring Breakdown', 'Registration Guide'] },
    { title: 'Reading Section', lectures: ['Factual Information', 'Inference Questions', 'Vocabulary in Context', 'Prose Summary', 'Practice Passages'] },
    { title: 'Listening Section', lectures: ['Academic Lectures', 'Campus Conversations', 'Note-Taking Strategies'] },
    { title: 'Speaking Section', lectures: ['Independent Task', 'Integrated Task 1 & 2', 'Fluency & Pronunciation'] },
    { title: 'Writing Section', lectures: ['Integrated Essay', 'Independent Essay', 'Paraphrasing Techniques'] },
    { title: 'Full Mock Tests', lectures: ['Mock Test 1', 'Mock Test 2'] },
  ],
  GERMAN: [
    { title: 'A1 – Absolute Beginners', lectures: ['Alphabet & Pronunciation', 'Greetings & Introductions', 'Numbers 1–100', 'Days, Months, Seasons', 'Basic Verbs (sein, haben)'] },
    { title: 'A2 – Elementary', lectures: ['Nominative & Accusative Cases', 'Modal Verbs', 'Daily Routines', 'Food & Shopping', 'Simple Past Tense'] },
    { title: 'B1 – Intermediate', lectures: ['Dative Case', 'Subordinate Clauses', 'Comparing Things', 'Travel & Transport', 'Expressing Opinions'] },
    { title: 'B2 – Upper Intermediate', lectures: ['Genitive Case', 'Passive Voice', 'Subjunctive II', 'Business German', 'Media & Culture'] },
    { title: 'Speaking Practice', lectures: ['Role Plays', 'Presentation Skills', 'Telephone Conversations', 'Interview Prep'] },
    { title: 'Exam Preparation (Goethe/TestDaF)', lectures: ['Exam Format', 'Hören Practice', 'Lesen Practice', 'Schreiben Practice', 'Sprechen Practice'] },
  ],
  FRENCH: [
    { title: 'A1 – Débutant', lectures: ['Alphabet & Sounds', 'Greetings & Politeness', 'Numbers & Dates', 'Colours & Adjectives', 'Verb Être & Avoir'] },
    { title: 'A2 – Élémentaire', lectures: ['Present Tense Verbs', 'Family & Relationships', 'At the Restaurant', 'Directions & Places', 'Simple Past (Passé Composé)'] },
    { title: 'B1 – Intermédiaire', lectures: ['Imparfait Tense', 'Future Tense', 'Expressing Emotions', 'Work & Career', 'French Media'] },
    { title: 'DELF/DALF Preparation', lectures: ['Compréhension Écrite', 'Compréhension Orale', 'Production Écrite', 'Production Orale', 'Mock Tests'] },
  ],
  SPOKEN_ENGLISH: [
    { title: 'Foundations', lectures: ['IPA & Phonetics', 'Stress & Rhythm', 'Intonation Patterns', 'Word Linking'] },
    { title: 'Everyday Conversations', lectures: ['Greetings & Small Talk', 'At Work', 'On the Phone', 'Social Situations'] },
    { title: 'Professional English', lectures: ['Presentations', 'Meetings & Discussions', 'Email Writing', 'Job Interviews'] },
    { title: 'Grammar in Use', lectures: ['Tense Review', 'Conditionals', 'Reported Speech', 'Phrasal Verbs'] },
    { title: 'Advanced Communication', lectures: ['Debate & Argumentation', 'Public Speaking', 'Negotiation Skills', 'Leadership Language'] },
  ],
  OTHER: [
    { title: 'Introduction', lectures: ['Course Overview', 'Learning Goals', 'Study Plan'] },
    { title: 'Core Concepts', lectures: ['Lesson 1', 'Lesson 2', 'Lesson 3', 'Lesson 4'] },
    { title: 'Intermediate Topics', lectures: ['Topic 1', 'Topic 2', 'Topic 3'] },
    { title: 'Advanced Material', lectures: ['Advanced 1', 'Advanced 2'] },
    { title: 'Practice & Assessment', lectures: ['Practice Test 1', 'Practice Test 2', 'Final Assessment'] },
  ],
};

// ── Curriculum Editor (modules + lectures) — redesigned ──────
function CurriculumEditor({ course }) {
  const [modules, setModules]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [loadErr, setLoadErr]   = useState('');
  const [openMods, setOpenMods] = useState({});
  const [msg, setMsg]           = useState('');
  const [editingMod, setEditingMod] = useState(null);
  const [showModForm, setShowModForm] = useState(false);
  const [modForm, setModForm]   = useState({ title:'', description:'', sort_order:0, price:'', is_free_preview:false });
  const [lecForms, setLecForms] = useState({});

  // Modals
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLibrary, setShowLibrary]     = useState(false);
  const [libraryModules, setLibraryModules] = useState([]);
  const [selectedLibMods, setSelectedLibMods] = useState([]);
  const [selectedTemplMods, setSelectedTemplMods] = useState([]);
  const [importing, setImporting] = useState(false);

  const fmtDur = (m) => { if (!m) return ''; const h=Math.floor(m/60),mn=m%60; return h>0?(mn>0?`${h}h ${mn}m`:`${h}h`):`${mn}m`; };
  const totalLectures = modules.reduce((s,m)=>s+(m.lectures?.length||0),0);
  const totalMins     = modules.reduce((s,m)=>s+m.lectures?.reduce((ls,l)=>ls+(l.duration_minutes||0),0),0);

  const load = async () => {
    setLoading(true); setLoadErr('');
    try {
      const data = await api.get(`/admin/courses/${course.id}/modules`);
      setModules(Array.isArray(data) ? data : []);
    } catch(e) {
      setLoadErr(e.message?.includes('DOCTYPE') || e.message?.includes('JSON')
        ? 'Server is updating — please wait a moment and click Retry.'
        : (e.message || 'Failed to load curriculum'));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [course.id]);

  const openLibraryModal = async () => {
    setSelectedLibMods([]);
    try {
      const all = await api.get('/admin/all-modules');
      setLibraryModules((all||[]).filter(m => m.course_id !== course.id));
    } catch(e) { setLibraryModules([]); }
    setShowLibrary(true);
  };

  const importFromTemplates = async () => {
    if (!selectedTemplMods.length) return;
    setImporting(true);
    const templates = MODULE_TEMPLATES[course.category] || MODULE_TEMPLATES.OTHER;
    try {
      for (let idx=0; idx<selectedTemplMods.length; idx++) {
        const tmpl = templates[selectedTemplMods[idx]];
        if (!tmpl) continue;
        const r = await api.post(`/admin/courses/${course.id}/modules`, {
          title: tmpl.title, description:'', sort_order: modules.length+idx, price:null, is_free_preview:false
        });
        for (let li=0; li<tmpl.lectures.length; li++) {
          await api.post(`/admin/modules/${r.id}/lectures`, {
            title: tmpl.lectures[li], course_id: course.id,
            duration_minutes: 60, sort_order: li, price: null, is_free_preview: li===0
          });
        }
      }
      setMsg(`✅ Added ${selectedTemplMods.length} module(s) with lectures`);
      setShowTemplates(false); setSelectedTemplMods([]);
      load();
    } catch(e) { setMsg('❌ '+e.message); }
    finally { setImporting(false); }
  };

  const importFromLibrary = async () => {
    if (!selectedLibMods.length) return;
    setImporting(true);
    try {
      const r = await api.post(`/admin/courses/${course.id}/import-modules`, { module_ids: selectedLibMods });
      setMsg(`✅ Copied ${r.copied} module(s) with all lectures`);
      setShowLibrary(false); setSelectedLibMods([]);
      load();
    } catch(e) { setMsg('❌ '+e.message); }
    finally { setImporting(false); }
  };

  const saveModule = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      if (editingMod) {
        await api.put(`/admin/modules/${editingMod}`, modForm);
        setEditingMod(null);
      } else {
        await api.post(`/admin/courses/${course.id}/modules`, modForm);
      }
      setShowModForm(false);
      setModForm({ title:'', description:'', sort_order:0, price:'', is_free_preview:false });
      load(); setMsg('✅ Module saved');
    } catch(e) { setMsg('❌ '+e.message); }
  };

  const deleteModule = async (id) => {
    if (!confirm('Delete this module and all its lectures?')) return;
    try { await api.delete(`/admin/modules/${id}`); load(); }
    catch(e) { setMsg('❌ '+e.message); }
  };

  const saveLecture = async (e, moduleId) => {
    e.preventDefault(); setMsg('');
    const lf = lecForms[moduleId] || {};
    try {
      if (lf.editingId) {
        await api.put(`/admin/lectures/${lf.editingId}`, { ...lf, course_id: course.id });
      } else {
        await api.post(`/admin/modules/${moduleId}/lectures`, { ...lf, course_id: course.id });
      }
      setLecForms(p => ({ ...p, [moduleId]: {} }));
      load(); setMsg('✅ Lecture saved');
    } catch(e) { setMsg('❌ '+e.message); }
  };

  const deleteLecture = async (id) => {
    if (!confirm('Delete this lecture?')) return;
    try { await api.delete(`/admin/lectures/${id}`); load(); }
    catch(e) { setMsg('❌ '+e.message); }
  };

  const startEditMod = (mod) => {
    setEditingMod(mod.id);
    setModForm({ title:mod.title, description:mod.description||'', sort_order:mod.sort_order||0, price:mod.price||'', is_free_preview:!!mod.is_free_preview });
    setShowModForm(true);
    setOpenMods(p=>({...p,[mod.id]:true}));
  };
  const startEditLec = (mod, lec) => {
    setLecForms(p=>({...p,[mod.id]:{editingId:lec.id,title:lec.title,description:lec.description||'',duration_minutes:lec.duration_minutes||60,sort_order:lec.sort_order||0,price:lec.price||'',is_free_preview:!!lec.is_free_preview}}));
    setOpenMods(p=>({...p,[mod.id]:true}));
  };

  const templates = MODULE_TEMPLATES[course.category] || MODULE_TEMPLATES.OTHER;

  return (
    <div className="mt-6 border-t-2 border-indigo-100 pt-6 pb-2">

      {/* ── Header row ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
            📋 Curriculum Editor
            <span className="text-xs font-normal text-slate-400">— {course.title}</span>
          </h3>
          {!loading && !loadErr && (
            <p className="text-xs text-slate-400 mt-0.5">
              {modules.length} module{modules.length!==1?'s':''} · {totalLectures} lecture{totalLectures!==1?'s':''}{totalMins>0?` · ${fmtDur(totalMins)} total`:''}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>{setShowTemplates(true);setSelectedTemplMods([]);}}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold transition-all">
            📦 Load Templates
          </button>
          <button onClick={openLibraryModal}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-all">
            📚 Copy from Course
          </button>
          <button onClick={()=>{setShowModForm(v=>!v);setEditingMod(null);setModForm({title:'',description:'',sort_order:modules.length,price:'',is_free_preview:false});}}
            className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold transition-all">
            + New Module
          </button>
        </div>
      </div>

      {/* ── Status messages ── */}
      {loadErr && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <span className="text-xs text-amber-700 font-semibold">⚠️ {loadErr}</span>
          <button onClick={load} className="flex-shrink-0 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-all">↻ Retry</button>
        </div>
      )}
      {msg && (
        <div className={`mb-3 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${msg.startsWith('✅')?'bg-emerald-50 border border-emerald-100 text-emerald-700':'bg-red-50 border border-red-100 text-red-600'}`}>
          <span>{msg}</span>
          <button onClick={()=>setMsg('')} className="text-slate-400 hover:text-slate-600 ml-3">✕</button>
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-6 justify-center">
          <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          Loading curriculum…
        </div>
      )}

      {/* ── Module Add/Edit Form ── */}
      {showModForm && (
        <div className="mb-5 p-5 bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200 rounded-2xl shadow-sm">
          <h4 className="text-sm font-black text-indigo-800 mb-4 flex items-center gap-2">
            {editingMod ? '✏️ Edit Module' : '➕ Add New Module'}
          </h4>
          <form onSubmit={saveModule} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Module Title *</label>
              <input className="input" required value={modForm.title} onChange={e=>setModForm({...modForm,title:e.target.value})}
                placeholder="e.g. Listening Skills, Writing Task 1…" />
            </div>
            <div>
              <label className="label">Separate Price (₹)</label>
              <input className="input" type="number" min="0" value={modForm.price} onChange={e=>setModForm({...modForm,price:e.target.value})}
                placeholder="Leave blank — included in course" />
            </div>
            <div>
              <label className="label">Sort / Display Order</label>
              <input className="input" type="number" value={modForm.sort_order} onChange={e=>setModForm({...modForm,sort_order:Number(e.target.value)})} />
            </div>
            <div className="col-span-2">
              <label className="label">Short Description (optional)</label>
              <input className="input" value={modForm.description} onChange={e=>setModForm({...modForm,description:e.target.value})}
                placeholder="What students will learn in this module" />
            </div>
            <div className="col-span-2 flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
              <input type="checkbox" id="mod-fp" checked={modForm.is_free_preview} onChange={e=>setModForm({...modForm,is_free_preview:e.target.checked})} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
              <label htmlFor="mod-fp" className="text-xs font-semibold text-emerald-800 cursor-pointer">
                Free Preview — students can view this module without purchasing
              </label>
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="submit" className="btn-success text-xs py-2 px-5">{editingMod?'✅ Update Module':'✅ Add Module'}</button>
              <button type="button" className="btn-ghost text-xs py-2" onClick={()=>{setShowModForm(false);setEditingMod(null);}}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !loadErr && modules.length===0 && (
        <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <div className="text-5xl mb-3">📂</div>
          <p className="font-black text-slate-600 text-sm">No modules yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-5">Use industry templates for a quick start, or build manually</p>
          <div className="flex gap-3 justify-center">
            <button onClick={()=>{setShowTemplates(true);setSelectedTemplMods([]);}}
              className="text-xs px-5 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-sm">
              📦 Load {course.category} Templates
            </button>
            <button onClick={()=>{setShowModForm(true);setEditingMod(null);}}
              className="text-xs px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm">
              + Add First Module
            </button>
          </div>
        </div>
      )}

      {/* ── Modules list ── */}
      <div className="space-y-3">
        {modules.map((mod, mi) => {
          const isOpen = !!openMods[mod.id];
          const modDur = mod.lectures?.reduce((s,l)=>s+(l.duration_minutes||0),0)||0;
          return (
            <div key={mod.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Module header row */}
              <div className="flex items-center gap-3 px-4 py-3.5 bg-white cursor-pointer select-none"
                onClick={()=>setOpenMods(p=>({...p,[mod.id]:!p[mod.id]}))}>
                {/* Index badge */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 text-white shadow-sm"
                  style={{background:`hsl(${(mi*53+215)%360},55%,52%)`}}>
                  {mi+1}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{mod.title}</span>
                    {mod.is_free_preview && <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">FREE</span>}
                    {mod.price && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">{fmt(mod.price)}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-slate-400">{mod.lectures?.length||0} lecture{mod.lectures?.length!==1?'s':''}</span>
                    {modDur>0 && <span className="text-[11px] text-slate-400">⏱ {fmtDur(modDur)}</span>}
                    {mod.description && <span className="text-[11px] text-slate-400 truncate max-w-xs hidden md:block">{mod.description}</span>}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>startEditMod(mod)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 font-semibold transition-all">
                    ✏️
                  </button>
                  <button onClick={()=>deleteModule(mod.id)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-red-100 text-red-400 hover:bg-red-50 hover:border-red-300 transition-all">
                    🗑
                  </button>
                  <span className="text-slate-300 ml-1 text-xs">{isOpen?'▲':'▼'}</span>
                </div>
              </div>

              {/* Lectures panel */}
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60">
                  {/* Lectures list */}
                  {(mod.lectures||[]).map((lec,li)=>(
                    <div key={lec.id} className="group flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 hover:bg-white/80 transition-colors">
                      <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 flex-shrink-0 shadow-sm">
                        {mi+1}.{li+1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800">{lec.title}</span>
                          {lec.is_free_preview && <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full border border-emerald-100">FREE PREVIEW</span>}
                          {lec.price && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">{fmt(lec.price)}</span>}
                        </div>
                        {lec.description && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{lec.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lec.duration_minutes>0 && (
                          <span className="text-[11px] font-semibold text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-lg">{lec.duration_minutes} min</span>
                        )}
                        <button onClick={()=>startEditLec(mod,lec)}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100">
                          Edit
                        </button>
                        <button onClick={()=>deleteLecture(lec.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded-lg bg-white border border-red-100 text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add / Edit lecture form */}
                  {(()=>{
                    const lf = lecForms[mod.id] || {};
                    return (
                      <div className="p-4 bg-white/50 border-t border-slate-100">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2">{lf.editingId?'Edit Lecture':'+ Add Lecture'}</p>
                        <form onSubmit={e=>saveLecture(e,mod.id)} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="col-span-2 sm:col-span-4">
                            <input className="input text-xs" required placeholder="Lecture title *" value={lf.title||''}
                              onChange={e=>setLecForms(p=>({...p,[mod.id]:{...lf,title:e.target.value}}))} />
                          </div>
                          <input className="input text-xs col-span-2" placeholder="Description (optional)" value={lf.description||''}
                            onChange={e=>setLecForms(p=>({...p,[mod.id]:{...lf,description:e.target.value}}))} />
                          <input className="input text-xs" type="number" min="1" placeholder="Duration (mins) *" value={lf.duration_minutes||''}
                            onChange={e=>setLecForms(p=>({...p,[mod.id]:{...lf,duration_minutes:Number(e.target.value)}}))} />
                          <input className="input text-xs" type="number" min="0" placeholder="Price ₹ (blank = free w/ course)" value={lf.price||''}
                            onChange={e=>setLecForms(p=>({...p,[mod.id]:{...lf,price:e.target.value}}))} />
                          <div className="col-span-2 sm:col-span-4 flex items-center justify-between gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={!!lf.is_free_preview}
                                onChange={e=>setLecForms(p=>({...p,[mod.id]:{...lf,is_free_preview:e.target.checked}}))} className="accent-emerald-600 w-3.5 h-3.5" />
                              <span className="text-[11px] font-semibold text-slate-600">Free preview</span>
                            </label>
                            <div className="flex gap-2">
                              <button type="submit" className="btn-success text-xs py-1 px-4">{lf.editingId?'Update':'+ Add Lecture'}</button>
                              {lf.editingId && <button type="button" className="btn-ghost text-xs py-1" onClick={()=>setLecForms(p=>({...p,[mod.id]:{}}))}>Cancel</button>}
                            </div>
                          </div>
                        </form>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════
          TEMPLATE MODAL (full-screen overlay)
          ════════════════════════════════════════════ */}
      {/* ── TEMPLATE PICKER (inline panel) ── */}
      {showTemplates && (
        <div className="mb-5 rounded-2xl border-2 border-purple-200 bg-purple-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-purple-100 border-b border-purple-200">
            <div>
              <span className="font-bold text-purple-900 text-sm">📦 {course.category} Module Templates</span>
              <span className="ml-2 text-[11px] text-purple-500">Select modules to add to this course</span>
            </div>
            <button onClick={()=>setShowTemplates(false)} className="text-purple-400 hover:text-purple-700 text-lg leading-none font-bold px-1">✕</button>
          </div>
          {/* Grid of template cards */}
          <div className="p-4 grid grid-cols-1 gap-2" style={{maxHeight:'340px',overflowY:'auto'}}>
            {templates.map((tmpl, i) => {
              const checked = selectedTemplMods.includes(i);
              return (
                <label key={i} onClick={()=>setSelectedTemplMods(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked?'border-purple-500 bg-white shadow-sm':'border-transparent bg-white hover:border-purple-300'}`}>
                  {/* Checkbox */}
                  <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${checked?'bg-purple-600 border-purple-600':'border-slate-300'}`}>
                    {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm">{tmpl.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{tmpl.lectures.length} lectures</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {tmpl.lectures.slice(0,4).map((l,li)=>(
                        <span key={li} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{l}</span>
                      ))}
                      {tmpl.lectures.length>4 && <span className="text-[10px] text-slate-400">+{tmpl.lectures.length-4} more</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-purple-100 border-t border-purple-200">
            <div className="flex gap-3">
              <button onClick={()=>setSelectedTemplMods(templates.map((_,i)=>i))} className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline">Select All</button>
              <button onClick={()=>setSelectedTemplMods([])} className="text-xs text-slate-500 hover:text-slate-700 font-semibold underline">Clear</button>
              <span className="text-xs text-purple-500">{selectedTemplMods.length} selected</span>
            </div>
            <button disabled={!selectedTemplMods.length||importing} onClick={importFromTemplates}
              className="text-xs px-4 py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 transition-all shadow-sm">
              {importing ? '⏳ Adding…' : `✅ Add ${selectedTemplMods.length} Module(s)`}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          LIBRARY MODAL (copy from other course)
          ════════════════════════════════════════════ */}
      {showLibrary && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}
          onClick={e=>e.target===e.currentTarget&&setShowLibrary(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">📚 Copy from Other Course</h3>
                <p className="text-xs text-slate-400 mt-0.5">Deep-copy selected modules (with all lectures) into this course</p>
              </div>
              <button onClick={()=>setShowLibrary(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {libraryModules.length===0 ? (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-sm font-semibold">No modules in other courses yet</p>
                  <p className="text-xs mt-1">Add modules to other courses first, then copy them here</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(()=>{
                    let lastCourse=null;
                    return libraryModules.map(mod=>{
                      const showHeader=mod.course_title!==lastCourse;
                      lastCourse=mod.course_title;
                      return (
                        <React.Fragment key={mod.id}>
                          {showHeader && (
                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-wider px-1 pt-3 pb-1 flex items-center gap-1.5">
                              <span className="w-3 h-px bg-blue-300 flex-1" />
                              {mod.category} · {mod.course_title}
                              <span className="w-3 h-px bg-blue-300 flex-1" />
                            </div>
                          )}
                          <div onClick={()=>setSelectedLibMods(p=>p.includes(mod.id)?p.filter(x=>x!==mod.id):[...p,mod.id])}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${selectedLibMods.includes(mod.id)?'border-blue-500 bg-blue-50':'border-slate-200 bg-white hover:border-blue-300'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedLibMods.includes(mod.id)?'bg-blue-600 border-blue-600':'border-slate-300'}`}>
                              {selectedLibMods.includes(mod.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-900">{mod.title}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {mod.lectures?.length||0} lectures{mod.price?` · ${fmt(mod.price)}`:''}{mod.is_free_preview?' · FREE':''}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            {libraryModules.length>0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                <div className="flex gap-3">
                  <button onClick={()=>setSelectedLibMods(libraryModules.map(m=>m.id))} className="text-xs text-blue-600 font-semibold hover:underline">Select All</button>
                  <button onClick={()=>setSelectedLibMods([])} className="text-xs text-slate-400 font-semibold hover:underline">Clear</button>
                </div>
                <button disabled={!selectedLibMods.length||importing} onClick={importFromLibrary}
                  className="text-xs px-5 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-all shadow-sm">
                  {importing?'⏳ Copying…':`📋 Copy ${selectedLibMods.length} Module${selectedLibMods.length!==1?'s':''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CoursesAdmin() {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'IELTS', description: '', price: '', duration_weeks: 12 });
  const [msg, setMsg] = useState('');
  const [editingCurriculum, setEditingCurriculum] = useState(null);
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
            <thead><tr><th>Title</th><th>Category</th><th>Price</th><th>Duration</th><th>Action</th></tr></thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id} className={editingCurriculum?.id === c.id ? 'bg-blue-50' : ''}>
                  <td className="font-semibold">{c.title}</td>
                  <td><span className={`badge ${catColors[c.category] || 'badge-gray'}`}>{c.category}</span></td>
                  <td className="font-bold text-slate-900">{fmt(c.price)}</td>
                  <td className="text-slate-500">{c.duration_weeks} weeks</td>
                  <td>
                    <button
                      onClick={() => setEditingCurriculum(editingCurriculum?.id === c.id ? null : c)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${editingCurriculum?.id === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}>
                      {editingCurriculum?.id === c.id ? '▲ Close' : '📋 Curriculum'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editingCurriculum && <CurriculumEditor course={editingCurriculum} />}
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
  // Live class detail modal (real-time)
  const [detailModal, setDetailModal] = useState(null); // { classId, classTitle }
  // Class insights modal (historical, all classes)
  const [insightModal, setInsightModal] = useState(null); // { classId, classTitle }
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
                      const zc            = c.platform === 'zoom' ? zoomCounts[c.id] : null;
                      const enrolledCount = zc ? zc.enrolled : (c.enrolled_live_count ?? 0);
                      const demoCount     = zc ? zc.demo    : (c.demo_live_count    ?? 0);
                      const total         = enrolledCount + demoCount;
                      const isZoom        = c.platform === 'zoom';
                      const loading       = isZoom && !zc;
                      return (
                        <div className="flex flex-col gap-1 min-w-[130px]">
                          {loading ? (
                            <span className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" />
                              Fetching…
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs font-black ${total > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                                👥 {total}
                              </span>
                              {total > 0 && (
                                <>
                                  <span className="text-[10px] text-green-700 font-bold">✓{enrolledCount} enrolled</span>
                                  <span className="text-[10px] text-amber-600 font-bold">·</span>
                                  <span className="text-[10px] text-amber-600 font-bold">{demoCount} demo</span>
                                </>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setDetailModal({ classId: c.id, classTitle: c.title })}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition w-fit"
                          >
                            👁 View Details
                          </button>
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
                      {/* Class Insights — available for all statuses except scheduled/pending */}
                      {(c.status === 'live' || c.status === 'ended') && (
                        <button
                          className="text-xs px-3 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold hover:bg-violet-100 border border-violet-200 transition"
                          onClick={() => setInsightModal({ classId: c.id, classTitle: c.title })}>
                          📊 Class Insights
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

      {/* Live Class Detail Modal (real-time, live only) */}
      {detailModal && (
        <LiveClassDetailModal
          classId={detailModal.classId}
          classTitle={detailModal.classTitle}
          onClose={() => setDetailModal(null)}
        />
      )}

      {/* Class Insights Modal (historical, all classes) */}
      {insightModal && (
        <ClassInsightsModal
          classId={insightModal.classId}
          classTitle={insightModal.classTitle}
          onClose={() => setInsightModal(null)}
        />
      )}
    </div>
  );
}

// ── LIVE CLASS DETAIL MODAL ───────────────────────────────────
function LiveClassDetailModal({ classId, classTitle, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollRef = React.useRef(null);

  const fmt = (n) => n ? '₹' + Number(n).toLocaleString('en-IN') : '—';
  const fmtDur = (secs) => {
    if (!secs || secs < 0) return '< 1 min';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };
  const fmtTime = (s) => {
    if (!s) return '—';
    try { return new Date(s.slice ? s.slice(0,19) : s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
    catch { return '—'; }
  };

  const fetchData = () => {
    api.get(`/admin/live-classes/${classId}/participant-details`)
      .then(d => { setData(d); setLastRefresh(new Date()); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 30000);
    return () => clearInterval(pollRef.current);
  }, [classId]);

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const participants = data?.participants || [];
  const enrolled = participants.filter(p => p.is_enrolled);
  const demo = participants.filter(p => !p.is_enrolled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black text-white animate-pulse" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                🔴 LIVE
              </span>
              <h3 className="font-black text-slate-900 text-lg truncate max-w-sm">{classTitle}</h3>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-slate-500">👥 <strong>{data?.total ?? '…'}</strong> in class</span>
              <span className="text-xs text-green-700 font-bold">✓ {data?.enrolled ?? '…'} enrolled</span>
              <span className="text-xs text-amber-600 font-bold">🎯 {data?.demo ?? '…'} demo</span>
              {lastRefresh && (
                <span className="text-[10px] text-slate-300">
                  Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={fetchData}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
            >
              🔄 Refresh
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              Loading participant data…
            </div>
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
              <span className="text-4xl">👥</span>
              <p className="text-sm font-semibold">No participants yet</p>
              <p className="text-xs">Participants will appear here once they join the class.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Enrolled section */}
              {enrolled.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <h4 className="text-xs font-black text-green-700 uppercase tracking-wide">Enrolled Students ({enrolled.length})</h4>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-green-50 text-green-800">
                          <th className="text-left px-3 py-2 font-bold">Student</th>
                          <th className="text-left px-3 py-2 font-bold">Course</th>
                          <th className="text-left px-3 py-2 font-bold">Payment</th>
                          <th className="text-left px-3 py-2 font-bold">Partner / Agency</th>
                          <th className="text-left px-3 py-2 font-bold">Joined</th>
                          <th className="text-left px-3 py-2 font-bold">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrolled.map((p, i) => (
                          <tr key={p.student_id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900">{p.name}</div>
                              <div className="text-slate-400 text-[10px]">{p.email || '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-700 max-w-[160px]">
                              <span className="truncate block" title={p.course_name}>{p.course_name}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {p.payment_status === 'paid' ? '✅' : '⏳'} {p.payment_status}
                              </span>
                              {p.fee_paid > 0 && <div className="text-slate-500 text-[10px] mt-0.5">{fmt(p.fee_paid)}</div>}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{p.agency_name}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtTime(p.joined_at)}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDur(p.duration_secs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Demo section */}
              {demo.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <h4 className="text-xs font-black text-amber-700 uppercase tracking-wide">Demo Participants ({demo.length})</h4>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-amber-50 text-amber-800">
                          <th className="text-left px-3 py-2 font-bold">Name</th>
                          <th className="text-left px-3 py-2 font-bold">Email</th>
                          <th className="text-left px-3 py-2 font-bold">Partner / Agency</th>
                          <th className="text-left px-3 py-2 font-bold">Joined</th>
                          <th className="text-left px-3 py-2 font-bold">Duration</th>
                          <th className="text-left px-3 py-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demo.map((p, i) => (
                          <tr key={p.student_id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 font-semibold text-slate-900">{p.name}</td>
                            <td className="px-3 py-2 text-slate-400">{p.email || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{p.agency_name}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtTime(p.joined_at)}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtDur(p.duration_secs)}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                🎯 Demo
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50">
          <p className="text-[10px] text-slate-400">Auto-refreshes every 30 seconds · Data from attendance records{data?.participants?.[0]?.source === 'zoom+db' ? ' + Zoom API' : ''}</p>
          <button onClick={onClose} className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CLASS INSIGHTS MODAL ─────────────────────────────────────
function ClassInsightsModal({ classId, classTitle, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('all'); // 'all' | 'enrolled' | 'demo'
  const [sortBy, setSortBy]   = useState('joined'); // 'joined' | 'duration' | 'progress'

  const fmtDur = (secs) => {
    if (!secs || secs < 0) return '—';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };
  const fmtTime = (v) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
    catch { return '—'; }
  };
  const fmtFee = (n) => n ? '₹' + Number(n).toLocaleString('en-IN') : '—';

  useEffect(() => {
    api.get(`/admin/live-classes/${classId}/insights`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [classId]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const all      = data?.participants || [];
  const enrolled = all.filter(p => p.is_enrolled);
  const demo     = all.filter(p => !p.is_enrolled);
  const visible  = tab === 'enrolled' ? enrolled : tab === 'demo' ? demo : all;

  const sorted = [...visible].sort((a, b) => {
    if (sortBy === 'duration') return b.duration_secs - a.duration_secs;
    if (sortBy === 'progress') return (b.progress_pct ?? -1) - (a.progress_pct ?? -1);
    return new Date(a.joined_at || 0) - new Date(b.joined_at || 0);
  });

  const avgDur = data?.avg_duration_secs || 0;
  const completionRate = enrolled.length > 0
    ? Math.round(enrolled.filter(p => (p.progress_pct || 0) >= 80).length / enrolled.length * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📊</span>
                <h3 className="font-black text-white text-lg leading-tight truncate max-w-md">{classTitle}</h3>
              </div>
              {data?.course_title && data.course_title !== '—' && (
                <p className="text-indigo-200 text-xs mb-2">📚 {data.course_title}</p>
              )}
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2">
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                  👥 {data?.total ?? '…'} total attendees
                </span>
                <span className="bg-green-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">
                  ✓ {data?.enrolled ?? '…'} enrolled
                </span>
                <span className="bg-amber-400/80 text-white text-xs font-bold px-3 py-1 rounded-full">
                  🎯 {data?.demo ?? '…'} demo
                </span>
                {avgDur > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ⏱ Avg {fmtDur(avgDur)}
                  </span>
                )}
                {data?.total_batch_classes > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                    🏫 {data.total_batch_classes} batch classes total
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="text-white/70 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition flex-shrink-0">
              ✕
            </button>
          </div>
        </div>

        {/* ── Stats bar ── */}
        {!loading && data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 flex-shrink-0">
            {[
              { label: 'Total Attended', value: data.total, icon: '👥', color: 'text-slate-900' },
              { label: 'Enrolled', value: data.enrolled, icon: '✅', color: 'text-green-700' },
              { label: 'Demo / Free', value: data.demo, icon: '🎯', color: 'text-amber-700' },
              { label: 'Avg Duration', value: fmtDur(avgDur), icon: '⏱', color: 'text-indigo-700' },
            ].map(s => (
              <div key={s.label} className="bg-white px-4 py-3 text-center">
                <div className={`text-xl font-black ${s.color}`}>{s.icon} {s.value}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs + Sort ── */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white gap-4">
          <div className="flex gap-1">
            {[
              { key: 'all',      label: `All (${all.length})` },
              { key: 'enrolled', label: `✅ Enrolled (${enrolled.length})` },
              { key: 'demo',     label: `🎯 Demo (${demo.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hidden sm:inline">Sort:</span>
            {[
              { key: 'joined', label: 'Join Time' },
              { key: 'duration', label: 'Duration' },
              { key: 'progress', label: 'Progress' },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)}
                className={`px-2 py-1 rounded-md transition font-semibold ${sortBy === s.key ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              Loading insights…
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300 gap-2">
              <span className="text-4xl">👥</span>
              <p className="text-sm font-semibold">No attendance data yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">#</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Student</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Agency</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Type</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Joined</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Left</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Duration</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Payment</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide text-[10px] min-w-[140px]">Course Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr key={p.student_id || i}
                      className={`border-b border-slate-50 transition-colors ${
                        p.is_enrolled ? 'hover:bg-green-50/50' : 'hover:bg-amber-50/50'
                      } ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-2.5 text-slate-300 font-bold">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{p.name || '—'}</div>
                        <div className="text-[10px] text-slate-400">{p.email || '—'}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.agency_name}</td>
                      <td className="px-4 py-2.5">
                        {p.is_enrolled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                            ✅ Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            🎯 Demo
                          </span>
                        )}
                        {p.still_in_class && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600 animate-pulse">
                            🔴 Live
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmtTime(p.joined_at)}</td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {p.still_in_class
                          ? <span className="text-red-500 font-bold animate-pulse">Still in class</span>
                          : fmtTime(p.left_at)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700 whitespace-nowrap">
                        {fmtDur(p.duration_secs)}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.is_enrolled ? (
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {p.payment_status === 'paid' ? '✅' : '⏳'} {p.payment_status}
                            </span>
                            {p.fee_paid > 0 && <div className="text-[10px] text-slate-400 mt-0.5">{fmtFee(p.fee_paid)}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.is_enrolled && p.progress_pct !== null ? (
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-500">
                                {p.classes_attended}/{p.total_batch_classes} classes
                              </span>
                              <span className={`text-[10px] font-black ${
                                p.progress_pct >= 80 ? 'text-green-600' :
                                p.progress_pct >= 50 ? 'text-amber-600' : 'text-red-500'
                              }`}>{p.progress_pct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  p.progress_pct >= 80 ? 'bg-green-500' :
                                  p.progress_pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${p.progress_pct}%` }}
                              />
                            </div>
                          </div>
                        ) : p.is_enrolled ? (
                          <span className="text-[10px] text-slate-400">No batch data</span>
                        ) : (
                          <span className="text-slate-200 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50">
          <p className="text-[10px] text-slate-400">
            Attendance data from class records · Progress = classes attended in this batch
          </p>
          <button onClick={onClose}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition">
            Close
          </button>
        </div>
      </div>
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
  // ── Filters ─────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [agencyF,  setAgencyF]  = useState([]);
  const [batchF,   setBatchF]   = useState([]);  // 'has','none'
  const [joinedF,  setJoinedF]  = useState('');  // date from

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

  const agencyOptions = [...new Set(faculty.map(f => f.agency_name).filter(Boolean))].sort();

  // ── Applied snapshot (only updates on Search click) ────────
  const [applied, setApplied] = useState(null);
  const handleSearch = () => setApplied({ search, agencyF, batchF, joinedF });
  const handleClear  = () => { setSearch(''); setAgencyF([]); setBatchF([]); setJoinedF(''); setApplied(null); };
  const f = applied || {};
  const appliedCount = !applied ? 0 : [f.search, f.agencyF?.length, f.batchF?.length, f.joinedF].filter(Boolean).length;

  const filtered = faculty.filter(fac => {
    if (!applied) return true;
    if (f.search && !fac.name?.toLowerCase().includes(f.search.toLowerCase()) && !fac.email?.toLowerCase().includes(f.search.toLowerCase()) && !fac.phone?.includes(f.search)) return false;
    if (f.agencyF?.length && !f.agencyF.includes(fac.agency_name)) return false;
    if (f.batchF?.length) {
      const hasBatches = (fac.batch_count || 0) > 0;
      if (!f.batchF.some(v => v === 'has' ? hasBatches : !hasBatches)) return false;
    }
    if (f.joinedF && fac.created_at < f.joinedF) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-black text-slate-900">Faculty
          <span className="text-base font-normal text-slate-400 ml-2">{applied ? `${filtered.length} of ${faculty.length}` : faculty.length}</span>
        </h2>
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

      <FilterRow onApply={handleSearch} onClear={handleClear} appliedCount={appliedCount}>
        <SearchInput value={search} onChange={setSearch} placeholder="Name, email, phone…" width="w-48" />
        {agencyOptions.length > 0 && (
          <MultiSelectDropdown label="Agency" options={agencyOptions} selected={agencyF} onChange={setAgencyF} />
        )}
        <MultiSelectDropdown label="Batches" options={[{value:'has',label:'Has batches'},{value:'none',label:'No batches'}]} selected={batchF} onChange={setBatchF} />
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Joined after</span>
          <input type="date" value={joinedF} onChange={e => setJoinedF(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-32" />
        </div>
      </FilterRow>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Agency</th><th>Batches</th><th>Joined</th></tr></thead>
            <tbody>
              {filtered.map(f => (
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
              {filtered.length === 0 && (
                <tr><td colSpan="5" className="text-center text-slate-400 py-8">No faculty match the selected filters</td></tr>
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
  const [users, setUsers]         = useState([]);
  const [agencies, setAgencies]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRole]     = useState('');
  const [agencyFilter, setAgency] = useState('');
  const [editing, setEditing]     = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [editMsg, setEditMsg]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [showPwd, setShowPwd]     = useState({}); // { [userId]: bool }
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [assigningAgency, setAssigningAgency] = useState(null); // userId being quick-assigned
  // Create user modal
  const [creating, setCreating]   = useState(false);
  const EMPTY_CREATE = { name: '', email: '', phone: '', role: 'student', agency_id: '', password: '' };
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createMsg, setCreateMsg] = useState('');
  const [showCreatePwd, setShowCreatePwd] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (roleFilter)   qs.set('role', roleFilter);
    if (agencyFilter) qs.set('agency_id', agencyFilter);
    if (search)       qs.set('search', search);
    api.get(`/admin/users?${qs}`).then(u => { setUsers(u); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); api.get('/admin/agencies').then(setAgencies); }, [roleFilter, agencyFilter]);

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, agency_id: u.agency_id || '', password: '' });
    setEditMsg('');
    setShowEditPwd(false);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/users', createForm);
      setCreating(false);
      setCreateForm(EMPTY_CREATE);
      setCreateMsg('');
      load();
    } catch (err) { setCreateMsg(err.message); }
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

  const handleQuickAssign = async (userId, agencyId) => {
    const u = users.find(x => x.id === userId);
    if (!u) return;
    try {
      await api.put(`/admin/users/${userId}`, {
        name: u.name, email: u.email, phone: u.phone || '',
        role: u.role, agency_id: agencyId || null, password: ''
      });
      setAssigningAgency(null);
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
        <button className="btn-primary" onClick={() => { setCreating(true); setCreateMsg(''); setCreateForm(EMPTY_CREATE); }}>
          + Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <input
            className="input flex-1 min-w-[180px]"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
          />
          <select className="input sm:w-40" value={roleFilter} onChange={e => setRole(e.target.value)}>
            <option value="">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
          </select>
          <select className="input sm:w-48" value={agencyFilter} onChange={e => setAgency(e.target.value)}>
            <option value="">All Agencies</option>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                <th>Password</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className={u.role === 'student' && !u.agency_id ? 'bg-amber-50/40' : ''}>
                  <td>
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="text-sm">
                    {u.agency_name ? (
                      <span className="text-slate-800 font-medium">{u.agency_name}</span>
                    ) : (
                      assigningAgency === u.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="text-xs border border-amber-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                            defaultValue=""
                            onChange={e => { if (e.target.value) handleQuickAssign(u.id, e.target.value); }}
                          >
                            <option value="">— Pick agency —</option>
                            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <button onClick={() => setAssigningAgency(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssigningAgency(u.id)}
                          className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg hover:bg-amber-100 transition"
                          title="No agency assigned — click to assign"
                        >
                          ⚠️ No Agency
                        </button>
                      )
                    )}
                  </td>
                  <td className="text-sm">{u.phone || <span className="text-slate-400">—</span>}</td>
                  <td>
                    {u.admin_set_password ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded select-all">
                          {showPwd[u.id] ? u.admin_set_password : '••••••••'}
                        </span>
                        <button
                          onClick={() => setShowPwd(p => ({ ...p, [u.id]: !p[u.id] }))}
                          className="text-slate-400 hover:text-slate-700 text-xs p-0.5 transition"
                          title={showPwd[u.id] ? 'Hide' : 'Show password'}
                        >
                          {showPwd[u.id] ? '🙈' : '👁'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 italic">not set by admin</span>
                    )}
                  </td>
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

      {/* Create User Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)' }} onClick={() => setCreating(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900">➕ Add New User</h3>
              <button onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createMsg && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{createMsg}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="+91 98765 43210" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <select className="input" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                    {Object.entries(ROLE_LABELS).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Agency</label>
                  <select className="input" value={createForm.agency_id} onChange={e => setCreateForm({ ...createForm, agency_id: e.target.value })}>
                    <option value="">— No Agency —</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="label">Password *</label>
                <div className="relative">
                  <input
                    type={showCreatePwd ? 'text' : 'password'}
                    className="input pr-10"
                    required
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowCreatePwd(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm px-1">
                    {showCreatePwd ? '🙈' : '👁'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">This password will be saved and visible to super admins for sharing with the user.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Creating…' : '✅ Create User'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)' }} onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900">✏️ Edit User</h3>
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
                {editing.admin_set_password && (
                  <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 mb-1">Current saved password</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-800 select-all">
                        {showEditPwd ? editing.admin_set_password : '••••••••'}
                      </span>
                      <button type="button" onClick={() => setShowEditPwd(p => !p)}
                        className="text-slate-400 hover:text-slate-700 text-sm">
                        {showEditPwd ? '🙈 Hide' : '👁 Show'}
                      </button>
                    </div>
                  </div>
                )}
                <label className="label">New Password <span className="text-slate-300 font-normal">(leave blank to keep current)</span></label>
                <div className="relative">
                  <input
                    type={showEditPwd ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min 6 characters"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowEditPwd(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm px-1">
                    {showEditPwd ? '🙈' : '👁'}
                  </button>
                </div>
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
  const [viewing, setViewing] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  // ── Filters ─────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [statusF,   setStatusF]   = useState([]);     // multi-select: pending/verified/rejected
  const [agencyF,   setAgencyF]   = useState([]);
  const [courseF,   setCourseF]   = useState([]);
  const [methodF,   setMethodF]   = useState([]);
  const [receiptF,  setReceiptF]  = useState([]);     // 'uploaded','missing'
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [amtMin,    setAmtMin]    = useState('');
  const [amtMax,    setAmtMax]    = useState('');
  const [sortBy,    setSortBy]    = useState('newest');

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

  const methodIcon  = { upi:'💳', qr:'📷', link:'🔗', mobile:'📱', other:'💸' };
  const statusColor = { pending:'badge-amber', verified:'badge-green', rejected:'badge-red' };

  // Derived filter options
  const agencyOptions  = [...new Set(proofs.map(p => p.agency_name).filter(Boolean))].sort();
  const courseOptions  = [...new Set(proofs.map(p => p.course_title).filter(Boolean))].sort();
  const methodOptions  = [...new Set(proofs.map(p => p.payment_method).filter(Boolean))];

  // ── Applied snapshot (only updates on Search click) ────────
  const [applied, setApplied] = useState(null);
  const handleSearch = () => setApplied({ search, statusF, agencyF, courseF, methodF, receiptF, amtMin, amtMax, dateFrom, dateTo });
  const handleClear  = () => { setSearch(''); setStatusF([]); setAgencyF([]); setCourseF([]); setMethodF([]); setReceiptF([]); setAmtMin(''); setAmtMax(''); setDateFrom(''); setDateTo(''); setApplied(null); };
  const fa = applied || {};
  const appliedCount = !applied ? 0 : [fa.search, fa.statusF?.length, fa.agencyF?.length, fa.courseF?.length, fa.methodF?.length, fa.receiptF?.length, fa.amtMin, fa.amtMax, fa.dateFrom, fa.dateTo].filter(Boolean).length;

  const filtered = proofs
    .filter(p => {
      if (!applied) return true;
      if (fa.search && !p.student_name?.toLowerCase().includes(fa.search.toLowerCase()) && !p.student_email?.toLowerCase().includes(fa.search.toLowerCase())) return false;
      if (fa.statusF?.length  && !fa.statusF.includes(p.status)) return false;
      if (fa.agencyF?.length  && !fa.agencyF.includes(p.agency_name)) return false;
      if (fa.courseF?.length  && !fa.courseF.includes(p.course_title)) return false;
      if (fa.methodF?.length  && !fa.methodF.includes(p.payment_method)) return false;
      if (fa.receiptF?.length) {
        const has = !!p.proof_image;
        if (!fa.receiptF.some(v => v === 'uploaded' ? has : !has)) return false;
      }
      if (fa.amtMin && Number(p.amount) < Number(fa.amtMin)) return false;
      if (fa.amtMax && Number(p.amount) > Number(fa.amtMax)) return false;
      if (fa.dateFrom && p.created_at < fa.dateFrom) return false;
      if (fa.dateTo   && p.created_at > fa.dateTo + 'T23:59:59') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest')   return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'amt_high') return Number(b.amount) - Number(a.amount);
      if (sortBy === 'amt_low')  return Number(a.amount) - Number(b.amount);
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const stats = {
    total:   proofs.length,
    pending: proofs.filter(p => p.status==='pending').length,
    verified:proofs.filter(p => p.status==='verified').length,
    rejected:proofs.filter(p => p.status==='rejected').length,
    amount:  proofs.filter(p => p.status==='verified').reduce((a,p) => a+Number(p.amount||0), 0),
  };
  const filteredAmt = filtered.filter(p => p.status==='verified').reduce((a,p) => a+Number(p.amount||0), 0);

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-3">Payment Records
        <span className="text-base font-normal text-slate-400 ml-2">{applied ? `${filtered.length} of ${proofs.length}` : proofs.length}</span>
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Proofs</p><p className="text-2xl font-black">{stats.total}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Pending Review</p><p className="text-2xl font-black text-amber-500">{stats.pending}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Verified</p><p className="text-2xl font-black text-emerald-600">{stats.verified}</p></div>
        <div className="stat-card"><p className="text-xs font-bold text-slate-400 uppercase mb-1">Collected{applied?' (filtered)':''}</p><p className="text-2xl font-black text-blue-600">{fmt(applied?filteredAmt:stats.amount)}</p></div>
      </div>

      {actionMsg && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold">{actionMsg}</div>}

      <FilterRow onApply={handleSearch} onClear={handleClear} appliedCount={appliedCount}>
        <SearchInput value={search} onChange={setSearch} placeholder="Student name or email…" width="w-48" />
        <MultiSelectDropdown label="Status" options={['pending','verified','rejected']} selected={statusF} onChange={setStatusF} />
        {agencyOptions.length > 0 && (
          <MultiSelectDropdown label="Agency" options={agencyOptions} selected={agencyF} onChange={setAgencyF} />
        )}
        {courseOptions.length > 0 && (
          <MultiSelectDropdown label="Course" options={courseOptions} selected={courseF} onChange={setCourseF} />
        )}
        {methodOptions.length > 0 && (
          <MultiSelectDropdown label="Method" options={methodOptions} selected={methodF} onChange={setMethodF} />
        )}
        <MultiSelectDropdown label="Receipt" options={[{value:'uploaded',label:'✅ Uploaded'},{value:'missing',label:'⚠️ Missing'}]} selected={receiptF} onChange={setReceiptF} />
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Amt ₹</span>
          <input type="number" value={amtMin} onChange={e => setAmtMin(e.target.value)} placeholder="Min"
            className="w-16 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <span className="text-slate-300 text-xs">–</span>
          <input type="number" value={amtMax} onChange={e => setAmtMax(e.target.value)} placeholder="Max"
            className="w-16 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <DateRange from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none text-slate-600 flex-shrink-0">
          <option value="newest">↕ Newest</option>
          <option value="oldest">↕ Oldest</option>
          <option value="amt_high">↕ Amt High→Low</option>
          <option value="amt_low">↕ Amt Low→High</option>
        </select>
      </FilterRow>

      <div className="card">
        {loading ? <div className="text-center py-8 text-slate-400 text-sm">Loading...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Agency</th><th>Course</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-slate-400 py-6">No payment records match the selected filters</td></tr>
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

// ── LOGIN BANNERS (admin-editable offers on login pages) ──────
function LoginBanners() {
  const [banners, setBanners] = useState([]);
  const [editing, setEditing] = useState(null);   // null | {} | banner object
  const [msg,     setMsg]     = useState('');
  const blank = { title:'', subtitle:'', badge:'', target_role:'all', image_data:null, link_url:'', link_text:'Learn More', bg_color:'#1e40af', text_color:'#ffffff', sort_order:0, is_active:1 };

  const load = () => api.get('/admin/login-banners').then(setBanners);
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing.id) {
        await api.put(`/admin/login-banners/${editing.id}`, editing);
        setMsg('Banner updated!');
      } else {
        await api.post('/admin/login-banners', editing);
        setMsg('Banner created!');
      }
      setEditing(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    await api.delete(`/admin/login-banners/${id}`);
    setMsg('Deleted'); load();
  };

  const toggle = async (b) => {
    await api.put(`/admin/login-banners/${b.id}`, { ...b, is_active: b.is_active ? 0 : 1 });
    load();
  };

  const onImage = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setEditing(p => ({ ...p, image_data: ev.target.result }));
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">📢 Login Page Banners</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage offers, announcements and promotions shown on Partner and Student login pages.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ New Banner</button>
      </div>

      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-xl">{msg}</div>}

      {/* ── Edit / Create form ── */}
      {editing && (
        <div className="card mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">{editing.id ? 'Edit Banner' : 'Create New Banner'}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Title *</label>
              <input className="input" required placeholder="New IELTS batch starting Monday!" value={editing.title}
                onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Badge text <span className="font-normal text-slate-400">(optional pill)</span></label>
              <input className="input" placeholder="🔥 Limited Seats" value={editing.badge||''}
                onChange={e => setEditing(p => ({ ...p, badge: e.target.value }))} />
            </div>
            <div className="lg:col-span-2">
              <label className="label">Subtitle / Description</label>
              <textarea className="input" rows={2} placeholder="Additional details shown below the title…"
                value={editing.subtitle||''} onChange={e => setEditing(p => ({ ...p, subtitle: e.target.value }))} />
            </div>
            <div>
              <label className="label">CTA Link URL</label>
              <input className="input" type="url" placeholder="https://…" value={editing.link_url||''}
                onChange={e => setEditing(p => ({ ...p, link_url: e.target.value }))} />
            </div>
            <div>
              <label className="label">CTA Button Text</label>
              <input className="input" placeholder="Learn More" value={editing.link_text||''}
                onChange={e => setEditing(p => ({ ...p, link_text: e.target.value }))} />
            </div>
            <div>
              <label className="label">Show On</label>
              <select className="input" value={editing.target_role}
                onChange={e => setEditing(p => ({ ...p, target_role: e.target.value }))}>
                <option value="all">All login pages</option>
                <option value="partner">Partner login only</option>
                <option value="student">Student login only</option>
              </select>
            </div>
            <div>
              <label className="label">Sort Order <span className="font-normal text-slate-400">(lower = first)</span></label>
              <input className="input" type="number" value={editing.sort_order||0}
                onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Background Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={editing.bg_color||'#1e40af'} onChange={e => setEditing(p => ({ ...p, bg_color: e.target.value }))}
                  className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5" />
                <input className="input flex-1" value={editing.bg_color||''} onChange={e => setEditing(p => ({ ...p, bg_color: e.target.value }))}
                  placeholder="#1e40af" />
              </div>
            </div>
            <div>
              <label className="label">Text Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={editing.text_color||'#ffffff'} onChange={e => setEditing(p => ({ ...p, text_color: e.target.value }))}
                  className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5" />
                <input className="input flex-1" value={editing.text_color||''} onChange={e => setEditing(p => ({ ...p, text_color: e.target.value }))}
                  placeholder="#ffffff" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="label">Banner Image <span className="font-normal text-slate-400">(optional, any format)</span></label>
              <input type="file" accept="image/*" onChange={onImage} className="text-xs text-slate-500" />
              {editing.image_data && (
                <div className="mt-2 relative inline-block">
                  <img src={editing.image_data} alt="Preview" className="h-20 rounded-xl object-cover border border-slate-200" />
                  <button onClick={() => setEditing(p => ({ ...p, image_data: null }))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center">✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Live preview */}
          {editing.title && (
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Preview</p>
              <div className="rounded-2xl overflow-hidden flex items-stretch max-w-lg" style={{ background: editing.bg_color, minHeight: 80 }}>
                {editing.image_data && (
                  <img src={editing.image_data} alt="" className="w-24 object-cover flex-shrink-0" />
                )}
                <div className="flex-1 px-5 py-4 flex flex-col justify-center" style={{ color: editing.text_color }}>
                  {editing.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full self-start mb-1" style={{ background: 'rgba(255,255,255,0.2)' }}>{editing.badge}</span>}
                  <p className="font-black text-sm">{editing.title}</p>
                  {editing.subtitle && <p className="text-xs opacity-70 mt-0.5">{editing.subtitle}</p>}
                  {editing.link_url && <span className="text-[10px] font-bold mt-1 opacity-80">{editing.link_text} →</span>}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn-primary" onClick={save}>{editing.id ? 'Save Changes' : 'Create Banner'}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Banner list ── */}
      <div className="space-y-3">
        {banners.length === 0 && !editing && (
          <div className="card text-center py-10 text-slate-400">
            <div className="text-4xl mb-3">📢</div>
            <p className="font-semibold">No banners yet</p>
            <p className="text-sm mt-1">Create your first banner to show offers and announcements on login pages.</p>
          </div>
        )}
        {banners.map(b => (
          <div key={b.id} className={`card flex items-center gap-4 ${!b.is_active ? 'opacity-50' : ''}`}>
            {/* Color swatch + preview */}
            <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden relative"
              style={{ background: b.bg_color }}>
              {b.image_data
                ? <img src={b.image_data} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl">📢</div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{b.title}</span>
                {b.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{b.badge}</span>}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.target_role === 'partner' ? 'bg-indigo-100 text-indigo-700' : b.target_role === 'student' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {b.target_role === 'all' ? '🌐 All pages' : b.target_role === 'partner' ? '🏢 Partners' : '👥 Students'}
                </span>
                {!b.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Hidden</span>}
              </div>
              {b.subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{b.subtitle}</p>}
              {b.link_url && <p className="text-[10px] text-blue-500 mt-0.5 truncate">{b.link_url}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggle(b)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${b.is_active ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {b.is_active ? '✅ Live' : '⏸ Hidden'}
              </button>
              <button onClick={() => setEditing({ ...b })} className="btn text-xs py-1.5 px-3">Edit</button>
              <button onClick={() => del(b.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CONTACT AUDIT ─────────────────────────────────────────────
function ContactAudit() {
  const [data, setData]       = useState(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const load = (fo) => api.get(`/admin/contact-audit${fo ? '?flagged_only=1' : ''}`).then(setData);
  useEffect(() => { load(false); }, []);

  const fmtDT = (s) => {
    const d = new Date(s.slice(0, 19));
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  };

  const actionIcon = { reveal: '👁', call: '📞', email: '📧', whatsapp: '💬' };

  const toggle = () => { const f = !flaggedOnly; setFlaggedOnly(f); load(f); };

  const stats = data?.stats || {};
  const logs  = data?.logs  || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">🔒 Contact Access Audit</h2>
          <p className="text-sm text-slate-500 mt-0.5">Every time anyone views, calls, emails or WhatsApps a student contact — it's logged here permanently.</p>
        </div>
        <button onClick={toggle}
          className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${flaggedOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>
          {flaggedOnly ? '🚨 Flagged Only' : 'Show All'} {stats.flagged > 0 && <span className="ml-1 bg-red-100 text-red-700 px-1.5 rounded-full text-[10px] font-black">{stats.flagged}</span>}
        </button>
      </div>

      {/* USP Banner */}
      <div className="mb-5 p-4 rounded-2xl flex gap-4 items-start"
        style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)', border: '1px solid #bbf7d0' }}>
        <span className="text-2xl flex-shrink-0">🛡️</span>
        <div>
          <p className="font-black text-emerald-900 text-sm">Zero Data Leakage Guarantee — Industry First</p>
          <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
            Contact details (phone &amp; email) are <strong>masked by default</strong> across the platform. Every reveal, call, email or WhatsApp action is permanently logged below with the viewer's name, role, IP address and timestamp.
            Agencies can see this audit for their own students in their partner dashboard — giving them full confidence that their student data is never silently accessed.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            {[['👁 Reveals', stats.reveals || 0], ['📞 Calls', stats.calls || 0], ['📧 Emails', stats.emails || 0], ['💬 WhatsApps', stats.whatsapps || 0], ['🚨 Flagged', stats.flagged || 0, true]].map(([lbl, val, red]) => (
              <div key={lbl} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold ${red && val > 0 ? 'bg-red-100 text-red-700' : 'bg-white text-slate-700'}`}>
                <span>{lbl}</span><span className="font-black">{val}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-slate-700">
              <span>Today</span><span className="font-black text-blue-700">{stats.today || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        {!data ? <div className="text-slate-400 text-sm py-6 text-center">Loading audit log…</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th><th>Viewer</th><th>Role</th><th>Agency</th><th>Student</th><th>Student Agency</th><th>IP Address</th><th>Time</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={9} className="text-center text-slate-400 py-8 text-sm">No contact access events recorded yet.</td></tr>}
                {logs.map(l => (
                  <tr key={l.id} className={l.is_flagged ? 'bg-red-50' : ''}>
                    <td>
                      <span className="text-base" title={l.action_type}>{actionIcon[l.action_type] || '👁'}</span>
                      <span className="text-xs text-slate-500 ml-1">{l.action_type}</span>
                    </td>
                    <td className="font-semibold text-sm">{l.viewer_name}</td>
                    <td><span className={`badge ${l.viewer_role === 'super_admin' ? 'badge-red' : 'badge-blue'}`}>{l.viewer_role?.replace('_', ' ')}</span></td>
                    <td className="text-xs text-slate-500">{l.viewer_agency_id ? `Agency #${l.viewer_agency_id}` : <span className="text-red-600 font-semibold">Platform</span>}</td>
                    <td className="font-medium text-sm">{l.target_student_name}</td>
                    <td className="text-xs text-slate-500">{l.target_agency_name || '—'}</td>
                    <td><span className="font-mono text-xs text-slate-400">{l.viewer_ip || '—'}</span></td>
                    <td className="text-xs text-slate-400 whitespace-nowrap">{fmtDT(l.created_at)}</td>
                    <td>
                      {l.is_flagged
                        ? <div><span className="badge badge-red">🚨 Flagged</span><div className="text-[10px] text-red-600 mt-0.5 max-w-[160px]">{l.flag_reason}</div></div>
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

// ── SUPPORT ADMIN ─────────────────────────────────────────────
const DEPT_META = [
  { id:'account_manager', icon:'👤', label:'Account Manager',    color:'#3b82f6', bg:'#eff6ff' },
  { id:'commission',      icon:'💰', label:'Commission Team',     color:'#f59e0b', bg:'#fffbeb' },
  { id:'academic',        icon:'🎓', label:'Academic Support',    color:'#10b981', bg:'#f0fdf4' },
  { id:'tech',            icon:'⚙️', label:'Tech Support',        color:'#8b5cf6', bg:'#f5f3ff' },
];
const STATUS_META = {
  open:        { label:'Open',        color:'#ef4444', bg:'#fef2f2' },
  in_progress: { label:'In Progress', color:'#f59e0b', bg:'#fffbeb' },
  resolved:    { label:'Resolved',    color:'#10b981', bg:'#f0fdf4' },
  closed:      { label:'Closed',      color:'#64748b', bg:'#f8fafc' },
};

function SupportAdmin() {
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [editDept, setEditDept] = useState(null); // { id, contact_name, email, phone, whatsapp, working_hours, notes }
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState({ status:'', dept:'', search:'' });
  const [replyTicket, setReplyTicket] = useState(null);
  const [replyForm, setReplyForm] = useState({ admin_reply:'', status:'in_progress' });
  const [replySaving, setReplySaving] = useState(false);

  const loadContacts = () => api.get('/support/contacts').then(setContacts).catch(() => {});
  const loadTickets  = () => {
    const q = new URLSearchParams();
    if (ticketFilter.status) q.set('status', ticketFilter.status);
    if (ticketFilter.dept)   q.set('dept',   ticketFilter.dept);
    if (ticketFilter.search) q.set('search', ticketFilter.search);
    api.get(`/admin/support/tickets?${q}`).then(setTickets).catch(() => {});
  };

  useEffect(() => { loadContacts(); }, []);
  useEffect(() => { if (tab === 'tickets') loadTickets(); }, [tab, ticketFilter]);

  const saveContact = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await api.put(`/admin/support/contacts/${editDept.department}`, editDept);
      setSaveMsg('✅ Saved!');
      loadContacts();
      setTimeout(() => { setSaveMsg(''); setEditDept(null); }, 1500);
    } catch (e) { setSaveMsg('❌ ' + e.message); }
    finally { setSaving(false); }
  };

  const saveReply = async () => {
    setReplySaving(true);
    try {
      await api.put(`/admin/support/tickets/${replyTicket.id}`, replyForm);
      setReplyTicket(null);
      loadTickets();
    } catch (e) { alert(e.message); }
    finally { setReplySaving(false); }
  };

  const quickStatus = async (id, status) => {
    await api.patch(`/admin/support/tickets/${id}/status`, { status }).catch(() => {});
    loadTickets();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Help & Support</h2>
          <p className="text-sm text-slate-500">Manage contact details and resolve support queries</p>
        </div>
        <div className="flex gap-2">
          {['contacts','tickets'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab===t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t === 'contacts' ? '📋 Contact Details' : `🎫 Tickets ${tickets.length > 0 && tab !== 'tickets' ? `(${tickets.filter(x=>x.status==='open').length} open)` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTACTS TAB ── */}
      {tab === 'contacts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {DEPT_META.map(d => {
            const c = contacts.find(x => x.department === d.id) || {};
            return (
              <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: d.bg, color: d.color }}>{d.icon}</div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{d.label}</p>
                      <p className="text-xs text-slate-400">{c.working_hours || 'Hours not set'}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditDept({ ...c, department: d.id })}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">✏️ Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  {c.contact_name && <div className="flex items-center gap-2"><span className="text-slate-400 w-20 flex-shrink-0">Name</span><span className="font-semibold text-slate-800">{c.contact_name}</span></div>}
                  {c.email        && <div className="flex items-center gap-2"><span className="text-slate-400 w-20 flex-shrink-0">Email</span><a href={`mailto:${c.email}`} className="text-blue-600 hover:underline font-semibold truncate">{c.email}</a></div>}
                  {c.phone        && <div className="flex items-center gap-2"><span className="text-slate-400 w-20 flex-shrink-0">Phone</span><span className="font-semibold text-slate-800">{c.phone}</span></div>}
                  {c.whatsapp     && <div className="flex items-center gap-2"><span className="text-slate-400 w-20 flex-shrink-0">WhatsApp</span><a href={`https://wa.me/${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-semibold">{c.whatsapp}</a></div>}
                  {c.notes        && <div className="mt-2 text-xs text-slate-500 italic border-t border-slate-100 pt-2">{c.notes}</div>}
                  {!c.contact_name && !c.email && !c.phone && <p className="text-xs text-slate-400 italic">No contact details added yet. Click Edit.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TICKETS TAB ── */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-xl p-3">
            <input placeholder="Search name / subject / agency…" value={ticketFilter.search}
              onChange={e => setTicketFilter(f=>({...f, search:e.target.value}))}
              className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-slate-200 rounded-lg" />
            <select value={ticketFilter.status} onChange={e => setTicketFilter(f=>({...f,status:e.target.value}))}
              className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg">
              <option value="">All Status</option>
              {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={ticketFilter.dept} onChange={e => setTicketFilter(f=>({...f,dept:e.target.value}))}
              className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg">
              <option value="">All Depts</option>
              {DEPT_META.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button onClick={loadTickets} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold">🔍</button>
          </div>

          {/* Ticket list */}
          {tickets.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <p className="text-4xl mb-3">🎫</p>
              <p className="font-bold">No tickets found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => {
                const sm = STATUS_META[t.status] || STATUS_META.open;
                const dm = DEPT_META.find(d=>d.id===t.department);
                return (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono font-bold text-slate-400">{t.ticket_no}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                          {dm && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: dm.bg, color: dm.color }}>{dm.icon} {dm.label}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.submitted_by_role==='partner_admin' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {t.submitted_by_role==='partner_admin' ? '🏢 Partner' : '👤 Student'}
                          </span>
                        </div>
                        <p className="font-black text-slate-900 text-sm truncate">{t.subject}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.submitted_by_name} · {t.submitted_by_email}{t.agency_name ? ` · ${t.agency_name}` : ''}</p>
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{t.message}</p>
                        {t.admin_reply && (
                          <div className="mt-2 p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800">
                            <span className="font-bold">Admin reply:</span> {t.admin_reply}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button onClick={() => { setReplyTicket(t); setReplyForm({ admin_reply: t.admin_reply||'', status: t.status }); }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                          💬 Reply
                        </button>
                        <select value={t.status} onChange={e => quickStatus(t.id, e.target.value)}
                          className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg font-semibold" style={{ color: sm.color }}>
                          {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <p className="text-xs text-slate-400 text-right">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT CONTACT MODAL ── */}
      {editDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditDept(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900">{DEPT_META.find(d=>d.id===editDept.department)?.icon} Edit {DEPT_META.find(d=>d.id===editDept.department)?.label}</h3>
              <button onClick={() => setEditDept(null)} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Contact Name</label><input value={editDept.contact_name||''} onChange={e=>setEditDept(d=>({...d,contact_name:e.target.value}))} placeholder="e.g. Rahul Sharma" /></div>
                <div><label className="label">Email</label><input type="email" value={editDept.email||''} onChange={e=>setEditDept(d=>({...d,email:e.target.value}))} placeholder="email@company.com" /></div>
                <div><label className="label">Phone</label><input value={editDept.phone||''} onChange={e=>setEditDept(d=>({...d,phone:e.target.value}))} placeholder="+91 98765 43210" /></div>
                <div><label className="label">WhatsApp</label><input value={editDept.whatsapp||''} onChange={e=>setEditDept(d=>({...d,whatsapp:e.target.value}))} placeholder="+91 98765 43210" /></div>
                <div className="col-span-2"><label className="label">Working Hours</label><input value={editDept.working_hours||''} onChange={e=>setEditDept(d=>({...d,working_hours:e.target.value}))} placeholder="Mon–Fri 9am–6pm" /></div>
                <div className="col-span-2"><label className="label">Notes / Description</label><textarea rows={2} value={editDept.notes||''} onChange={e=>setEditDept(d=>({...d,notes:e.target.value}))} placeholder="Short description of this department…" className="w-full" /></div>
              </div>
              {saveMsg && <p className={`text-sm font-semibold ${saveMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{saveMsg}</p>}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={saveContact} disabled={saving} className="btn-primary">{saving ? 'Saving…' : '💾 Save Contact'}</button>
                <button onClick={() => setEditDept(null)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REPLY MODAL ── */}
      {replyTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReplyTicket(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Reply to Ticket</h3>
                <p className="text-xs text-slate-500">{replyTicket.ticket_no} · {replyTicket.submitted_by_name}{replyTicket.agency_name ? ` · ${replyTicket.agency_name}` : ''}</p>
              </div>
              <button onClick={() => setReplyTicket(null)} className="text-slate-400 hover:text-slate-700 text-2xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                <p className="font-bold text-slate-800 mb-1">{replyTicket.subject}</p>
                <p className="text-slate-600 text-xs">{replyTicket.message}</p>
              </div>
              <div>
                <label className="label">Your Reply</label>
                <textarea rows={4} value={replyForm.admin_reply}
                  onChange={e => setReplyForm(f=>({...f, admin_reply:e.target.value}))}
                  placeholder="Type your reply here…" className="w-full" />
              </div>
              <div>
                <label className="label">Update Status</label>
                <select value={replyForm.status} onChange={e => setReplyForm(f=>({...f,status:e.target.value}))}>
                  {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={saveReply} disabled={replySaving} className="btn-primary">{replySaving ? 'Sending…' : '📨 Send Reply & Update'}</button>
                <button onClick={() => setReplyTicket(null)} className="btn-ghost">Cancel</button>
              </div>
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
  { id: 'contactaudit',   icon: '🔒', label: 'Contact Audit' },
  { id: 'loginbanners',   icon: '📢', label: 'Login Banners' },
  { id: 'support',        icon: '🎧', label: 'Help & Support' },
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
    contactaudit: <ContactAudit />,
    loginbanners: <LoginBanners />,
    support:      <SupportAdmin />,
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
