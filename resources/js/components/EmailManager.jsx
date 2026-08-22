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
  FileText,
  Eye,
  EyeOff
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
  const [autoresponders, setAutoresponders] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueStats, setQueueStats] = useState({ queued: 0, deferred: 0, sent: 0, bounced: 0, active: 0 });
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [isQueueDetailOpen, setIsQueueDetailOpen] = useState(false);
  const [queueDetail, setQueueDetail] = useState(null);
  const [queueContent, setQueueContent] = useState({ headers: '', body: '' });
  const [servicesStatus, setServicesStatus] = useState({
    postfix_running: false,
    dovecot_running: false,
    opendkim_running: false,
    spamassassin_running: false
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
  const [routes, setRoutes] = useState([]);
  const [routingDomain, setRoutingDomain] = useState('');
  const [mailRoutingMode, setMailRoutingMode] = useState('local'); // 'local' | 'backup' | 'remote'
  const [routingDestination, setRoutingDestination] = useState('');
  const [isSavingRouting, setIsSavingRouting] = useState(false);

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
  const [formData, setFormData] = useState({ username: '', domain: '', password: '', quota_mb: 1024 });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [allDomains, setAllDomains] = useState([]);
  const [aliasData, setAliasData] = useState({ source: '', destination: '' });
  const [autoRespData, setAutoRespData] = useState({
    email: '',
    subject: 'Out of Office / Automated Reply',
    body: 'I am currently away and will respond to your email as soon as possible.',
    interval_days: 1,
  });
  const [catchAllData, setCatchAllData] = useState({ domain: '', destination: '' });
  const [isSavingCatchAll, setIsSavingCatchAll] = useState(false);

  // Antispam State (mirrors /api/emails/antispam)
  const [antiSpam, setAntiSpam] = useState({
    enabled: true,
    required_score: 5.0,
    rewrite_subject: true,
    subject_tag: '[SPAM]',
    blacklist: [],
    whitelist: [],
    last_update: '',
  });
  const [newBlacklist, setNewBlacklist] = useState('');
  const [isSavingSpam, setIsSavingSpam] = useState(false);
  const [isUpdatingRules, setIsUpdatingRules] = useState(false);

  // Single place where a GET is turned into state, so a failing endpoint surfaces to the
  // user instead of silently leaving the tab looking empty but healthy.
  const loadJson = async (url, label) => {
    try {
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.message || `Failed to load ${label}`, 'error');
        return null;
      }
      return json;
    } catch (e) {
      showToast(`Failed to load ${label}: ${e.message}`, 'error');
      return null;
    }
  };

  const fetchEmails = async () => {
    setLoading(true);
    const json = await loadJson('/api/emails', 'mailboxes');
    if (json) {
      const list = json.data || [];
      setEmails(list);
      if (list.length > 0 && !selectedDomain) {
        setSelectedDomain(list[0].domain);
      }
    }
    setLoading(false);
  };

  const fetchAliases = async () => {
    const json = await loadJson('/api/emails/aliases', 'forwarders');
    if (json) setAliases(json.data || []);
  };

  const fetchAutoresponders = async () => {
    const json = await loadJson('/api/emails/autoresponders', 'autoresponders');
    if (json) setAutoresponders(json.data || []);
  };

  const fetchQueue = async () => {
    const json = await loadJson('/api/emails/queue', 'mail queue');
    if (json) {
      setQueue(json.data || []);
      setQueueStats(json.stats || {});
      setRecentDeliveries(json.recent || []);
    }
  };

  const fetchServicesStatus = async () => {
    const json = await loadJson('/api/emails/services', 'mail service status');
    if (json && json.data) setServicesStatus(json.data);
  };

  const fetchMailConfig = async () => {
    const json = await loadJson('/api/emails/config', 'mail server settings');
    if (json && json.data) setMailConfig(json.data);
  };

  const fetchAntiSpam = async () => {
    const json = await loadJson('/api/emails/antispam', 'anti-spam policy');
    if (json && json.data) {
      setAntiSpam({
        ...json.data,
        blacklist: json.data.blacklist || [],
        whitelist: json.data.whitelist || [],
      });
    }
  };

  const fetchRoutes = async () => {
    const json = await loadJson('/api/emails/routing', 'mail routing');
    if (json) setRoutes(json.data || []);
  };

  const fetchSecurityReport = async (domain) => {
    if (!domain) return;
    const json = await loadJson(
      `/api/emails/security-report?domain=${encodeURIComponent(domain)}`,
      'deliverability report'
    );
    if (json) setSecurityReport(json.data || null);
  };

  const fetchDomains = async () => {
    const json = await loadJson('/api/websites', 'domains');
    if (!json) return;
    const list = (json.data || []).map((w) => w.domain).filter(Boolean);
    setAllDomains(list);
    if (list.length > 0) {
      setFormData((prev) => ({ ...prev, domain: prev.domain || list[0] }));
      setRoutingDomain((prev) => prev || list[0]);
      setCatchAllData((prev) => ({ ...prev, domain: prev.domain || list[0] }));
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchAliases();
    fetchAutoresponders();
    fetchQueue();
    fetchServicesStatus();
    fetchMailConfig();
    fetchAntiSpam();
    fetchRoutes();
    fetchDomains();
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
        body: JSON.stringify({
          username: formData.username,
          domain: formData.domain,
          email: `${formData.username}@${formData.domain}`,
          password: formData.password,
          quota_mb: formData.quota_mb,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Mailbox created successfully!');
        setIsCreateOpen(false);
        setFormData({ username: '', domain: allDomains[0] || '', password: '', quota_mb: 1024 });
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

  // Shared POST helper: every mail mutation endpoint answers with {status, message}.
  const postJson = async (url, body, fallbackError) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || fallbackError, 'error');
        return null;
      }
      return data;
    } catch (err) {
      showToast(err.message || fallbackError, 'error');
      return null;
    }
  };

  const handleDeleteEmail = async (email) => {
    if (!confirm(`Are you sure you want to permanently delete mailbox ${email}?`)) return;
    const data = await postJson('/api/emails/delete', { email }, 'Failed to delete mailbox');
    if (data) {
      showToast(data.message || 'Mailbox deleted successfully!');
      fetchEmails();
      fetchAutoresponders();
    }
  };

  const handleDeleteAlias = async (source, destination) => {
    const data = await postJson(
      '/api/emails/aliases/delete',
      { source, destination },
      'Failed to remove forwarder'
    );
    if (data) {
      showToast(data.message || 'Alias removed successfully!');
      fetchAliases();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const data = await postJson(
      '/api/emails/password',
      { email: targetEmail, new_password: newPassword },
      'Failed to update password'
    );
    if (data) {
      showToast(data.message || 'Password updated successfully!');
      setIsChangePassOpen(false);
      setNewPassword('');
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushLoading(true);
    const data = await postJson('/api/emails/queue/flush', {}, 'Failed to flush mail queue');
    if (data) {
      showToast(data.message || 'Postfix mail queue delivery triggered!');
      fetchQueue();
    }
    setIsFlushLoading(false);
  };

  const handleDeleteQueue = async (id) => {
    const data = await postJson(
      '/api/emails/queue/delete',
      { queue_id: id },
      'Failed to remove message from queue'
    );
    if (data) {
      showToast(id === 'ALL' ? 'All mail queue purged!' : 'Message removed from queue');
      fetchQueue();
    }
  };

  const handleRetryQueueItem = async (queueId) => {
    const data = await postJson('/api/emails/queue/retry', { queue_id: queueId }, 'Failed to retry queue item');
    if (data) {
      showToast(data.message || 'Message queued for retry');
      fetchQueue();
    }
  };

  const openQueueDetail = async (item) => {
    setQueueDetail(item);
    setQueueContent({ headers: '', body: '' });
    setIsQueueDetailOpen(true);
    const json = await loadJson(`/api/emails/queue/content?queue_id=${encodeURIComponent(item.queue_id)}`, 'message content');
    if (json) {
      setQueueContent({ headers: json.headers || '', body: json.body || '' });
    }
  };

  const handleSaveAutoresponder = async (e) => {
    e.preventDefault();
    const data = await postJson(
      '/api/emails/autoresponders',
      {
        email: autoRespData.email,
        subject: autoRespData.subject,
        body: autoRespData.body,
        interval_days: Number(autoRespData.interval_days) || 1,
        enabled: true,
      },
      'Failed to save autoresponder'
    );
    if (data) {
      showToast(data.message || 'Autoresponder activated!');
      setIsAutoResponderOpen(false);
      fetchAutoresponders();
    }
  };

  const handleDeleteAutoresponder = async (email) => {
    const data = await postJson(
      '/api/emails/autoresponders/delete',
      { email },
      'Failed to remove autoresponder'
    );
    if (data) {
      showToast(data.message || 'Autoresponder removed!');
      fetchAutoresponders();
    }
  };

  const handleSaveAntiSpam = async (override) => {
    const payload = { ...antiSpam, ...(override || {}) };
    setIsSavingSpam(true);
    const data = await postJson('/api/emails/antispam', payload, 'Failed to apply anti-spam policy');
    if (data) {
      showToast(data.message || 'Anti-spam policy applied!');
      if (data.data) {
        setAntiSpam({
          ...data.data,
          blacklist: data.data.blacklist || [],
          whitelist: data.data.whitelist || [],
        });
      }
    }
    setIsSavingSpam(false);
  };

  const handleUpdateSpamRules = async () => {
    setIsUpdatingRules(true);
    const data = await postJson('/api/emails/antispam/update-rules', {}, 'Failed to update rule set');
    if (data) {
      showToast(data.message || 'SpamAssassin rule set updated!');
      fetchAntiSpam();
    }
    setIsUpdatingRules(false);
  };

  const handleSaveRouting = async () => {
    setIsSavingRouting(true);
    const data = await postJson(
      '/api/emails/routing',
      { domain: routingDomain, mode: mailRoutingMode, destination: routingDestination },
      'Failed to apply mail routing'
    );
    if (data) {
      showToast(data.message || 'Mail routing applied!');
      fetchRoutes();
    }
    setIsSavingRouting(false);
  };

  const handleDeleteRoute = async (domain) => {
    const data = await postJson('/api/emails/routing/delete', { domain }, 'Failed to remove route');
    if (data) {
      showToast(data.message || 'Routing rule removed!');
      fetchRoutes();
    }
  };

  // A catch-all is just a Postfix virtual alias whose source is the bare domain.
  const handleSaveCatchAll = async (e) => {
    if (e) e.preventDefault();
    if (!catchAllData.domain || !catchAllData.destination) {
      showToast('Select a domain and a destination mailbox', 'error');
      return;
    }
    setIsSavingCatchAll(true);
    const source = `@${catchAllData.domain}`;
    const existing = aliases.find((a) => a.source === source);
    if (existing) {
      await postJson(
        '/api/emails/aliases/delete',
        { source, destination: existing.destination },
        'Failed to replace catch-all'
      );
    }
    const data = await postJson(
      '/api/emails/aliases',
      { source, destination: catchAllData.destination },
      'Failed to set catch-all'
    );
    if (data) {
      showToast(`Catch-all for ${catchAllData.domain} now delivers to ${catchAllData.destination}`);
      fetchAliases();
    }
    setIsSavingCatchAll(false);
  };

  const handleRemoveCatchAll = async (domain) => {
    const source = `@${domain}`;
    const existing = aliases.find((a) => a.source === source);
    if (!existing) return;
    await handleDeleteAlias(source, existing.destination);
  };

  const catchAllAliases = aliases.filter((a) => a.source && a.source.startsWith('@'));

  const deliverabilityChecks = [
    { key: 'mx', label: 'MX (Mail Exchanger)', ok: !!securityReport?.mx_valid, value: securityReport?.mx_record || '' },
    { key: 'spf', label: 'SPF (Sender Policy Framework)', ok: !!securityReport?.spf_valid, value: securityReport?.spf_record || '' },
    { key: 'dkim', label: 'DKIM (DomainKeys Identified Mail)', ok: !!securityReport?.dkim_valid, value: securityReport?.dkim_record || '' },
    { key: 'dmarc', label: 'DMARC (Reporting & Alignment Policy)', ok: !!securityReport?.dmarc_valid, value: securityReport?.dmarc_record || '' },
    { key: 'ptr', label: 'PTR (Reverse DNS of the sending IP)', ok: !!securityReport?.ptr_valid, value: securityReport?.ptr_record || '' },
    { key: 'caa', label: 'CAA (Certificate Authority Authorization)', ok: !!securityReport?.caa_valid, value: securityReport?.caa_record || '' },
  ];
  const passedChecks = deliverabilityChecks.filter((c) => c.ok);
  const deliverabilityScore =
    securityReport?.deliverability_rate ??
    Math.round((passedChecks.length / deliverabilityChecks.length) * 100);

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    const data = await postJson('/api/emails/config', mailConfig, 'Failed to save mail configuration');
    if (data) {
      showToast(data.message || 'Mail server configuration saved & reloaded!');
    }
    setIsSavingConfig(false);
  };

  const handleControlService = async (service, action) => {
    const data = await postJson(
      '/api/emails/services/action',
      { service, action },
      `Failed to ${action} ${service}`
    );
    if (data) {
      showToast(data.message || `Service ${service} ${action} successful!`);
      fetchServicesStatus();
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
            onClick={() => window.open(`${window.location.origin}/roundcube/`, '_blank')}
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
                            {e.status === 'suspended' ? (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                Suspended
                              </span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400 font-mono">{e.created_at || '—'}</td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            <Button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/emails/webmail-sso?email=${encodeURIComponent(e.email)}`);
                                  const json = await res.json();
                                  if (!res.ok) throw new Error(json.message || 'SSO failed');
                                  window.open(json.url, '_blank');
                                } catch (err) {
                                  showToast(err.message, 'error');
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 p-1.5 h-auto rounded-lg"
                              title="Open webmail (auto login)"
                            >
                              <Inbox className="w-3.5 h-3.5" />
                            </Button>
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
                  <th className="py-3.5 px-4">Repeat Interval</th>
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
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        Every {ar.interval_days || 1} day(s) per sender
                      </td>
                      <td className="py-3.5 px-4">
                        {ar.enabled ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>
                        ) : (
                          <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/30">Disabled</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <Button
                          onClick={() => {
                            setAutoRespData({
                              email: ar.email,
                              subject: ar.subject,
                              body: ar.body,
                              interval_days: ar.interval_days || 1,
                            });
                            setIsAutoResponderOpen(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-zinc-400 hover:text-white p-1.5 h-auto rounded-lg"
                          title="Edit autoresponder"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteAutoresponder(ar.email)}
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
                          title="Delete autoresponder"
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
                value={routingDomain}
                onChange={(e) => {
                  const domain = e.target.value;
                  setRoutingDomain(domain);
                  const existing = routes.find((r) => r.domain === domain);
                  setMailRoutingMode(existing ? existing.mode : 'local');
                  setRoutingDestination(existing ? existing.destination || '' : '');
                }}
                className="bg-zinc-900 border border-zinc-800 text-xs text-white rounded-xl px-3 py-1.5"
              >
                <option value="">Select a domain…</option>
                {allDomains.map((d, idx) => (
                  <option key={`site-${idx}`} value={d}>{d}</option>
                ))}
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

            {mailRoutingMode !== 'local' && (
              <div className="pt-2">
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Destination mail server (hostname or IP)
                </label>
                <Input
                  value={routingDestination}
                  onChange={(e) => setRoutingDestination(e.target.value)}
                  placeholder="aspmx.l.google.com"
                  className="bg-zinc-900 border-zinc-800 text-white text-xs h-9 rounded-xl"
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Written to the Postfix transport map as
                  <span className="font-mono text-zinc-400">
                    {' '}{routingDomain || 'domain'} {mailRoutingMode === 'backup' ? 'relay' : 'smtp'}:[{routingDestination || 'host'}]
                  </span>
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-mono">
                Transport rule for: <b>{routingDomain || 'no domain selected'}</b>
              </span>
              <Button
                onClick={handleSaveRouting}
                disabled={!routingDomain || isSavingRouting}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold h-8 px-4 rounded-xl shadow-md"
              >
                {isSavingRouting ? 'Applying…' : 'Save Routing Mode'}
              </Button>
            </div>
          </Card>

          <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase">
                  <th className="py-3.5 px-4">Domain</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500 font-medium">
                      No explicit transport rules. All hosted domains deliver locally by default.
                    </td>
                  </tr>
                ) : (
                  routes.map((r, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{r.domain}</td>
                      <td className="py-3.5 px-4 text-blue-400 font-medium capitalize">{r.mode}</td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400">{r.destination || 'this server'}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">{r.updated_at || '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          onClick={() => handleDeleteRoute(r.domain)}
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
                          title="Remove transport rule"
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
      {/* PAGE 5: MAIL QUEUE MANAGER                                                */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'In Queue', value: queueStats.queued || 0, color: 'text-sky-400' },
              { label: 'Deferred', value: queueStats.deferred || 0, color: 'text-amber-400' },
              { label: 'Active', value: queueStats.active || 0, color: 'text-violet-400' },
              { label: 'Delivered', value: queueStats.sent || 0, color: 'text-emerald-400' },
              { label: 'Bounced', value: queueStats.bounced || 0, color: 'text-rose-400' },
            ].map((card) => (
              <Card key={card.label} className="bg-[#111217] border-zinc-800/90 p-4 rounded-2xl">
                <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{card.label}</div>
                <div className={`text-2xl font-bold font-mono mt-1 ${card.color}`}>{card.value}</div>
              </Card>
            ))}
          </div>

          <div className="flex justify-between items-center bg-[#111217] border border-zinc-800/90 p-4 rounded-2xl shadow-sm">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Postfix Mail Queue & Delivery Tracker</h3>
              <p className="text-xs text-zinc-400">Live spool, defer reasons, delivery log events, and per-message retry</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchQueue} variant="outline" className="border-zinc-800 bg-zinc-900 text-xs h-9 px-3 rounded-xl">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
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
                <span>Retry All Deferred</span>
              </Button>
            </div>
          </div>

          <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase">
                  <th className="py-3.5 px-4">Queue ID</th>
                  <th className="py-3.5 px-4">Sender</th>
                  <th className="py-3.5 px-4">Recipient(s)</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Arrival</th>
                  <th className="py-3.5 px-4">Status / Reason</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-zinc-500 font-medium">
                      Mail queue is empty — nothing waiting in Postfix spool.
                    </td>
                  </tr>
                ) : (
                  queue.map((q, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30 transition cursor-pointer" onClick={() => openQueueDetail(q)}>
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{q.queue_id}</td>
                      <td className="py-3.5 px-4 font-mono">{q.sender}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-300">
                        {(q.recipients && q.recipients.length ? q.recipients : [q.recipient]).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400">{q.size}</td>
                      <td className="py-3.5 px-4 text-zinc-400">{q.arrival}</td>
                      <td className="py-3.5 px-4">
                        <Badge className={q.status === 'deferred' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-sky-500/10 text-sky-400 border-sky-500/30'}>
                          {q.status}
                        </Badge>
                        {q.reason && <p className="text-[10px] text-zinc-500 mt-1 max-w-xs truncate">{q.reason}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button onClick={() => handleRetryQueueItem(q.queue_id)} variant="ghost" size="sm" className="text-sky-400 p-1.5 h-auto rounded-lg" title="Retry now">
                            <RotateCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button onClick={() => handleDeleteQueue(q.queue_id)} variant="ghost" size="sm" className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          <Card className="bg-[#111217] border-zinc-800/90 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-800 text-xs font-bold text-white uppercase tracking-wider">Recent Delivery Events</div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 uppercase">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">DSN</th>
                  <th className="py-3 px-4">Relay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recentDeliveries.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-zinc-500">No delivery events imported yet — send/receive mail to populate.</td></tr>
                ) : recentDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-800/20">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-500">{d.updated_at || d.created_at}</td>
                    <td className="py-2.5 px-4 font-mono text-emerald-300">{d.recipient}</td>
                    <td className="py-2.5 px-4">
                      <Badge className={
                        d.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : d.status === 'bounced' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }>{d.status}</Badge>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-zinc-400">{d.dsn || '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-zinc-500 truncate max-w-[200px]">{d.relay || d.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Dialog open={isQueueDetailOpen} onOpenChange={setIsQueueDetailOpen}>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white font-mono">Queue Item {queueDetail?.queue_id}</DialogTitle>
              </DialogHeader>
              {queueDetail && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div><span className="text-zinc-500">From:</span> {queueDetail.sender}</div>
                    <div><span className="text-zinc-500">Status:</span> {queueDetail.status}</div>
                    <div className="col-span-2"><span className="text-zinc-500">To:</span> {(queueDetail.recipients || []).join(', ')}</div>
                    {queueDetail.reason && <div className="col-span-2 text-amber-400">{queueDetail.reason}</div>}
                  </div>
                  <div>
                    <div className="text-zinc-500 mb-1 uppercase tracking-wider text-[10px]">Headers</div>
                    <pre className="bg-zinc-950 p-3 rounded-lg overflow-x-auto text-[11px] whitespace-pre-wrap">{queueContent.headers || 'Loading…'}</pre>
                  </div>
                  <div>
                    <div className="text-zinc-500 mb-1 uppercase tracking-wider text-[10px]">Body</div>
                    <pre className="bg-zinc-950 p-3 rounded-lg overflow-x-auto text-[11px] whitespace-pre-wrap max-h-64">{queueContent.body || 'Loading…'}</pre>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
                <Badge className={servicesStatus?.opendkim_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.opendkim_running ? 'Running' : 'Stopped'}
                </Badge>
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
                <Badge className={servicesStatus?.spamassassin_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.spamassassin_running ? 'Running' : 'Stopped'}
                </Badge>
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

          <Card className="bg-[#111217] border-zinc-800/90 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Domain Catch-All Delivery</h3>
              <p className="text-xs text-zinc-400">
                Deliver mail addressed to any non-existent mailbox on a domain into one inbox. Written to
                the Postfix <span className="font-mono">virtual_alias_maps</span> as
                <span className="font-mono"> @domain</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Domain</label>
                <select
                  value={catchAllData.domain}
                  onChange={(e) => setCatchAllData({ ...catchAllData, domain: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white rounded-xl px-3 h-9"
                >
                  <option value="">Select a domain…</option>
                  {allDomains.map((d, idx) => (
                    <option key={idx} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Destination mailbox</label>
                <select
                  value={catchAllData.destination}
                  onChange={(e) => setCatchAllData({ ...catchAllData, destination: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white rounded-xl px-3 h-9"
                >
                  <option value="">Select a mailbox…</option>
                  {emails.map((e, idx) => (
                    <option key={idx} value={e.email}>{e.email}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleSaveCatchAll}
                disabled={isSavingCatchAll}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md"
              >
                {isSavingCatchAll ? 'Applying…' : 'Set Catch-All'}
              </Button>
            </div>

            {catchAllAliases.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                {catchAllAliases.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5">
                    <span className="text-xs font-mono text-zinc-300">
                      {a.source} <ArrowUpRight className="w-3 h-3 inline text-zinc-500" /> {a.destination}
                    </span>
                    <Button
                      onClick={() => handleRemoveCatchAll(a.source.replace('@', ''))}
                      variant="ghost"
                      size="sm"
                      className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
                      title="Remove catch-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
              <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                deliverabilityScore >= 80
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : deliverabilityScore >= 50
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
              }`}>
                {deliverabilityScore >= 80 ? <ShieldCheck className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
              </div>
              <div>
                <div className="text-3xl font-black text-white">{deliverabilityScore} / 100</div>
                <div className="text-xs font-bold text-zinc-400 mt-0.5">Live Deliverability Score</div>
              </div>
              <p className="text-xs text-zinc-400">
                {securityReport
                  ? `${passedChecks.length} of ${deliverabilityChecks.length} DNS checks passing for ${selectedDomain}.`
                  : 'Resolving DNS records…'}
              </p>
              <Button
                onClick={() => fetchSecurityReport(selectedDomain)}
                size="sm"
                variant="outline"
                className="border-zinc-800 bg-zinc-900 text-xs h-8 rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                <span>Re-check DNS</span>
              </Button>
            </Card>

            <Card className="lg:col-span-2 bg-[#111217] border-zinc-800/90 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-white">Security DNS Records for {selectedDomain}</h3>
              <div className="space-y-3 text-xs">
                {deliverabilityChecks.map((check) => (
                  <div key={check.key} className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {check.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{check.label}</span>
                      </div>
                      <code className="text-[11px] text-zinc-400 font-mono block break-all">
                        {check.value || 'Not published on DNS yet'}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!check.value}
                      onClick={() => {
                        navigator.clipboard.writeText(check.value);
                        showToast(`${check.label} value copied!`);
                      }}
                      className="text-cyan-400 hover:text-cyan-300 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      <span>Copy</span>
                    </Button>
                  </div>
                ))}
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
                <Badge className={antiSpam.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'}>
                  {antiSpam.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">
                Wired into Postfix through <span className="font-mono">spamass-milter</span>; every inbound
                message is scored before delivery.
              </p>

              <label className="flex items-center gap-2 text-xs text-zinc-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={antiSpam.enabled}
                  onChange={(e) => setAntiSpam({ ...antiSpam, enabled: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Enable spam scanning for all inbound mail</span>
              </label>

              <div className="pt-1">
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  Spam Score Threshold: <b>{antiSpam.required_score}</b>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={antiSpam.required_score}
                  onChange={(e) => setAntiSpam({ ...antiSpam, required_score: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={antiSpam.rewrite_subject}
                  onChange={(e) => setAntiSpam({ ...antiSpam, rewrite_subject: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Tag the subject of flagged messages</span>
              </label>

              {antiSpam.rewrite_subject && (
                <Input
                  value={antiSpam.subject_tag}
                  onChange={(e) => setAntiSpam({ ...antiSpam, subject_tag: e.target.value })}
                  placeholder="[SPAM]"
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono h-9"
                />
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => handleSaveAntiSpam()}
                  disabled={isSavingSpam}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md"
                >
                  {isSavingSpam ? 'Applying…' : 'Apply Anti-Spam Policy'}
                </Button>
              </div>
            </Card>

            <Card className="bg-[#111217] border-zinc-800/90 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase font-mono">SpamAssassin Rule Set</span>
                <Badge className={servicesStatus?.spamassassin_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                  {servicesStatus?.spamassassin_running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">
                Runs <span className="font-mono">sa-update</span> and restarts the scanner so refreshed
                rules take effect immediately.
              </p>
              <div className="pt-2 flex justify-between items-center text-xs text-zinc-400 font-mono">
                <span>Last update: {antiSpam.last_update || 'never'}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUpdatingRules}
                  className="text-xs border-zinc-800 h-7"
                  onClick={handleUpdateSpamRules}
                >
                  {isUpdatingRules ? 'Updating…' : 'Update Rules'}
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
                  if (!newBlacklist.trim()) return;
                  const next = [...(antiSpam.blacklist || []), newBlacklist.trim()];
                  setAntiSpam({ ...antiSpam, blacklist: next });
                  setNewBlacklist('');
                  handleSaveAntiSpam({ blacklist: next });
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 rounded-xl shadow-md"
              >
                Add Blacklist
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(antiSpam.blacklist || []).length === 0 ? (
                <span className="text-xs text-zinc-500">No blacklisted senders configured yet.</span>
              ) : (
                (antiSpam.blacklist || []).map((item, idx) => (
                  <span key={idx} className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-xl text-xs font-mono text-rose-300 flex items-center gap-2">
                    <span>{item}</span>
                    <button
                      onClick={() => {
                        const next = (antiSpam.blacklist || []).filter((_, i) => i !== idx);
                        setAntiSpam({ ...antiSpam, blacklist: next });
                        handleSaveAntiSpam({ blacklist: next });
                      }}
                      className="text-zinc-500 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Username</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="info"
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain</label>
                <select
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 text-xs rounded-xl font-mono text-white px-3"
                  required
                >
                  {allDomains.length === 0 && <option value="">No domains</option>}
                  {allDomains.map((d) => (
                    <option key={d} value={d}>@{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                >
                  Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

          <form onSubmit={handleSaveAutoresponder} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Email Account</label>
              <select
                value={autoRespData.email}
                onChange={(e) => setAutoRespData({ ...autoRespData, email: e.target.value })}
                className="w-full h-10 bg-zinc-900 border border-zinc-800 text-xs rounded-xl font-mono text-white px-3"
                required
              >
                <option value="">Select a mailbox…</option>
                {emails.map((e, idx) => (
                  <option key={idx} value={e.email}>{e.email}</option>
                ))}
              </select>
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

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Repeat interval (days per sender)
              </label>
              <Input
                type="number"
                min="1"
                max="30"
                value={autoRespData.interval_days}
                onChange={(e) => setAutoRespData({ ...autoRespData, interval_days: parseInt(e.target.value) || 1 })}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Dovecot Sieve will not reply to the same sender again within this window.
              </p>
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

      {/* Panel: Mail Client Manual Settings */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent position="bottom" className="bg-zinc-950 border-zinc-800 text-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Mail Client Manual Settings (IMAP / SMTP)</span>
            </DialogTitle>
          </DialogHeader>

          {activeConfigMailbox && (
            <div className="space-y-4 text-xs pt-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Secure SSL/TLS Settings (Recommended)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-zinc-300 font-mono">
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                  <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">IMAP</span>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Server</span>
                    <strong className="text-white">mail.{activeConfigMailbox.domain || 'domain.com'}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Port</span>
                    <strong className="text-white">993 (SSL/TLS)</strong>
                  </div>
                </div>
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                  <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">POP3</span>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Server</span>
                    <strong className="text-white">mail.{activeConfigMailbox.domain || 'domain.com'}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Port</span>
                    <strong className="text-white">995 (SSL/TLS)</strong>
                  </div>
                </div>
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                  <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">SMTP</span>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Server</span>
                    <strong className="text-white">mail.{activeConfigMailbox.domain || 'domain.com'}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Port</span>
                    <strong className="text-white">465 (SSL/TLS)</strong> or <strong className="text-white">587 (STARTTLS)</strong>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 text-[11px] text-zinc-400 font-mono">
                <span className="text-zinc-500 font-bold text-[10px] uppercase">Non-SSL Settings (Not Recommended)</span>
                <div>Incoming (IMAP): <code>mail.{activeConfigMailbox.domain || 'domain.com'}</code> : <strong>Port 143</strong></div>
                <div>Incoming (POP3): <code>mail.{activeConfigMailbox.domain || 'domain.com'}</code> : <strong>Port 110</strong></div>
                <div>Outgoing (SMTP): <code>mail.{activeConfigMailbox.domain || 'domain.com'}</code> : <strong>Port 587 / 25</strong></div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 sm:justify-between sm:items-center">
            <div className="font-mono text-xs text-left">
              <span className="text-zinc-500 text-[11px] block">Mailbox Account</span>
              <span className="text-white font-bold text-sm">{activeConfigMailbox?.email}</span>
            </div>
            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
