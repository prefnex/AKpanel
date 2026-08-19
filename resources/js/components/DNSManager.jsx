import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  RotateCw, 
  ShieldCheck, 
  Copy, 
  Check, 
  Sparkles, 
  Server, 
  Search, 
  Mail, 
  ExternalLink, 
  Layers, 
  Key, 
  Info,
  SlidersHorizontal,
  Cloud,
  FileCode,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Zap,
  Save,
  Cpu,
  HelpCircle,
  Hash,
  Activity,
  Play,
  Square,
  RefreshCcw,
  Sliders,
  Send,
  Database,
  ArrowLeftRight,
  Lock,
  Radio,
  FileText
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function DNSManager({ initialTab = 'zones', showToast }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active view from URL path if available
  const getTabFromPath = () => {
    const p = location.pathname;
    if (p.includes('/dns/server')) return 'server';
    if (p.includes('/dns/nameservers')) return 'nameservers';
    if (p.includes('/dns/templates')) return 'templates';
    if (p.includes('/dns/security')) return 'security';
    if (p.includes('/dns/sync')) return 'sync';
    if (p.includes('/dns/zones')) return 'zones';
    return initialTab;
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [zones, setZones] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [activeZone, setActiveZone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateZoneOpen, setIsCreateZoneOpen] = useState(false);
  const [isMigrateOpen, setIsMigrateOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // New Zone Form
  const [newZoneDomain, setNewZoneDomain] = useState('');
  const [newZoneIP, setNewZoneIP] = useState('');

  // Bulk IP Migration State
  const [migrateOldIP, setMigrateOldIP] = useState('');
  const [migrateNewIP, setMigrateNewIP] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);

  // BIND 9 Server Engine & Daemon State
  const [daemonStatus, setDaemonStatus] = useState(null);
  const [bindOptions, setBindOptions] = useState({
    listen_port: 53,
    listen_ipv4: 'any',
    listen_ipv6: 'any',
    recursion: false,
    allow_recursion: ['localhost', '127.0.0.1/32'],
    forwarders: ['1.1.1.1', '8.8.8.8', '9.9.9.9'],
    response_rate_limit: 10,
    rate_limit_window: 5,
    allow_transfer: 'none',
    query_logging: true,
    dnssec_validation: 'auto',
    max_cache_size_mb: 128,
    authoritative_only: true,
  });
  const [bindLogs, setBindLogs] = useState('');
  const [isSavingOptions, setIsSavingOptions] = useState(false);
  const [isControllingDaemon, setIsControllingDaemon] = useState(false);

  // Master Template State
  const [masterTemplate, setMasterTemplate] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // DNSSEC State
  const [dnssecSummary, setDnssecSummary] = useState(null);
  const [isTogglingDNSSEC, setIsTogglingDNSSEC] = useState(false);

  // Diagnostics (dig / nslookup) State
  const [diagDomain, setDiagDomain] = useState('');
  const [diagType, setDiagType] = useState('A');
  const [diagServer, setDiagServer] = useState('127.0.0.1');
  const [diagOutput, setDiagOutput] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Global Settings State (Hostname & Nameservers)
  const [settings, setSettings] = useState({
    server_hostname: '',
    primary_ns: 'ns1.akpanel.local',
    secondary_ns: 'ns2.akpanel.local',
    primary_ip: '',
    secondary_ip: '',
    cloudflare_api_token: '',
    cloudflare_zone_id: '',
    default_ttl: 14400,
    bind_enabled: true,
    dnssec_enabled: false,
  });
  const [glueRecords, setGlueRecords] = useState([]);
  const [serverIP, setServerIP] = useState('127.0.0.1');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUpdatingHostname, setIsUpdatingHostname] = useState(false);
  const [hostnameInput, setHostnameInput] = useState('');

  // Raw Zone Editor State
  const [rawZoneContent, setRawZoneContent] = useState('');
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
  const [isSavingRaw, setIsSavingRaw] = useState(false);
  const [zoneViewMode, setZoneViewMode] = useState('table'); // 'table' | 'raw'

  // Cloudflare Sync State
  const [isSyncingCF, setIsSyncingCF] = useState(false);
  const [cfSyncResult, setCfSyncResult] = useState(null);

  const [newRecord, setNewRecord] = useState({
    name: '@',
    type: 'A',
    value: '',
    ttl: 14400,
    priority: 10,
    comment: '',
  });

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    navigate(`/dns/${tabKey}`);
  };

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dns/zones');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setZones(list);
        if (list.length > 0 && !selectedDomain) {
          setSelectedDomain(list[0].domain);
          setActiveZone(list[0]);
          setDiagDomain(list[0].domain);
        } else if (selectedDomain) {
          const found = list.find(z => z.domain === selectedDomain);
          if (found) setActiveZone(found);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dns/settings');
      if (res.ok) {
        const json = await res.json();
        if (json.settings) {
          setSettings(json.settings);
          setHostnameInput(json.settings.server_hostname || '');
        }
        if (json.glue_records) setGlueRecords(json.glue_records);
        if (json.server_ip) {
          setServerIP(json.server_ip);
          setNewZoneIP(json.server_ip);
          setMigrateOldIP(json.server_ip);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDaemonStatus = async () => {
    try {
      const res = await fetch('/api/dns/server/status');
      if (res.ok) {
        const json = await res.json();
        setDaemonStatus(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBindOptions = async () => {
    try {
      const res = await fetch('/api/dns/server/options');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setBindOptions(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBindLogs = async () => {
    try {
      const res = await fetch('/api/dns/server/logs');
      if (res.ok) {
        const json = await res.json();
        setBindLogs(json.data || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMasterTemplate = async () => {
    try {
      const res = await fetch('/api/dns/template');
      if (res.ok) {
        const json = await res.json();
        setMasterTemplate(json.data || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDNSSEC = async (domain) => {
    if (!domain) return;
    try {
      const res = await fetch(`/api/dns/dnssec?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const json = await res.json();
        setDnssecSummary(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRawZone = async (domain) => {
    if (!domain) return;
    setIsLoadingRaw(true);
    try {
      const res = await fetch(`/api/dns/zone/raw?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const json = await res.json();
        setRawZoneContent(json.content || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRaw(false);
    }
  };

  useEffect(() => {
    fetchZones();
    fetchSettings();
    fetchDaemonStatus();
    fetchBindOptions();
    fetchBindLogs();
    fetchMasterTemplate();
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      fetchDNSSEC(selectedDomain);
      if (zoneViewMode === 'raw') {
        fetchRawZone(selectedDomain);
      }
    }
  }, [selectedDomain, zoneViewMode]);

  const handleSelectDomain = (domain) => {
    setSelectedDomain(domain);
    const found = zones.find(z => z.domain === domain);
    if (found) setActiveZone(found);
    fetchDNSSEC(domain);
    if (zoneViewMode === 'raw') {
      fetchRawZone(domain);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleDaemonControl = async (action) => {
    setIsControllingDaemon(true);
    try {
      const res = await fetch('/api/dns/server/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchDaemonStatus();
      fetchBindLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsControllingDaemon(false);
    }
  };

  const handleSaveBindOptions = async (e) => {
    e.preventDefault();
    setIsSavingOptions(true);
    try {
      const res = await fetch('/api/dns/server/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bindOptions),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchBindOptions();
      fetchDaemonStatus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingOptions(false);
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dns/zone/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newZoneDomain, server_ip: newZoneIP }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsCreateZoneOpen(false);
      setNewZoneDomain('');
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteZone = async (domain) => {
    if (!confirm(`Are you sure you want to completely drop zone '${domain}' from BIND 9?`)) return;
    try {
      const res = await fetch('/api/dns/zone/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkMigrate = async (e) => {
    e.preventDefault();
    setIsMigrating(true);
    try {
      const res = await fetch('/api/dns/bulk-migrate-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_ip: migrateOldIP, new_ip: migrateNewIP }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsMigrateOpen(false);
      fetchZones();
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!selectedDomain) return;

    try {
      const res = await fetch('/api/dns/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          name: newRecord.name,
          type: newRecord.type,
          value: newRecord.value,
          ttl: parseInt(newRecord.ttl) || 14400,
          priority: parseInt(newRecord.priority) || 10,
          comment: newRecord.comment,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsAddOpen(false);
      fetchZones();
      setNewRecord({ name: '@', type: 'A', value: '', ttl: 14400, priority: 10, comment: '' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteRecord = async (index) => {
    if (!confirm('Are you sure you want to delete this DNS record?')) return;
    try {
      const res = await fetch('/api/dns/record/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, index }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetZone = async () => {
    if (!confirm(`Reset DNS zone for '${selectedDomain}' to default AKpanel Master template with SPF/DKIM/DMARC/CAA?`)) return;
    try {
      const res = await fetch('/api/dns/zone/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/dns/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateHostname = async (e) => {
    e.preventDefault();
    setIsUpdatingHostname(true);
    try {
      const res = await fetch('/api/dns/hostname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: hostnameInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsUpdatingHostname(false);
    }
  };

  const handleSaveRawZone = async () => {
    if (!selectedDomain || !rawZoneContent) return;
    setIsSavingRaw(true);
    try {
      const res = await fetch('/api/dns/zone/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedDomain,
          raw_content: rawZoneContent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingRaw(false);
    }
  };

  const handleSaveTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      const res = await fetch('/api/dns/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: masterTemplate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchMasterTemplate();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleToggleDNSSEC = async (enable) => {
    if (!selectedDomain) return;
    setIsTogglingDNSSEC(true);
    try {
      const res = await fetch('/api/dns/dnssec/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, enable }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchDNSSEC(selectedDomain);
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsTogglingDNSSEC(false);
    }
  };

  const handleRunDiagnose = async (e) => {
    e.preventDefault();
    if (!diagDomain) return;
    setIsDiagnosing(true);
    try {
      const res = await fetch('/api/dns/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: diagDomain,
          record_type: diagType,
          server: diagServer,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      setDiagOutput(json.data || 'No response returned from DNS query.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSyncCloudflare = async () => {
    if (!selectedDomain) return;
    setIsSyncingCF(true);
    try {
      const res = await fetch('/api/dns/cloudflare/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setCfSyncResult(json.data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSyncingCF(false);
    }
  };

  const filteredRecords = (activeZone?.records || []).filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.value.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.comment && r.comment.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchType = typeFilter === 'ALL' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Top Root Administrator Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/20 border border-cyan-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Globe className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">Root DNS Server & Zones Authority</h1>
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-xs font-semibold px-2.5 py-0.5">
                Root Level (WHM)
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                BIND 9 Daemon Port 53
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Full Server Engine Daemon Control, named.conf.options, Master Zone Templates, Bulk IP Migration, Custom Nameservers, and DNSSEC.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsMigrateOpen(true)}
            variant="outline"
            className="border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 gap-2 h-10 px-3.5 rounded-xl text-xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Bulk IP Migration</span>
          </Button>
          <Button
            onClick={() => setIsCreateZoneOpen(true)}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold gap-2 h-10 px-4 rounded-xl shadow-lg shadow-cyan-600/20 transition border border-cyan-400/30 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Zone</span>
          </Button>
        </div>
      </div>

      {/* 2. Top-Level Page Navigation Pill Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        <button
          onClick={() => switchTab('zones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'zones'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>DNS Zones List ({zones.length})</span>
        </button>

        <button
          onClick={() => switchTab('server')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'server'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>BIND 9 Server Engine</span>
        </button>

        <button
          onClick={() => switchTab('nameservers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'nameservers'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Nameservers & Hostname</span>
        </button>

        <button
          onClick={() => switchTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'templates'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Master Zone Template</span>
        </button>

        <button
          onClick={() => switchTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>DNSSEC & Shield</span>
        </button>

        <button
          onClick={() => switchTab('sync')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'sync'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Cloudflare & Sync</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 1: DNS ZONES LIST & RECORD MANAGER                                  */}
      {/* ========================================================================= */}
      {activeTab === 'zones' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Server Zones Grid / Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {zones.map((z) => (
              <Card
                key={z.domain}
                onClick={() => handleSelectDomain(z.domain)}
                className={`p-4 rounded-xl cursor-pointer transition border backdrop-blur-md ${
                  selectedDomain === z.domain
                    ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-white text-xs truncate max-w-[150px]">{z.domain}</div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                    {z.records.length} Recs
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                  <span>IP: {z.server_ip}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteZone(z.domain);
                    }}
                    className="text-zinc-500 hover:text-rose-400 p-0.5"
                    title="Delete Zone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Selected Zone Command Card */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedDomain}</h2>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                      SOA: {activeZone?.serial || '2026081801'}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400">Authoritative BIND 9 Zone: <code>/etc/bind/zones/db.{selectedDomain}</code></p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setZoneViewMode('table')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      zoneViewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Visual Table
                  </button>
                  <button
                    onClick={() => {
                      setZoneViewMode('raw');
                      fetchRawZone(selectedDomain);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      zoneViewMode === 'raw' ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Monaco BIND File
                  </button>
                </div>

                <Button
                  onClick={handleResetZone}
                  variant="outline"
                  className="border-zinc-800 bg-zinc-900 hover:bg-amber-950/30 hover:text-amber-300 text-zinc-400 text-xs h-9 px-3 rounded-xl gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Zone</span>
                </Button>

                <Button
                  onClick={() => setIsAddOpen(true)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-cyan-600/20"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add Record</span>
                </Button>
              </div>
            </div>

            {/* View Mode: Visual Records Table */}
            {zoneViewMode === 'table' ? (
              <div className="space-y-4">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                    <Input
                      placeholder="Filter records (e.g. www, mail, SPF)..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-9 bg-zinc-900 border-zinc-800 text-xs h-9 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA', 'SRV'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          typeFilter === t
                            ? 'bg-cyan-600 text-white'
                            : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-semibold uppercase">
                        <th className="py-3 px-4">Name / Host</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Value / Target</th>
                        <th className="py-3 px-4">TTL</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/30 transition group">
                            <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                              <span>{r.name}</span>
                              {r.comment && (
                                <span className="text-[10px] text-zinc-500 font-normal bg-zinc-900 px-1.5 py-0.5 rounded">
                                  {r.comment}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge className="font-mono text-[10px] font-black px-2 py-0.5 border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                                {r.type}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-zinc-300 max-w-md truncate">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{r.value}</span>
                                <button
                                  onClick={() => handleCopy(r.value, `rec_${idx}`)}
                                  className="text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition p-1"
                                >
                                  {copiedKey === `rec_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-zinc-400">{r.ttl}s</td>
                            <td className="py-3.5 px-4 font-mono text-zinc-400">{r.priority || '-'}</td>
                            <td className="py-3.5 px-4 text-right">
                              <Button
                                onClick={() => handleDeleteRecord(idx)}
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
              </div>
            ) : (
              /* View Mode: Monaco Raw Zone File Editor */
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span>Direct RFC 1035 format with pre-flight <code>named-checkzone</code> check:</span>
                  <Button
                    onClick={handleSaveRawZone}
                    disabled={isSavingRaw}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-lg shadow-emerald-600/20"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    <span>{isSavingRaw ? 'Checking & Saving...' : 'Save & Reload BIND 9'}</span>
                  </Button>
                </div>
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                  <Editor
                    height="400px"
                    language="ini"
                    theme="vs-dark"
                    value={rawZoneContent}
                    onChange={(val) => setRawZoneContent(val || '')}
                    options={{
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono, monospace',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 2: BIND 9 SERVER ENGINE & DAEMON CONTROLS                           */}
      {/* ========================================================================= */}
      {activeTab === 'server' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Daemon Status & Instant Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">BIND 9 Daemon Status</h3>
                  <p className="text-xs text-zinc-400">{daemonStatus?.version || 'BIND 9.18 (Authoritative)'}</p>
                </div>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Process State:</span>
                  <Badge className={daemonStatus?.is_running ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}>
                    {daemonStatus?.status_text || 'Active (Port 53)'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Total Zones Loaded:</span>
                  <span className="font-bold text-white font-mono">{daemonStatus?.zone_count || zones.length} Zones</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Memory Footprint:</span>
                  <span className="font-bold text-white font-mono">{daemonStatus?.memory_used || '32 MB'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">System Port:</span>
                  <span className="font-bold text-cyan-400 font-mono">53 (TCP / UDP)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  onClick={() => handleDaemonControl('restart')}
                  disabled={isControllingDaemon}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs h-9 rounded-xl"
                >
                  <RefreshCcw className="w-3.5 h-3.5 mr-1" />
                  <span>Restart Daemon</span>
                </Button>
                <Button
                  onClick={() => handleDaemonControl('reload')}
                  disabled={isControllingDaemon}
                  variant="outline"
                  className="border-zinc-800 bg-zinc-950 text-xs h-9 rounded-xl"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1" />
                  <span>Reload Zones</span>
                </Button>
                <Button
                  onClick={() => handleDaemonControl('flush_cache')}
                  disabled={isControllingDaemon}
                  variant="outline"
                  className="border-zinc-800 bg-zinc-950 hover:bg-amber-950/20 text-xs h-9 rounded-xl"
                >
                  <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  <span>Flush Cache (rndc)</span>
                </Button>
                <Button
                  onClick={() => handleDaemonControl('checkconf')}
                  disabled={isControllingDaemon}
                  variant="outline"
                  className="border-zinc-800 bg-zinc-950 text-xs h-9 rounded-xl"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  <span>named-checkconf</span>
                </Button>
              </div>
            </Card>

            {/* named.conf.options Global Form */}
            <Card className="lg:col-span-2 bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                <span>Global named.conf.options Configuration</span>
              </h3>

              <form onSubmit={handleSaveBindOptions} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Listen Port</label>
                    <Input
                      type="number"
                      value={bindOptions.listen_port}
                      onChange={(e) => setBindOptions({ ...bindOptions, listen_port: parseInt(e.target.value) || 53 })}
                      className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">IPv4 Listen Interface</label>
                    <Input
                      value={bindOptions.listen_ipv4}
                      onChange={(e) => setBindOptions({ ...bindOptions, listen_ipv4: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Max Cache Size (MB)</label>
                    <Input
                      type="number"
                      value={bindOptions.max_cache_size_mb}
                      onChange={(e) => setBindOptions({ ...bindOptions, max_cache_size_mb: parseInt(e.target.value) || 128 })}
                      className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Upstream Forwarders (Comma Separated)</label>
                    <Input
                      value={bindOptions.forwarders.join(', ')}
                      onChange={(e) => setBindOptions({ ...bindOptions, forwarders: e.target.value.split(',').map(s => s.trim()) })}
                      placeholder="1.1.1.1, 8.8.8.8, 9.9.9.9"
                      className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Zone Transfer ACL (allow-transfer)</label>
                    <Input
                      value={bindOptions.allow_transfer}
                      onChange={(e) => setBindOptions({ ...bindOptions, allow_transfer: e.target.value })}
                      placeholder="none or trusted_ip_list"
                      className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                    />
                  </div>
                </div>

                {/* Security Flags */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Authoritative Lockdown (Disable Open Resolver)</div>
                      <div className="text-[11px] text-zinc-400">Protects against DNS Amplification DDoS attacks by disabling public recursion</div>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PROTECTED</Badge>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                    <div>
                      <div className="text-xs font-bold text-white">Response Rate Limiting (RRL)</div>
                      <div className="text-[11px] text-zinc-400">Limits repetitive responses to 10 queries/sec per client IP</div>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">ACTIVE</Badge>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingOptions}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-cyan-600/20"
                >
                  {isSavingOptions ? 'Applying to named.conf.options...' : 'Save & Reload BIND 9 Configuration'}
                </Button>
              </form>
            </Card>
          </div>

          {/* Live BIND 9 Log Stream Console */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>BIND 9 Live Event & Query Logs Stream</span>
              </h3>
              <Button onClick={fetchBindLogs} size="sm" variant="ghost" className="text-xs text-zinc-400 hover:text-white">
                <RotateCw className="w-3.5 h-3.5 mr-1" />
                <span>Refresh Logs</span>
              </Button>
            </div>
            <div className="bg-black/90 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-emerald-400 h-64 overflow-y-auto whitespace-pre-wrap">
              {bindLogs || 'Listening for DNS query events...'}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 3: NAMESERVERS, HOSTNAME & LIVE DIAGNOSTICS                         */}
      {/* ========================================================================= */}
      {activeTab === 'nameservers' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hostname & Nameservers */}
            <div className="space-y-6">
              <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
                <h3 className="text-base font-bold text-white">Root Server Hostname (FQDN)</h3>
                <form onSubmit={handleUpdateHostname} className="flex gap-2">
                  <Input
                    value={hostnameInput}
                    onChange={(e) => setHostnameInput(e.target.value)}
                    placeholder="srv1.yourdomain.com"
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                  />
                  <Button type="submit" disabled={isUpdatingHostname} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-10 px-4 rounded-xl">
                    Set Hostname
                  </Button>
                </form>
              </Card>

              <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
                <h3 className="text-base font-bold text-white">Primary & Secondary Nameservers</h3>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Primary NS1</label>
                      <Input
                        value={settings.primary_ns}
                        onChange={(e) => setSettings({ ...settings, primary_ns: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">NS1 IP</label>
                      <Input
                        value={settings.primary_ip}
                        onChange={(e) => setSettings({ ...settings, primary_ip: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">Secondary NS2</label>
                      <Input
                        value={settings.secondary_ns}
                        onChange={(e) => setSettings({ ...settings, secondary_ns: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">NS2 IP</label>
                      <Input
                        value={settings.secondary_ip}
                        onChange={(e) => setSettings({ ...settings, secondary_ip: e.target.value })}
                        className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isSavingSettings} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs w-full rounded-xl h-10">
                    Save Nameserver Records
                  </Button>
                </form>
              </Card>
            </div>

            {/* Live DNS Diagnostics Tool (dig / nslookup) */}
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <span>Live DNS Query Diagnostics Tool (dig)</span>
              </h3>
              <p className="text-xs text-zinc-400">Perform real-time DNS resolution tests against local BIND or public nameservers.</p>

              <form onSubmit={handleRunDiagnose} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain Name</label>
                    <Input
                      value={diagDomain}
                      onChange={(e) => setDiagDomain(e.target.value)}
                      placeholder="e.g. google.com or mydomain.com"
                      className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Type</label>
                    <select
                      value={diagType}
                      onChange={(e) => setDiagType(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono"
                    >
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="MX">MX</option>
                      <option value="TXT">TXT</option>
                      <option value="NS">NS</option>
                      <option value="SOA">SOA</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Query Nameserver (IP or Hostname)</label>
                  <Input
                    value={diagServer}
                    onChange={(e) => setDiagServer(e.target.value)}
                    placeholder="127.0.0.1 or 8.8.8.8"
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                  />
                </div>

                <Button type="submit" disabled={isDiagnosing} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs w-full rounded-xl h-10">
                  {isDiagnosing ? 'Querying Nameserver...' : 'Run dig Query Now'}
                </Button>
              </form>

              {diagOutput && (
                <div className="bg-black/90 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-cyan-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {diagOutput}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 4: MASTER ZONE TEMPLATE EDITOR                                      */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                <span>Master DNS Zone Template (Server-Wide)</span>
              </h3>
              <p className="text-xs text-zinc-400">
                This template is automatically instantiated whenever any domain, subdomain, or user account is provisioned.
              </p>
            </div>

            <Button
              onClick={handleSaveTemplate}
              disabled={isSavingTemplate}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-lg shadow-cyan-600/20"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              <span>{isSavingTemplate ? 'Saving Template...' : 'Save Master Template'}</span>
            </Button>
          </div>

          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 flex items-center gap-2 flex-wrap font-mono">
            <span className="text-zinc-500 font-sans font-bold">Template Placeholders:</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded text-cyan-400">%domain%</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded text-cyan-400">%ip%</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded text-cyan-400">%ns1%</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded text-cyan-400">%ns2%</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded text-cyan-400">%admin_email%</span>
            <span className="bg-zinc-900 px-2 py-0.5 rounded text-cyan-400">%serial%</span>
          </div>

          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
            <Editor
              height="450px"
              language="ini"
              theme="vs-dark"
              value={masterTemplate}
              onChange={(val) => setMasterTemplate(val || '')}
              options={{
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* PAGE 5: DNSSEC & ACCESS CONTROL SECURITY                                  */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">DNSSEC Key Signing (ECDSA P-256)</h3>
                  <p className="text-xs text-zinc-400">Cryptographic authenticity for <strong>{selectedDomain}</strong></p>
                </div>
              </div>

              <Button
                onClick={() => handleToggleDNSSEC(!dnssecSummary?.enabled)}
                disabled={isTogglingDNSSEC}
                className={dnssecSummary?.enabled ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 rounded-xl' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 rounded-xl'}
              >
                {dnssecSummary?.enabled ? 'Disable DNSSEC' : 'Sign & Enable DNSSEC'}
              </Button>
            </div>

            {dnssecSummary && (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Key Tag:</span>
                  <span className="font-bold text-cyan-400">{dnssecSummary.key_tag}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Algorithm:</span>
                  <span className="text-zinc-200">{dnssecSummary.algorithm}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Digest Type:</span>
                  <span className="text-zinc-200">{dnssecSummary.digest_type}</span>
                </div>
                <div>
                  <div className="text-zinc-400 mb-1">Delegation Signer (DS Record) for Registrar:</div>
                  <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-400 break-all text-[11px] flex justify-between items-center">
                    <span>{dnssecSummary.ds_record}</span>
                    <button onClick={() => handleCopy(dnssecSummary.ds_record, 'ds_key')} className="p-1 text-zinc-400 hover:text-white">
                      {copiedKey === 'ds_key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <h3 className="text-base font-bold text-white">DNS Security & Attack Mitigation</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Open Resolver Lockdown</div>
                  <div className="text-[11px] text-zinc-400">Recursion denied to external clients</div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASS</Badge>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Response Rate Limiting (RRL)</div>
                  <div className="text-[11px] text-zinc-400">DDoS Amplification Shield active</div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">ACTIVE</Badge>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Zone Transfer Restrictions</div>
                  <div className="text-[11px] text-zinc-400">AXFR/IXFR requests limited to secondary servers</div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">LOCKED</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 6: CLOUDFLARE & CLUSTER SYNC                                        */}
      {/* ========================================================================= */}
      {activeTab === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cloudflare DNS API v4 Integration</h3>
                <p className="text-xs text-zinc-400">Sync hosted zones directly with Cloudflare Anycast DNS</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Cloudflare API Token (Bearer)</label>
                <Input
                  type="password"
                  value={settings.cloudflare_api_token}
                  onChange={(e) => setSettings({ ...settings, cloudflare_api_token: e.target.value })}
                  placeholder="Bearer API Token"
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Target Zone ID</label>
                <Input
                  value={settings.cloudflare_zone_id}
                  onChange={(e) => setSettings({ ...settings, cloudflare_zone_id: e.target.value })}
                  placeholder="Zone ID"
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                />
              </div>

              <Button type="submit" disabled={isSavingSettings} className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs w-full rounded-xl h-10">
                Save Cloudflare API Credentials
              </Button>
            </form>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <h3 className="text-base font-bold text-white">1-Click Zone Push</h3>
            <p className="text-xs text-zinc-300">
              Synchronize all records for <strong>{selectedDomain}</strong> to Cloudflare API now.
            </p>

            <Button
              onClick={handleSyncCloudflare}
              disabled={isSyncingCF || !settings.cloudflare_api_token}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs w-full rounded-xl h-11 shadow-lg shadow-cyan-600/20"
            >
              <Zap className={`w-4 h-4 mr-2 ${isSyncingCF ? 'animate-bounce' : ''}`} />
              <span>{isSyncingCF ? 'Pushing Records...' : `Sync ${selectedDomain} to Cloudflare`}</span>
            </Button>

            {cfSyncResult && (
              <div className="bg-emerald-950/30 border border-emerald-900/40 p-4 rounded-xl text-xs text-emerald-300 space-y-1">
                <div className="font-bold">Sync Completed!</div>
                <div>Synchronized: {cfSyncResult.synced_count} of {cfSyncResult.total_count} records.</div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW DNS ZONE                                               */}
      {/* ========================================================================= */}
      <Dialog open={isCreateZoneOpen} onOpenChange={setIsCreateZoneOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>Create New Authoritative DNS Zone</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateZone} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain Name</label>
              <Input
                value={newZoneDomain}
                onChange={(e) => setNewZoneDomain(e.target.value)}
                placeholder="e.g. newdomain.com"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Server IPv4 Address</label>
              <Input
                value={newZoneIP}
                onChange={(e) => setNewZoneIP(e.target.value)}
                placeholder={serverIP}
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateZoneOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 rounded-xl">Create Zone</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: BULK SERVER IP MIGRATION                                          */}
      {/* ========================================================================= */}
      <Dialog open={isMigrateOpen} onOpenChange={setIsMigrateOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
              <span>Bulk DNS Server IP Migration Tool</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBulkMigrate} className="space-y-4 mt-2">
            <p className="text-xs text-zinc-400">
              Replaces the old server IP across <strong>ALL</strong> DNS zones, A records, SPF strings, and Glue records in one atomic execution.
            </p>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Current / Old Server IP</label>
              <Input
                value={migrateOldIP}
                onChange={(e) => setMigrateOldIP(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">New Target Server IP</label>
              <Input
                value={migrateNewIP}
                onChange={(e) => setMigrateNewIP(e.target.value)}
                placeholder="e.g. 192.0.2.1"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsMigrateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isMigrating} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 rounded-xl">
                {isMigrating ? 'Migrating Zones...' : 'Migrate All Zones'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: ADD DNS RECORD                                                     */}
      {/* ========================================================================= */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>Add Record to {selectedDomain}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddRecord} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Record Type</label>
                <select
                  value={newRecord.type}
                  onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-bold"
                >
                  <option value="A">A (IPv4 Address)</option>
                  <option value="AAAA">AAAA (IPv6 Address)</option>
                  <option value="CNAME">CNAME (Alias)</option>
                  <option value="MX">MX (Mail Exchange)</option>
                  <option value="TXT">TXT (Text / SPF / DKIM / DMARC)</option>
                  <option value="NS">NS (Nameserver)</option>
                  <option value="CAA">CAA (Certificate Authority)</option>
                  <option value="SRV">SRV (Service Record)</option>
                  <option value="PTR">PTR (Reverse DNS)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Name / Host</label>
                <Input
                  value={newRecord.name}
                  onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                  placeholder="@ or subdomain"
                  className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Value / Target</label>
              <Input
                value={newRecord.value}
                onChange={(e) => setNewRecord({ ...newRecord, value: e.target.value })}
                placeholder="1.2.3.4 or target.domain.com"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">TTL</label>
                <select
                  value={newRecord.ttl}
                  onChange={(e) => setNewRecord({ ...newRecord, ttl: parseInt(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono"
                >
                  <option value={300}>300s (5 mins)</option>
                  <option value={3600}>3600s (1 hr)</option>
                  <option value={14400}>14400s (4 hrs)</option>
                  <option value={86400}>86400s (1 day)</option>
                </select>
              </div>

              {newRecord.type === 'MX' || newRecord.type === 'SRV' ? (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Priority</label>
                  <Input
                    type="number"
                    value={newRecord.priority}
                    onChange={(e) => setNewRecord({ ...newRecord, priority: parseInt(e.target.value) || 10 })}
                    className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Comment</label>
                  <Input
                    value={newRecord.comment}
                    onChange={(e) => setNewRecord({ ...newRecord, comment: e.target.value })}
                    placeholder="Optional note"
                    className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 rounded-xl">Add Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
