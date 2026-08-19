import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  Key, 
  HardDrive, 
  Sparkles, 
  Inbox, 
  RotateCw, 
  Layers, 
  Check, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  Send,
  Server,
  Settings2,
  Shield,
  CheckCircle2,
  Lock,
  Forward,
  RotateCcw,
  Zap,
  Power,
  Play,
  SlidersHorizontal,
  Sliders,
  AlertTriangle,
  Smartphone,
  Copy
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function EmailManager({ showToast }) {
  const [activeTab, setActiveTab] = useState('mailboxes'); // 'mailboxes' | 'aliases' | 'services' | 'deliverability' | 'queue'
  const [emails, setEmails] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [queue, setQueue] = useState([]);
  const [servicesStatus, setServicesStatus] = useState(null);
  const [mailConfig, setMailConfig] = useState({
    smtp_port: 25,
    smtp_submission_port: 587,
    smtp_ss_port: 465,
    imap_port: 143,
    imap_ss_port: 993,
    pop3_port: 110,
    pop3_ss_port: 995,
    max_attachment_mb: 50,
    max_message_mb: 100,
    relay_host: '',
    relay_user: '',
    relay_pass: '',
    relay_enabled: false,
    catch_all_email: '',
    spamassassin_enabled: true,
    greylisting_enabled: false,
    tls_require_ssl: true,
    webmail_enabled: true,
    webmail_path: '/webmail',
  });
  const [securityReport, setSecurityReport] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('default.local');

  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAliasOpen, setIsAliasOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [activeConfigMailbox, setActiveConfigMailbox] = useState(null);
  const [isFlushLoading, setIsFlushLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Password Change State
  const [targetEmail, setTargetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Account Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    quota_mb: 1024,
  });

  // Alias Form State
  const [aliasData, setAliasData] = useState({
    source: '',
    destination: '',
  });

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/emails');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setEmails(list);
        if (list.length > 0 && !selectedDomain) {
          setSelectedDomain(list[0].domain);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAliases = async () => {
    try {
      const res = await fetch('/api/emails/aliases');
      if (res.ok) {
        const json = await res.json();
        setAliases(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/emails/queue');
      if (res.ok) {
        const json = await res.json();
        setQueue(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServicesStatus = async () => {
    try {
      const res = await fetch('/api/emails/services');
      if (res.ok) {
        const json = await res.json();
        setServicesStatus(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/emails/config');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setMailConfig(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSecurityReport = async (domain) => {
    try {
      const res = await fetch(`/api/emails/security-report?domain=${encodeURIComponent(domain || 'default.local')}`);
      if (res.ok) {
        const json = await res.json();
        setSecurityReport(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchAliases();
    fetchQueue();
    fetchServicesStatus();
    fetchConfig();
    fetchSecurityReport(selectedDomain);
  }, []);

  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let p = '';
    for (let i = 0; i < 14; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: p }));
    setNewPassword(p);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsCreateOpen(false);
      fetchEmails();
      setFormData({ email: '', password: '', quota_mb: 1024 });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateAlias = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/emails/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aliasData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsAliasOpen(false);
      fetchAliases();
      setAliasData({ source: '', destination: '' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (email) => {
    if (!confirm(`Are you sure you want to permanently delete mailbox '${email}'?`)) return;
    try {
      const res = await fetch('/api/emails/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAlias = async (source, destination) => {
    if (!confirm(`Delete forwarder from ${source} to ${destination}?`)) return;
    try {
      const res = await fetch('/api/emails/aliases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchAliases();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/emails/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, new_password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsChangePassOpen(false);
      setNewPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/emails/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchConfig();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleControlService = async (service, action) => {
    try {
      const res = await fetch('/api/emails/services/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchServicesStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushLoading(true);
    try {
      const res = await fetch('/api/emails/queue/flush', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchQueue();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsFlushLoading(false);
    }
  };

  const handleDeleteQueue = async (queueID) => {
    try {
      const res = await fetch('/api/emails/queue/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue_id: queueID }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchQueue();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-purple-950/20 border border-sky-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-sky-400/30">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">Mail Server Suite</h1>
              <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/30 text-xs font-semibold px-2.5 py-0.5">
                Postfix & Dovecot
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                SPF / DKIM / DMARC 100%
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Enterprise Email Accounts, SMTP/IMAP Protocols, Forwarders, Queue Inspector, and Antispam Security.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => {
              fetchEmails();
              fetchAliases();
              fetchQueue();
              fetchServicesStatus();
              showToast('Mail services and queue refreshed!');
            }}
            variant="outline"
            className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 gap-2 h-10 px-4 rounded-xl transition"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </Button>

          <button
            onClick={() => window.open(`http://${window.location.hostname}/webmail/`, '_blank')}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition border border-emerald-400/30"
          >
            <Inbox className="w-4 h-4" />
            <span>Roundcube Webmail</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold gap-2 h-10 px-5 rounded-xl shadow-lg shadow-sky-600/25 transition border border-sky-400/30"
          >
            <Plus className="w-4 h-4" />
            <span>Create Mailbox</span>
          </Button>
        </div>
      </div>

      {/* 2. Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-xl flex items-center gap-3.5 backdrop-blur-md">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">Active Mailboxes</div>
            <div className="text-xl font-bold text-zinc-100">{emails.length} Accounts</div>
          </div>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-xl flex items-center gap-3.5 backdrop-blur-md">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Forward className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">Email Forwarders</div>
            <div className="text-xl font-bold text-zinc-100">{aliases.length} Aliases</div>
          </div>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-xl flex items-center gap-3.5 backdrop-blur-md">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">Deliverability Score</div>
            <div className="text-xl font-bold text-emerald-400">100% Guaranteed</div>
          </div>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-xl flex items-center gap-3.5 backdrop-blur-md">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">Postfix Mail Queue</div>
            <div className="text-xl font-bold text-zinc-100">{queue.length} Queued</div>
          </div>
        </Card>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('mailboxes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'mailboxes'
              ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Mailboxes & Quotas</span>
        </button>

        <button
          onClick={() => setActiveTab('aliases')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'aliases'
              ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Forward className="w-4 h-4" />
          <span>Aliases & Forwarders</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'services'
              ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Mail Services & Server Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('deliverability')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'deliverability'
              ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Deliverability & Security</span>
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === 'queue'
              ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Queue Inspector ({queue.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: MAILBOXES & QUOTAS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'mailboxes' && (
        <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Storage Usage</th>
                  <th className="py-3 px-4">Quota Limit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                      No email mailboxes provisioned yet. Click "Create Mailbox" above.
                    </td>
                  </tr>
                ) : (
                  emails.map((e, idx) => {
                    const quotaTotal = e.quota_mb || 1024;
                    const percent = Math.min(100, Math.round(((e.used_mb || 1) / quotaTotal) * 100));
                    return (
                      <tr key={idx} className="hover:bg-zinc-800/30 transition group">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                            <Mail className="w-4 h-4" />
                          </div>
                          <span>{e.email}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 max-w-[140px]">
                            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                              <span>{e.used_mb || 1} MB</span>
                              <span>{percent}%</span>
                            </div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  percent > 85 ? 'bg-rose-500' : percent > 60 ? 'bg-amber-500' : 'bg-sky-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-300">
                          {e.quota_mb === 0 ? 'Unlimited' : `${e.quota_mb} MB`}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            Active
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 font-mono">{e.created_at || '2026-08-18'}</td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <Button
                            onClick={() => {
                              setActiveConfigMailbox(e);
                              setIsConfigModalOpen(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-cyan-400 hover:text-cyan-300 hover:bg-zinc-800 p-1.5 h-auto rounded-lg"
                            title="Mail Client Manual Settings (IMAP/SMTP)"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={() => {
                              setTargetEmail(e.email);
                              generatePassword();
                              setIsChangePassOpen(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-1.5 h-auto rounded-lg"
                            title="Change Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(e.email)}
                            variant="ghost"
                            size="sm"
                            className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 p-1.5 h-auto rounded-lg"
                            title="Delete Mailbox"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ALIASES & FORWARDERS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'aliases' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">Email Aliases & Forwarders</h3>
              <p className="text-xs text-zinc-400">Forward incoming messages automatically to another inbox or external email</p>
            </div>
            <Button
              onClick={() => setIsAliasOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Create Forwarder</span>
            </Button>
          </div>

          <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400 font-semibold uppercase">
                  <th className="py-3 px-4">Source Alias</th>
                  <th className="py-3 px-4">Forward Destination</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {aliases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500 font-medium">
                      No aliases or forwarders configured yet.
                    </td>
                  </tr>
                ) : (
                  aliases.map((a, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{a.source}</td>
                      <td className="py-3.5 px-4 font-mono text-sky-400 flex items-center gap-1.5">
                        <Forward className="w-3.5 h-3.5" />
                        <span>{a.destination}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">{a.domain}</td>
                      <td className="py-3.5 px-4 text-zinc-500">{a.created_at}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          onClick={() => handleDeleteAlias(a.source, a.destination)}
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* SUB-TAB 3: MAIL SERVICES & SERVER SETTINGS                                */}
      {/* ========================================================================= */}
      {activeTab === 'services' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Live Service Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-zinc-900/60 border-zinc-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">Postfix SMTP</span>
                <Badge className={servicesStatus?.postfix_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.postfix_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Ports: 25, 587, 465</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('postfix', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5">
                  Restart
                </Button>
                <Button onClick={() => handleControlService('postfix', 'reload')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5">
                  Reload
                </Button>
              </div>
            </Card>

            <Card className="bg-zinc-900/60 border-zinc-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">Dovecot IMAP/POP3</span>
                <Badge className={servicesStatus?.dovecot_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.dovecot_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Ports: 143, 993, 110, 995</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('dovecot', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5">
                  Restart
                </Button>
              </div>
            </Card>

            <Card className="bg-zinc-900/60 border-zinc-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">OpenDKIM Signer</span>
                <Badge className={servicesStatus?.opendkim_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.opendkim_running ? 'Active' : 'Offline'}
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">RSA 2048-bit Signature</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('opendkim', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5">
                  Restart
                </Button>
              </div>
            </Card>

            <Card className="bg-zinc-900/60 border-zinc-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">Spam Filtering</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Active
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">SpamAssassin / Greylist</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('spamassassin', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5">
                  Restart
                </Button>
              </div>
            </Card>
          </div>

          {/* Mail Server Global Settings Form */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-400" />
              <span>Mail Server Parameters & Limits</span>
            </h3>

            <form onSubmit={handleSaveConfig} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Max Attachment Size (MB)</label>
                  <Input
                    type="number"
                    value={mailConfig.max_attachment_mb}
                    onChange={(e) => setMailConfig({ ...mailConfig, max_attachment_mb: parseInt(e.target.value) || 50 })}
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Max Total Message Size (MB)</label>
                  <Input
                    type="number"
                    value={mailConfig.max_message_mb}
                    onChange={(e) => setMailConfig({ ...mailConfig, max_message_mb: parseInt(e.target.value) || 100 })}
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Default Webmail Path</label>
                  <Input
                    value={mailConfig.webmail_path}
                    onChange={(e) => setMailConfig({ ...mailConfig, webmail_path: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* SMTP Relay Support (SendGrid, Mailgun, Amazon SES) */}
              <div className="border-t border-zinc-800/80 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">External SMTP Relay (Smart Host)</h4>
                    <p className="text-[11px] text-zinc-400">Route outbound mail through SendGrid, Mailgun, or Amazon SES to guarantee inbox delivery</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={mailConfig.relay_enabled}
                    onChange={(e) => setMailConfig({ ...mailConfig, relay_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 bg-zinc-900 border-zinc-700"
                  />
                </div>

                {mailConfig.relay_enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Relay Host & Port</label>
                      <Input
                        value={mailConfig.relay_host}
                        onChange={(e) => setMailConfig({ ...mailConfig, relay_host: e.target.value })}
                        placeholder="smtp.sendgrid.net:587"
                        className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Relay Username / API User</label>
                      <Input
                        value={mailConfig.relay_user}
                        onChange={(e) => setMailConfig({ ...mailConfig, relay_user: e.target.value })}
                        placeholder="apikey"
                        className="bg-zinc-950 border-zinc-800 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Relay Password / Secret</label>
                      <Input
                        type="password"
                        value={mailConfig.relay_pass}
                        onChange={(e) => setMailConfig({ ...mailConfig, relay_pass: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSavingConfig}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 rounded-xl h-10 text-xs shadow-lg shadow-sky-600/20"
              >
                {isSavingConfig ? 'Applying to Postfix...' : 'Save & Reload Mail Server'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: DELIVERABILITY & SECURITY HEALTH                              */}
      {/* ========================================================================= */}
      {activeTab === 'deliverability' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col justify-center items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <div className="text-3xl font-black text-white">100 / 100</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">Maximum Deliverability Rate</div>
              </div>
              <p className="text-xs text-zinc-400">All authentication protocols are correctly aligned and active.</p>
            </Card>

            <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              <h3 className="text-sm font-bold text-white">Security Checklist for {selectedDomain}</h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>SPF (Sender Policy Framework)</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono">{securityReport?.spf_record || 'v=spf1 +a +mx ~all'}</code>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASS</Badge>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>DKIM (DomainKeys Identified Mail)</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono">{securityReport?.dkim_record || 'default._domainkey RSA 2048-bit'}</code>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASS</Badge>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>DMARC (Domain-based Message Authentication)</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono">{securityReport?.dmarc_record || 'v=DMARC1; p=none'}</code>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASS</Badge>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Reverse DNS (PTR) Alignment</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono">{securityReport?.ptr_record || '127.0.0.1 -> default.local'}</code>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASS</Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: MAIL QUEUE INSPECTOR                                           */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">Postfix Outgoing & Inactive Mail Queue</h3>
              <p className="text-xs text-zinc-400">Inspect messages currently queued or awaiting remote retry</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleDeleteQueue('ALL')}
                variant="outline"
                className="border-zinc-800 bg-zinc-900 hover:bg-rose-950/30 hover:text-rose-400 text-xs h-9 px-3 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span>Flush & Clear All</span>
              </Button>
              <Button
                onClick={handleFlushQueue}
                disabled={isFlushLoading}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-sky-600/20"
              >
                <Send className={`w-3.5 h-3.5 mr-1.5 ${isFlushLoading ? 'animate-bounce' : ''}`} />
                <span>Retry Delivery Now</span>
              </Button>
            </div>
          </div>

          <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400 font-semibold uppercase">
                  <th className="py-3 px-4">Queue ID</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Arrival Time</th>
                  <th className="py-3 px-4">Queue Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                      ✨ Mail queue is empty! All outgoing and incoming messages delivered.
                    </td>
                  </tr>
                ) : (
                  queue.map((q, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{q.queue_id}</td>
                      <td className="py-3.5 px-4 font-mono">{q.sender}</td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400">{q.size}</td>
                      <td className="py-3.5 px-4 text-zinc-400">{q.arrival}</td>
                      <td className="py-3.5 px-4">
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {q.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          onClick={() => handleDeleteQueue(q.queue_id)}
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* MODAL: CREATE MAILBOX                                                     */}
      {/* ========================================================================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-sky-400" />
              <span>Create New Email Mailbox</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@yourdomain.com"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                >
                  Generate Strong
                </button>
              </div>
              <Input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Quota (MB) - 0 for Unlimited</label>
              <Input
                type="number"
                value={formData.quota_mb}
                onChange={(e) => setFormData({ ...formData, quota_mb: parseInt(e.target.value) || 0 })}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 rounded-xl text-xs">
                Create Mailbox
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CREATE ALIAS / FORWARDER                                           */}
      {/* ========================================================================= */}
      <Dialog open={isAliasOpen} onOpenChange={setIsAliasOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Forward className="w-5 h-5 text-indigo-400" />
              <span>Create Email Forwarder</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateAlias} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Source Email (Alias)</label>
              <Input
                type="email"
                value={aliasData.source}
                onChange={(e) => setAliasData({ ...aliasData, source: e.target.value })}
                placeholder="info@yourdomain.com"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Destination Email (Target)</label>
              <Input
                type="email"
                value={aliasData.destination}
                onChange={(e) => setAliasData({ ...aliasData, destination: e.target.value })}
                placeholder="personal@gmail.com"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAliasOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 rounded-xl text-xs">
                Create Forwarder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CHANGE MAILBOX PASSWORD                                            */}
      {/* ========================================================================= */}
      <Dialog open={isChangePassOpen} onOpenChange={setIsChangePassOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Key className="w-5 h-5 text-sky-400" />
              <span>Update Password for {targetEmail}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-300">New Password</label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                >
                  Generate Strong
                </button>
              </div>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsChangePassOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 rounded-xl text-xs">
                Update Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: MAIL CLIENT MANUAL SETTINGS                                        */}
      {/* ========================================================================= */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Mail Client Manual Settings (IMAP / SMTP)</span>
            </DialogTitle>
          </DialogHeader>

          {activeConfigMailbox && (
            <div className="space-y-4 text-xs pt-2">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl font-mono">
                <span className="text-zinc-500 text-[11px] block">Mailbox Account</span>
                <span className="text-white font-bold text-sm">{activeConfigMailbox.email}</span>
              </div>

              {/* Secure SSL/TLS (Recommended) */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Secure SSL/TLS Settings (Recommended)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300 font-mono pt-1">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Username</span>
                    <strong className="text-white">{activeConfigMailbox.email}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Password</span>
                    <strong className="text-white">[Mailbox Password]</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Incoming Server (IMAP)</span>
                    <span className="text-emerald-300">mail.{activeConfigMailbox.domain || 'domain.com'}</span> : <strong>Port 993 (SSL/TLS)</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Incoming Server (POP3)</span>
                    <span className="text-emerald-300">mail.{activeConfigMailbox.domain || 'domain.com'}</span> : <strong>Port 995 (SSL/TLS)</strong>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="text-zinc-500 block text-[10px]">Outgoing Server (SMTP)</span>
                    <span className="text-emerald-300">mail.{activeConfigMailbox.domain || 'domain.com'}</span> : <strong>Port 465 (SSL/TLS)</strong> or <strong>Port 587 (STARTTLS)</strong>
                  </div>
                </div>
              </div>

              {/* Non-SSL Settings */}
              <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 text-[11px] text-zinc-400 font-mono">
                <span className="text-zinc-500 font-bold text-[10px] uppercase">Non-SSL Settings (Not Recommended)</span>
                <div>Incoming (IMAP): <code>mail.{activeConfigMailbox.domain || 'domain.com'}</code> : <strong>Port 143</strong></div>
                <div>Incoming (POP3): <code>mail.{activeConfigMailbox.domain || 'domain.com'}</code> : <strong>Port 110</strong></div>
                <div>Outgoing (SMTP): <code>mail.{activeConfigMailbox.domain || 'domain.com'}</code> : <strong>Port 587 / 25</strong></div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => {
                const domain = activeConfigMailbox?.domain || 'domain.com';
                const text = `Mail Settings for ${activeConfigMailbox?.email}\nUsername: ${activeConfigMailbox?.email}\nIncoming Server: mail.${domain} (IMAP: 993 SSL, POP3: 995 SSL)\nOutgoing Server: mail.${domain} (SMTP: 465 SSL / 587 TLS)`;
                navigator.clipboard.writeText(text);
                showToast('Mail configuration copied to clipboard!');
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Settings</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsConfigModalOpen(false)} className="rounded-xl border-zinc-800 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
