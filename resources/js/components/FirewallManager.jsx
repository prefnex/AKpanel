import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  Power, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  Server, 
  Globe, 
  Terminal, 
  Database, 
  Mail, 
  FolderTree, 
  Radio, 
  Key, 
  SlidersHorizontal,
  Ban,
  UserX,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function FirewallManager({ showToast }) {
  const [loading, setLoading] = useState(false);
  const [firewallData, setFirewallData] = useState({
    is_active: true,
    default_incoming: 'DENY',
    default_outgoing: 'ALLOW',
    rules: [],
    banned_ips: [],
    waf_mode: 'on',
    fail2ban_active: true
  });

  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'banned' | 'quick' | 'waf'
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);

  // New Rule Form
  const [newRule, setNewRule] = useState({
    port: '',
    protocol: 'TCP',
    action: 'allow',
    from_ip: 'Anywhere',
    comment: ''
  });

  // Manual Ban Form
  const [banIP, setBanIP] = useState('');
  const [banReason, setBanReason] = useState('Manual Ban by Administrator');

  const fetchFirewall = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/firewall');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setFirewallData(json.data);
        }
      }
    } catch (e) {
      showToast('Error loading firewall telemetry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirewall();
  }, []);

  const handleToggleFirewall = async () => {
    try {
      const targetState = !firewallData.is_active;
      const res = await fetch('/api/security/firewall/toggle-enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: targetState })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || `Firewall ${targetState ? 'enabled' : 'disabled'}`);
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/security/firewall/rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || 'Firewall rule created successfully');
      setIsAddRuleOpen(false);
      setNewRule({ port: '', protocol: 'TCP', action: 'allow', from_ip: 'Anywhere', comment: '' });
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteRule = async (ruleIdOrPort) => {
    if (!confirm('Are you sure you want to delete this firewall rule?')) return;
    try {
      const res = await fetch('/api/security/firewall/rule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: ruleIdOrPort })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast('Firewall rule deleted');
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleQuickTogglePort = async (port, currentAllowed) => {
    try {
      const res = await fetch('/api/security/firewall/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: String(port), allow: !currentAllowed })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(`Port ${port} ${!currentAllowed ? 'allowed' : 'blocked'}`);
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUnbanIP = async (ip, jail) => {
    try {
      const res = await fetch('/api/security/firewall/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, jail })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || `IP ${ip} unbanned`);
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBanIP = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/security/firewall/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: banIP, reason: banReason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || `IP ${banIP} blocked`);
      setIsBanModalOpen(false);
      setBanIP('');
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const isPortAllowed = (port) => {
    return firewallData.rules.some(r => r.port === String(port) && r.action.toUpperCase() === 'ALLOW');
  };

  const presetPorts = [
    { name: 'Web HTTP', port: '80', proto: 'TCP', icon: Globe, color: 'text-blue-400', desc: 'Standard HTTP Traffic' },
    { name: 'Web HTTPS', port: '443', proto: 'TCP', icon: ShieldCheck, color: 'text-emerald-400', desc: 'Encrypted SSL/TLS Web' },
    { name: 'AKpanel WHM', port: '2087', proto: 'TCP', icon: Server, color: 'text-purple-400', desc: 'Root Administration Console' },
    { name: 'Client Portal', port: '2083', proto: 'TCP', icon: Globe, color: 'text-teal-400', desc: 'User Tenant Dashboard' },
    { name: 'SSH Terminal', port: '22', proto: 'TCP', icon: Terminal, color: 'text-amber-400', desc: 'Secure Shell Remote Login' },
    { name: 'DNS Nameserver', port: '53', proto: 'TCP/UDP', icon: Radio, color: 'text-cyan-400', desc: 'BIND 9 Authoritative Queries' },
    { name: 'FTP Transfer', port: '21', proto: 'TCP', icon: FolderTree, color: 'text-orange-400', desc: 'Pure-FTPd File Transfers' },
    { name: 'MySQL Database', port: '3306', proto: 'TCP', icon: Database, color: 'text-indigo-400', desc: 'MySQL / MariaDB Daemon' },
    { name: 'Mail SMTP', port: '25', proto: 'TCP', icon: Mail, color: 'text-rose-400', desc: 'Inbound / Outbound SMTP' },
    { name: 'Mail SMTP SSL', port: '465', proto: 'TCP', icon: Mail, color: 'text-rose-400', desc: 'Secure SMTP Submission' },
    { name: 'Mail IMAP SSL', port: '993', proto: 'TCP', icon: Mail, color: 'text-pink-400', desc: 'Dovecot Secure Mailboxes' },
    { name: 'Mail POP3 SSL', port: '995', proto: 'TCP', icon: Mail, color: 'text-pink-400', desc: 'Dovecot POP3 Retrieval' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Firewall & Security Suite</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Netfilter/UFW packet filtering, Fail2Ban intrusion prevention, and Web Application Firewall (WAF).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchFirewall}
            disabled={loading}
            className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xl gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </Button>

          <Button
            onClick={() => setIsAddRuleOpen(true)}
            className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Rule</span>
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">UFW Status</span>
            <button
              onClick={handleToggleFirewall}
              className={`p-1.5 rounded-lg transition ${
                firewallData.is_active
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
              }`}
              title="Toggle Master Firewall"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${firewallData.is_active ? 'text-emerald-400' : 'text-rose-400'}`}>
              {firewallData.is_active ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Default: IN {firewallData.default_incoming} • OUT {firewallData.default_outgoing}
          </p>
        </Card>

        {/* Port Rules Count */}
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Managed Inbound Rules</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{firewallData.rules.length}</span>
            <span className="text-xs text-zinc-400">Open Ports</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Full stateful packet inspection</p>
        </Card>

        {/* Fail2Ban Bans */}
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Intrusion Prevention</span>
            <UserX className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">{firewallData.banned_ips.length}</span>
            <span className="text-xs text-zinc-400">Banned IPs</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Fail2Ban SSH & Auth Jails Active</p>
        </Card>

        {/* WAF Status */}
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">ModSecurity WAF</span>
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-indigo-400">ENABLED</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">OWASP Core Rule Set (CRS 3.3)</p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'rules'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Active Port Rules ({firewallData.rules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('quick')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'quick'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Quick Hosting Ports Switcher</span>
        </button>

        <button
          onClick={() => setActiveTab('banned')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'banned'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>IP Blacklist & Fail2Ban ({firewallData.banned_ips.length})</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE PORT RULES TABLE */}
      {activeTab === 'rules' && (
        <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Port / Range</th>
                  <th className="py-3.5 px-4">Protocol</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Source IP</th>
                  <th className="py-3.5 px-4">Service Description</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {firewallData.rules.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-zinc-500 font-mono">
                      No custom firewall rules configured yet.
                    </td>
                  </tr>
                ) : (
                  firewallData.rules.map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-900/40 transition font-mono">
                      <td className="py-3 px-4 text-zinc-500 text-[11px]">{r.number || i + 1}</td>
                      <td className="py-3 px-4 font-bold text-white">{r.port}</td>
                      <td className="py-3 px-4 text-cyan-400">{r.protocol}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${r.action.toUpperCase() === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'} text-[10px]`}>
                          {r.action.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{r.from_ip || 'Anywhere'}</td>
                      <td className="py-3 px-4 text-zinc-400 font-sans text-xs">{r.comment || 'Custom Port'}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(r.number || r.port)}
                          className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 p-1.5 h-auto rounded-lg"
                          title="Delete Firewall Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: QUICK HOSTING PORTS SWITCHER */}
      {activeTab === 'quick' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presetPorts.map((p) => {
            const Icon = p.icon;
            const allowed = isPortAllowed(p.port);
            return (
              <Card key={p.port} className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl hover:border-zinc-700 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center ${p.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{p.name}</h4>
                      <span className="font-mono text-xs text-zinc-400">Port {p.port} ({p.proto})</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuickTogglePort(p.port, allowed)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition ${
                      allowed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-500 hover:text-white border border-zinc-700'
                    }`}
                  >
                    {allowed ? 'OPEN' : 'BLOCKED'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-3">{p.desc}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 3: IP BLACKLIST & FAIL2BAN */}
      {activeTab === 'banned' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">Banned IPs & Malicious Traffic Blacklist</h3>
              <p className="text-xs text-zinc-400">Inspect brute-force attempts caught by Fail2Ban and manage manual IP blocks</p>
            </div>
            <Button
              onClick={() => setIsBanModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 rounded-xl gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Blacklist New IP</span>
            </Button>
          </div>

          <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Banned IP</th>
                  <th className="py-3.5 px-4">Jail / Protection Layer</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
                {firewallData.banned_ips.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-10 text-zinc-500 font-sans text-xs">
                      No banned IP addresses detected. The server is secure and free of brute-force attacks!
                    </td>
                  </tr>
                ) : (
                  firewallData.banned_ips.map((b, i) => (
                    <tr key={i} className="hover:bg-zinc-900/40 transition">
                      <td className="py-3 px-4 font-bold text-rose-400">{b.ip}</td>
                      <td className="py-3 px-4 text-zinc-400">{b.jail || 'sshd'}</td>
                      <td className="py-3 px-4">
                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">
                          BLOCKED
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleUnbanIP(b.ip, b.jail)}
                          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] h-7 px-3 rounded-lg"
                        >
                          <Unlock className="w-3 h-3 mr-1" />
                          <span>Unban IP</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* MODAL: ADD CUSTOM RULE */}
      <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Shield className="w-5 h-5 text-rose-400" />
              <span>Add Custom Firewall Rule</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddRule} className="space-y-4 mt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-300 font-bold block mb-1">Port / Port Range</label>
                <Input
                  type="text"
                  placeholder="e.g. 8080 or 8000:8050"
                  value={newRule.port}
                  onChange={(e) => setNewRule({ ...newRule, port: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">Protocol</label>
                <select
                  value={newRule.protocol}
                  onChange={(e) => setNewRule({ ...newRule, protocol: e.target.value })}
                  className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="TCP/UDP">TCP/UDP (Both)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-300 font-bold block mb-1">Action</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                  className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  <option value="allow">ALLOW (Open)</option>
                  <option value="deny">DENY (Block)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">Source IP / Subnet</label>
                <Input
                  type="text"
                  placeholder="Anywhere or 192.168.1.0/24"
                  value={newRule.from_ip}
                  onChange={(e) => setNewRule({ ...newRule, from_ip: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-300 font-bold block mb-1">Rule Description / Comment</label>
              <Input
                type="text"
                placeholder="e.g. Custom Node.js API Service"
                value={newRule.comment}
                onChange={(e) => setNewRule({ ...newRule, comment: e.target.value })}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddRuleOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 rounded-xl text-xs">
                Save Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: MANUAL BAN IP */}
      <Dialog open={isBanModalOpen} onOpenChange={setIsBanModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Ban className="w-5 h-5 text-rose-400" />
              <span>Blacklist & Block IP Address</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBanIP} className="space-y-4 mt-2 text-xs">
            <div>
              <label className="text-zinc-300 font-bold block mb-1">Target IP Address</label>
              <Input
                type="text"
                placeholder="e.g. 198.51.100.45"
                value={banIP}
                onChange={(e) => setBanIP(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-zinc-300 font-bold block mb-1">Reason for Blacklisting</label>
              <Input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsBanModalOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 rounded-xl text-xs">
                Block IP
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
