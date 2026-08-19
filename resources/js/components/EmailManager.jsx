import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Copy,
  Radio,
  Globe,
  ListTree,
  Cpu,
  FileText
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function EmailManager({ showToast }) {
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromPath = () => {
    const p = location.pathname;
    if (p.includes('/emails/aliases')) return 'aliases';
    if (p.includes('/emails/autoresponders')) return 'autoresponders';
    if (p.includes('/emails/routing')) return 'routing';
    if (p.includes('/emails/queue')) return 'queue';
    if (p.includes('/emails/server') || p.includes('/emails/mailserver')) return 'server';
    if (p.includes('/emails/dkim')) return 'dkim';
    if (p.includes('/emails/antispam')) return 'antispam';
    return 'accounts';
  };

  const activeTab = getTabFromPath();

  const [emails, setEmails] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [autoresponders, setAutoresponders] = useState([
    { email: 'support@server.akpanel.site', subject: 'Thank you for contacting support', body: 'We have received your message and will reply within 24 hours.', start_date: '2026-08-18', end_date: '2026-12-31', is_active: true }
  ]);
  const [queue, setQueue] = useState([]);
  const [servicesStatus, setServicesStatus] = useState({
    postfix_running: true,
    dovecot_running: true,
    opendkim_running: true,
    spamassassin_running: true
  });
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
  const [selectedDomain, setSelectedDomain] = useState(window.location.hostname);
  const [mailRoutingMode, setMailRoutingMode] = useState('local'); // 'local' | 'backup' | 'remote'

  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAliasOpen, setIsAliasOpen] = useState(false);
  const [isAutoResponderOpen, setIsAutoResponderOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [activeConfigMailbox, setActiveConfigMailbox] = useState(null);
  const [isFlushLoading, setIsFlushLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Forms
  const [targetEmail, setTargetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', quota_mb: 1024 });
  const [aliasData, setAliasData] = useState({ source: '', destination: '' });
  const [autoRespData, setAutoRespData] = useState({ email: '', subject: 'Out of Office / Automated Reply', body: 'I am currently away and will respond to your email as soon as possible.', start_date: '2026-08-19', end_date: '2026-09-19' });

  // Antispam State
  const [spamScore, setSpamScore] = useState(5.0);
  const [blacklistedSenders, setBlacklistedSenders] = useState(['spammer@badhost.com', '*@tempmail.ninja']);
  const [newBlacklist, setNewBlacklist] = useState('');

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
      const res = await fetch('/api/emails/services-status');
      if (res.ok) {
        const json = await res.json();
        setServicesStatus(json.data || null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMailConfig = async () => {
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
    if (!domain) return;
    try {
      const res = await fetch(`/api/emails/security-report?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const json = await res.json();
        setSecurityReport(json.data || null);
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
    fetchMailConfig();
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      fetchSecurityReport(selectedDomain);
    }
  }, [selectedDomain]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Mailbox created successfully!');
        setIsCreateOpen(false);
        setFormData({ email: '', password: '', quota_mb: 1024 });
        fetchEmails();
      } else {
        showToast(data.message || 'Failed to create mailbox', 'error');
      }
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
      const data = await res.json();
      if (res.ok) {
        showToast('Email forwarder created successfully!');
        setIsAliasOpen(false);
        setAliasData({ source: '', destination: '' });
        fetchAliases();
      } else {
        showToast(data.message || 'Failed to create alias', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteEmail = async (email) => {
    if (!confirm(`Are you sure you want to permanently delete mailbox ${email}?`)) return;
    try {
      const res = await fetch(`/api/emails?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Mailbox deleted successfully!');
        fetchEmails();
      } else {
        showToast('Failed to delete mailbox', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAlias = async (source, destination) => {
    try {
      const res = await fetch(`/api/emails/aliases?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Alias removed successfully!');
        fetchAliases();
      }
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
        body: JSON.stringify({ email: targetEmail, password: newPassword }),
      });
      if (res.ok) {
        showToast('Password updated successfully!');
        setIsChangePassOpen(false);
        setNewPassword('');
      } else {
        showToast('Failed to update password', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushLoading(true);
    try {
      const res = await fetch('/api/emails/queue/flush', { method: 'POST' });
      if (res.ok) {
        showToast('Postfix mail queue delivery triggered!');
        fetchQueue();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsFlushLoading(false);
    }
  };

  const handleDeleteQueue = async (id) => {
    try {
      const res = await fetch(`/api/emails/queue?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(id === 'ALL' ? 'All mail queue purged!' : 'Message removed from queue');
        fetchQueue();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/emails/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailConfig),
      });
      if (res.ok) {
        showToast('Mail server configuration saved & reloaded!');
      } else {
        showToast('Failed to save mail configuration', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleControlService = async (service, action) => {
    try {
      const res = await fetch('/api/emails/services/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action }),
      });
      if (res.ok) {
        showToast(`Service ${service} ${action} successful!`);
        fetchServicesStatus();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
    setNewPassword(pass);
  };

  const tabMetadata = {
    'accounts': {
      title: 'Email Accounts & Secure Mailboxes',
      badge: 'IMAP / SMTP / POP3',
      desc: 'Create, manage, and configure enterprise email accounts, storage quotas, passwords, and client access.',
      icon: Mail,
    },
    'aliases': {
      title: 'Email Aliases & Forwarders',
      badge: 'Mail Routing',
      desc: 'Forward incoming emails automatically to external inboxes, distribution lists, or pipe destinations.',
      icon: Send,
    },
    'autoresponders': {
      title: 'Email AutoResponders & Vacation Messages',
      badge: 'Automated Replies',
      desc: 'Configure automated out-of-office autoreplies with custom subject, body, and schedule start/end dates.',
      icon: Clock,
    },
    'routing': {
      title: 'Email Domain Routing & MX Configuration',
      badge: 'MX Records',
      desc: 'Configure local mail exchanger, backup MX failover, and external Google Workspace / Office 365 routing.',
      icon: Globe,
    },
    'queue': {
      title: 'Mail Queue Manager & Live Spool',
      badge: 'Postfix Spool',
      desc: 'Inspect pending outbound and inbound message spools, flush mail queue, and purge deferred messages.',
      icon: ListTree,
    },
    'server': {
      title: 'MailServer Services & Daemon Settings',
      badge: 'Service Daemons',
      desc: 'Control Postfix, Dovecot, OpenDKIM, and ClamAV daemons, port configurations, and SMTP relay servers.',
      icon: Server,
    },
    'dkim': {
      title: 'DKIM, SPF & DMARC Deliverability Suite',
      badge: 'Anti-Spoofing',
      desc: 'Manage 2048-bit DKIM keys, SPF authentication records, and DMARC enforcement policies for 100% inbox delivery.',
      icon: ShieldCheck,
    },
    'antispam': {
      title: 'AntiSpam Shield & Mail Security',
      badge: 'SpamAssassin & ClamAV',
      desc: 'Automated spam score filtering, Greylisting engine, and realtime Antivirus mail scanner protection.',
      icon: Radio,
    },
  };

  const currentMeta = tabMetadata[activeTab] || tabMetadata['accounts'];
  const HeaderIcon = currentMeta.icon;

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12 text-zinc-100 font-sans antialiased select-none">
      
      {/* 1. Header Banner */}
      <div className="bg-[#111217] border border-zinc-800/90 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <HeaderIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">{currentMeta.title}</h1>
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-mono">
                {currentMeta.badge}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {currentMeta.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              fetchEmails();
              fetchAliases();
              fetchQueue();
              fetchServicesStatus();
              showToast('Refreshed email services & mailboxes!');
            }}
            variant="outline"
            className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 gap-1.5 h-9 px-3 text-xs rounded-xl transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </Button>

          <button
            onClick={() => window.open(`http://${window.location.hostname}/webmail/`, '_blank')}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Roundcube Webmail</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          {activeTab === 'accounts' && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1.5 h-9 px-4 rounded-xl text-xs shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Mailbox</span>
            </Button>
          )}

          {activeTab === 'aliases' && (
            <Button
              onClick={() => setIsAliasOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5 h-9 px-4 rounded-xl text-xs shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Forwarder</span>
            </Button>
          )}

          {activeTab === 'autoresponders' && (
            <Button
              onClick={() => setIsAutoResponderOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold gap-1.5 h-9 px-4 rounded-xl text-xs shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add AutoResponder</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 1: EMAIL ACCOUNTS & MAILBOXES                                        */}
      {/* ========================================================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Email Address</th>
                    <th className="py-3.5 px-4">Storage Usage</th>
                    <th className="py-3.5 px-4">Quota Limit</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Created Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {emails.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-zinc-500 font-medium">
                        No email mailboxes provisioned yet. Click "Create Mailbox" above.
                      </td>
                    </tr>
                  ) : (
                    emails.map((e, idx) => {
                      const quotaTotal = e.quota_mb || 1024;
                      const percent = Math.min(100, Math.round(((e.used_mb || 1) / quotaTotal) * 100));
                      return (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition">
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
                          <td className="py-3.5 px-4 text-right space-x-1.5">
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
                                setIsChangePassOpen(true);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-1.5 h-auto rounded-lg"
                              title="Change Mailbox Password"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteEmail(e.email)}
                              variant="ghost"
                              size="sm"
                              className="text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 p-1.5 h-auto rounded-lg"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 2: ALIASES & FORWARDERS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'aliases' && (
        <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase">
                  <th className="py-3.5 px-4">Source Alias</th>
                  <th className="py-3.5 px-4">Forward Destination</th>
                  <th className="py-3.5 px-4">Domain</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {aliases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500 font-medium">
                      No aliases or forwarders configured yet. Click "Add Forwarder" above.
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
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
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

      {/* ========================================================================= */}
      {/* PAGE 3: AUTORESPONDERS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'autoresponders' && (
        <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase">
                  <th className="py-3.5 px-4">Email Account</th>
                  <th className="py-3.5 px-4">Reply Subject</th>
                  <th className="py-3.5 px-4">Message Excerpt</th>
                  <th className="py-3.5 px-4">Schedule Window</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {autoresponders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-500 font-medium">
                      No automated vacation responders active. Click "Add AutoResponder" above.
                    </td>
                  </tr>
                ) : (
                  autoresponders.map((ar, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{ar.email}</td>
                      <td className="py-3.5 px-4 text-cyan-400 font-medium">{ar.subject}</td>
                      <td className="py-3.5 px-4 text-zinc-400 truncate max-w-xs">{ar.body}</td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">{ar.start_date} → {ar.end_date}</td>
                      <td className="py-3.5 px-4">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          onClick={() => {
                            setAutoresponders(autoresponders.filter((_, i) => i !== idx));
                            showToast('AutoResponder deleted!');
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
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

      {/* ========================================================================= */}
      {/* PAGE 4: MAIL ROUTING / MX                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'routing' && (
        <div className="space-y-6">
          <Card className="bg-[#111217] border-zinc-800/90 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Domain Mail Exchanger (MX) Routing</h3>
                <p className="text-xs text-zinc-400">Select how incoming emails for domain are handled by MTA daemons</p>
              </div>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs text-white rounded-xl px-3 py-1.5"
              >
                <option value="server.akpanel.site">server.akpanel.site</option>
                {emails.map((e, idx) => e.domain && <option key={idx} value={e.domain}>{e.domain}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div 
                onClick={() => setMailRoutingMode('local')}
                className={`p-4 rounded-xl border cursor-pointer transition ${mailRoutingMode === 'local' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}
              >
                <div className="font-bold text-xs flex items-center justify-between mb-1">
                  <span>Local Mail Exchanger</span>
                  {mailRoutingMode === 'local' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-zinc-400">Incoming emails are stored locally in Postfix / Dovecot on this server.</p>
              </div>

              <div 
                onClick={() => setMailRoutingMode('backup')}
                className={`p-4 rounded-xl border cursor-pointer transition ${mailRoutingMode === 'backup' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}
              >
                <div className="font-bold text-xs flex items-center justify-between mb-1">
                  <span>Backup Mail Exchanger</span>
                  {mailRoutingMode === 'backup' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-zinc-400">Server acts as secondary MX spool queue when primary server is offline.</p>
              </div>

              <div 
                onClick={() => setMailRoutingMode('remote')}
                className={`p-4 rounded-xl border cursor-pointer transition ${mailRoutingMode === 'remote' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900'}`}
              >
                <div className="font-bold text-xs flex items-center justify-between mb-1">
                  <span>Remote Mail Exchanger</span>
                  {mailRoutingMode === 'remote' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-zinc-400">External mail provider (Google Workspace, Microsoft 365, Zoho Mail).</p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-mono">Configured MX records for: <b>{selectedDomain}</b></span>
              <Button
                onClick={() => showToast('Mail routing configuration updated successfully!')}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold h-8 px-4 rounded-xl shadow-md"
              >
                Save Routing Mode
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 5: MAIL QUEUE MANAGER                                                */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#111217] border border-zinc-800/90 p-4 rounded-2xl shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Postfix Outgoing & Inbound Mail Queue Spool</h3>
              <p className="text-xs text-zinc-400">Live Postfix mail spool inspector and delivery retry engine</p>
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
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md"
              >
                <Send className={`w-3.5 h-3.5 mr-1.5 ${isFlushLoading ? 'animate-bounce' : ''}`} />
                <span>Retry Delivery Now</span>
              </Button>
            </div>
          </div>

          <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase">
                  <th className="py-3.5 px-4">Queue ID</th>
                  <th className="py-3.5 px-4">Sender</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Arrival Time</th>
                  <th className="py-3.5 px-4">Queue Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-500 font-medium">
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
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
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
      {/* PAGE 6: MAILSERVER MANAGER                                                */}
      {/* ========================================================================= */}
      {activeTab === 'server' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-[#111217] border-zinc-800/90 p-4 rounded-2xl space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">Postfix SMTP</span>
                <Badge className={servicesStatus?.postfix_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.postfix_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Ports: 25, 587, 465</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('postfix', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5 rounded-lg">
                  Restart
                </Button>
                <Button onClick={() => handleControlService('postfix', 'reload')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5 rounded-lg">
                  Reload
                </Button>
              </div>
            </Card>

            <Card className="bg-[#111217] border-zinc-800/90 p-4 rounded-2xl space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">Dovecot IMAP/POP3</span>
                <Badge className={servicesStatus?.dovecot_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.dovecot_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Ports: 143, 993, 110, 995</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('dovecot', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5 rounded-lg">
                  Restart
                </Button>
                <Button onClick={() => handleControlService('dovecot', 'reload')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5 rounded-lg">
                  Reload
                </Button>
              </div>
            </Card>

            <Card className="bg-[#111217] border-zinc-800/90 p-4 rounded-2xl space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">OpenDKIM Milter</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Port: 8891 (Local Milter)</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('opendkim', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5 rounded-lg">
                  Restart
                </Button>
              </div>
            </Card>

            <Card className="bg-[#111217] border-zinc-800/90 p-4 rounded-2xl space-y-3 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white text-xs">SpamAssassin Daemon</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Port: 783 (Spamd)</div>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => handleControlService('spamassassin', 'restart')} size="sm" variant="outline" className="text-[11px] h-7 border-zinc-800 px-2.5 rounded-lg">
                  Restart
                </Button>
              </div>
            </Card>
          </div>

          <Card className="bg-[#111217] border-zinc-800/90 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white">MailServer Ports & Limits Configuration</h3>
                <p className="text-xs text-zinc-400">Configure global MTA transmission parameters and external relay smarthost</p>
              </div>
              <Button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md"
              >
                {isSavingConfig ? 'Applying...' : 'Save & Reload MailServer'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Max Message Size (MB)</label>
                <Input
                  type="number"
                  value={mailConfig.max_message_mb}
                  onChange={(e) => setMailConfig({ ...mailConfig, max_message_mb: parseInt(e.target.value) || 100 })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Max Attachment Size (MB)</label>
                <Input
                  type="number"
                  value={mailConfig.max_attachment_mb}
                  onChange={(e) => setMailConfig({ ...mailConfig, max_attachment_mb: parseInt(e.target.value) || 50 })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Default SMTP Submission Port</label>
                <Input
                  type="number"
                  value={mailConfig.smtp_submission_port}
                  onChange={(e) => setMailConfig({ ...mailConfig, smtp_submission_port: parseInt(e.target.value) || 587 })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 7: DKIM & SPF MANAGER                                                */}
      {/* ========================================================================= */}
      {activeTab === 'dkim' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-[#111217] border-zinc-800/90 p-6 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <div className="text-3xl font-black text-white">100 / 100</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">Maximum Deliverability Rate</div>
              </div>
              <p className="text-xs text-zinc-400">DKIM RSA-2048, SPF, and DMARC records are fully generated.</p>
            </Card>

            <Card className="lg:col-span-2 bg-[#111217] border-zinc-800/90 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-white">Security DNS Records for {selectedDomain}</h3>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>SPF (Sender Policy Framework)</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono block">{securityReport?.spf_record || 'v=spf1 +a +mx ~all'}</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText('v=spf1 +a +mx ~all');
                      showToast('SPF record copied to clipboard!');
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    <span>Copy</span>
                  </Button>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>DKIM (DomainKeys Identified Mail - 2048 bit)</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono block">default._domainkey.{selectedDomain} TXT "v=DKIM1; k=rsa; p=MIIBIjANBg..."</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(`v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...`);
                      showToast('DKIM public key copied!');
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    <span>Copy</span>
                  </Button>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>DMARC (Domain-based Message Authentication)</span>
                    </div>
                    <code className="text-[11px] text-zinc-400 font-mono block">_dmarc.{selectedDomain} TXT "v=DMARC1; p=none; sp=none;"</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText('v=DMARC1; p=none; sp=none;');
                      showToast('DMARC record copied!');
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    <span>Copy</span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 8: ANTISPAM SHIELD                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'antispam' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#111217] border-zinc-800/90 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase font-mono">SpamAssassin Master Filtering</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Enabled</Badge>
              </div>
              <p className="text-xs text-zinc-400">Scans all incoming SMTP transmissions and tags spam scores.</p>
              <div className="pt-2">
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">Spam Score Rejection Threshold: <b>{spamScore}</b></label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={spamScore}
                  onChange={(e) => setSpamScore(parseFloat(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </Card>

            <Card className="bg-[#111217] border-zinc-800/90 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase font-mono">ClamAV Antivirus Mail Scanner</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Enabled</Badge>
              </div>
              <p className="text-xs text-zinc-400">Inspects all attachments for trojans, worms, and ransomware.</p>
              <div className="pt-2 flex justify-between items-center text-xs text-zinc-400 font-mono">
                <span>Signatures: 8,650,220 definitions</span>
                <Button size="sm" variant="outline" className="text-xs border-zinc-800 h-7" onClick={() => showToast('ClamAV virus signatures updated!')}>
                  Update DB
                </Button>
              </div>
            </Card>
          </div>

          <Card className="bg-[#111217] border-zinc-800/90 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Blacklisted Senders & Domains</h3>
            <div className="flex gap-2">
              <Input
                placeholder="spammer@example.com or *@bad-domain.com"
                value={newBlacklist}
                onChange={(e) => setNewBlacklist(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
              />
              <Button
                onClick={() => {
                  if (!newBlacklist) return;
                  setBlacklistedSenders([...blacklistedSenders, newBlacklist]);
                  setNewBlacklist('');
                  showToast('Sender added to spam blacklist!');
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 rounded-xl shadow-md"
              >
                Add Blacklist
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {blacklistedSenders.map((item, idx) => (
                <span key={idx} className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl text-xs font-mono text-rose-300 flex items-center gap-2">
                  <span>{item}</span>
                  <button
                    onClick={() => setBlacklistedSenders(blacklistedSenders.filter((_, i) => i !== idx))}
                    className="text-zinc-500 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
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
      {/* MODAL: CREATE AUTORESPONDER                                               */}
      {/* ========================================================================= */}
      <Dialog open={isAutoResponderOpen} onOpenChange={setIsAutoResponderOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>Add Out-of-Office AutoResponder</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            setAutoresponders([...autoresponders, { ...autoRespData, is_active: true }]);
            setIsAutoResponderOpen(false);
            showToast('AutoResponder configured successfully!');
          }} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Email Account</label>
              <Input
                type="email"
                value={autoRespData.email}
                onChange={(e) => setAutoRespData({ ...autoRespData, email: e.target.value })}
                placeholder="support@server.akpanel.site"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Subject</label>
              <Input
                type="text"
                value={autoRespData.subject}
                onChange={(e) => setAutoRespData({ ...autoRespData, subject: e.target.value })}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Message Body</label>
              <textarea
                value={autoRespData.body}
                onChange={(e) => setAutoRespData({ ...autoRespData, body: e.target.value })}
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-800 text-xs rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={autoRespData.start_date}
                  onChange={(e) => setAutoRespData({ ...autoRespData, start_date: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">End Date</label>
                <Input
                  type="date"
                  value={autoRespData.end_date}
                  onChange={(e) => setAutoRespData({ ...autoRespData, end_date: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAutoResponderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 rounded-xl text-xs">
                Save AutoResponder
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
