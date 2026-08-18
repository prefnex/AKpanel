import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import ClientHeader from './components/ClientHeader';
import ClientSidebar from './components/ClientSidebar';
import ClientDashboard from './components/ClientDashboard';
import ClientWebsitesPage from './components/ClientWebsitesPage';
import ClientDNSPage from './components/ClientDNSPage';
import ClientDatabasesPage from './components/ClientDatabasesPage';
import ClientFileManagerV2 from './components/ClientFileManagerV2';
import ClientFTPPage from './components/ClientFTPPage';
import ClientCronPage from './components/ClientCronPage';
import ClientPHPPage from './components/ClientPHPPage';
import ClientEmailsPage from './components/ClientEmailsPage';
import ClientBackupsPage from './components/ClientBackupsPage';
import ClientLoginView from './components/ClientLoginView';

export default function ClientApp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState(
    localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token') || ''
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('akpanel_client_user') || localStorage.getItem('ak_client_user') || 'null');
    } catch {
      return null;
    }
  });

  const [stats, setStats] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchStats = async () => {
    const currentToken = localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
    if (!currentToken) return;
    try {
      const res = await fetch('/api/client/stats', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('ak_client_token');
    localStorage.removeItem('akpanel_client_token');
    localStorage.removeItem('ak_client_user');
    localStorage.removeItem('akpanel_client_user');
    setToken('');
    setUser(null);
    setStats(null);
  };

  const handleNavigateFiles = (domain) => {
    navigate('/files');
  };

  // If unauthenticated, show Client Login View
  if (!token) {
    return <ClientLoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Toast Popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-800/80 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-800/80 text-emerald-200'
          }`}>
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <ClientHeader 
        user={user} 
        stats={stats} 
        onLogout={handleLogout} 
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex">
        {/* Navigation Sidebar */}
        <ClientSidebar 
          stats={stats} 
        />

        {/* Content Area with Full React Router Multi-Page Switching */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          <Routes>
            <Route 
              path="/" 
              element={
                <ClientDashboard 
                  stats={stats} 
                  showToast={showToast} 
                />
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ClientDashboard 
                  stats={stats} 
                  showToast={showToast} 
                />
              } 
            />
            <Route 
              path="/websites" 
              element={
                <ClientWebsitesPage 
                  showToast={showToast} 
                  onNavigateFiles={handleNavigateFiles} 
                />
              } 
            />
            <Route 
              path="/dns" 
              element={
                <ClientDNSPage 
                  showToast={showToast} 
                />
              } 
            />
            <Route 
              path="/databases" 
              element={
                <ClientDatabasesPage 
                  showToast={showToast} 
                  username={user?.username || 'user'} 
                />
              } 
            />
            <Route 
              path="/files" 
              element={
                <ClientFileManagerV2 
                  showToast={showToast} 
                  username={user?.username || 'user'}
                />
              } 
            />
            <Route 
              path="/filemanager" 
              element={
                <ClientFileManagerV2 
                  showToast={showToast} 
                  username={user?.username || 'user'}
                />
              } 
            />
            <Route 
              path="/ftp" 
              element={
                <ClientFTPPage 
                  showToast={showToast} 
                  username={user?.username || 'user'} 
                  serverIP={stats?.server_ip}
                />
              } 
            />
            <Route 
              path="/emails" 
              element={
                <ClientEmailsPage 
                  showToast={showToast} 
                />
              } 
            />
            <Route 
              path="/cron" 
              element={
                <ClientCronPage 
                  showToast={showToast} 
                  username={user?.username || 'user'} 
                />
              } 
            />
            <Route 
              path="/php" 
              element={
                <ClientPHPPage 
                  showToast={showToast} 
                  username={user?.username || 'user'} 
                  serverIP={stats?.server_ip}
                />
              } 
            />
            <Route 
              path="/backups" 
              element={
                <ClientBackupsPage 
                  showToast={showToast} 
                  stats={stats} 
                />
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
