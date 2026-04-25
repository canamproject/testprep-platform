import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function DashLayout({ sidebar, children, headerRight, bgColor = '#1a1a2e' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col flex-shrink-0 text-white" style={{ background: bgColor }}>
        <div className="p-5 border-b border-white/10">
          {sidebar?.logo}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {sidebar?.items}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/50 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {headerRight && (
          <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-end gap-3 flex-shrink-0">
            {headerRight}
          </header>
        )}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function NavItem({ active, onClick, icon, label, accent }) {
  return (
    <button onClick={onClick} className={`sidebar-item w-full text-left ${active ? 'active' : ''}`}
      style={active && accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: '13px' } : {}}>
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
