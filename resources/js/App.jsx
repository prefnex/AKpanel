import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

import WebServerManager from './components/WebServerManager';
import PHPLayout from './components/php/PHPLayout';
import PHPCLIPage from './components/php/PHPCLIPage';
import PHPFPMPage from './components/php/PHPFPMPage';
import PHPDefaultPage from './components/php/PHPDefaultPage';
import PHPShortInfoPage from './components/php/PHPShortInfoPage';
import PHPInfoPage from './components/php/PHPInfoPage';
import PHPExtensionsPage from './components/php/PHPExtensionsPage';
import PHPAddonsPage from './components/php/PHPAddonsPage';
import PHPIniPage from './components/php/PHPIniPage';
import PHPIniRawPage from './components/php/PHPIniRawPage';
import PHPInstallPage from './components/php/PHPInstallPage';
import WebsitesTable from './components/WebsitesTable';
import TemplatesShowcase from './components/TemplatesShowcase';
import DatabasesManager from './components/DatabasesManager';
import FileManager from './components/FileManager';
import FileManagerV2 from './components/FileManagerV2';
import WebTerminal from './components/WebTerminal';

import CreateSiteModal from './components/CreateSiteModal';
import PackagesManager from './components/PackagesManager';
import UsersManager from './components/UsersManager';
import DashboardOverview from './components/DashboardOverview';

import DNSZonesPage from './components/dns/DNSZonesPage';
import BindServerPage from './components/dns/BindServerPage';
import NameserversPage from './components/dns/NameserversPage';
import ZoneTemplatePage from './components/dns/ZoneTemplatePage';
import DNSClusterPage from './components/dns/DNSClusterPage';
import DNSSECPage from './components/dns/DNSSECPage';
import EmailManager from './components/EmailManager';
import IPManager from './components/IPManager';
import ServerSettingsManager from './components/ServerSettingsManager';
import SSLManager from './components/SSLManager';
import FirewallManager from './components/FirewallManager';
import NotFoundPage from './components/NotFoundPage';
import LoginView from './components/LoginView';
import Toast from './components/Toast';

