import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { LogOut, Menu, X } from 'lucide-react';

// Polls for live classes every 60s and shows a pulsing header badge
function LiveClassesBadge({ onNavigate }) {
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    const check = () => {
      api.get('/live-classes/upcoming').then(rows => {
        setLiveCount(rows.filter(r => r.status === 'live').length);
      }).catch(() => {});
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      onClick={onNavigate}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all
        ${liveCount > 0
          ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
          : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
        }`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${liveCount > 0 ? 'bg-white animate-ping' : 'bg-red-400'}`} />
      {liveCount > 0 ? `🔴 ${liveCount} Live Now` : '📺 Live Classes'}
    </button>
  );
}

// sidebarTheme: 'dark' (default) | 'light' | 'bold'
export default function DashLayout({ sidebar, children, headerRight, bgColor = '#1a1a2e', logoUrl, onLiveClasses, sidebarTheme = 'dark', accentColor }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const accent = accentColor || bgColor;

  useEffect(() => { setOpen(false); }, [children]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Sidebar bg style per theme
  const sidebarStyle = sidebarTheme === 'light'
    ? { background: '#f8fafc', borderRight: '1px solid #e2e8f0' }
    : sidebarTheme === 'bold'
      ? { background: `linear-gradient(160deg, ${bgColor} 0%, ${darkenColor(bgColor, 25)} 100%)` }
      : { background: bgColor };

  const sidebarTextColor = sidebarTheme === 'light' ? 'text-slate-800' : 'text-white';
  const sidebarBorderColor = sidebarTheme === 'light' ? 'border-slate-200' : 'border-white/10';
  const closeButtonClass = sidebarTheme === 'light' ? 'text-slate-400 hover:text-slate-700' : 'text-white/60 hover:text-white';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={`p-5 border-b ${sidebarBorderColor} flex items-center justify-between`}>
        <div className="flex-1">
          {sidebar?.logo}
        </div>
        <button onClick={() => setOpen(false)} className={`md:hidden ${closeButtonClass} p-1 rounded`}>
          <X size={20} />
        </button>
      </div>

      {onLiveClasses && (
        <div className="px-3 pt-3 pb-1">
          <LiveNavItem onNavigate={() => { onLiveClasses(); setOpen(false); }} bgColor={bgColor} sidebarTheme={sidebarTheme} />
        </div>
      )}

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {sidebar?.items}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex md:flex-col flex-shrink-0 ${sidebarTextColor}`}
        style={{ ...sidebarStyle, width: sidebarTheme === 'light' ? '220px' : '240px' }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className={`relative z-50 flex flex-col w-72 max-w-[85vw] shadow-2xl ${sidebarTextColor}`} style={{ ...sidebarStyle, width: undefined }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition text-slate-600"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="md:hidden flex-1 min-w-0">
            {sidebar?.mobileTitle && (
              <p className="font-bold text-slate-800 text-sm truncate">{sidebar.mobileTitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {onLiveClasses && <LiveClassesBadge onNavigate={onLiveClasses} />}
            {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name}</p>
                <p className="text-xs text-slate-400 leading-tight truncate max-w-[140px]">{user?.email}</p>
              </div>
              <button onClick={handleLogout} title="Logout"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition border border-slate-200 hover:border-red-200">
                <LogOut size={13} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
            {logoUrl && (
              <img src={logoUrl} alt="brand logo" className="h-8 w-auto max-w-[120px] object-contain rounded" style={{ maxHeight: 32 }} />
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function darkenColor(hex, amount) {
  try {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return hex; }
}

// Sidebar live classes nav item with pulse
function LiveNavItem({ onNavigate, bgColor, sidebarTheme }) {
  const [liveCount, setLiveCount] = useState(0);
  useEffect(() => {
    api.get('/live-classes/upcoming').then(rows => {
      setLiveCount(rows.filter(r => r.status === 'live').length);
    }).catch(() => {});
  }, []);

  const isLight = sidebarTheme === 'light';
  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all relative overflow-hidden"
      style={{
        background: liveCount > 0 ? 'rgba(239,68,68,0.9)' : isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
        color: liveCount > 0 ? 'white' : isLight ? '#475569' : 'white',
        boxShadow: liveCount > 0 ? '0 0 16px rgba(239,68,68,0.5)' : 'none',
      }}
    >
      {liveCount > 0 && (
        <span className="absolute inset-0 rounded-xl animate-ping opacity-30" style={{ background: '#ef4444' }} />
      )}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${liveCount > 0 ? 'bg-white animate-pulse' : isLight ? 'bg-slate-400' : 'bg-white/50'}`} />
      <span className="relative">{liveCount > 0 ? `🔴 ${liveCount} Live Now` : '📺 Live Classes'}</span>
    </button>
  );
}

export function NavItem({ active, onClick, icon, label, accent, theme = 'dark' }) {
  if (theme === 'light') {
    return (
      <button onClick={onClick}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition"
        style={active
          ? { background: accent, color: '#fff', fontWeight: 700 }
          : { color: '#475569' }
        }
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; }}
      >
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick}
      className={`sidebar-item w-full text-left ${active ? 'active' : ''}`}
      style={active && accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: '13px' } : {}}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
