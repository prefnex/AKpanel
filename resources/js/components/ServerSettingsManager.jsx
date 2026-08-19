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
  ExternalLink
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
  const [loading, setLoading] = useState(false);
  const [sslLoading, setSslLoading] = useState(false);
  const [syncNsLoading, setSyncNsLoading] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/server');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setSettings(prev => ({ ...prev, ...json.data }));
        if (json.hostname_ssl) setHostnameSSL(json.hostname_ssl);
      }
    } catch (e) {
      console.error(e);
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

  useEffect(() => {
    fetchSettings();
    fetchIps();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || 'Server settings saved successfully');
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSyncNameserversToBind = async () => {
    setSyncNsLoading(true);
    try {
      const res = await fetch('/api/dns/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_ns: settings.primary_ns,
          secondary_ns: settings.secondary_ns,
          admin_email: settings.admin_email,
          server_ip: settings.shared_ip || window.location.hostname
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast('Nameservers synced to BIND 9 & DNS templates!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSyncNsLoading(false);
    }
  };

  const handleIssueHostnameSSL = async () => {
    setSslLoading(true);
    try {
      const res = await fetch('/api/settings/hostname-ssl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: settings.admin_email })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || 'Hostname SSL updated successfully');
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSslLoading(false);
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
                    Trusted (Let's Encrypt / acme.sh)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                Secures Root WHM (<span className="text-indigo-300 font-mono">:2087</span>), Client Portal (<span className="text-indigo-300 font-mono">:2083</span>), Mail (<span className="text-indigo-300 font-mono">IMAP/SMTP SSL</span>), and Pure-FTPd.
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
              onClick={handleIssueHostnameSSL}
              disabled={sslLoading}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-2 shadow-lg shadow-indigo-900/40 py-2.5 px-5"
            >
              <Zap className={`w-4 h-4 ${sslLoading ? 'animate-spin' : ''}`} />
              <span>{sslLoading ? 'Issuing via acme.sh...' : 'Issue / Renew Hostname SSL'}</span>
            </Button>
          </div>
        </div>
      </Card>

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
                      onClick={handleSyncNameserversToBind}
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
