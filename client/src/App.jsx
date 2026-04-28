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

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
    if (user.role === 'partner_admin') return <Navigate to="/partner" replace />;
    if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
    if (user.role === 'student') return <Navigate to="/student" replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin" replace />;
  if (user.role === 'partner_admin') return <Navigate to="/partner" replace />;
  if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
  return <Navigate to="/student" replace />;
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
          {/* Tenant-specific entry points */}
          <Route path="/agent/:slug" element={<TenantEntry />} />
          <Route path="/agent/:slug/login" element={<TenantEntry />} />
          <Route path="/agent/:slug/signup" element={<TenantSignup />} />

          <Route path="/admin/*" element={
            <RequireAuth role="super_admin"><AdminDashboard /></RequireAuth>
          } />
          <Route path="/partner/*" element={
            <RequireAuth role="partner_admin"><PartnerDashboard /></RequireAuth>
          } />
          <Route path="/student/*" element={
            <RequireAuth role="student"><StudentDashboard /></RequireAuth>
          } />
          <Route path="/faculty/*" element={
            <RequireAuth role="faculty"><FacultyDashboard /></RequireAuth>
          } />
          <Route path="/live-class/:id" element={
            <RequireAuth><LiveClassRoom /></RequireAuth>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
