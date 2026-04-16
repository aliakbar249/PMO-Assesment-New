import { useState, useMemo } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import Layout from './components/Layout';

// Auth pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Employee pages
import EmpDashboard from './pages/EmpDashboard';
import EmpProfile from './pages/EmpProfile';
import SelfAssessment from './pages/SelfAssessment';
import EmpAssignments from './pages/EmpAssignments';
import EmpNominations from './pages/EmpNominations';

// Reviewer pages
import ReviewerDashboard from './pages/ReviewerDashboard';
import ReviewerAssessment from './pages/ReviewerAssessment';

// Admin pages
import AdminDashboard from './pages/AdminDashboard';
import AdminProfiles from './pages/AdminProfiles';
import AdminProgress from './pages/AdminProgress';
import AdminTemplates from './pages/AdminTemplates';
import AdminExport from './pages/AdminExport';
import AdminEmployees from './pages/AdminEmployees';

// Default pages per role
const DEFAULT_PAGE = {
  employee: 'emp-dashboard',
  reviewer: 'rev-dashboard',
  admin:    'adm-dashboard',
};

function AppRouter() {
  const { currentUser, dbReady } = useApp();

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-300 text-sm">Connecting to database…</p>
        </div>
      </div>
    );
  }
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  const defaultPage = currentUser ? DEFAULT_PAGE[currentUser.role] || 'emp-dashboard' : null;
  const [page, setPage] = useState(defaultPage);

  // When user logs in, set their default page
  const navigate = (p) => setPage(p);

  // Reset page on login
  useMemo(() => {
    if (currentUser) setPage(DEFAULT_PAGE[currentUser.role] || 'emp-dashboard');
  }, [currentUser?.id]);

  // ── Not logged in ──────────────────────────────────────────
  if (!currentUser) {
    if (authMode === 'register') {
      return <RegisterPage onBack={() => setAuthMode('login')} />;
    }
    return <LoginPage onRegister={() => setAuthMode('register')} />;
  }

  // ── Employee pages ─────────────────────────────────────────
  if (currentUser.role === 'employee') {
    return (
      <Layout page={page} onNavigate={navigate}>
        {page === 'emp-dashboard'   && <EmpDashboard   onNavigate={navigate} />}
        {page === 'emp-profile'     && <EmpProfile />}
        {page === 'emp-assessment'  && <SelfAssessment  onNavigate={navigate} />}
        {page === 'emp-assignments' && <EmpAssignments  onNavigate={navigate} />}
        {page === 'emp-nominations' && <EmpNominations  onNavigate={navigate} />}
      </Layout>
    );
  }

  // ── Reviewer pages ─────────────────────────────────────────
  if (currentUser.role === 'reviewer') {
    return (
      <Layout page={page} onNavigate={navigate}>
        {page === 'rev-dashboard'   && <ReviewerDashboard onNavigate={navigate} />}
        {page === 'rev-assessment'  && <ReviewerAssessment onNavigate={navigate} />}
      </Layout>
    );
  }

  // ── Admin pages ────────────────────────────────────────────
  if (currentUser.role === 'admin') {
    return (
      <Layout page={page} onNavigate={navigate}>
        {page === 'adm-dashboard' && <AdminDashboard onNavigate={navigate} />}
        {page === 'adm-employees' && <AdminEmployees />}
        {page === 'adm-profiles'  && <AdminProfiles />}
        {page === 'adm-progress'  && <AdminProgress />}
        {page === 'adm-templates' && <AdminTemplates />}
        {page === 'adm-export'    && <AdminExport />}
      </Layout>
    );
  }

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
