import React, { useState, useEffect } from 'react';
import {
  Users, 
  UserPlus, 
  Trash2, 
  Key, 
  Globe, 
  HardDrive, 
  Activity, 
  Layers, 
  Terminal, 
  ExternalLink, 
  Search, 
  RefreshCw,
  Sparkles,
  Wrench,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Server,
  Cpu,
  Mail,
  FileCode,
  Sliders,
  Settings,
  Edit2,
  Zap
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function UsersManager({ showToast }) {
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, active, suspended, reseller

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [targetPackage, setTargetPackage] = useState('');

  // Create Form State (Matching Screenshot 3)
  const [formData, setFormData] = useState({
    main_domain: '',
    username: '',
    password: '',
    email: 'admin@akpanel.local',
    server_ip: '37.27.116.105 (Shared)',
    package_id: 'standard',
    is_reseller: false,
    language: 'en',
    inode_limit: 0,
    process_limit: 40,
    open_files_limit: 200,
    backup_enabled: true,
    shell_access: false,
    autossl: false,
    create_mysql: true,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const json = await res.json();
        setPackages(json.data || []);
        if (json.data?.length > 0 && !formData.package_id) {
          setFormData(prev => ({ ...prev, package_id: json.data[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPackages();
  }, []);

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const handleDomainChange = (domain) => {
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').trim();
    // Auto-generate username from domain (up to 8 alphanumeric chars)
    const suggestedUser = cleanDomain.split('.')[0].replace(/[^a-z0-9]/g, '').slice(0, 8);
    setFormData(prev => ({
      ...prev,
      main_domain: cleanDomain,
      username: prev.username ? prev.username : suggestedUser,
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsCreateOpen(false);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleActive = async (user) => {
    const isSuspended = user.status === 'suspended';
    const action = isSuspended ? 'unsuspend' : 'suspend';

    try {
      const res = await fetch(`/api/users/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, reason: 'Admin toggle switch' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFixPermissions = async (user) => {
    try {
      const res = await fetch('/api/users/fix-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(`Permissions repaired for ${user.username} (chown & chmod 755/644)`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleChangePackage = async (e) => {
    e.preventDefault();
    if (!selectedUser || !targetPackage) return;

    try {
      const res = await fetch('/api/users/change-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUser.username, package_id: targetPackage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsPkgModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUser.username, password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsPassModalOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`CAUTION: Permanently delete '${user.username}'? This will delete all files in ${user.home_dir}, databases, and VirtualHosts!`)) return;

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Username', 'Main Domain', 'IP Address', 'Email', 'Package', 'Status', 'Disk Used MB', 'Disk Quota MB', 'Inodes', 'Setup Time'];
    const rows = users.map(u => [
      u.username,
      u.main_domain || '',
      u.ip_address || 'Shared',
      u.email || '',
      u.package_name || u.package_id,
      u.status,
      u.disk_used_mb || 0,
      u.disk_quota_mb || 'Unlimited',
      u.inodes_used || 0,
      u.setup_time || u.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `akpanel_accounts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Accounts list exported to CSV');
  };

  // Filter accounts
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || 
      (u.main_domain && u.main_domain.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'active') return u.status === 'active';
    if (filterType === 'suspended') return u.status === 'suspended';
    if (filterType === 'reseller') return u.is_reseller;
    return true;
  });

  const totalDiskUsedMB = users.reduce((acc, u) => acc + (u.disk_used_mb || u.DiskUsedMB || 0), 0);

  return (
    <div className="space-y-6 select-none">
      {/* Header & Global Disk Meter (Matching Screenshot 2 Top) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-400" />
            <span>List Accounts</span>
          </h1>
          <span className="text-xs text-zinc-400 font-mono mt-0.5 block">
            Total number of accounts: <strong className="text-white font-bold">{users.length}</strong>
          </span>
        </div>

        {/* Global Server Disk Meter Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Disk Usage / Users</span>
            </span>
            <span className="text-emerald-400 font-bold">{(totalDiskUsedMB / 1024).toFixed(2)} GB Total</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(5, (totalDiskUsedMB / 102400) * 100))}%` }} 
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="rounded-2xl border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export to Csv</span>
          </Button>

          <Button
            onClick={() => {
              generateRandomPassword();
              setIsCreateOpen(true);
            }}
            className="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-blue-600/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Account</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar (Matching Screenshot 2 Controls) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121215] border border-zinc-800/80 rounded-2xl p-3 shadow-sm">
        <div className="relative w-64 md:w-80">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <Input
            type="text"
            placeholder="Search username, domain, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white"
          />
        </div>

        {/* Radio Filter Pills */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'suspended', label: 'Suspended' },
            { id: 'reseller', label: 'Reseller' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1 rounded-xl text-xs transition font-mono ${
                filterType === f.id 
                  ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Table (Matching Screenshot 2 Columns) */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-4 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-zinc-900/80 uppercase text-[10px] text-zinc-400 border-b border-zinc-800 font-mono tracking-wider">
              <tr>
                <th className="py-3 px-3">Username</th>
                <th className="py-3 px-3">Domain</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Setup Time</th>
                <th className="py-3 px-3">Package</th>
                <th className="py-3 px-3">Reseller</th>
                <th className="py-3 px-3">Bandwidth</th>
                <th className="py-3 px-3">Disk Usage</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-10 text-zinc-500 font-sans">
                    No accounts match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => {
                  const diskUsed = u.disk_used_mb ?? u.DiskUsedMB ?? 0;
                  const diskQuota = u.disk_quota_mb ?? u.DiskQuotaMB ?? 0;
                  const bwUsed = u.bandwidth_used_mb ?? u.BandwidthUsedMB ?? 0;
                  const bwLimit = u.bandwidth_limit_mb ?? u.BandwidthLimitMB ?? 0;
                  const diskPct = diskQuota > 0 ? Math.min(100, Math.round((diskUsed / diskQuota) * 100)) : 5;
                  const isSuspended = u.status === 'suspended';

                  return (
                    <tr key={i} className="hover:bg-zinc-900/40 transition group">
                      {/* Username */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white flex items-center gap-1.5 font-mono">
                          <span>{u.username}</span>
                          {u.username === 'root' || u.username === 'admin' ? (
                            <Badge className="bg-purple-500/10 border-purple-500/30 text-purple-400 text-[8px] px-1 py-0">ROOT</Badge>
                          ) : null}
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="py-3 px-3">
                        {u.main_domain ? (
                          <a
                            href={`http://${u.main_domain}:8080`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <span>{u.main_domain}</span>
                            <ExternalLink className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition" />
                          </a>
                        ) : (
                          <span className="text-zinc-500 font-mono">None</span>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-3 font-mono text-zinc-400 text-[11px]">
                        {u.ip_address || '37.27.116.105'}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3 font-mono text-zinc-400 text-[11px] truncate max-w-[150px]">
                        {u.email || 'admin@nexus.net'}
                      </td>

                      {/* Setup Time */}
                      <td className="py-3 px-3 font-mono text-zinc-500 text-[10px]">
                        {u.setup_time || u.created_at || '2026-08-17'}
                      </td>

                      {/* Package with Quick Edit */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-zinc-200">{u.package_name || u.package_id}</span>
                          <button
                            onClick={() => { setSelectedUser(u); setTargetPackage(u.package_id); setIsPkgModalOpen(true); }}
                            className="p-1 text-zinc-500 hover:text-purple-400 transition"
                            title="Change Package"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Reseller */}
                      <td className="py-3 px-3 font-mono text-zinc-500 text-[11px]">
                        {u.is_reseller ? <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px]">Reseller</Badge> : '---'}
                      </td>

                      {/* Bandwidth Progress */}
                      <td className="py-3 px-3 min-w-28">
                        <div className="text-[10px] font-mono text-zinc-400 mb-0.5 flex justify-between">
                          <span>{bwUsed} MB</span>
                          <span>{bwLimit === 0 ? '∞' : `${bwLimit / 1024} GB`}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: '10%' }} />
                        </div>
                      </td>

                      {/* Disk Usage Progress */}
                      <td className="py-3 px-3 min-w-28">
                        <div className="text-[10px] font-mono text-zinc-400 mb-0.5 flex justify-between">
                          <span>{diskUsed} MB</span>
                          <span>{diskQuota === 0 ? '∞' : `${diskQuota / 1024} GB`}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${diskPct > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${diskPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Actions Toolbar (Matching Screenshot 2 Icons) */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Green/Red ON/OFF Toggle Switch */}
                          <button
                            onClick={() => handleToggleActive(u)}
                            title={isSuspended ? 'Click to Activate Account' : 'Click to Suspend Account'}
                            className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold transition flex items-center gap-1 ${
                              isSuspended
                                ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-500'
                            }`}
                          >
                            <span>{isSuspended ? 'OFF' : 'ON'}</span>
                          </button>

                          {/* Fix Permissions (Wrench) */}
                          <button
                            onClick={() => handleFixPermissions(u)}
                            title="Fix Linux Permissions (chown & chmod 755/644)"
                            className="p-1 rounded-md text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password (Key) */}
                          <button
                            onClick={() => { setSelectedUser(u); setNewPassword(''); setIsPassModalOpen(true); }}
                            title="Change Password"
                            className="p-1 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit / Change Package (Cog) */}
                          <button
                            onClick={() => { setSelectedUser(u); setTargetPackage(u.package_id); setIsPkgModalOpen(true); }}
                            title="Edit Account / Package"
                            className="p-1 rounded-md text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 transition"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete (Red Trash) */}
                          {u.username !== 'root' && u.username !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Delete Account"
                              className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Create Account Modal (Matching Screenshot 3 Exact Fields) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 text-white rounded-3xl max-w-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 border-b border-zinc-800 pb-3">
              <UserPlus className="w-4 h-4 text-blue-400" />
              <span>Create a New Account</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 py-2 text-xs">
            {/* Domain Name */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-300">Domain name:</label>
              <Input
                required
                value={formData.main_domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                placeholder="Enter domain name without www."
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
              />
              <span className="text-[10px] text-zinc-500">Enter domain name without www.</span>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-300">Username:</label>
              <Input
                required
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                placeholder="Enter username"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-zinc-300">Password:</label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate Password</span>
                </button>
              </div>
              <Input
                required
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Password"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
              />
            </div>

            {/* Admin Email */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-300">Admin Email:</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@domain.com"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            {/* Server IPs & Package Dropdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Server IPs:</label>
                <select
                  value={formData.server_ip}
                  onChange={(e) => setFormData(prev => ({ ...prev, server_ip: e.target.value }))}
                  className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  <option value="37.27.116.105 (Shared)">37.27.116.105 (Shared)</option>
                  <option value="127.0.0.1 (Localhost)">127.0.0.1 (Localhost)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Package:</label>
                <select
                  value={formData.package_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, package_id: e.target.value }))}
                  className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.disk_quota_mb === 0 ? 'Unlimited' : `${p.disk_quota_mb / 1024}GB`})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reseller & Language */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                <input
                  type="checkbox"
                  id="reseller_check"
                  checked={formData.is_reseller}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_reseller: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600"
                />
                <label htmlFor="reseller_check" className="text-xs text-zinc-300 cursor-pointer">
                  Reseller Privileges
                </label>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Language:</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  <option value="en">English (en)</option>
                  <option value="ar">Arabic (العربية)</option>
                </select>
              </div>
            </div>

            {/* Resource Limits (Inode, Process limit, Open files) */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Inode:</label>
                <Input
                  type="number"
                  value={formData.inode_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, inode_limit: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
                <span className="text-[10px] text-rose-400/80 block">0 for unlimited</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Process limit:</label>
                <Input
                  type="number"
                  value={formData.process_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, process_limit: parseInt(e.target.value) || 40 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
                <span className="text-[10px] text-rose-400/80 block">Limit number of processes</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Open files:</label>
                <Input
                  type="number"
                  value={formData.open_files_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, open_files_limit: parseInt(e.target.value) || 200 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
                <span className="text-[10px] text-rose-400/80 block">Limit open files (nofile)</span>
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/60">
              <label className="font-bold text-zinc-300 block">Additional Options:</label>
              
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                  <input
                    type="checkbox"
                    checked={formData.backup_enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, backup_enabled: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600"
                  />
                  <span className="text-zinc-300">Backup user account</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                  <input
                    type="checkbox"
                    checked={formData.shell_access}
                    onChange={(e) => setFormData(prev => ({ ...prev, shell_access: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600"
                  />
                  <span className="text-zinc-300">Shell Access (SSH)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                  <input
                    type="checkbox"
                    checked={formData.autossl}
                    onChange={(e) => setFormData(prev => ({ ...prev, autossl: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600"
                  />
                  <span className="text-zinc-300">AutoSSL Certificate</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                  <input
                    type="checkbox"
                    checked={formData.create_mysql}
                    onChange={(e) => setFormData(prev => ({ ...prev, create_mysql: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600"
                  />
                  <span className="text-zinc-300">Create MySQL Database</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Close
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 px-6"
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isPkgModalOpen} onOpenChange={setIsPkgModalOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 text-white rounded-3xl max-w-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-400" />
              <span>Edit Account Settings ({selectedUser?.username})</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedUser) return;
            try {
              const res = await fetch('/api/users/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username: selectedUser.username,
                  email: selectedUser.email,
                  ip_address: selectedUser.ip_address,
                  package_id: selectedUser.package_id,
                  disk_quota_mb: selectedUser.disk_quota_mb,
                  bandwidth_limit_mb: selectedUser.bandwidth_limit_mb,
                  inodes_limit: selectedUser.inodes_limit,
                  max_processes: selectedUser.max_processes,
                  open_files_limit: selectedUser.open_files_limit,
                  shell_access: selectedUser.shell_access,
                  autossl: selectedUser.autossl,
                  is_reseller: selectedUser.is_reseller,
                  backup_enabled: selectedUser.backup_enabled,
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.message);
              showToast(json.message || 'User account updated successfully');
              setIsPkgModalOpen(false);
              fetchUsers();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }} className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Hosting Package</label>
                <select
                  value={selectedUser?.package_id || ''}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, package_id: e.target.value }))}
                  className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.disk_quota_mb === 0 ? '∞' : `${p.disk_quota_mb / 1024}GB`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Account Email</label>
                <Input
                  type="email"
                  value={selectedUser?.email || ''}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Assigned IP Address</label>
                <Input
                  type="text"
                  value={selectedUser?.ip_address || ''}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, ip_address: e.target.value }))}
                  placeholder="e.g. 167.233.222.45 (Shared)"
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white h-9"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Disk Quota (MB, 0=∞)</label>
                <Input
                  type="number"
                  value={selectedUser?.disk_quota_mb || 0}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, disk_quota_mb: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-zinc-300 block mb-1">Inodes Limit</label>
                <Input
                  type="number"
                  value={selectedUser?.inodes_limit || 0}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, inodes_limit: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white h-9"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Max Processes</label>
                <Input
                  type="number"
                  value={selectedUser?.max_processes || 40}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, max_processes: parseInt(e.target.value) || 40 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white h-9"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-300 block mb-1">Open Files (nofile)</label>
                <Input
                  type="number"
                  value={selectedUser?.open_files_limit || 200}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, open_files_limit: parseInt(e.target.value) || 200 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white h-9"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUser?.shell_access || false}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, shell_access: e.target.checked }))}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-zinc-300 font-semibold">Shell Access (SSH)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUser?.autossl || false}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, autossl: e.target.checked }))}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-zinc-300 font-semibold">AutoSSL Enabled</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUser?.is_reseller || false}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, is_reseller: e.target.checked }))}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-zinc-300 font-semibold">Reseller Privileges</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUser?.backup_enabled || false}
                  onChange={(e) => setSelectedUser(prev => ({ ...prev, backup_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-zinc-300 font-semibold">Backup User</span>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPkgModalOpen(false)}
                className="rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20"
              >
                Save Account Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Professional Universal Password Reset Modal */}
      <Dialog open={isPassModalOpen} onOpenChange={setIsPassModalOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 text-white rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Universal Password Reset ({selectedUser?.username})</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Multi-Service Universal Sync</span>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Changes password simultaneously for <strong>SSH / SFTP</strong>, <strong>MySQL database</strong>, <strong>Pure-FTPd</strong>, and the <strong>Client Web Panel</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300">New Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
                    let pass = '';
                    for (let i = 0; i < 16; i++) {
                      pass += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    setNewPassword(pass);
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate Strong</span>
                </button>
              </div>

              <div className="relative">
                <Input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter or generate strong password"
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white pr-20"
                />
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newPassword);
                      showToast('Password copied to clipboard!');
                    }}
                    className="absolute right-2.5 top-2 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300"
                  >
                    Copy
                  </button>
                )}
              </div>

              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Password Strength:</span>
                    <span className={newPassword.length >= 12 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {newPassword.length >= 12 ? 'Strong (12+ chars)' : 'Moderate'}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${newPassword.length >= 12 ? 'w-full bg-emerald-400' : 'w-1/2 bg-amber-400'}`} 
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPassModalOpen(false)}
                className="rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 px-5"
              >
                Reset All Passwords
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
