import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, X } from 'lucide-react';

export default function DashLayout({ sidebar, children, headerRight, bgColor = '#1a1a2e', logoUrl }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [children]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex-1">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="brand logo"
              className="mb-2 h-10 w-auto max-w-[140px] object-contain rounded-lg bg-white/10 p-1"
            />
          )}
          {sidebar?.logo}
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-white/60 hover:text-white p-1 rounded">
          <X size={20} />
        </button>
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
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex md:flex-col w-60 flex-shrink-0 text-white" style={{ background: bgColor }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <aside className="relative z-50 flex flex-col w-72 max-w-[85vw] text-white shadow-2xl" style={{ background: bgColor }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar — always visible on mobile, optional on desktop */}
        <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition text-slate-600"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Logo on mobile when sidebar is hidden */}
          <div className="md:hidden flex-1 min-w-0">
            {sidebar?.mobileTitle && (
              <p className="font-bold text-slate-800 text-sm truncate">{sidebar.mobileTitle}</p>
            )}
          </div>

          {/* Right side: brand logo + optional extra content */}
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
            {logoUrl && (
              <img
                src={logoUrl}
                alt="brand logo"
                className="h-8 w-auto max-w-[120px] object-contain rounded"
                style={{ maxHeight: 32 }}
              />
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

export function NavItem({ active, onClick, icon, label, accent }) {
  return (
    <button
      onClick={onClick}
      className={`sidebar-item w-full text-left ${active ? 'active' : ''}`}
      style={active && accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: '13px' } : {}}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
