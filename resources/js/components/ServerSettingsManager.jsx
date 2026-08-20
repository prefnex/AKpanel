import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Server, 
  ShieldCheck, 
  Lock, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Globe, 
  Clock, 
  Mail, 
  Cpu, 
  HardDrive, 
  Zap,
  Save,
  Radio,
  ExternalLink,
  Upload,
  Key,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export default function ServerSettingsManager({ showToast }) {
  const [settings, setSettings] = useState({
    hostname: '',
    admin_email: '',
    panel_port: 2087,
    client_port: 2083,
    primary_ns: '',
    secondary_ns: '',
    shared_ip: '',
    ip_stack_mode: 'dual', // 'ipv4_only' | 'dual'
    timezone: 'UTC',
    language: 'en',
    auto_renew_ssl: true,
    force_https: false,
    session_timeout_mins: 60
  });

  const [availableIps, setAvailableIps] = useState([]);
  const [hostnameSSL, setHostnameSSL] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslTaskId, setSslTaskId] = useState(localStorage.getItem('akpanel_hostname_ssl_task') || '');
  const [sslLogs, setSslLogs] = useState([]);
  const [sslProgress, setSslProgress] = useState(0);
  const [sslStep, setSslStep] = useState('');
  const [sslStatus, setSslStatus] = useState('idle'); // idle | running | completed | failed
  const [sslError, setSslError] = useState('');
  const [syncNsLoading, setSyncNsLoading] = useState(false);
  const [customSslModal, setCustomSslModal] = useState(false);
  const [customCert, setCustomCert] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customSslLoading, setCustomSslLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchIps();
  }, []);

  useEffect(() => {
    if (!sslTaskId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/settings/hostname-ssl/status?task_id=${sslTaskId}`);
        if (!res.ok) return;
        const json = await res.json();
        const task = json.data;
        if (!task || cancelled) return;
        setSslLogs(task.logs || []);
        setSslProgress(task.progress || 0);
        setSslStep(task.current_step || '');
        if (task.status === 'completed') {
          setSslLoading(false);
          setSslStatus('completed');
          setSslError('');
          localStorage.removeItem('akpanel_hostname_ssl_task');
          setSslTaskId('');
          showToast('Hostname SSL configured successfully');
          fetchSettings();
        } else if (task.status === 'failed') {
          setSslLoading(false);
          setSslStatus('failed');
          setSslError(task.error || 'SSL issuance failed');
          localStorage.removeItem('akpanel_hostname_ssl_task');
          showToast((task.error || 'SSL issuance failed').split('\n')[0], 'error');
        } else if (task.status === 'running') {
          setSslStatus('running');
        }
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sslTaskId]);

  useEffect(() => {
    const recover = async () => {
      const storedId = sslTaskId || localStorage.getItem('akpanel_hostname_ssl_task');
      if (!storedId) return;
      try {
        const res = await fetch(`/api/settings/hostname-ssl/status?task_id=${storedId}`);
        if (!res.ok) return;
        const json = await res.json();
        const task = json.data;
        if (!task) return;
        setSslLogs(task.logs || []);
        setSslProgress(task.progress || 0);
        setSslStep(task.current_step || '');
        if (task.status === 'running') {
          setSslTaskId(storedId);
          setSslLoading(true);
          setSslStatus('running');
        } else if (task.status === 'failed') {
          setSslStatus('failed');
          setSslError(task.error || 'SSL issuance failed');
        }
      } catch (e) {
        console.error(e);
      }
    };
    recover();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/server');
      const json = await res.json();
      if (json.status === 'success') {
        setSettings(json.data || {});
        setHostnameSSL(json.hostname_ssl || null);
      }
    } catch (err) {
      showToast('Failed to load server settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchIps = async () => {
    try {
      const res = await fetch('/api/ips');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setAvailableIps(list);
        if (list.length > 0 && !settings.shared_ip) {
          const main = list.find(x => x.is_main) || list[0];
          setSettings(prev => ({ ...prev, shared_ip: main.ip }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast('Server settings updated successfully');
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNameservers = async () => {
    setSyncNsLoading(true);
    try {
      const res = await fetch('/api/dns/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_ns: settings.primary_ns,
          secondary_ns: settings.secondary_ns,
          primary_ip: settings.shared_ip,
          secondary_ip: settings.shared_ip
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast('Nameservers synced to BIND 9 cluster successfully');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSyncNsLoading(false);
    }
  };

  const handleIssueHostnameSSL = async () => {
    setSslLoading(true);
    setSslStatus('running');
    setSslError('');
    setSslLogs([]);
    setSslProgress(0);
    setSslStep('');
    try {
      const res = await fetch('/api/settings/hostname-ssl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: settings.admin_email })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (json.task_id) {
        setSslTaskId(json.task_id);
        localStorage.setItem('akpanel_hostname_ssl_task', json.task_id);
        showToast(json.message || 'SSL issuance started — track progress below');
      } else {
        showToast(json.message || 'Hostname SSL updated successfully');
        fetchSettings();
        setSslLoading(false);
      }
    } catch (err) {
      setSslLoading(false);
      setSslStatus('failed');
      setSslError(err.message);
      showToast(err.message, 'error');
    }
  };

  const resetSslUI = () => {
    setSslStatus('idle');
    setSslError('');
    setSslLogs([]);
    setSslProgress(0);
    setSslStep('');
    setSslTaskId('');
    setSslLoading(false);
  };

  const handleUploadCustomSSL = async (e) => {
    e.preventDefault();
    if (!customCert.trim() || !customKey.trim()) {
      showToast('Both Certificate and Private Key are required', 'error');
      return;
    }
    setCustomSslLoading(true);
    try {
      const res = await fetch('/api/settings/hostname-ssl/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificate: customCert, private_key: customKey })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || 'Custom Hostname SSL installed successfully');
      setCustomSslModal(false);
      setCustomCert('');
      setCustomKey('');
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCustomSslLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>CWP / Server Settings & Hostname SSL</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configure root hostname, nameservers, server ports, and issue trusted Hostname SSL certificates.
          </p>
        </div>

        <Button 
          onClick={fetchSettings} 
          variant="outline" 
          size="sm" 
          className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
        >
          <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Hostname SSL Banner / Action Card */}
      <Card className="bg-gradient-to-r from-[#121215] via-indigo-950/20 to-[#121215] border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mt-1">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Server Hostname SSL Certificate</h3>
                {hostnameSSL?.is_self_signed ? (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                    Self-Signed Fallback
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Trusted ({hostnameSSL?.issuer || "Let's Encrypt / Custom"})
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                Secures Root WHM (<span className="text-indigo-300 font-mono">:2087 HTTPS</span>), Client Portal (<span className="text-indigo-300 font-mono">:2083 HTTPS</span>), Mail (<span className="text-indigo-300 font-mono">IMAP/SMTP SSL</span>), and FTP.
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-zinc-400">
                <div><strong className="text-zinc-300">Hostname:</strong> <span className="font-mono text-white">{settings.hostname || window.location.hostname}</span></div>
                <div><strong className="text-zinc-300">Issuer:</strong> <span className="text-zinc-200">{hostnameSSL?.issuer || "Let's Encrypt / acme.sh"}</span></div>
                <div><strong className="text-zinc-300">Days Left:</strong> <span className="text-emerald-400 font-mono">{hostnameSSL?.days_left || 90} Days</span></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <Button
              onClick={() => setCustomSslModal(true)}
              variant="outline"
              className="rounded-xl border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:text-white hover:bg-indigo-900/60 text-xs font-bold gap-2 py-2.5 px-4"
            >
              <Upload className="w-4 h-4" />
              <span>Install Custom SSL</span>
            </Button>
            <Button
              onClick={handleIssueHostnameSSL}
              disabled={sslLoading}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-2 shadow-lg shadow-indigo-900/40 py-2.5 px-5"
            >
              <Zap className={`w-4 h-4 ${sslLoading ? 'animate-spin' : ''}`} />
              <span>{sslLoading ? 'Issuing SSL...' : sslStatus === 'failed' ? 'Retry SSL Issue' : 'Issue / Renew via Let\'s Encrypt'}</span>
            </Button>
          </div>
        </div>

        {(sslLoading || sslStatus === 'failed' || sslTaskId) && (
          <div className={`mt-4 p-3 rounded-xl space-y-2 border ${
            sslStatus === 'failed' ? 'bg-red-950/30 border-red-800' : 'bg-zinc-950/60 border-indigo-900/40'
          }`}>
            <div className={`flex justify-between text-xs ${sslStatus === 'failed' ? 'text-red-400' : 'text-indigo-300'}`}>
              <span className="flex items-center gap-1.5">
                {sslStatus === 'failed' && <AlertTriangle className="w-3.5 h-3.5" />}
                {sslStatus === 'failed'
                  ? `SSL failed${sslStep ? ` at ${sslStep}` : ''}`
                  : `SSL issuance${sslStep ? `: ${sslStep}` : '...'}`}
              </span>
              <span>{sslProgress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${sslStatus === 'failed' ? 'bg-red-600' : 'bg-indigo-600'}`}
                style={{ width: `${sslProgress}%` }}
              />
            </div>
            {sslStatus === 'failed' && sslError && (
              <div className="text-[10px] font-mono text-red-300/90 bg-red-950/40 border border-red-900/50 rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {sslError.split('\n').slice(0, 6).join('\n')}
              </div>
            )}
            <div className="max-h-24 overflow-y-auto text-[10px] font-mono text-zinc-500 space-y-0.5">
              {(sslLogs || []).slice(-8).map((line, i) => (
                <div key={i} className={line.startsWith('Failed:') ? 'text-red-400' : ''}>{line}</div>
              ))}
            </div>
            {sslStatus === 'failed' && (
              <button type="button" onClick={resetSslUI} className="text-[10px] text-zinc-400 hover:text-white underline">
                Dismiss
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Custom SSL Upload Modal */}
      {customSslModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="bg-[#121215] border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Install Custom Hostname SSL Certificate</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCustomSslModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleUploadCustomSSL} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">SSL Certificate (PEM / Fullchain) *</label>
                <textarea
                  required
                  rows={6}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={customCert}
                  onChange={(e) => setCustomCert(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-mono text-zinc-300 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Private Key (PEM) *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-mono text-zinc-300 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustomSslModal(false)}
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-zinc-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={customSslLoading}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-2"
                >
                  <Save className={`w-4 h-4 ${customSslLoading ? 'animate-spin' : ''}`} />
                  <span>{customSslLoading ? 'Validating & Installing...' : 'Install & Apply SSL'}</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Server Identity & Hostname */}
          <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Server Identity & Hostname</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Define your fully qualified domain name (FQDN).</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Server Hostname (FQDN) *</label>
                <Input 
                  type="text"
                  required
                  placeholder="server.akpanel.site"
                  value={settings.hostname}
                  onChange={(e) => setSettings({ ...settings, hostname: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Must be an A record pointing to your server's primary public IP.</p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Root Administrator Email</label>
                <Input 
                  type="email"
                  required
                  placeholder="admin@akpanel.site"
                  value={settings.admin_email}
                  onChange={(e) => setSettings({ ...settings, admin_email: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 text-white text-xs"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Used for Let's Encrypt / ZeroSSL expiration notifications.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Root WHM Port</label>
                  <Input 
                    type="number"
                    value={settings.panel_port}
                    onChange={(e) => setSettings({ ...settings, panel_port: parseInt(e.target.value) || 2087 })}
                    className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Client Portal Port</label>
                  <Input 
                    type="number"
                    value={settings.client_port}
                    onChange={(e) => setSettings({ ...settings, client_port: parseInt(e.target.value) || 2083 })}
                    className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Nameservers & Localization */}
          <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Nameserver Defaults & System Time</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Authoritative DNS defaults assigned to new virtual hosts.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-zinc-300">Primary NS (NS1)</label>
                    <button
                      type="button"
                      onClick={handleSyncNameservers}
                      disabled={syncNsLoading}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
                    >
                      {syncNsLoading ? 'Syncing...' : '⚡ Sync to BIND 9'}
                    </button>
                  </div>
                  <Input 
                    type="text"
                    placeholder="ns1.akpanel.site"
                    value={settings.primary_ns}
                    onChange={(e) => setSettings({ ...settings, primary_ns: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Secondary NS (NS2)</label>
                  <Input 
                    type="text"
                    placeholder="ns2.akpanel.site"
                    value={settings.secondary_ns}
                    onChange={(e) => setSettings({ ...settings, secondary_ns: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Main Shared Hosting IP</label>
                  <select
                    value={settings.shared_ip}
                    onChange={(e) => setSettings({ ...settings, shared_ip: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  >
                    {availableIps.length === 0 ? (
                      <option value={window.location.hostname}>{window.location.hostname} (Default Host)</option>
                    ) : (
                      availableIps.map(ip => (
                        <option key={ip.ip} value={ip.ip}>
                          {ip.ip} {ip.is_main ? '(Main Server IP)' : `(${ip.type || 'Secondary'})`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Tenant IP Stack Mode</label>
                  <select
                    value={settings.ip_stack_mode}
                    onChange={(e) => setSettings({ ...settings, ip_stack_mode: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="dual">Dual-Stack (IPv4 + IPv6 Active)</option>
                    <option value="ipv4_only">IPv4 Only (Legacy Single-Stack)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Server Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="America/New_York">America/New_York (EST / EDT)</option>
                    <option value="Europe/London">Europe/London (GMT / BST)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET / CEST)</option>
                    <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Riyadh">Asia/Riyadh (AST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Session Inactivity Timeout (Mins)</label>
                  <Input 
                    type="number"
                    value={settings.session_timeout_mins}
                    onChange={(e) => setSettings({ ...settings, session_timeout_mins: parseInt(e.target.value) || 60 })}
                    className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Save Bar */}
        <div className="mt-6 flex items-center justify-end">
          <Button 
            type="submit" 
            className="rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-2 px-6 py-2.5 shadow-lg"
          >
            <Save className="w-4 h-4" />
            <span>Save Server Configuration</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
