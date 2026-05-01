import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import LiveClassRoom from './pages/LiveClassRoom';
import PublicLiveClass from './pages/PublicLiveClass';

function studentHome(user) {
  const slug = user?.slug || user?.agency_slug;
  return slug ? `/${slug}/student` : '/student';
}

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
    if (user.role === 'partner_admin') return <Navigate to="/partner" replace />;
    if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
    if (user.role === 'student') return <Navigate to={studentHome(user)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
  if (user.role === 'partner_admin') return <Navigate to="/partner" replace />;
  if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
  return <Navigate to={studentHome(user)} replace />;
}

// Tenant route: /agent/:slug — loads partner branding then student login
function TenantEntry() {
  const { slug } = useParams();
  return <Login tenantSlug={slug} />;
}

function TenantSignup() {
  const { slug } = useParams();
  return <Login tenantSlug={slug} defaultMode="signup" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          {/* Named app routes — must come before /:slug catch */}
          <Route path="/admin/*" element={
            <RequireAuth role="super_admin"><AdminDashboard /></RequireAuth>
          } />
          <Route path="/partner/*" element={
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

          {/* Clean partner URLs: /:slug, /:slug/login, /:slug/signup */}
          <Route path="/:slug/login" element={<TenantEntry />} />
          <Route path="/:slug/signup" element={<TenantSignup />} />
          <Route path="/:slug" element={<TenantEntry />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
