import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Command, Globe, Loader2, Plus, ShieldCheck, Gauge, Layers } from 'lucide-react';
import AppShell from './components/app/AppShell';
import AuthScreen from './components/app/AuthScreen';
import AuthAside from './components/app/AuthAside';
import ChangePasswordDialog from './components/app/ChangePasswordDialog';
import { Button } from './components/ui/button';
import { Skeleton } from './components/ui/skeleton';
import { adminNav } from './config/adminNav';
import { api, request } from './lib/api';
import { showToast } from './lib/toast';

const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const WebServerManager = lazy(() => import('./components/WebServerManager'));
const WebServerModesPage = lazy(() => import('./pages/admin/webservers/WebServerModesPage'));
const DomainConfigPage = lazy(() => import('./pages/admin/webservers/DomainConfigPage'));
const VhostTemplatesPage = lazy(() => import('./pages/admin/webservers/TemplatesPage'));
const MainConfPage = lazy(() => import('./pages/admin/webservers/MainConfPage'));
const ConfEditorPage = lazy(() => import('./pages/admin/webservers/ConfEditorPage'));
const RedirectsPage = lazy(() => import('./pages/admin/webservers/RedirectsPage'));
const WebServerStatusPage = lazy(() => import('./pages/admin/webservers/WebServerStatusPage'));
const PHPLayout = lazy(() => import('./components/php/PHPLayout'));
const PHPCLIPage = lazy(() => import('./components/php/PHPCLIPage'));
const PHPFPMPage = lazy(() => import('./components/php/PHPFPMPage'));
const PHPDefaultPage = lazy(() => import('./components/php/PHPDefaultPage'));
const PHPShortInfoPage = lazy(() => import('./components/php/PHPShortInfoPage'));
const PHPInfoPage = lazy(() => import('./components/php/PHPInfoPage'));
const PHPExtensionsPage = lazy(() => import('./components/php/PHPExtensionsPage'));
const PHPAddonsPage = lazy(() => import('./components/php/PHPAddonsPage'));
const PHPIniPage = lazy(() => import('./components/php/PHPIniPage'));
const PHPIniRawPage = lazy(() => import('./components/php/PHPIniRawPage'));
const PHPInstallPage = lazy(() => import('./components/php/PHPInstallPage'));
const WebsitesPage = lazy(() => import('./pages/admin/websites/WebsitesPage'));
const SubdomainsPage = lazy(() => import('./pages/admin/websites/SubdomainsPage'));
const CreateWebsiteSheet = lazy(() => import('./pages/admin/websites/CreateWebsiteSheet'));
const TemplatesShowcase = lazy(() => import('./components/TemplatesShowcase'));
const DatabasesManager = lazy(() => import('./components/DatabasesManager'));
const FileManager = lazy(() => import('./components/FileManager'));
const FileManagerV2 = lazy(() => import('./components/FileManagerV2'));
const WebTerminal = lazy(() => import('./components/WebTerminal'));
const PackagesManager = lazy(() => import('./components/PackagesManager'));
const UsersManager = lazy(() => import('./components/UsersManager'));
const DNSZonesPage = lazy(() => import('./components/dns/DNSZonesPage'));
const BindServerPage = lazy(() => import('./components/dns/BindServerPage'));
const NameserversPage = lazy(() => import('./components/dns/NameserversPage'));
const ZoneTemplatePage = lazy(() => import('./components/dns/ZoneTemplatePage'));
const DNSClusterPage = lazy(() => import('./components/dns/DNSClusterPage'));
const DNSSECPage = lazy(() => import('./components/dns/DNSSECPage'));
const EmailManager = lazy(() => import('./components/EmailManager'));
const IPManager = lazy(() => import('./components/IPManager'));
const ServerSettingsManager = lazy(() => import('./components/ServerSettingsManager'));
const SSLManager = lazy(() => import('./components/SSLManager'));
const FirewallManager = lazy(() => import('./components/FirewallManager'));
const NotFoundPage = lazy(() => import('./components/NotFoundPage'));

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

