import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, Lock, Rocket, HardDrive } from 'lucide-react';
import { motion } from 'motion/react';
import AppShell from '../components/app/AppShell';
import AuthScreen from '../components/app/AuthScreen';
import AuthAside from '../components/app/AuthAside';
import { Skeleton } from '../components/ui/skeleton';
import { clientNav } from '../config/clientNav';
import { api, request } from '../lib/api';
import { showToast } from '../lib/toast';

const ClientDashboard = lazy(() => import('./components/ClientDashboard'));
const ClientWebsitesPage = lazy(() => import('./components/ClientWebsitesPage'));
const ClientDNSPage = lazy(() => import('./components/ClientDNSPage'));
const ClientDatabasesPage = lazy(() => import('./components/ClientDatabasesPage'));
const FileManagerV2 = lazy(() => import('../components/FileManagerV2'));
const ClientFTPPage = lazy(() => import('./components/ClientFTPPage'));
const ClientCronPage = lazy(() => import('./components/ClientCronPage'));
const ClientPHPPage = lazy(() => import('./components/ClientPHPPage'));
const ClientEmailsPage = lazy(() => import('./components/ClientEmailsPage'));
const ClientBackupsPage = lazy(() => import('./components/ClientBackupsPage'));

const TOKEN_KEYS = ['akpanel_client_token', 'ak_client_token'];
const USER_KEYS = ['akpanel_client_user', 'ak_client_user'];

function readToken() {
  try {
    return TOKEN_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) || '';
  } catch {
    return '';
  }
}

function readUser() {
  try {
    return JSON.parse(USER_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) || 'null');
  } catch {
    return null;
  }
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-64" />
    </div>
  );
}

function UsageMeter({ label, used, total, unit = 'MB' }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular">{used ?? 0} / {total ?? '∞'} {unit}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-sidebar-accent">
        <motion.div
          className={pct >= 90 ? 'h-full bg-destructive' : pct >= 75 ? 'h-full bg-warning' : 'h-full bg-primary'}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

// Legacy client pages call fetch() directly with their own headers; make sure every
// /api/client/ request carries the session and reacts to suspension.
function useLegacyClientFetch(onSignedOut) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith('/api/client/') && !url.includes('/api/client/auth/login')) {
        const token = readToken();
        const headers = new Headers(init.headers || {});
        if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        init = { ...init, headers };
      }
      const res = await originalFetch(input, init);
      if (url.startsWith('/api/client/') && res.status === 401 && !url.includes('/auth/login')) onSignedOut();
      if (res.status === 403) {
        try {
          const body = await res.clone().json();
          if (String(body?.message || '').toLowerCase().includes('suspend')) onSignedOut(body.message);
        } catch {
          /* not JSON */
        }
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [onSignedOut]);
}

export default function ClientApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(readUser);

  const signOutLocal = useCallback((message) => {
    [...TOKEN_KEYS, ...USER_KEYS].forEach((k) => localStorage.removeItem(k));
    qc.clear();
    setToken('');
    setUser(null);
    if (message) showToast(message, 'error');
  }, [qc]);

  useLegacyClientFetch(signOutLocal);

  useEffect(() => {
    const onUnauthorized = (e) => {
      const url = String(e.detail?.url || '');
      if (url.startsWith('/api/client/') && !url.includes('/auth/login')) signOutLocal();
    };
    window.addEventListener('akpanel:unauthorized', onUnauthorized);
    return () => window.removeEventListener('akpanel:unauthorized', onUnauthorized);
  }, [signOutLocal]);

  const statsQuery = useQuery({
    queryKey: ['client', 'stats'],
    queryFn: () => api.get('/api/client/stats').then((r) => r.data),
    enabled: !!token,
    refetchInterval: 30_000,
  });
  const stats = statsQuery.data;

  const handleLogout = async () => {
    try {
      await request('/api/client/auth/logout', { method: 'POST' });
    } catch {
      /* local sign-out still happens */
    }
    signOutLocal();
  };

  if (!token) {
    return (
      <AuthScreen
        title="Sign in to your hosting"
        subtitle="Manage websites, mail, databases and files."
        icon={Globe}
        usernameLabel="Account username"
        usernamePlaceholder="e.g. client1"
        onSubmit={async ({ username, password }) => {
          const data = await api.post('/api/client/auth/login', { username, password });
          TOKEN_KEYS.forEach((k) => localStorage.setItem(k, data.token));
          USER_KEYS.forEach((k) => localStorage.setItem(k, JSON.stringify(data.user)));
          setUser(data.user);
          setToken(data.token);
        }}
        footer={
          <p className="text-center text-xs text-muted-foreground">
            Server administrators sign in on port <span className="font-mono">2087</span>.
          </p>
        }
        aside={
          <AuthAside
            heading="Your sites, your space"
            points={[
              { icon: Lock, title: 'Private by design', text: 'Your files, PHP and cron jobs run under your own isolated account.' },
              { icon: Rocket, title: 'Deploy in minutes', text: 'Domains, SSL, databases and mailboxes from one place.' },
              { icon: HardDrive, title: 'Know your limits', text: 'Disk, bandwidth and quotas are always visible.' },
            ]}
          />
        }
      />
    );
  }

  const username = user?.username || stats?.username || 'user';
  const isFileManager = ['/files', '/filemanager', '/filemanager/standalone'].includes(location.pathname);
  const fileManager = (
    <FileManagerV2
      showToast={showToast}
      standalone
      apiBase="/api/client/files"
      jailRoot={`/home/${username}`}
      dashboardHref="/"
    />
  );

  if (location.pathname === '/filemanager/standalone') {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <Suspense fallback={<PageFallback />}>{fileManager}</Suspense>
      </div>
    );
  }

  return (
    <AppShell
      nav={clientNav}
      brand={{ name: stats?.main_domain || 'My hosting', subtitle: stats?.package_name || 'Client portal', icon: Globe }}
      user={{ name: username, detail: user?.email || stats?.email || 'Hosting account' }}
      badges={{
        '/websites': stats?.domains_used || undefined,
        '/databases': stats?.databases_used || undefined,
        '/emails': stats?.emails_used || undefined,
      }}
      onLogout={handleLogout}
      fullBleed={isFileManager}
      sidebarFooter={
        stats && (
          <div className="space-y-2 rounded-md border border-sidebar-border p-2.5 group-data-[collapsible=icon]:hidden">
            <UsageMeter label="Disk" used={stats.disk_used_mb} total={stats.disk_quota_mb} />
            <UsageMeter label="Bandwidth" used={stats.bandwidth_used_mb} total={stats.bandwidth_limit_mb} />
          </div>
        )
      }
    >
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route path="/" element={<ClientDashboard stats={stats} showToast={showToast} />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/websites" element={<ClientWebsitesPage showToast={showToast} onNavigateFiles={() => navigate('/files')} />} />
          <Route path="/dns" element={<ClientDNSPage showToast={showToast} />} />
          <Route path="/databases" element={<ClientDatabasesPage showToast={showToast} username={username} />} />
          <Route path="/files" element={fileManager} />
          <Route path="/filemanager" element={fileManager} />
          <Route path="/ftp" element={<ClientFTPPage showToast={showToast} username={username} serverIP={stats?.server_ip} />} />
          <Route path="/emails" element={<ClientEmailsPage showToast={showToast} />} />
          <Route path="/cron" element={<ClientCronPage showToast={showToast} username={username} />} />
          <Route path="/php" element={<ClientPHPPage showToast={showToast} username={username} serverIP={stats?.server_ip} />} />
          <Route path="/backups" element={<ClientBackupsPage showToast={showToast} stats={stats} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
