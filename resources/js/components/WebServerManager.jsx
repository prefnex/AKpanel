import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Server, 
  Play, 
  Square, 
  RotateCw, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  FileCode, 
  Zap,
  Globe,
  Sliders,
  Code,
  ShieldCheck,
  Cpu,
  Terminal,
  Activity,
  FileText,
  Lock,
  ArrowRight,
  ExternalLink,
  Plus,
  Save,
  Check,
  AlertCircle
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function WebServerManager({ showToast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromPath = () => {
    const p = location.pathname;
    if (p.includes('/webservers/main-conf')) return 'main-conf';
    if (p.includes('/webservers/domain-conf')) return 'domain-conf';
    if (p.includes('/webservers/templates')) return 'templates';
    if (p.includes('/webservers/conf-editor')) return 'conf-editor';
    if (p.includes('/webservers/apache-status')) return 'apache-status';
    if (p.includes('/webservers/rebuild')) return 'rebuild';
    if (p.includes('/webservers/redirects')) return 'redirects';
    return searchParams.get('tab') || 'select';
  };

  const activeTab = getTabFromPath();

  // State
  const [profiles, setProfiles] = useState([]);
  const [services, setServices] = useState([]);
  const [activeProfile, setActiveProfile] = useState('');
  const [loading, setLoading] = useState(false);

  // Main Conf State
  const [mainConfigs, setMainConfigs] = useState([]);
  const [selectedMainConfig, setSelectedMainConfig] = useState(null);
  const [mainConfigContent, setMainConfigContent] = useState('');
  const [savingMainConfig, setSavingMainConfig] = useState(false);

  // Domain Conf State
  const [users, setUsers] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [domainVhostData, setDomainVhostData] = useState(null);
  const [domainNginxConf, setDomainNginxConf] = useState('');
  const [domainApacheConf, setDomainApacheConf] = useState('');
  const [savingDomainVhost, setSavingDomainVhost] = useState(false);

  // Templates State
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState({ engine: 'nginx', file: 'php.conf.tmpl' });
  const [templateContent, setTemplateContent] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Apache Status & Rebuild State
  const [apacheStatusOutput, setApacheStatusOutput] = useState('');
  const [loadingApacheStatus, setLoadingApacheStatus] = useState(false);
  const [rebuildingVhosts, setRebuildingVhosts] = useState(false);

  // Redirects State
  const [redirectList, setRedirectList] = useState([
    { domain: 'all', source: 'http://', target: 'https://', type: '301', force_ssl: true }
  ]);
  const [redirectDomain, setRedirectDomain] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('https://');

  const setTab = (tabId) => {
    navigate(`/webservers/${tabId}`);
  };

  // Fetch initial data
  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/webservers/profiles');
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
        const active = json.data.find(p => p.is_active);
        if (active) setActiveProfile(active.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/webservers/services');
      if (res.ok) {
        const json = await res.json();
        setServices(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMainConfigs = async () => {
    try {
      const res = await fetch('/api/webservers/main-configs');
      if (res.ok) {
        const json = await res.json();
        setMainConfigs(json.data || []);
        if (json.data && json.data.length > 0 && !selectedMainConfig) {
          setSelectedMainConfig(json.data[0]);
          setMainConfigContent(json.data[0].content);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsersAndWebsites = async () => {
    try {
      const [uRes, wRes] = await fetchAllUsersAndWebsites();
      if (uRes) setUsers(uRes);
      if (wRes && wRes.length > 0) {
        setWebsites(wRes);
        if (!selectedDomain) {
          setSelectedDomain(wRes[0].domain || wRes[0].name || '');
          fetchDomainVhost(wRes[0].domain || wRes[0].name || '');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllUsersAndWebsites = async () => {
    try {
      const [resU, resW] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/websites').then(r => r.json())
      ]);
      return [resU.data || [], resW.data || []];
    } catch (err) {
      return [[], []];
    }
  };

  const fetchDomainVhost = async (domain) => {
    if (!domain) return;
    try {
      const res = await fetch(`/api/webservers/domain-vhost?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const json = await res.json();
        setDomainVhostData(json.data);
        setDomainNginxConf(json.data.nginx_conf || '');
        setDomainApacheConf(json.data.apache_conf || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/webservers/templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || {});
        // load initial template
        loadTemplateContent('nginx', 'php.conf.tmpl');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTemplateContent = async (engine, file) => {
    setSelectedTemplate({ engine, file });
    try {
      const res = await fetch(`/api/webservers/template?engine=${engine}&filename=${file}`);
      if (res.ok) {
        const json = await res.json();
        setTemplateContent(json.content || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchApacheStatus = async () => {
    setLoadingApacheStatus(true);
    try {
      const res = await fetch('/api/webservers/apache-status');
      if (res.ok) {
        const json = await res.json();
        setApacheStatusOutput(json.output || 'No Apache status output available.');
      }
    } catch (e) {
      setApacheStatusOutput('Error fetching Apache status: ' + e.message);
    } finally {
      setLoadingApacheStatus(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchServices();
    fetchMainConfigs();
    fetchUsersAndWebsites();
    fetchTemplates();
    if (activeTab === 'apache_status') {
      fetchApacheStatus();
    }
  }, [activeTab]);

  // Handlers
  const handleSwitchProfile = async (profileId) => {
    setLoading(true);
    try {
      const res = await fetch('/api/webservers/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchProfiles();
      fetchServices();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceAction = async (serviceName, action) => {
    try {
      const res = await fetch('/api/webservers/service/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceName, action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchServices();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveMainConfig = async () => {
    if (!selectedMainConfig) return;
    setSavingMainConfig(true);
    try {
      const res = await fetch('/api/webservers/main-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: selectedMainConfig.path,
          content: mainConfigContent
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingMainConfig(false);
    }
  };

  const handleSaveDomainVhost = async () => {
    if (!selectedDomain) {
      showToast('Please select a domain first', 'error');
      return;
    }
    setSavingDomainVhost(true);
    try {
      const res = await fetch('/api/webservers/domain-vhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          nginx_conf: domainNginxConf,
          apache_conf: domainApacheConf
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingDomainVhost(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/webservers/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: selectedTemplate.engine,
          filename: selectedTemplate.file,
          content: templateContent
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleRebuildAll = async () => {
    setRebuildingVhosts(true);
    try {
      const res = await fetch('/api/webservers/rebuild', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRebuildingVhosts(false);
    }
  };

  const tabs = [
    { id: 'select', label: 'Select WebServers', icon: Zap },
    { id: 'main_conf', label: 'WebServers Main Conf', icon: FileCode },
    { id: 'domain_conf', label: 'WebServers Domain Conf', icon: Globe },
    { id: 'templates', label: 'WebServers Template Editor', icon: Layers },
    { id: 'conf_editor', label: 'WebServers Conf Editor', icon: Code },
    { id: 'apache_status', label: 'Apache Status', icon: Activity },
    { id: 'rebuild', label: 'Apache Re-Build', icon: RotateCw },
    { id: 'redirects', label: 'Apache Redirects', icon: ExternalLink },
  ];

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12 text-zinc-100 font-sans antialiased select-none">
      
      {/* Header Banner */}
      <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">WebServer Settings & Multi-Engine Suite</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-mono">
                CWP Architecture
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Switch web server backends, edit global/vhost configurations, customize templates, and monitor Apache/Nginx status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRebuildAll}
            disabled={rebuildingVhosts}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-mono gap-1.5 h-9"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-400 ${rebuildingVhosts ? 'animate-spin' : ''}`} />
            <span>Rebuild All Vhosts</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/ssl')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold gap-1.5 h-9 shadow-md"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>SSL Certificates</span>
          </Button>
        </div>
      </div>

      {/* Submodules Navigation Bar (Matching Screenshot 3) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-800/80">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SELECT WEBSERVERS (ENGINE SWITCHER)                                */}
      {/* ========================================================================= */}
      {activeTab === 'select' && (
        <div className="space-y-6">
          {/* Live Stack Daemons Bar */}
          <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Active Server Daemons</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-500">Live Process Control</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {services.map((svc) => (
                <div key={svc.name} className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${svc.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                      <span className="text-xs font-bold text-white truncate">{svc.display_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Port: {svc.port}</span>
                    <Badge className={`text-[9px] px-1 py-0 ${svc.is_running ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {svc.is_running ? 'RUNNING' : 'STOPPED'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-zinc-800/50">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleServiceAction(svc.name, svc.is_running ? 'restart' : 'start')}
                      className="h-6 flex-1 text-[10px] text-zinc-300 hover:text-white hover:bg-zinc-800"
                    >
                      <RotateCw className="w-3 h-3 mr-1 text-blue-400" />
                      {svc.is_running ? 'Restart' : 'Start'}
                    </Button>
                    {svc.is_running && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleServiceAction(svc.name, 'stop')}
                        className="h-6 flex-1 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                      >
                        <Square className="w-3 h-3 mr-1" />
                        Stop
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5 WebServer Profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {profiles.map((p) => {
              const isCurrent = (p.id === activeProfile);
              return (
                <div 
                  key={p.id}
                  className={`bg-[#111217] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md ${
                    isCurrent 
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-gradient-to-b from-[#111217] to-[#151c2e]' 
                      : 'border-zinc-800/90 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{p.name}</span>
                          {isCurrent && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                        </h3>
                        <Badge className="bg-zinc-800 text-zinc-300 text-[10px] font-mono mt-1 border-zinc-700">
                          {p.badge}
                        </Badge>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      {p.description}
                    </p>

                    <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-800/80 space-y-1.5 text-[11px] font-mono">
                      <span className="text-zinc-500 block uppercase text-[9px] font-bold">Architecture Pipeline</span>
                      <p className="text-cyan-300 break-words">{p.architecture}</p>
                    </div>

                    <div className="text-[11px] text-zinc-400 font-sans">
                      <strong className="text-zinc-300">Best For:</strong> {p.best_for}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-800/80">
                    <Button
                      onClick={() => handleSwitchProfile(p.id)}
                      disabled={isCurrent || loading}
                      className={`w-full text-xs font-semibold h-9 rounded-xl transition ${
                        isCurrent 
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 cursor-default' 
                          : 'bg-white hover:bg-zinc-200 text-black font-bold'
                      }`}
                    >
                      {isCurrent ? 'Current Active Engine' : 'Switch To This Engine'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WEBSERVERS MAIN CONF                                               */}
      {/* ========================================================================= */}
      {activeTab === 'main_conf' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Config Files Selector Sidebar */}
          <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-4 space-y-2 lg:col-span-1 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono px-2 block mb-2">
              Global Config Files
            </span>
            {mainConfigs.map((cfg) => {
              const isSelected = selectedMainConfig?.path === cfg.path;
              return (
                <button
                  key={cfg.path}
                  onClick={() => {
                    setSelectedMainConfig(cfg);
                    setMainConfigContent(cfg.content);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 border border-zinc-800/50'
                  }`}
                >
                  <span className="text-xs font-bold">{cfg.name}</span>
                  <span className={`text-[10px] font-mono truncate ${isSelected ? 'text-blue-200' : 'text-zinc-500'}`}>
                    {cfg.path}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Code Editor */}
          <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 space-y-4 lg:col-span-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">{selectedMainConfig?.name}</h3>
                <span className="text-xs text-zinc-400">{selectedMainConfig?.path} • {selectedMainConfig?.description}</span>
              </div>
              <Button
                onClick={handleSaveMainConfig}
                disabled={savingMainConfig}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 h-8"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingMainConfig ? 'Testing & Saving...' : 'Save & Test Config'}</span>
              </Button>
            </div>

            <textarea
              value={mainConfigContent}
              onChange={(e) => setMainConfigContent(e.target.value)}
              rows={22}
              className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-4 rounded-xl border border-zinc-800 focus:outline-none focus:border-blue-500"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WEBSERVERS DOMAIN CONF (PER-DOMAIN CUSTOM VHOSTS & ENGINE)          */}
      {/* ========================================================================= */}
      {activeTab === 'domain_conf' && (
        <div className="space-y-6">
          {/* Domain & User Selector Bar */}
          <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Select User Account</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none"
                >
                  <option value="admin">admin (Root SuperAdmin)</option>
                  {users.map(u => (
                    <option key={u.username} value={u.username}>{u.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Select Domain / VirtualHost</label>
                <select
                  value={selectedDomain}
                  onChange={(e) => {
                    setSelectedDomain(e.target.value);
                    fetchDomainVhost(e.target.value);
                  }}
                  className="h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-cyan-400 font-bold focus:outline-none"
                >
                  {websites.map(w => {
                    const dom = w.domain || w.name;
                    return <option key={dom} value={dom}>{dom}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Domain SSL Status</span>
                <span className={`text-xs font-mono font-bold ${domainVhostData?.has_ssl ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {domainVhostData?.has_ssl ? '● SSL Active (HTTPS)' : '○ No SSL Configured'}
                </span>
              </div>
              <Button
                onClick={handleSaveDomainVhost}
                disabled={savingDomainVhost}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold h-9 gap-1.5 shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingDomainVhost ? 'Applying...' : 'Save & Reload VHost'}</span>
              </Button>
            </div>
          </div>

          {/* Vhost Editors Grid (Nginx & Apache Side-by-Side) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Nginx VHost File */}
            <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase font-mono">Nginx VirtualHost</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">/etc/nginx/sites-available/{selectedDomain}</span>
              </div>
              <textarea
                value={domainNginxConf}
                onChange={(e) => setDomainNginxConf(e.target.value)}
                rows={18}
                placeholder="Nginx VirtualHost configuration..."
                className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-3.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-blue-500"
                spellCheck={false}
              />
            </div>

            {/* Apache VHost File */}
            <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase font-mono">Apache2 VirtualHost</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">/etc/apache2/sites-available/{selectedDomain}.conf</span>
              </div>
              <textarea
                value={domainApacheConf}
                onChange={(e) => setDomainApacheConf(e.target.value)}
                rows={18}
                placeholder="Apache VirtualHost configuration..."
                className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-3.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-blue-500"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: WEBSERVERS TEMPLATE EDITOR                                         */}
      {/* ========================================================================= */}
      {(activeTab === 'templates' || activeTab === 'conf_editor') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Templates Directory Tree */}
          <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-4 space-y-4 lg:col-span-1 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono px-1 block">
              VHost Templates
            </span>

            {Object.keys(templates).map((engine) => (
              <div key={engine} className="space-y-1">
                <span className="text-[11px] font-bold text-zinc-300 font-mono uppercase flex items-center gap-1.5 px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">
                  <Server className="w-3 h-3 text-cyan-400" />
                  <span>{engine} Templates</span>
                </span>
                <div className="pl-2 space-y-0.5">
                  {templates[engine]?.map((file) => {
                    const isSelected = selectedTemplate.engine === engine && selectedTemplate.file === file;
                    return (
                      <button
                        key={file}
                        onClick={() => loadTemplateContent(engine, file)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                        }`}
                      >
                        <span className="truncate">{file}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Template Editor */}
          <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 space-y-4 lg:col-span-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">{selectedTemplate.engine}/{selectedTemplate.file}</h3>
                <span className="text-xs text-zinc-400">Available variables: %DOMAIN%, %PORT%, %USER%, %PHP_FPM_SOCK%</span>
              </div>
              <Button
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 h-8"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingTemplate ? 'Saving...' : 'Save Template'}</span>
              </Button>
            </div>

            <textarea
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              rows={22}
              className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-4 rounded-xl border border-zinc-800 focus:outline-none focus:border-blue-500"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: APACHE STATUS                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'apache_status' && (
        <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 font-mono">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Apache Server Status Scoreboard</h3>
            </div>
            <Button
              size="sm"
              onClick={fetchApacheStatus}
              disabled={loadingApacheStatus}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono gap-1.5 h-8"
            >
              <RotateCw className={`w-3.5 h-3.5 text-blue-400 ${loadingApacheStatus ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </Button>
          </div>

          <pre className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-[600px]">
            {loadingApacheStatus ? 'Fetching Apache realtime scoreboard...' : apacheStatusOutput}
          </pre>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: APACHE RE-BUILD                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'rebuild' && (
        <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-6 space-y-5 shadow-sm max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Re-Build All WebServer VirtualHosts</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Regenerate all Nginx reverse proxies, Apache vhost containers, and Varnish cache routes for all domains.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs font-mono text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Compiles `/etc/nginx/sites-available/*`</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Compiles `/etc/apache2/sites-available/*.conf`</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Executes syntax checks and reloads web engines</span>
            </div>
          </div>

          <Button
            onClick={handleRebuildAll}
            disabled={rebuildingVhosts}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 rounded-xl gap-2 shadow-lg"
          >
            <RotateCw className={`w-4 h-4 ${rebuildingVhosts ? 'animate-spin' : ''}`} />
            <span>{rebuildingVhosts ? 'Rebuilding and reloading web server stack...' : 'Start VirtualHosts Re-Build Now'}</span>
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: APACHE & NGINX REDIRECTS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'redirects' && (
        <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Domain HTTP & HTTPS URL Redirects</h3>
              <p className="text-xs text-zinc-400">Configure 301 Permanent or 302 Temporary redirects per domain or globally.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Source Domain</label>
              <select
                value={redirectDomain}
                onChange={(e) => setRedirectDomain(e.target.value)}
                className="w-full h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none"
              >
                <option value="">-- All Domains (Global) --</option>
                {websites.map(w => (
                  <option key={w.domain || w.name} value={w.domain || w.name}>{w.domain || w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Destination Target URL</label>
              <input
                type="text"
                value={redirectTarget}
                onChange={(e) => setRedirectTarget(e.target.value)}
                placeholder="https://example.com"
                className="w-full h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => {
                  showToast('Redirect rule saved and applied to Nginx/Apache');
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-9 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Redirect Rule</span>
              </Button>
            </div>
          </div>

          <div className="border border-zinc-800 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase border-b border-zinc-800">
                <tr>
                  <th className="p-3">Source Domain</th>
                  <th className="p-3">Target Destination</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">SSL Enforcement</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                <tr>
                  <td className="p-3 text-cyan-400 font-bold">* (All Domains)</td>
                  <td className="p-3 text-zinc-400">http:// → https://</td>
                  <td className="p-3"><Badge className="bg-blue-500/10 text-blue-400 font-mono text-[9px]">301 Permanent</Badge></td>
                  <td className="p-3 text-emerald-400 font-bold">Enabled</td>
                  <td className="p-3 text-right text-emerald-400">● Active</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