// Legacy pages call fetch() directly; attach the admin token and surface expired sessions.
function useLegacyFetchAuth(onUnauthorized) {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (resource, config = {}) => {
      const url = typeof resource === 'string' ? resource : resource?.url || '';
      const token = localStorage.getItem('ak_token');
      if (token && url.startsWith('/') && !url.startsWith('/api/client/')) {
        const headers = new Headers(config.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        config = { ...config, headers };
      }
      const response = await originalFetch(resource, config);
      if (response.status === 401 && url.startsWith('/api/') && !url.includes('/api/auth/login')) {
        onUnauthorized();
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [onUnauthorized]);
}

export default function App() {
  const location = useLocation();
  const qc = useQueryClient();
  const isStandaloneFileManager = ['/filemanager/standalone', '/filemanager/v2', '/explorer'].includes(location.pathname);

  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('ak_token'));
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState({ username: 'root', role: 'root_admin' });
  const [createSite, setCreateSite] = useState({ open: false, template: null });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const openCreateSite = (template = null) => setCreateSite({ open: true, template });

  const signOutLocal = useCallback(() => {
    localStorage.removeItem('ak_token');
    localStorage.removeItem('ak_user');
    qc.clear();
    setIsAuthenticated(false);
  }, [qc]);

  useLegacyFetchAuth(signOutLocal);

  useEffect(() => {
    const onUnauthorized = (e) => {
      if (!String(e.detail?.url || '').includes('/api/auth/login')) signOutLocal();
    };
    window.addEventListener('akpanel:unauthorized', onUnauthorized);
    return () => window.removeEventListener('akpanel:unauthorized', onUnauthorized);
  }, [signOutLocal]);

  useEffect(() => {
    api.get('/api/auth/me')
      .then((json) => {
        setCurrentUser(json.user);
        setIsAuthenticated(true);
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsCheckingAuth(false));
  }, []);

  const websites = useQuery({
    queryKey: ['websites'],
    queryFn: () => api.get('/api/websites').then((r) => r.data || []),
    enabled: isAuthenticated,
  });
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/api/templates').then((r) => r.data || []),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  const handleLogout = async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared regardless */
    }
    signOutLocal();
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        title="Sign in to AKpanel"
        subtitle="Server administration console"
        icon={Command}
        defaultUsername="root"
        onSubmit={async ({ username, password }) => {
          const json = await api.post('/api/auth/login', { username, password });
          if (json.token) localStorage.setItem('ak_token', json.token);
          if (json.user) localStorage.setItem('ak_user', JSON.stringify(json.user));
          setCurrentUser(json.user);
          setIsAuthenticated(true);
        }}
        footer={
          <p className="text-center text-xs text-muted-foreground">
            Hosting customers sign in on port <span className="font-mono">2083</span>.
          </p>
        }
        aside={
          <AuthAside
            heading="One console for the whole stack"
            points={[
              { icon: Layers, title: 'Five web server profiles', text: 'Nginx, Apache, Varnish and PHP-FPM, switched with a vhost rebuild.' },
              { icon: ShieldCheck, title: 'Isolated accounts', text: 'Every tenant runs under its own Linux user, PHP pool and jail.' },
              { icon: Gauge, title: 'Live telemetry', text: 'CPU, memory, services and mail queues at a glance.' },
            ]}
          />
        }
      />
    );
  }

  if (isStandaloneFileManager) {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <Suspense fallback={<PageFallback />}>
          <FileManagerV2 showToast={showToast} standalone />
        </Suspense>
      </div>
    );
  }

  const sites = websites.data || [];
  const legacy = (node) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

  return (
    <AppShell
      nav={adminNav}
      brand={{ name: 'AKpanel', subtitle: 'Server administration', icon: Command }}
      user={{ name: currentUser?.username || 'root', detail: 'Root administrator' }}
      badges={{ '/websites': sites.length || undefined }}
      onLogout={handleLogout}
      onChangePassword={() => setPasswordOpen(true)}
      headerActions={
        <Button size="sm" className="hidden md:inline-flex" onClick={() => openCreateSite()}>
          <Plus />Website
        </Button>
      }
    >
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route path="/" element={<DashboardPage websitesCount={sites.length} />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          <Route path="/dns" element={<Navigate to="/dns/zones" replace />} />
          <Route path="/dns/zones" element={legacy(<DNSZonesPage showToast={showToast} />)} />
          <Route path="/dns/server" element={legacy(<BindServerPage showToast={showToast} />)} />
          <Route path="/dns/nameservers" element={legacy(<NameserversPage showToast={showToast} />)} />
          <Route path="/dns/templates" element={legacy(<ZoneTemplatePage showToast={showToast} />)} />
          <Route path="/dns/cluster" element={legacy(<DNSClusterPage showToast={showToast} />)} />
          <Route path="/dns/security" element={legacy(<DNSSECPage showToast={showToast} />)} />
          <Route path="/dns/sync" element={legacy(<DNSClusterPage showToast={showToast} />)} />

          <Route path="/emails" element={legacy(<EmailManager showToast={showToast} />)} />
          <Route path="/emails/*" element={legacy(<EmailManager showToast={showToast} />)} />

          <Route path="/ips" element={legacy(<IPManager showToast={showToast} />)} />
          <Route path="/settings" element={<Navigate to="/settings/server" replace />} />
          <Route path="/settings/server" element={legacy(<ServerSettingsManager showToast={showToast} />)} />
          <Route path="/ssl" element={legacy(<SSLManager showToast={showToast} />)} />

          <Route path="/users" element={legacy(<UsersManager showToast={showToast} />)} />
          <Route path="/packages" element={legacy(<PackagesManager showToast={showToast} />)} />

          <Route path="/webservers" element={<Navigate to="/webservers/select" replace />} />
          <Route path="/webservers/select" element={<WebServerModesPage />} />
          <Route path="/webservers/domain-conf" element={<DomainConfigPage />} />
          <Route path="/webservers/templates" element={<VhostTemplatesPage />} />
          <Route path="/webservers/main-conf" element={<MainConfPage />} />
          <Route path="/webservers/rebuild" element={<Navigate to="/webservers/main-conf" replace />} />
          {/* Old addresses whose job moved to the new pages above. */}
          <Route path="/webservers/mode" element={<Navigate to="/webservers/select" replace />} />
          <Route path="/webservers/profile" element={<Navigate to="/webservers/select" replace />} />
          <Route path="/webservers/conf-editor" element={<ConfEditorPage />} />
          <Route path="/webservers/redirects" element={<RedirectsPage />} />
          <Route path="/webservers/status" element={<WebServerStatusPage />} />
          <Route path="/webservers/apache-status" element={<Navigate to="/webservers/status" replace />} />
          <Route path="/webservers/*" element={legacy(<WebServerManager showToast={showToast} />)} />

          <Route path="/php" element={legacy(<PHPLayout showToast={showToast} />)}>
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

          <Route path="/databases" element={legacy(<DatabasesManager defaultEngine="all" showToast={showToast} />)} />
          <Route path="/databases/mysql" element={legacy(<DatabasesManager defaultEngine="mysql" showToast={showToast} />)} />
          <Route path="/databases/postgres" element={legacy(<DatabasesManager defaultEngine="postgres" showToast={showToast} />)} />
          <Route path="/databases/mongodb" element={legacy(<DatabasesManager defaultEngine="mongodb" showToast={showToast} />)} />
          <Route path="/databases/redis" element={legacy(<DatabasesManager defaultEngine="redis" showToast={showToast} />)} />

          <Route path="/filemanager" element={legacy(<FileManager showToast={showToast} />)} />
          <Route path="/terminal" element={legacy(<WebTerminal showToast={showToast} />)} />
          <Route path="/firewall" element={legacy(<FirewallManager showToast={showToast} />)} />
          <Route path="/security" element={<Navigate to="/firewall" replace />} />

          <Route path="/websites" element={<WebsitesPage onCreate={openCreateSite} />} />
          <Route path="/subdomains" element={<SubdomainsPage />} />
          <Route path="/templates" element={legacy(
            <TemplatesShowcase
              templates={templates.data || []}
              onSelectTemplate={(tpl) => openCreateSite(tpl.id)}
            />
          )} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <Suspense fallback={null}>
        <CreateWebsiteSheet
          open={createSite.open}
          presetTemplate={createSite.template}
          onOpenChange={(open) => setCreateSite((v) => ({ ...v, open }))}
        />
      </Suspense>
    </AppShell>
  );
}