export default function App() {
  const location = useLocation();
  const isStandaloneFileManager = location.pathname === '/filemanager/standalone' || location.pathname === '/filemanager/v2' || location.pathname === '/explorer';
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('ak_token'));
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ak_user')) || { username: 'root', role: 'root_admin' };
    } catch {
      return { username: 'root', role: 'root_admin' };
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    domain: '',
    server_engine: 'nginx',
    template_id: 'laravel',
    php_version: '8.2',
    site_type: 'php',
    proxy_port: 3000
  });

  // Attach global fetch interceptor to inject Authorization Bearer token & handle 401
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      config = config || {};
      config.headers = config.headers || {};

      const token = localStorage.getItem('ak_token');
      if (token) {
        if (config.headers instanceof Headers) {
          if (!config.headers.has('Authorization')) {
            config.headers.set('Authorization', `Bearer ${token}`);
          }
        } else if (Array.isArray(config.headers)) {
          config.headers.push(['Authorization', `Bearer ${token}`]);
        } else {
          if (!config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      }

      try {
        const response = await originalFetch(resource, config);
        if (response.status === 401 && !resource.toString().includes('/api/auth/login')) {
          localStorage.removeItem('ak_token');
          localStorage.removeItem('ak_user');
          setIsAuthenticated(false);
        }
        return response;
      } catch (err) {
        throw err;
      }
    };
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('ak_token');
        localStorage.removeItem('ak_user');
        setIsAuthenticated(false);
      }
    } catch (e) {
      // If offline or failure
      if (!localStorage.getItem('ak_token')) {
        setIsAuthenticated(false);
      }
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/system/stats');
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/websites');
      if (res.ok) {
        const json = await res.json();
        setWebsites(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchWebsites();
      fetchTemplates();
      const interval = setInterval(fetchStats, 2500);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleTemplateSelect = (tpl) => {
    setFormData(prev => ({
      ...prev,
      template_id: tpl.id,
      php_version: tpl.php_version !== 'none' ? tpl.php_version : '8.2',
      site_type: tpl.default_type
    }));
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      
      showToast(json.message);
      setIsModalOpen(false);
      fetchWebsites();
      setFormData({
        domain: '',
        server_engine: 'nginx',
        template_id: 'laravel',
        php_version: '8.2',
        site_type: 'php',
        proxy_port: 3000
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchEngine = async (domain, engine) => {
    try {
      const res = await fetch('/api/websites/switch-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, engine })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchWebsites();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteSite = async (domain) => {
    if (!confirm(`Are you sure you want to delete ${domain}? This will permanently remove its vhost, configurations, and public directory!`)) return;
    try {
      const res = await fetch('/api/websites/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchWebsites();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    showToast('Logged out of Root Authority Console');
  };

  // Auth Loading Screen
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs font-mono text-zinc-400">Verifying Root Authority Security...</span>
        </div>
      </div>
    );
  }

  // If Not Authenticated -> Show Root Login Screen
  if (!isAuthenticated) {
    return (
      <>
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <LoginView 
          onLoginSuccess={(user, token) => {
            setCurrentUser(user);
            setIsAuthenticated(true);
            showToast(`Welcome Root Administrator (${user.username})`);
          }} 
        />
      </>
    );
  }

  // Standalone File Manager View
  if (isStandaloneFileManager) {
    return (
      <div className="h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans overflow-hidden">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <FileManagerV2 showToast={showToast} standalone={true} />
      </div>
    );
  }

  // Full Authenticated Admin Dashboard Layout
  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 flex font-sans overflow-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
        websitesCount={websites.length}
        stats={stats}
        onLogout={handleLogout}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header with Root User & Logout */}
        <Header 
          hostname={stats?.hostname} 
          onOpenModal={() => setIsModalOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={handleLogout}
          showToast={showToast}
        />

        {/* Dynamic Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 custom-scrollbar">
          <Routes>
            {/* Dashboard Overview Route (Enterprise Command Center) */}
            <Route path="/" element={
              <div className="space-y-8 max-w-[1400px] mx-auto">
                <DashboardOverview stats={stats} onRefresh={fetchStats} showToast={showToast} />
                <WebsitesTable 
                  websites={websites} 
                  onRefresh={fetchWebsites} 
                  onSwitchEngine={handleSwitchEngine} 
                  onDeleteSite={handleDeleteSite} 
                  onOpenModal={() => setIsModalOpen(true)} 
                />
              </div>
            } />

            {/* Dashboard Alias */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* DNS Functions - Root Server & BIND 9 Dedicated Pages */}
            <Route path="/dns" element={<Navigate to="/dns/zones" replace />} />
            <Route path="/dns/zones" element={
              <div className="max-w-[1400px] mx-auto">
                <DNSZonesPage showToast={showToast} />
              </div>
            } />
            <Route path="/dns/server" element={
              <div className="max-w-[1400px] mx-auto">
                <BindServerPage showToast={showToast} />
              </div>
            } />
            <Route path="/dns/nameservers" element={
              <div className="max-w-[1400px] mx-auto">
                <NameserversPage showToast={showToast} />
              </div>
            } />
            <Route path="/dns/templates" element={
              <div className="max-w-[1400px] mx-auto">
                <ZoneTemplatePage showToast={showToast} />
              </div>
            } />
            <Route path="/dns/cluster" element={
              <div className="max-w-[1400px] mx-auto">
                <DNSClusterPage showToast={showToast} />
              </div>
            } />
            <Route path="/dns/security" element={
              <div className="max-w-[1400px] mx-auto">
                <DNSSECPage showToast={showToast} />
              </div>
            } />
            <Route path="/dns/sync" element={
              <div className="max-w-[1400px] mx-auto">
                <DNSClusterPage showToast={showToast} />
              </div>
            } />

            {/* Email Accounts & Postfix Routing Route */}
            <Route path="/emails" element={
              <div className="max-w-[1400px] mx-auto">
                <EmailManager showToast={showToast} />
              </div>
            } />
            <Route path="/emails/*" element={
              <div className="max-w-[1400px] mx-auto">
                <EmailManager showToast={showToast} />
              </div>
            } />

            {/* IP Address & Network Pool Manager */}
            <Route path="/ips" element={
              <div className="max-w-[1400px] mx-auto">
                <IPManager showToast={showToast} />
              </div>
            } />

            {/* CWP / Server Settings & Hostname SSL */}
            <Route path="/settings" element={<Navigate to="/settings/server" replace />} />
            <Route path="/settings/server" element={
              <div className="max-w-[1400px] mx-auto">
                <ServerSettingsManager showToast={showToast} />
              </div>
            } />

            {/* SSL Certificates & Auto-Renewal Center */}
            <Route path="/ssl" element={
              <div className="max-w-[1400px] mx-auto">
                <SSLManager showToast={showToast} />
              </div>
            } />

            {/* User Accounts & Multi-Tenant Management Route */}
            <Route path="/users" element={
              <div className="max-w-[1400px] mx-auto">
                <UsersManager showToast={showToast} />
              </div>
            } />

            {/* Hosting Packages & Resource Quotas Route */}
            <Route path="/packages" element={
              <div className="max-w-[1400px] mx-auto">
                <PackagesManager showToast={showToast} />
              </div>
            } />

            {/* Web Server Switcher & Profiles Route */}
            <Route path="/webservers" element={
              <div className="max-w-[1400px] mx-auto">
                <WebServerManager showToast={showToast} />
              </div>
            } />
            <Route path="/webservers/*" element={
              <div className="max-w-[1400px] mx-auto">
                <WebServerManager showToast={showToast} />
              </div>
            } />

            {/* Multi-PHP: one React page file per URL */}
            <Route path="/php" element={
              <div className="max-w-[1400px] mx-auto">
                <PHPLayout showToast={showToast} />
              </div>
            }>
              <Route index element={<Navigate to="cli" replace />} />
              <Route path="cli" element={<PHPCLIPage />} />
              <Route path="fpm" element={<PHPFPMPage />} />
              <Route path="default" element={<PHPDefaultPage />} />
              <Route path="short-info" element={<PHPShortInfoPage />} />
              <Route path="info" element={<PHPInfoPage />} />
              <Route path="extensions" element={<PHPExtensionsPage />} />
              <Route path="addons" element={<PHPAddonsPage />} />
              <Route path="ini" element={<PHPIniPage />} />
              <Route path="ini-raw" element={<PHPIniRawPage />} />
              <Route path="install/:version" element={<PHPInstallPage />} />
            </Route>

            {/* Database Management Suite (Dropdown & Specific Sub-engines) */}
            <Route path="/databases" element={
              <div className="max-w-[1400px] mx-auto">
                <DatabasesManager defaultEngine="all" showToast={showToast} />
              </div>
            } />
            <Route path="/databases/mysql" element={
              <div className="max-w-[1400px] mx-auto">
                <DatabasesManager defaultEngine="mysql" showToast={showToast} />
              </div>
            } />
            <Route path="/databases/postgres" element={
              <div className="max-w-[1400px] mx-auto">
                <DatabasesManager defaultEngine="postgres" showToast={showToast} />
              </div>
            } />
            <Route path="/databases/mongodb" element={
              <div className="max-w-[1400px] mx-auto">
                <DatabasesManager defaultEngine="mongodb" showToast={showToast} />
              </div>
            } />
            <Route path="/databases/redis" element={
              <div className="max-w-[1400px] mx-auto">
                <DatabasesManager defaultEngine="redis" showToast={showToast} />
              </div>
            } />

            {/* File Manager (Standard Integrated View) */}
            <Route path="/filemanager" element={
              <div className="max-w-[1400px] mx-auto">
                <FileManager showToast={showToast} />
              </div>
            } />

            {/* Web Terminal Route */}
            <Route path="/terminal" element={
              <div className="max-w-[1400px] mx-auto">
                <WebTerminal showToast={showToast} />
              </div>
            } />

            {/* Enterprise Firewall & Security Suite */}
            <Route path="/firewall" element={
              <div className="max-w-[1400px] mx-auto">
                <FirewallManager showToast={showToast} />
              </div>
            } />
            <Route path="/security" element={<Navigate to="/firewall" replace />} />

            {/* Websites & Vhosts Route */}
            <Route path="/websites" element={
              <div className="space-y-6 max-w-[1400px] mx-auto">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Virtual Hosts Management</h1>
                  <p className="text-xs text-zinc-400 mt-0.5">Manage web root paths, SSL certificates, and server engines per domain.</p>
                </div>
                <WebsitesTable 
                  websites={websites} 
                  onRefresh={fetchWebsites} 
                  onSwitchEngine={handleSwitchEngine} 
                  onDeleteSite={handleDeleteSite} 
                  onOpenModal={() => setIsModalOpen(true)} 
                />
              </div>
            } />

            {/* 10 Ready Templates Route */}
            <Route path="/templates" element={
              <div className="max-w-[1400px] mx-auto">
                <TemplatesShowcase 
                  templates={templates} 
                  onSelectTemplate={(tpl) => {
                    handleTemplateSelect(tpl);
                    setIsModalOpen(true);
                  }} 
                />
              </div>
            } />

            {/* 404 Catch-all Error Page */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>

      {/* Add Website / Preset Modal */}
      <CreateSiteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        templates={templates} 
        formData={formData} 
        setFormData={setFormData} 
        onSubmit={handleCreateSite} 
        loading={loading} 
        onTemplateSelect={handleTemplateSelect} 
      />
    </div>
  );
}
