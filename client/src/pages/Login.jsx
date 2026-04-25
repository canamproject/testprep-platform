import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function Login({ tenantSlug }) {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [activeTab, setActiveTab] = useState('student');

  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') navigate('/admin');
      else if (user.role === 'partner_admin') navigate('/partner');
      else navigate('/student');
    }
  }, [user]);

  useEffect(() => {
    if (tenantSlug) {
      api.get(`/tenant/${tenantSlug}`).then(setTenant).catch(() => {});
    }
  }, [tenantSlug]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const u = await login(email, password);
      if (u.role === 'super_admin') navigate('/admin');
      else if (u.role === 'partner_admin') navigate('/partner');
      else navigate('/student');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const fillDemo = (role) => {
    if (role === 'admin') { setEmail('admin@testprep.com'); setPassword('Admin@123'); }
    else if (role === 'partner1') { setEmail('admin@brightpath.in'); setPassword('Partner@123'); }
    else if (role === 'partner2') { setEmail('ops@globalvisa.com'); setPassword('Partner@123'); }
    else if (role === 'partner3') { setEmail('info@edustar.co'); setPassword('Partner@123'); }
    else if (role === 'student') { setEmail('priya.sharma@email.com'); setPassword('Student@123'); }
  };

  const brandColor = tenant?.brand_color || '#1a1a2e';
  const agencyName = tenant?.name || 'TestPrep Platform';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-100">
          <div className="p-8 text-white text-center" style={{ background: brandColor }}>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black">
              {tenant?.logo_initials || 'TP'}
            </div>
            <h1 className="text-2xl font-bold">{agencyName}</h1>
            {tenant && <p className="text-white/70 text-sm mt-1">testprep.com/agent/{tenant.slug}</p>}
          </div>

          <div className="bg-white p-8">
            {/* Role Tabs */}
            {!tenantSlug && (
              <div className="flex bg-slate-100 rounded-xl p-1 mb-6 gap-1">
                {[['admin','Admin'],['partner','Partner'],['student','Student']].map(([k,l]) => (
                  <button key={k} onClick={() => setActiveTab(k)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab===k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                  >{l}</button>
                ))}
              </div>
            )}

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label>Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <div>
                <label>Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 shadow-lg"
                style={{ background: brandColor }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Demo Quick Access */}
            <div className="mt-6 border-t border-slate-100 pt-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Quick Demo Login</p>
              <div className="grid grid-cols-2 gap-2">
                {!tenantSlug && <button onClick={() => fillDemo('admin')} className="text-xs px-3 py-2 bg-slate-900 text-white rounded-lg font-medium">Admin</button>}
                <button onClick={() => fillDemo('partner1')} className="text-xs px-3 py-2 rounded-lg font-medium text-white" style={{background:'#1e40af'}}>BrightPath Partner</button>
                <button onClick={() => fillDemo('partner2')} className="text-xs px-3 py-2 rounded-lg font-medium text-white" style={{background:'#0f766e'}}>GlobalVisa Partner</button>
                <button onClick={() => fillDemo('partner3')} className="text-xs px-3 py-2 rounded-lg font-medium text-white" style={{background:'#7c3aed'}}>EduStar Partner</button>
                <button onClick={() => fillDemo('student')} className="text-xs px-3 py-2 bg-emerald-600 text-white rounded-lg font-medium">Student Login</button>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant URLs Info */}
        {!tenantSlug && (
          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-100 text-xs text-slate-500">
            <p className="font-bold mb-2">Tenant-Specific Portals:</p>
            <div className="space-y-1">
              {[['brightpath','BrightPath Academy','#1e40af'],['globalvisa','GlobalVisa Consultants','#0f766e'],['edustar','EduStar Institute','#7c3aed']].map(([slug,name,color]) => (
                <div key={slug} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}></span>
                  <a href={`/agent/${slug}`} className="font-mono hover:underline" style={{color}}>/agent/{slug}</a>
                  <span className="text-slate-400">— {name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
