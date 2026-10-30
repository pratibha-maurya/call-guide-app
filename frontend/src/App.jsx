import { Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Toast from './components/Toast.jsx';
import ConfigError from './components/ConfigError.jsx';
import { configError } from './api/index.js';
import { LiveCallProvider } from './hooks/useLiveCall.jsx';
import { StagesProvider } from './lib/StagesContext.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LiveCallPage from './pages/LiveCallPage.jsx';
import PastCallsPage from './pages/PastCallsPage.jsx';
import CallDetailPage from './pages/CallDetailPage.jsx';

export default function App() {
  if (configError) return <ConfigError />;

  return (
    <StagesProvider>
      <LiveCallProvider>
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
