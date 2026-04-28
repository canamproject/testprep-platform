import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import DashLayout, { NavItem } from '../../components/DashLayout';

// ── HELPERS ─────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    active: 'badge-green', live: 'badge-red', scheduled: 'badge-blue',
    ended: 'badge-gray', cancelled: 'badge-gray', draft: 'badge-amber',
    paused: 'badge-amber', completed: 'badge-purple', pending_approval: 'badge-amber'
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace(/_/g, ' ')}</span>;
}

// Parse DB datetime as local time (strips Z so JS won't shift by UTC offset)
const parseDT = (s) => s ? new Date(s.slice(0, 19)) : new Date(0);
function fmtTime(dt) {
  return parseDT(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(dt) {
  return parseDT(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
const toInputDT = (s) => s ? s.slice(0, 16) : '';
function isLive(lc) {
  return lc.status === 'live' || Math.abs(new Date() - parseDT(lc.scheduled_at)) / 60000 < 30;
}
function canStart(lc) {
  const diff = (parseDT(lc.scheduled_at) - new Date()) / 60000;
  return diff <= 30; // allow starting 30 min before scheduled time
}

// ── MY BATCHES ───────────────────────────────────────────────
function MyBatches({ accent, onSelectBatch }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/faculty/batches').then(setBatches).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm p-4">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">
        My Batches <span className="text-base font-normal text-slate-400 ml-2">{batches.length} assigned</span>
      </h2>

      {batches.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-slate-500 font-semibold">No batches assigned yet</p>
          <p className="text-sm text-slate-400 mt-1">Contact your admin to get assigned to a batch</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {batches.map(b => (
            <div key={b.id} className="card relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectBatch(b)}>
              <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l" style={{ background: accent }} />
              <div className="pl-3">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-black text-slate-900">{b.name}</h3>
                    <p className="text-sm text-slate-500">{b.course_title} · {b.category}</p>
                  </div>
                  <Badge status={b.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ['Students', b.enrolled_students || 0],
                    ['Upcoming', b.upcoming_classes || 0],
                    ['Done', b.completed_classes || 0],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-slate-50 rounded-xl py-2">
                      <div className="text-lg font-black text-slate-900">{v}</div>
                      <div className="text-xs text-slate-400">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  {b.start_date && <span>📅 {fmtDate(b.start_date)}</span>}
                  {b.class_time && <span>🕐 {b.class_time}</span>}
                  {b.schedule_days && <span>📆 {b.schedule_days}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SCHEDULE CLASS MODAL ──────────────────────────────────────
function ScheduleModal({ batch, accent, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: 60,
    class_mode: 'interactive',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const autoTitle = () => {
    if (!form.scheduled_at) return '';
    const dt = new Date(form.scheduled_at);
    const datePart = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${batch.agency_name || ''} – ${batch.name} – ${datePart} ${timePart}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/faculty/classes', { ...form, title: form.title || autoTitle(), batch_id: batch.id });
      onCreated();
      onClose();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-900 text-lg">Schedule Live Class</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <p className="text-sm text-slate-500 mb-2">Batch: <span className="font-semibold text-slate-700">{batch.name}</span></p>
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
          ⚠️ Classes you create require <strong>admin approval</strong> before students can join.
        </div>
        {msg && <p className="text-red-500 text-sm mb-3">{msg}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date & Time *</label>
              <input type="datetime-local" className="input" required
                value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" className="input" min="15" max="300"
                value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Class Title</label>
            <input className="input" placeholder={autoTitle() || 'Auto-generated from institute + batch + time'}
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            {!form.title && form.scheduled_at && (
              <p className="text-xs text-slate-400 mt-1">Will be: <em>{autoTitle()}</em></p>
            )}
          </div>
          <div>
            <label className="label">Class Mode</label>
            <select className="input" value={form.class_mode} onChange={e => setForm({ ...form, class_mode: e.target.value })}>
              <option value="interactive">Interactive (students can speak)</option>
              <option value="broadcast">Broadcast (view-only for students)</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows="2" placeholder="What will be covered..."
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-white font-bold transition-opacity hover:opacity-90"
              style={{ background: accent }}>
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MY CLASSES ────────────────────────────────────────────────
function MyClasses({ accent }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [scope, setScope] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [schedModal, setSchedModal] = useState(null);
  const [editModal, setEditModal] = useState(null); // class being edited
  const [batches, setBatches] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/faculty/classes?scope=${scope}`).then(setClasses).catch(() => {}).finally(() => setLoading(false));
  }, [scope]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/faculty/batches').then(setBatches).catch(() => {}); }, []);

  const handleStart = async (classId) => {
    setActionLoading(classId);
    try {
      await api.put(`/faculty/classes/${classId}/start`, {});
      load();
    } catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleEnd = async (classId) => {
    if (!window.confirm('End this class? Students will be removed.')) return;
    setActionLoading(classId);
    try {
      await api.put(`/faculty/classes/${classId}/end`, {});
      load();
    } catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const openEdit = (c) => setEditModal({
    id: c.id, title: c.title, description: c.description || '',
    scheduled_at: toInputDT(c.scheduled_at),
    duration_minutes: c.duration_minutes, class_mode: c.class_mode,
  });

  const handleEditSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/faculty/classes/${editModal.id}`, editModal);
      setEditModal(null); load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900">My Classes</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            {['upcoming', 'past'].map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={`px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${scope === s ? 'text-white' : 'text-slate-500 bg-white'}`}
                style={scope === s ? { background: accent } : {}}>
                {s}
              </button>
            ))}
          </div>
          {batches.length > 0 && (
            <button
              className="btn-primary text-sm"
              style={{ background: accent }}
              onClick={() => setSchedModal(batches[0])}>
              + Schedule Class
            </button>
          )}
        </div>
      </div>

      {/* Edit Class Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-900 text-lg">Edit Class</h3>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date & Time *</label>
                  <input type="datetime-local" className="input" required
                    value={editModal.scheduled_at}
                    onChange={e => setEditModal({ ...editModal, scheduled_at: e.target.value })} />
                </div>
                <div>
                  <label className="label">Duration (min)</label>
                  <input type="number" className="input" min="15"
                    value={editModal.duration_minutes}
                    onChange={e => setEditModal({ ...editModal, duration_minutes: +e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={editModal.title}
                  onChange={e => setEditModal({ ...editModal, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Class Mode</label>
                <select className="input" value={editModal.class_mode}
                  onChange={e => setEditModal({ ...editModal, class_mode: e.target.value })}>
                  <option value="interactive">Interactive (students can speak)</option>
                  <option value="broadcast">Broadcast (view-only for students)</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows="2" value={editModal.description}
                  onChange={e => setEditModal({ ...editModal, description: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 py-2.5 rounded-xl text-white font-bold hover:opacity-90"
                  style={{ background: accent }}>Save Changes</button>
                <button type="button" className="px-5 py-2.5 rounded-xl border text-slate-600 hover:bg-slate-50"
                  onClick={() => setEditModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">{scope === 'upcoming' ? '📅' : '📺'}</p>
          <p className="text-slate-500">{scope === 'upcoming' ? 'No upcoming classes' : 'No past classes'}</p>
          {scope === 'upcoming' && batches.length > 0 && (
            <button onClick={() => setSchedModal(batches[0])} className="mt-4 text-sm font-semibold" style={{ color: accent }}>
              + Schedule your first class
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map(c => {
            const live = c.status === 'live';
            const isPending = c.status === 'pending_approval';
            const startable = canStart(c) && c.status === 'scheduled';
            return (
              <div key={c.id} className="card relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${live ? 'bg-red-500 animate-pulse' : isPending ? 'bg-amber-400' : startable ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                <div className="flex items-start justify-between mt-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-900">{c.title}</h3>
                      {live && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE NOW</span>}
                      <Badge status={c.status} />
                    </div>
                    <p className="text-sm text-slate-500 mb-2">{c.batch_name} · {c.course_title}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>📅 {fmtDate(c.scheduled_at)}</span>
                      <span>🕐 {fmtTime(c.scheduled_at)}</span>
                      <span>⏱ {c.duration_minutes} min</span>
                      <span className="badge badge-blue">{c.class_mode}</span>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex flex-col gap-2 items-end">
                    {isPending && (
                      <div className="text-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <span className="text-xs text-amber-700 font-semibold block">⏳ Awaiting Admin</span>
                        <span className="text-xs text-amber-600">Approval Required</span>
                      </div>
                    )}
                    {live && (
                      <>
                        <button
                          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm"
                          onClick={() => window.open(`/live-class/${c.id}`, '_blank')}>
                          Enter Class
                        </button>
                        <button
                          className="px-5 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                          disabled={actionLoading === c.id}
                          onClick={() => handleEnd(c.id)}>
                          End Class
                        </button>
                      </>
                    )}
                    {startable && !live && (
                      <button
                        className="px-5 py-2 text-white rounded-lg font-semibold text-sm hover:opacity-90"
                        style={{ background: accent }}
                        disabled={actionLoading === c.id}
                        onClick={() => handleStart(c.id)}>
                        {actionLoading === c.id ? 'Starting...' : 'Start Class'}
                      </button>
                    )}
                    {!startable && !live && !isPending && c.status === 'scheduled' && (
                      <div className="text-center text-sm text-slate-400">
                        <span className="block text-xs">Starts in</span>
                        <span className="font-bold">{Math.ceil((parseDT(c.scheduled_at) - new Date()) / 3600000)}h</span>
                      </div>
                    )}
                    {(c.status === 'scheduled' || c.status === 'pending_approval') && (
                      <button className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600"
                        onClick={() => openEdit(c)}>✏️ Edit</button>
                    )}
                    {(c.status === 'ended' || c.status === 'recorded') && c.recording_url && (
                      <a href={c.recording_url} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 text-center">
                        View Recording
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {schedModal && (
        <ScheduleModal
          batch={schedModal}
          accent={accent}
          onClose={() => setSchedModal(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}

// ── SCHEDULE (pick batch first) ───────────────────────────────
function ScheduleTab({ accent }) {
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/faculty/batches').then(b => { setBatches(b); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected) {
      api.get(`/faculty/classes?scope=upcoming`).then(all => setClasses(all.filter(c => c.batch_id === selected.id)));
    }
  }, [selected]);

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">Schedule a Class</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batch picker */}
        <div>
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-3">Select Batch</p>
          <div className="space-y-2">
            {batches.map(b => (
              <button key={b.id} onClick={() => setSelected(b)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selected?.id === b.id ? 'border-current text-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                style={selected?.id === b.id ? { borderColor: accent, background: accent } : {}}>
                <div className="font-semibold text-sm">{b.name}</div>
                <div className={`text-xs mt-0.5 ${selected?.id === b.id ? 'text-white/70' : 'text-slate-400'}`}>{b.course_title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule form or empty state */}
        <div className="lg:col-span-2">
          {selected ? (
            <ScheduleModal
              batch={selected}
              accent={accent}
              onClose={() => {}}
              onCreated={() => {
                api.get(`/faculty/classes?scope=upcoming`)
                  .then(all => setClasses(all.filter(c => c.batch_id === selected.id)));
              }}
              inline
            />
          ) : (
            <div className="card text-center py-16 text-slate-400">
              <p className="text-3xl mb-3">👈</p>
              <p>Select a batch to schedule a class</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PROFILE ──────────────────────────────────────────────────
function FacultyProfile({ user, accent }) {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-6">My Profile</h2>
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{ background: accent }}>{user?.name?.[0]}</div>
          <div>
            <div className="text-xl font-black text-slate-900">{user?.name}</div>
            <div className="text-sm text-slate-400">{user?.email}</div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white mt-1 inline-block"
              style={{ background: accent }}>Faculty</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['Phone', user?.phone || '—'], ['Academy', user?.agency_name], ['Role', 'Faculty / Instructor']].map(([k, v]) => (
            <div key={k} className="p-3 bg-slate-50 rounded-xl">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card text-sm text-slate-500" style={{ border: `1px solid ${accent}30`, background: accent + '06' }}>
        <p className="font-bold" style={{ color: accent }}>Instructor Guide</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>You can start a class up to 15 minutes before scheduled time</li>
          <li>Click <strong>Start Class</strong> to go live — students will see a "LIVE NOW" badge</li>
          <li>You join as <strong>Moderator</strong> with full controls (mute/remove participants)</li>
          <li>Click <strong>End Class</strong> after finishing to update the status</li>
          <li>Your default password is <strong>Faculty@123</strong> — change it after first login</li>
        </ul>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────
export default function FacultyDashboard() {
  const { user } = useAuth();
  const [section, setSection] = useState('classes');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/faculty/profile').then(setProfile).catch(() => {});
  }, []);

  const accent = profile?.brand_color || user?.brand_color || '#7c3aed';
  const agencyName = profile?.agency_name || user?.agency_name || 'Academy';
  const logoInitials = profile?.logo_initials || user?.name?.[0] || 'F';

  const panels = {
    classes: <MyClasses accent={accent} />,
    batches: <MyBatches accent={accent} onSelectBatch={() => setSection('classes')} />,
    profile: <FacultyProfile user={profile || user} accent={accent} />,
  };

  return (
    <DashLayout
      bgColor={accent}
      onLiveClasses={() => setSection('classes')}
      sidebar={{
        logo: (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-white text-sm">{logoInitials}</div>
              <div className="text-white font-bold text-sm">{agencyName}</div>
            </div>
            <div className="text-xs text-white/50">Faculty Portal</div>
          </div>
        ),
        items: (
          <>
            <NavItem active={section === 'classes'} onClick={() => setSection('classes')} icon="📺" label="My Classes" accent="rgba(255,255,255,0.9)" />
            <NavItem active={section === 'batches'} onClick={() => setSection('batches')} icon="📚" label="My Batches" accent="rgba(255,255,255,0.9)" />
            <NavItem active={section === 'profile'} onClick={() => setSection('profile')} icon="👤" label="Profile" accent="rgba(255,255,255,0.9)" />
          </>
        ),
      }}
    >
      {panels[section]}
    </DashLayout>
  );
}
