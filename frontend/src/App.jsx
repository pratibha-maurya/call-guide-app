import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Toast from './components/Toast.jsx';
import ConfigError from './components/ConfigError.jsx';
import { configError } from './api/index.js';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { LiveCallProvider } from './hooks/useLiveCall.jsx';
import { StagesProvider } from './lib/StagesContext.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LiveCallPage from './pages/LiveCallPage.jsx';
import PastCallsPage from './pages/PastCallsPage.jsx';
import CallDetailPage from './pages/CallDetailPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import AuthLayout from './components/AuthLayout.jsx';

// Everything behind the login. This only decides what to show: the backend refuses
// every data request without a valid login, whatever the screen does.
function ProtectedApp() {
  const { status, user, resetting, retry } = useAuth();
  const location = useLocation();

  if (resetting) return <Navigate to="/reset-password" replace />;
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (status === 'loading' || status === 'checking') return <AuthLayout title="Loading..." />;
  if (status === 'unreachable') {
    return (
      <AuthLayout title="Can't reach the server" lede="Check the connection and try again.">
        <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
      </AuthLayout>
    );
  }

  return (
    <StagesProvider>
      {/* key: a different login starts clean, with nothing from the last person's call */}
      <LiveCallProvider key={user.id} userId={user.id}>
        <div className="app">
          <Header />
          <main className="main">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/call" element={<LiveCallPage />} />
              <Route path="/calls" element={<PastCallsPage />} />
              <Route path="/calls/:id" element={<CallDetailPage />} />
              <Route path="*" element={<p className="empty">This page doesn't exist.</p>} />
            </Routes>
          </main>
          <Toast />
        </div>
      </LiveCallProvider>
    </StagesProvider>
  );
}

export default function App() {
  if (configError) return <ConfigError />;

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </AuthProvider>
  );
}
