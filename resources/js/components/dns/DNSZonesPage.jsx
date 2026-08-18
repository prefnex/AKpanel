import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  RotateCw, 
  Search, 
  Sparkles, 
  Save, 
  Layers, 
  Copy, 
  Check, 
  ArrowLeftRight,
  ShieldCheck,
  Cpu,
  FileCode,
  Sliders,
  ExternalLink,
  User,
  Users,
  ShieldAlert,
  SlidersHorizontal,
  Server,
  ArrowLeft,
  Edit3,
  CheckCircle2,
  Lock,
  Zap,
  MoreVertical,
  HelpCircle
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue, 
  SelectGroup, 
  SelectLabel 
} from '../ui/select';

export default function DNSZonesPage({ showToast }) {
  const [zones, setZones] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Active View: 'list' (all zones table) or 'manage' (records editor for one zone)
  const [currentView, setCurrentView] = useState('list');
  const [selectedZone, setSelectedZone] = useState(null);

  // Filters & Search in List View
  const [userFilter, setUserFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals in List View
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkMigrateOpen, setIsBulkMigrateOpen] = useState(false);
  const [isChangeOwnerOpen, setIsChangeOwnerOpen] = useState(false);
  const [isApplyTemplateOpen, setIsApplyTemplateOpen] = useState(false);
  const [modalTargetZone, setModalTargetZone] = useState(null);

  // Form State for Modals
  const [newZoneDomain, setNewZoneDomain] = useState('');
  const [newZoneOwner, setNewZoneOwner] = useState('root');
  const [newZoneIP, setNewZoneIP] = useState('');
  const [newZoneTemplate, setNewZoneTemplate] = useState('tpl_standard');
  const [targetNewOwner, setTargetNewOwner] = useState('root');
  const [targetTemplateId, setTargetTemplateId] = useState('');
  const [migrateOldIP, setMigrateOldIP] = useState('');
  const [migrateNewIP, setMigrateNewIP] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);

  // State inside Zone Records Manage View
  const [recordsViewMode, setRecordsViewMode] = useState('table'); // 'table' | 'raw'
  const [recordTypeFilter, setRecordTypeFilter] = useState('ALL');
  const [recordSearch, setRecordSearch] = useState('');
  const [rawZoneContent, setRawZoneContent] = useState('');
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
  const [isSavingRaw, setIsSavingRaw] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Add Record Form State
  const [newRecord, setNewRecord] = useState({
    name: '@',
    type: 'A',
    value: '',
    ttl: 14400,
    priority: 10,
    comment: '',
  });

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dns/zones');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setZones(list);
        
        if (list.length > 0 && !newZoneIP) {
          setNewZoneIP(list[0].server_ip || '172.17.0.2');
        }

        if (selectedZone) {
          const found = list.find(z => z.domain === selectedZone.domain);
          if (found) setSelectedZone(found);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/dns/templates');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setTemplates(list);
        if (list.length > 0) {
          setNewZoneTemplate(list[0].id);
          setTargetTemplateId(list[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsersList(json.data || []);
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
    fetchTemplates();
    fetchUsers();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (showToast) showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleOpenManage = (zone) => {
    setSelectedZone(zone);
    setCurrentView('manage');
    setRecordsViewMode('table');
    setRecordTypeFilter('ALL');
    setRecordSearch('');
  };

  const handleSwitchToRaw = () => {
    setRecordsViewMode('raw');
    if (selectedZone) {
      fetchRawZone(selectedZone.domain);
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dns/zone/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newZoneDomain.trim(),
          server_ip: newZoneIP.trim(),
          owner_user: newZoneOwner,
          template_id: newZoneTemplate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setIsCreateOpen(false);
      setNewZoneDomain('');
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDeleteZone = async (domain) => {
    if (!confirm(`Are you sure you want to completely delete DNS zone '${domain}' and remove its BIND file?`)) return;
    try {
      const res = await fetch('/api/dns/zone/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      if (selectedZone?.domain === domain) {
        setCurrentView('list');
        setSelectedZone(null);
      }
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleChangeOwner = async (e) => {
    e.preventDefault();
    if (!modalTargetZone || !targetNewOwner) return;
    try {
      const res = await fetch('/api/dns/zone/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: modalTargetZone.domain, new_owner: targetNewOwner }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setIsChangeOwnerOpen(false);
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleApplyTemplate = async (e) => {
    e.preventDefault();
    if (!modalTargetZone || !targetTemplateId) return;
    if (!confirm(`Re-apply template to '${modalTargetZone.domain}'? All existing records will be regenerated according to the template.`)) return;

    try {
      const res = await fetch('/api/dns/zone/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: modalTargetZone.domain, template_id: targetTemplateId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setIsApplyTemplateOpen(false);
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
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

      if (showToast) showToast(json.message);
      setIsBulkMigrateOpen(false);
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!selectedZone) return;

    try {
      const res = await fetch('/api/dns/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedZone.domain,
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

      if (showToast) showToast(json.message);
      setIsAddRecordOpen(false);
      fetchZones();
      setNewRecord({ name: '@', type: 'A', value: '', ttl: 14400, priority: 10, comment: '' });
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDeleteRecord = async (index) => {
    if (!confirm('Delete this DNS record?')) return;
    try {
      const res = await fetch('/api/dns/record/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedZone.domain, index }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleSaveRawZone = async () => {
    if (!selectedZone || !rawZoneContent) return;
    setIsSavingRaw(true);
    try {
      const res = await fetch('/api/dns/zone/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedZone.domain,
          raw_content: rawZoneContent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsSavingRaw(false);
    }
  };

  // Distinct owners list
  const uniqueOwners = Array.from(new Set(zones.map(z => z.owner_user || 'root')));

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    const owner = z.owner_user || 'root';
    const matchUser = userFilter === 'ALL' || owner === userFilter;
    const matchSearch = z.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        z.server_ip.includes(searchQuery);
    return matchUser && matchSearch;
  });

  // Filtered records
  const filteredRecords = (selectedZone?.records || []).filter((r) => {
    const matchType = recordTypeFilter === 'ALL' || r.type === recordTypeFilter;
    const matchSearch = r.name.toLowerCase().includes(recordSearch.toLowerCase()) ||
                        r.value.toLowerCase().includes(recordSearch.toLowerCase()) ||
                        (r.comment && r.comment.toLowerCase().includes(recordSearch.toLowerCase()));
    return matchType && matchSearch;
  });

  const rootZonesCount = zones.filter(z => (z.owner_user || 'root') === 'root').length;
  const clientZonesCount = zones.length - rootZonesCount;
  const totalRecordsCount = zones.reduce((acc, z) => acc + (z.records?.length || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ========================================================================= */}
      {/* VIEW 1: MASTER ZONES INVENTORY TABLE (ALL USERS & ROOT SERVER)           */}
      {/* ========================================================================= */}
      {currentView === 'list' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 border border-blue-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
                <Layers className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-black text-white tracking-tight">DNS Zones & User Authority Manager</h1>
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs font-semibold px-2.5 py-0.5">
                    Root Administration (WHM / CWP Level)
                  </Badge>
                </div>
                <p className="text-zinc-400 text-sm mt-1">
                  Master control of all authoritative DNS zones across all client accounts and the root authority.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                onClick={() => {
                  if (zones.length > 0) setMigrateOldIP(zones[0].server_ip);
                  setIsBulkMigrateOpen(true);
                }}
                variant="outline"
                className="border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 gap-2 h-10 px-3.5 rounded-xl text-xs"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bulk IP Migration</span>
              </Button>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold gap-2 h-10 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition border border-blue-400/30 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Zone for User</span>
              </Button>
            </div>
          </div>

          {/* Metric KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
              <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Total Hosted Zones</span>
              <div className="text-2xl font-black text-white font-mono mt-1">{zones.length}</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Active authoritative zones</p>
            </Card>

            <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
              <span className="text-[11px] uppercase font-bold text-purple-400 tracking-wider">Root System Zones</span>
              <div className="text-2xl font-black text-purple-400 font-mono mt-1">{rootZonesCount}</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Hostname & Core Server</p>
            </Card>

            <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
              <span className="text-[11px] uppercase font-bold text-cyan-400 tracking-wider">Client User Zones</span>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-1">{clientZonesCount}</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">Multi-Tenant Client Accounts</p>
            </Card>

            <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-2xl shadow-sm backdrop-blur-md">
              <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">Total Active Records</span>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{totalRecordsCount}</div>
              <p className="text-[11px] text-zinc-500 mt-0.5">A, MX, TXT, CNAME, SPF...</p>
            </Card>
          </div>

          {/* Search & User Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
            {/* User Owner Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 mr-2 shrink-0">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Owner:</span>
              </span>
              <button
                onClick={() => setUserFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  userFilter === 'ALL' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                All Accounts ({zones.length})
              </button>
              {uniqueOwners.map((u) => {
                const count = zones.filter(z => (z.owner_user || 'root') === u).length;
                const isRoot = u === 'root';
                return (
                  <button
                    key={u}
                    onClick={() => setUserFilter(u)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      userFilter === u
                        ? isRoot ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    {isRoot ? <Server className="w-3 h-3 text-purple-300" /> : <User className="w-3 h-3 text-cyan-300" />}
                    <span>{u}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <Input
                placeholder="Search domain, owner, or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-950 border-zinc-800 text-xs h-9 rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Master Zones Table */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Domain Name</th>
                    <th className="py-3.5 px-4">Account Owner</th>
                    <th className="py-3.5 px-4">Server IP Address</th>
                    <th className="py-3.5 px-4">SOA Serial</th>
                    <th className="py-3.5 px-4">Records Count</th>
                    <th className="py-3.5 px-4">DNSSEC</th>
                    <th className="py-3.5 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {filteredZones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-medium">
                        No DNS zones match the current search or user filter.
                      </td>
                    </tr>
                  ) : (
                    filteredZones.map((z) => {
                      const isRoot = (z.owner_user || 'root') === 'root';
                      return (
                        <tr key={z.domain} className="hover:bg-zinc-800/30 transition group">
                          {/* Domain */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-cyan-400 shrink-0">
                                <Globe className="w-4 h-4" />
                              </div>
                              <div>
                                <button
                                  onClick={() => handleOpenManage(z)}
                                  className="font-bold text-white hover:text-cyan-400 transition text-xs flex items-center gap-1.5"
                                >
                                  <span>{z.domain}</span>
                                  <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-400 transition" />
                                </button>
                                <div className="text-[10px] text-zinc-500 font-mono">
                                  /etc/bind/zones/db.{z.domain}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Owner */}
                          <td className="py-4 px-4">
                            <Badge className={isRoot ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs font-semibold' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-xs font-semibold'}>
                              {isRoot ? '👑 root (Server)' : `👤 ${z.owner_user}`}
                            </Badge>
                          </td>

                          {/* Server IP */}
                          <td className="py-4 px-4 font-mono font-semibold text-zinc-200">
                            {z.server_ip}
                          </td>

                          {/* Serial */}
                          <td className="py-4 px-4 font-mono text-zinc-400 text-[11px]">
                            {z.serial || '2026081801'}
                          </td>

                          {/* Records Count */}
                          <td className="py-4 px-4">
                            <span className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-bold text-emerald-400 font-mono">
                              {z.records?.length || 0} Records
                            </span>
                          </td>

                          {/* DNSSEC */}
                          <td className="py-4 px-4">
                            {z.dnssec_enabled ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                                🛡️ Signed
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-medium">
                                Unsigned
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                onClick={() => handleOpenManage(z)}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 px-3 rounded-xl gap-1 shadow-sm"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Manage Records</span>
                              </Button>

                              <Button
                                onClick={() => {
                                  setModalTargetZone(z);
                                  setTargetTemplateId(z.template_id || (templates[0]?.id || 'tpl_standard'));
                                  setIsApplyTemplateOpen(true);
                                }}
                                variant="outline"
                                size="sm"
                                className="border-zinc-800 bg-zinc-950 hover:bg-amber-950/20 text-amber-400 text-xs h-8 px-2.5 rounded-xl"
                                title="Re-Apply Master Zone Template"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                onClick={() => {
                                  setModalTargetZone(z);
                                  setTargetNewOwner(z.owner_user || 'root');
                                  setIsChangeOwnerOpen(true);
                                }}
                                variant="outline"
                                size="sm"
                                className="border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 text-xs h-8 px-2.5 rounded-xl"
                                title="Change Account Owner"
                              >
                                <User className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                onClick={() => handleDeleteZone(z.domain)}
                                variant="ghost"
                                size="sm"
                                className="text-zinc-500 hover:text-rose-400 p-1.5 h-8 rounded-xl"
                                title="Delete DNS Zone"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
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
      {/* VIEW 2: DEDICATED ZONE RECORDS MANAGEMENT (DRILL DOWN VIEW)              */}
      {/* ========================================================================= */}
      {currentView === 'manage' && selectedZone && (
        <div className="space-y-6">
          {/* Breadcrumb & Navigation Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setCurrentView('list')}
                variant="outline"
                className="border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 font-bold text-xs h-10 px-3.5 rounded-xl gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All DNS Zones</span>
              </Button>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-white font-mono">{selectedZone.domain}</h1>
                  <Badge className={(selectedZone.owner_user || 'root') === 'root' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'}>
                    Owner: {selectedZone.owner_user || 'root'}
                  </Badge>
                  <Badge className="bg-zinc-950 text-zinc-300 border-zinc-800 text-[11px] font-mono">
                    IP: {selectedZone.server_ip}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  BIND 9 Zone File: <code>/etc/bind/zones/db.{selectedZone.domain}</code>
                </p>
              </div>
            </div>

            {/* Top Zone Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setRecordsViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    recordsViewMode === 'table' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Visual Records Table
                </button>
                <button
                  onClick={handleSwitchToRaw}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    recordsViewMode === 'raw' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Monaco RFC 1035 Raw
                </button>
              </div>

              <Button
                onClick={() => setIsAddRecordOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add Record</span>
              </Button>
            </div>
          </div>

          {/* Visual Records Table Mode */}
          {recordsViewMode === 'table' ? (
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              {/* Type Filter & Search inside zone */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  <span className="text-xs text-zinc-500 mr-2 font-semibold">Filter Record Type:</span>
                  {['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA', 'SRV'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setRecordTypeFilter(t)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        recordTypeFilter === t ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                  <Input
                    placeholder="Search records..."
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    className="pl-8 bg-zinc-900 border-zinc-800 text-xs h-8 rounded-lg"
                  />
                </div>
              </div>

              {/* Records List Table */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-semibold uppercase">
                      <th className="py-3 px-4">Name / Subdomain</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Record Value / Target</th>
                      <th className="py-3 px-4">TTL</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-500 font-medium">
                          No DNS records match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition group">
                          <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
                            <span>{r.name}</span>
                            {r.comment && (
                              <span className="text-[10px] text-zinc-500 font-normal bg-zinc-900 px-1.5 py-0.5 rounded">
                                {r.comment}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className="font-mono text-[10px] font-black px-2 py-0.5 border bg-blue-500/10 text-blue-400 border-blue-500/30">
                              {r.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-300 max-w-md truncate">
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
                          <td className="py-3 px-4 font-mono text-zinc-400">{r.ttl}s</td>
                          <td className="py-3 px-4 font-mono text-zinc-400">{r.priority || '-'}</td>
                          <td className="py-3 px-4 text-right">
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
            </Card>
          ) : (
            /* Monaco Raw RFC 1035 Mode */
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Direct BIND RFC 1035 format (validated via <code>named-checkzone</code> on save):</span>
                <Button
                  onClick={handleSaveRawZone}
                  disabled={isSavingRaw}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-4 rounded-xl shadow-lg shadow-emerald-600/20"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isSavingRaw ? 'Validating & Saving...' : 'Save & Reload BIND 9'}</span>
                </Button>
              </div>

              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                <Editor
                  height="450px"
                  language="ini"
                  theme="vs-dark"
                  value={rawZoneContent}
                  onChange={(val) => setRawZoneContent(val || '')}
                  options={{
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                  }}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS WITH SHADCN SELECTS                                                */}
      {/* ========================================================================= */}

      {/* Modal: Create Zone for User */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-lg rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Plus className="w-4 h-4" />
              </div>
              <span>Add Authoritative DNS Zone for User</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateZone} className="space-y-4 mt-2 font-sans">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain Name (FQDN)</label>
              <Input
                value={newZoneDomain}
                onChange={(e) => setNewZoneDomain(e.target.value)}
                placeholder="e.g. clientdomain.com"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Account Owner Shadcn Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Account Owner</label>
                <Select value={newZoneOwner} onValueChange={setNewZoneOwner}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-medium">
                    <SelectValue placeholder="Select Owner..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white shadow-2xl rounded-xl">
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1">Core Server</SelectLabel>
                      <SelectItem value="root" className="text-xs font-bold text-purple-400">
                        👑 root (Core Authority)
                      </SelectItem>
                    </SelectGroup>

                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1 border-t border-zinc-800/80 mt-1">Client Users</SelectLabel>
                      <SelectItem value="admin" className="text-xs font-semibold text-cyan-300">
                        👤 admin
                      </SelectItem>
                      {usersList
                        .filter(u => u.username !== 'root' && u.username !== 'admin')
                        .map((u) => (
                          <SelectItem key={u.username} value={u.username} className="text-xs text-zinc-200">
                            👤 {u.username}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Server IPv4 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Server IPv4</label>
                <Input
                  value={newZoneIP}
                  onChange={(e) => setNewZoneIP(e.target.value)}
                  placeholder="e.g. 172.17.0.2"
                  className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                  required
                />
              </div>
            </div>

            {/* Initial Template Shadcn Select */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">Master Zone Template</label>
              <Select value={newZoneTemplate} onValueChange={setNewZoneTemplate}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-medium">
                  <SelectValue placeholder="Select Template..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white shadow-2xl rounded-xl">
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="font-bold text-white">{t.name}</span>
                        {t.is_default && (
                          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.2 rounded font-mono">
                            DEFAULT
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-zinc-500 mt-1">
                Zone will be pre-populated with A, CNAME, MX, SPF, and DMARC records based on this template.
              </p>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-5 rounded-xl shadow-lg shadow-blue-600/20">
                Provision Zone in BIND 9
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Change Zone Owner with Shadcn Select */}
      <Dialog open={isChangeOwnerOpen} onOpenChange={setIsChangeOwnerOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-sm rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <User className="w-5 h-5 text-blue-400" />
              <span>Transfer Zone Ownership</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleChangeOwner} className="space-y-4 mt-2">
            <p className="text-xs text-zinc-400">
              Transfer <strong>{modalTargetZone?.domain}</strong> to another account:
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">Target Owner</label>
              <Select value={targetNewOwner} onValueChange={setTargetNewOwner}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white">
                  <SelectValue placeholder="Select User..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                  <SelectItem value="root" className="text-xs font-bold text-purple-400">
                    👑 root (Server Core)
                  </SelectItem>
                  <SelectItem value="admin" className="text-xs font-semibold text-cyan-300">
                    👤 admin
                  </SelectItem>
                  {usersList
                    .filter(u => u.username !== 'root' && u.username !== 'admin')
                    .map((u) => (
                      <SelectItem key={u.username} value={u.username} className="text-xs text-zinc-200">
                        👤 {u.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsChangeOwnerOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 rounded-xl">
                Transfer Zone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Re-Apply Master Template with Shadcn Select */}
      <Dialog open={isApplyTemplateOpen} onOpenChange={setIsApplyTemplateOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Re-Apply Master Zone Template</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleApplyTemplate} className="space-y-4 mt-2">
            <p className="text-xs text-zinc-400">
              Select a master template to re-generate records for <strong>{modalTargetZone?.domain}</strong>:
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">Select Template</label>
              <Select value={targetTemplateId} onValueChange={setTargetTemplateId}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white">
                  <SelectValue placeholder="Choose Template..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsApplyTemplateOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-5 rounded-xl">
                Apply Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Bulk Server IP Migration */}
      <Dialog open={isBulkMigrateOpen} onOpenChange={setIsBulkMigrateOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
              <span>Bulk Server IP Migration</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBulkMigrate} className="space-y-4 mt-2">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Replaces old IP with new IP across <strong>ALL</strong> DNS zones, A records, SPF records, and BIND zone files across <strong>all users and root</strong>.
            </p>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Old Server IP</label>
              <Input
                value={migrateOldIP}
                onChange={(e) => setMigrateOldIP(e.target.value)}
                placeholder="Old IP"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">New Target Server IP</label>
              <Input
                value={migrateNewIP}
                onChange={(e) => setMigrateNewIP(e.target.value)}
                placeholder="New IP"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsBulkMigrateOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isMigrating} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 rounded-xl">
                {isMigrating ? 'Migrating Zones...' : 'Migrate All Zones'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Add Record with Shadcn Selects */}
      <Dialog open={isAddRecordOpen} onOpenChange={setIsAddRecordOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-lg rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-blue-400" />
              <span>Add Record to {selectedZone?.domain}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddRecord} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Record Type Shadcn Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Record Type</label>
                <Select 
                  value={newRecord.type} 
                  onValueChange={(val) => setNewRecord({ ...newRecord, type: val })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-mono font-bold">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                    <SelectItem value="A" className="font-mono text-xs text-blue-400 font-bold">A (IPv4 Address)</SelectItem>
                    <SelectItem value="AAAA" className="font-mono text-xs text-indigo-400 font-bold">AAAA (IPv6 Address)</SelectItem>
                    <SelectItem value="CNAME" className="font-mono text-xs text-cyan-400 font-bold">CNAME (Alias)</SelectItem>
                    <SelectItem value="MX" className="font-mono text-xs text-amber-400 font-bold">MX (Mail Exchange)</SelectItem>
                    <SelectItem value="TXT" className="font-mono text-xs text-emerald-400 font-bold">TXT (SPF / DKIM / DMARC)</SelectItem>
                    <SelectItem value="NS" className="font-mono text-xs text-purple-400 font-bold">NS (Nameserver)</SelectItem>
                    <SelectItem value="CAA" className="font-mono text-xs text-rose-400 font-bold">CAA (SSL Authority)</SelectItem>
                    <SelectItem value="SRV" className="font-mono text-xs text-teal-400 font-bold">SRV (Service Discovery)</SelectItem>
                    <SelectItem value="PTR" className="font-mono text-xs text-zinc-300 font-bold">PTR (Reverse DNS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Host/Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Name / Host</label>
                <Input
                  value={newRecord.name}
                  onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                  placeholder="@ or subdomain"
                  className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
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
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* TTL Shadcn Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">TTL (Time to Live)</label>
                <Select 
                  value={String(newRecord.ttl)} 
                  onValueChange={(val) => setNewRecord({ ...newRecord, ttl: parseInt(val) })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-mono">
                    <SelectValue placeholder="TTL" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                    <SelectItem value="300" className="text-xs font-mono">300s (5 mins - Edge Fast)</SelectItem>
                    <SelectItem value="3600" className="text-xs font-mono">3600s (1 hour - Standard)</SelectItem>
                    <SelectItem value="14400" className="text-xs font-mono">14400s (4 hours - Default)</SelectItem>
                    <SelectItem value="86400" className="text-xs font-mono">86400s (1 day - Static)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRecord.type === 'MX' || newRecord.type === 'SRV' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 block">Priority</label>
                  <Input
                    type="number"
                    value={newRecord.priority}
                    onChange={(e) => setNewRecord({ ...newRecord, priority: parseInt(e.target.value) || 10 })}
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 block">Comment (Optional)</label>
                  <Input
                    value={newRecord.comment}
                    onChange={(e) => setNewRecord({ ...newRecord, comment: e.target.value })}
                    placeholder="e.g. Mail Server A"
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsAddRecordOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 rounded-xl">
                Add Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
