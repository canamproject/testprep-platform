import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import PartnerLoginPage from './pages/PartnerLoginPage';
import FacultyLoginPage from './pages/FacultyLoginPage';
import StudentLandingPage from './pages/StudentLandingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import LiveClassRoom from './pages/LiveClassRoom';
import PublicLiveClass from './pages/PublicLiveClass';
import StudentLandingPage from './pages/StudentLandingPage';

// ── System slugs that are NOT agency slugs ──────────────────────────────────
const RESERVED = new Set(['admin','partner','student','faculty','login','live-class','join','agent','api','partner-login','faculty-login']);

function studentHome(user) {
  const slug = user?.slug || user?.agency_slug;
  return slug ? `/${slug}/student` : '/student';
}

function partnerHome(user) {
  const slug = user?.slug || user?.agency_slug;
  return slug ? `/${slug}/partner` : '/partner';
}

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-lg animate-pulse">T</div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <p className="text-xs text-slate-400 font-medium">Connecting to server…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
    if (user.role === 'partner_admin') return <Navigate to={partnerHome(user)} replace />;
    if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
    if (user.role === 'student') return <Navigate to={studentHome(user)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
  if (user.role === 'partner_admin') return <Navigate to={partnerHome(user)} replace />;
  if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
  return <Navigate to={studentHome(user)} replace />;
}

// Tenant route: /agent/:slug — full student landing page with branding
function TenantEntry() {
  const { slug } = useParams();
  if (slug === 'partner-login') return <PartnerLoginPage />;
  if (slug === 'faculty-login') return <FacultyLoginPage />;
  return <StudentLandingPage tenantSlug={slug} />;
}

function TenantSignup() {
  const { slug } = useParams();
  return <StudentLandingPage tenantSlug={slug} />;
}

// ── DOM helpers ─────────────────────────────────────────────────────────────
function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
}
function setLink(rel, href, type) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
  if (type) el.type = type;
}

// ── PWA Manager ──────────────────────────────────────────────────────────────
// Dynamically swaps manifest, title, favicon, and theme-color per agency.
// Works for students, partners, and the login page — anywhere a slug is present.
function PWAManager() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Detect slug: from URL first, then from logged-in user
    const pathMatch = location.pathname.match(/^\/([^/]+)(?:\/|$)/);
    const pathSlug  = pathMatch?.[1];
    const slug = (!pathSlug || RESERVED.has(pathSlug))
      ? (user?.slug || user?.agency_slug)
      : pathSlug;

    if (!slug || RESERVED.has(slug)) {
      // Reset to platform defaults for admin / no-agency pages
      document.title = 'TestPrep Platform';
      setMeta('theme-color', '#1a1a2e');
      setMeta('apple-mobile-web-app-title', 'TestPrep');
      setLink('manifest', '/manifest.json', 'application/manifest+json');
      setLink('icon', '/favicon.svg', 'image/svg+xml');
      setLink('apple-touch-icon', '/favicon.svg');
      return;
    }

    // Fetch agency branding
    fetch(`/api/tenant/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(tenant => {
        if (!tenant) return;
        const name  = tenant.name  || 'Student Portal';
        const color = tenant.brand_color || '#1a1a2e';

        // Title + meta
        document.title = name;
        setMeta('theme-color', color);
        setMeta('apple-mobile-web-app-title', name);
        setMeta('apple-mobile-web-app-capable', 'yes');
        setMeta('mobile-web-app-capable', 'yes');
        setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
        setMeta('description', `${name} · Live classes & test prep`);

        // Favicon / touch icon — use agency logo or coloured SVG fallback
        const iconHref = `/api/tenant-icon/${slug}`;
        setLink('icon', iconHref);
        setLink('apple-touch-icon', iconHref);

        // PWA manifest — points to dynamic per-agency manifest on backend
        setLink('manifest', `/api/tenant-manifest/${slug}`, 'application/manifest+json');
      })
      .catch(() => {});
  }, [location.pathname, user?.agency_id]);

  return null;
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PWAManager />
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          {/* Role-specific login pages with USP panels */}
          <Route path="/partner-login" element={<PartnerLoginPage />} />
          <Route path="/faculty-login" element={<FacultyLoginPage />} />

          {/* Named app routes — must come before /:slug catch-all */}
          <Route path="/admin/*" element={
            <RequireAuth role="super_admin"><AdminDashboard /></RequireAuth>
          } />
          <Route path="/partner/*" element={
            <RequireAuth role="partner_admin"><PartnerDashboard /></RequireAuth>
          } />
          {/* Slug-based partner URL: e.g. /globalvisa/partner */}
          <Route path="/:slug/partner/*" element={
            <RequireAuth role="partner_admin"><PartnerDashboard /></RequireAuth>
          } />
          <Route path="/student/*" element={
            <RequireAuth role="student"><StudentDashboard /></RequireAuth>
          } />
          {/* Slug-based student URL: e.g. /rtconsultants/student */}
          <Route path="/:slug/student/*" element={
            <RequireAuth role="student"><StudentDashboard /></RequireAuth>
          } />
          <Route path="/faculty/*" element={
            <RequireAuth role="faculty"><FacultyDashboard /></RequireAuth>
          } />
          <Route path="/live-class/:id" element={
            <RequireAuth><LiveClassRoom /></RequireAuth>
          } />

          {/* Public guest join — no auth required */}
          <Route path="/join/:id" element={<PublicLiveClass />} />

          {/* Legacy /agent/:slug routes — kept for backward compat */}
          <Route path="/agent/:slug" element={<TenantEntry />} />
          <Route path="/agent/:slug/login" element={<TenantEntry />} />
          <Route path="/agent/:slug/signup" element={<TenantSignup />} />

          {/* Clean partner URLs: /:slug shows landing page, /login and /signup go to auth */}
          <Route path="/:slug/login" element={<TenantEntry />} />
          <Route path="/:slug/signup" element={<TenantSignup />} />
          <Route path="/:slug" element={<TenantLanding />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
