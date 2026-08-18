import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  HardDrive, 
  Activity, 
  Cpu, 
  Layers, 
  Globe, 
  Database, 
  ShieldCheck, 
  Terminal, 
  Check, 
  Sparkles,
  Zap,
  Server,
  Mail,
  FolderTree,
  Sliders,
  Radio,
  FileCode
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function PackagesManager({ showToast }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);

  // Form Data (Matching Screenshot 4 Exact Fields)
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    disk_quota_mb: 20480,
    bandwidth_mb: 1048576,
    ftp_accounts: 5,
    email_accounts: 20,
    email_lists: 5,
    mysql_databases: 10,
    sub_domains: 20,
    parked_domains: 5,
    addon_domains: 5,
    hourly_emails: 100,
    cgroups_policy: 'None policy',
    nproc: 40,
    apache_nproc: 40,
    max_inodes: 0,
    nofile: 200,
    nodejs_apps: 1,
    package_type: 'General',
    default_web_engine: 'nginx',
    default_php_version: '8.2',
    shell_access: true,
  });

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const json = await res.json();
        setPackages(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleOpenCreate = () => {
    setEditingPkg(null);
    setFormData({
      id: '',
      name: '',
      disk_quota_mb: 20480,
      bandwidth_mb: 1048576,
      ftp_accounts: 5,
      email_accounts: 20,
      email_lists: 5,
      mysql_databases: 10,
      sub_domains: 20,
      parked_domains: 5,
      addon_domains: 5,
      hourly_emails: 100,
      cgroups_policy: 'None policy',
      nproc: 40,
      apache_nproc: 40,
      max_inodes: 0,
      nofile: 200,
      nodejs_apps: 1,
      package_type: 'General',
      default_web_engine: 'nginx',
      default_php_version: '8.2',
      shell_access: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pkg) => {
    setEditingPkg(pkg);
    setFormData({ ...pkg });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsModalOpen(false);
      fetchPackages();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (pkg) => {
    if (!confirm(`Are you sure you want to delete package '${pkg.name}'?`)) return;
    try {
      const res = await fetch('/api/packages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pkg.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchPackages();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-purple-400" />
            <span>Hosting Packages & Resource Policies</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure multi-tenant hosting tiers, cgroups policies, nproc, nofile, subdomains, and database allowances.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-purple-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Package</span>
        </Button>
      </div>

      {/* Package Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {packages.map((pkg) => (
          <Card 
            key={pkg.id} 
            className="bg-[#121215] border-zinc-800/80 hover:border-purple-500/40 rounded-3xl p-5 shadow-sm space-y-4 relative flex flex-col justify-between transition group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                    {pkg.name}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">{pkg.package_type || 'General'}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-400">
                  {pkg.default_web_engine ? pkg.default_web_engine.toUpperCase() : 'NGINX'}
                </Badge>
              </div>

              {/* Resource Quotas Grid */}
              <div className="space-y-2 pt-3 text-xs">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    <span>Disk Quota</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {pkg.disk_quota_mb === 0 ? 'Unlimited' : `${pkg.disk_quota_mb / 1024} GB`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Bandwidth / Mo</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {pkg.bandwidth_mb === 0 ? 'Unlimited' : `${pkg.bandwidth_mb / 1024} GB`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>nproc / procs</span>
                  </span>
                  <span className="font-mono text-zinc-300">{pkg.nproc || 40} Procs</span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>nofile / open files</span>
                  </span>
                  <span className="font-mono text-zinc-300">{pkg.nofile || 200} Files</span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Inodes</span>
                  </span>
                  <span className="font-mono text-zinc-300">
                    {!pkg.max_inodes || pkg.max_inodes === 0 ? 'Unlimited' : Number(pkg.max_inodes).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Database className="w-3.5 h-3.5 text-yellow-400" />
                    <span>MySQL DBs</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {pkg.mysql_databases === 0 ? 'Unlimited' : (pkg.mysql_databases || 'Unlimited')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Globe className="w-3.5 h-3.5 text-rose-400" />
                    <span>Sub / Addon Domains</span>
                  </span>
                  <span className="font-mono text-zinc-300">
                    {pkg.sub_domains || '∞'} / {pkg.addon_domains || '∞'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Mail className="w-3.5 h-3.5 text-teal-400" />
                    <span>Hourly Emails</span>
                  </span>
                  <span className="font-mono text-zinc-300">{pkg.hourly_emails || 100} / hr</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-zinc-800/80">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenEdit(pkg)}
                className="flex-1 rounded-xl border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                <span>Edit</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(pkg)}
                className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Package Create/Edit Modal (Matching Screenshot 4 Exact Grid) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 text-white rounded-3xl max-w-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Package className="w-4 h-4 text-purple-400" />
              <span>{editingPkg ? `Edit package: ${editingPkg.name}` : 'Add new package'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
            {/* Name */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-300">Name:</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Package Name"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white font-medium"
              />
            </div>

            {/* Row 1: Disk Quota MB / Bandwidth MB */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Disk Quota MB:</label>
                <Input
                  type="number"
                  value={formData.disk_quota_mb}
                  onChange={(e) => setFormData(prev => ({ ...prev, disk_quota_mb: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Bandwidth MB:</label>
                <Input
                  type="number"
                  value={formData.bandwidth_mb}
                  onChange={(e) => setFormData(prev => ({ ...prev, bandwidth_mb: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 2: FTP / Email Accounts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">FTP:</label>
                <Input
                  type="number"
                  value={formData.ftp_accounts}
                  onChange={(e) => setFormData(prev => ({ ...prev, ftp_accounts: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Email Accounts:</label>
                <Input
                  type="number"
                  value={formData.email_accounts}
                  onChange={(e) => setFormData(prev => ({ ...prev, email_accounts: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 3: Email Lists / Mysql */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Email Lists:</label>
                <Input
                  type="number"
                  value={formData.email_lists}
                  onChange={(e) => setFormData(prev => ({ ...prev, email_lists: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Mysql:</label>
                <Input
                  type="number"
                  value={formData.mysql_databases}
                  onChange={(e) => setFormData(prev => ({ ...prev, mysql_databases: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 4: Sub Domains / Parked Domains */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Sub Domains:</label>
                <Input
                  type="number"
                  value={formData.sub_domains}
                  onChange={(e) => setFormData(prev => ({ ...prev, sub_domains: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Parked Domains:</label>
                <Input
                  type="number"
                  value={formData.parked_domains}
                  onChange={(e) => setFormData(prev => ({ ...prev, parked_domains: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 5: Addon Domains / Hourly Emails */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Addon Domains:</label>
                <Input
                  type="number"
                  value={formData.addon_domains}
                  onChange={(e) => setFormData(prev => ({ ...prev, addon_domains: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Hourly Emails:</label>
                <Input
                  type="number"
                  value={formData.hourly_emails}
                  onChange={(e) => setFormData(prev => ({ ...prev, hourly_emails: parseInt(e.target.value) || 100 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 6: Cgroups policy / nproc */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Cgroups policy:</label>
                <select
                  value={formData.cgroups_policy}
                  onChange={(e) => setFormData(prev => ({ ...prev, cgroups_policy: e.target.value }))}
                  className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
                >
                  <option value="None policy">None policy</option>
                  <option value="Standard 1 Core / 1GB">Standard 1 Core / 1GB</option>
                  <option value="High-Perf 2 Cores / 2GB">High-Perf 2 Cores / 2GB</option>
                  <option value="VIP Unlimited">VIP Unlimited</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">nproc (Max Processes):</label>
                <Input
                  type="number"
                  value={formData.nproc}
                  onChange={(e) => setFormData(prev => ({ ...prev, nproc: parseInt(e.target.value) || 40 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 7: apache_nproc / inode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">apache_nproc:</label>
                <Input
                  type="number"
                  value={formData.apache_nproc}
                  onChange={(e) => setFormData(prev => ({ ...prev, apache_nproc: parseInt(e.target.value) || 40 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">inode (0 for unlimited):</label>
                <Input
                  type="number"
                  value={formData.max_inodes}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_inodes: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 8: nofile / Nodejs App */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">nofile (Open Files Limit):</label>
                <Input
                  type="number"
                  value={formData.nofile}
                  onChange={(e) => setFormData(prev => ({ ...prev, nofile: parseInt(e.target.value) || 200 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-300">NodeJs App Limit:</label>
                <Input
                  type="number"
                  value={formData.nodejs_apps}
                  onChange={(e) => setFormData(prev => ({ ...prev, nodejs_apps: parseInt(e.target.value) || 1 }))}
                  className="bg-zinc-950 border-zinc-800 rounded-xl text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Row 9: Type */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-300">Type:</label>
              <select
                value={formData.package_type}
                onChange={(e) => setFormData(prev => ({ ...prev, package_type: e.target.value }))}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-3 focus:outline-none"
              >
                <option value="General">General</option>
                <option value="Reseller">Reseller</option>
                <option value="VIP">VIP</option>
              </select>
            </div>

            <DialogFooter className="pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Close
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 px-6"
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
