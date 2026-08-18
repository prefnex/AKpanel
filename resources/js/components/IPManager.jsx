import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Plus, 
  Trash2, 
  Globe, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  Server, 
  Activity, 
  Radio, 
  ArrowUpRight, 
  Search, 
  RefreshCw,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function IPManager({ showToast }) {
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, ipv4, ipv6, shared, dedicated
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    ip: '',
    netmask: '255.255.255.0',
    gateway: '',
    interface: 'eth0',
    role: 'shared',
    assigned_to: ''
  });

  const fetchIPs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ips');
      if (res.ok) {
        const json = await res.json();
        setIps(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIPs();
  }, []);

  const handleAddIP = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsAddModalOpen(false);
      setFormData({
        ip: '',
        netmask: '255.255.255.0',
        gateway: '',
        interface: 'eth0',
        role: 'shared',
        assigned_to: ''
      });
      fetchIPs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteIP = async (ip) => {
    if (!confirm(`Are you sure you want to delete and unbind IP ${ip}?`)) return;
    try {
      const res = await fetch('/api/ips/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchIPs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSetRole = async (ip, role) => {
    try {
      const res = await fetch('/api/ips/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, role })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchIPs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredIPs = (ips || []).filter(item => {
    const matchesSearch = item.ip.toLowerCase().includes(search.toLowerCase()) || 
                          (item.interface && item.interface.toLowerCase().includes(search.toLowerCase())) ||
                          (item.role && item.role.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    if (filter === 'ipv4') return item.version === 'IPv4';
    if (filter === 'ipv6') return item.version === 'IPv6';
    if (filter === 'shared') return item.role === 'shared' || item.role === 'main';
    if (filter === 'dedicated') return item.role === 'dedicated';
    return true;
  });

  const ipv4Count = (ips || []).filter(i => i.version === 'IPv4').length;
  const ipv6Count = (ips || []).filter(i => i.version === 'IPv6').length;
  const sharedCount = (ips || []).filter(i => i.role === 'shared' || i.role === 'main').length;
  const dedicatedCount = (ips || []).filter(i => i.role === 'dedicated').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>IP Address & Network Pool Manager</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Manage public IPv4 & IPv6 pools, interface bindings, and allocate Shared / Dedicated addresses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchIPs} 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold gap-1.5 shadow-lg shadow-cyan-900/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add IP Address</span>
          </Button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Total IP Pool</span>
            <Network className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{ips.length}</span>
            <span className="text-[11px] text-zinc-500">Active</span>
          </div>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>IPv4 Addresses</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">IPv4</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{ipv4Count}</span>
            <span className="text-[11px] text-zinc-500">Allocated</span>
          </div>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>IPv6 Addresses</span>
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">IPv6</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{ipv6Count}</span>
            <span className="text-[11px] text-zinc-500">Subnets</span>
          </div>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Shared vs Dedicated</span>
            <Sliders className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white font-mono">{sharedCount}</span>
            <span className="text-xs text-zinc-500">Shared /</span>
            <span className="text-xl font-bold text-cyan-400 font-mono">{dedicatedCount}</span>
            <span className="text-xs text-zinc-500">Ded</span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800/80 rounded-xl w-full md:w-auto">
            {['all', 'ipv4', 'ipv6', 'shared', 'dedicated'].map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                  filter === t 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <Input 
              type="text"
              placeholder="Search IP, interface..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900 border-zinc-800 rounded-xl pl-9 text-xs text-white"
            />
          </div>
        </div>
      </Card>

      {/* IPs Table */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4">Version</th>
                <th className="py-3.5 px-4">Subnet / CIDR</th>
                <th className="py-3.5 px-4">Interface</th>
                <th className="py-3.5 px-4">Role / Type</th>
                <th className="py-3.5 px-4">Accounts</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredIPs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-zinc-500 text-xs">
                    No IP addresses found matching filter.
                  </td>
                </tr>
              ) : (
                filteredIPs.map((item) => (
                  <tr key={item.id || item.ip} className="hover:bg-zinc-900/40 transition">
                    {/* IP */}
                    <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                      <span>{item.ip}</span>
                      {item.is_primary && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-sans font-bold">
                          Primary Host
                        </span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.version === 'IPv6' 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.version}
                      </span>
                    </td>

                    {/* Netmask / CIDR */}
                    <td className="py-3.5 px-4 text-zinc-400 font-mono">
                      {item.netmask} ({item.cidr ? `/${item.cidr}` : ''})
                    </td>

                    {/* Interface */}
                    <td className="py-3.5 px-4 text-zinc-300 font-mono flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{item.interface || 'eth0'}</span>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.role === 'main' 
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' 
                          : item.role === 'dedicated' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      }`}>
                        {item.role === 'main' ? 'Main Server' : item.role === 'dedicated' ? 'Dedicated' : 'Shared Pool'}
                      </span>
                    </td>

                    {/* Accounts using */}
                    <td className="py-3.5 px-4 text-zinc-300 font-semibold">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200">
                        {item.accounts_num || 0} accounts
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Bound</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!item.is_primary && (
                          <>
                            {item.role !== 'dedicated' ? (
                              <button
                                onClick={() => handleSetRole(item.ip, 'dedicated')}
                                title="Make Dedicated"
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition"
                              >
                                Set Dedicated
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSetRole(item.ip, 'shared')}
                                title="Make Shared"
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition"
                              >
                                Set Shared
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteIP(item.ip)}
                              title="Delete IP"
                              className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add IP Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[#121215] rounded-3xl max-w-lg w-full p-6 border border-zinc-800 shadow-2xl text-white">
          <DialogHeader className="pb-3 border-b border-zinc-800">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              <span>Add Additional IP Address</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddIP} className="mt-4 space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                IP Address (IPv4 or IPv6) *
              </label>
              <Input 
                type="text"
                required
                placeholder="e.g. 167.233.222.46 or 2a01:4f8:..."
                value={formData.ip}
                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Netmask / CIDR
                </label>
                <Input 
                  type="text"
                  placeholder="255.255.255.0 or /64"
                  value={formData.netmask}
                  onChange={(e) => setFormData({ ...formData, netmask: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Network Interface
                </label>
                <Input 
                  type="text"
                  placeholder="eth0 or ens3"
                  value={formData.interface}
                  onChange={(e) => setFormData({ ...formData, interface: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Gateway (Optional)
              </label>
              <Input 
                type="text"
                placeholder="e.g. 167.233.222.1"
                value={formData.gateway}
                onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Role & Assignment Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'shared' })}
                  className={`p-3 rounded-xl border text-left transition ${
                    formData.role === 'shared'
                      ? 'border-cyan-500 bg-cyan-950/20 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <div className="font-bold text-xs">Shared Pool</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Used by default for new hosting accounts</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'dedicated' })}
                  className={`p-3 rounded-xl border text-left transition ${
                    formData.role === 'dedicated'
                      ? 'border-cyan-500 bg-cyan-950/20 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <div className="font-bold text-xs">Dedicated IP</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Reserved for specific domain/user</div>
                </button>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30"
              >
                Bind & Save IP
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
