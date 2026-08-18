import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Plus, 
  Trash2, 
  RotateCw, 
  Server, 
  Cloud, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  Key, 
  Radio, 
  ExternalLink 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

export default function DNSClusterPage({ showToast }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [isSyncingCluster, setIsSyncingCluster] = useState(false);

  // Cloudflare Settings
  const [settings, setSettings] = useState({
    cloudflare_api_token: '',
    cloudflare_zone_id: '',
  });
  const [isSavingCF, setIsSavingCF] = useState(false);
  const [isSyncingCF, setIsSyncingCF] = useState(false);

  // Add Node Form
  const [nodeData, setNodeData] = useState({
    name: '',
    ip: '',
    secret_key: '',
  });

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dns/cluster');
      if (res.ok) {
        const json = await res.json();
        setNodes(json.data || []);
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
        if (json.settings) setSettings(json.settings);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNodes();
    fetchSettings();
  }, []);

  const handleAddNode = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/dns/cluster/node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsAddNodeOpen(false);
      setNodeData({ name: '', ip: '', secret_key: '' });
      fetchNodes();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteNode = async (id) => {
    if (!confirm('Remove this slave DNS node from cluster?')) return;
    try {
      const res = await fetch('/api/dns/cluster/node/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchNodes();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSyncCluster = async () => {
    setIsSyncingCluster(true);
    try {
      const res = await fetch('/api/dns/cluster/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchNodes();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSyncingCluster(false);
    }
  };

  const handleSaveCF = async (e) => {
    e.preventDefault();
    setIsSavingCF(true);
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
      setIsSavingCF(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-orange-950/40 via-amber-950/30 to-yellow-950/20 border border-orange-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/30">
            <Network className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">DNS Cluster & Slave DNS Manager</h1>
              <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs font-semibold px-2.5 py-0.5">
                Master-Slave Replication
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Synchronize BIND 9 DNS zones across multiple remote secondary VPS nodes and Cloudflare Anycast DNS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleSyncCluster}
            disabled={isSyncingCluster}
            variant="outline"
            className="border-zinc-800 bg-zinc-900 text-xs h-10 px-4 rounded-xl gap-2"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncingCluster ? 'animate-spin' : ''}`} />
            <span>Sync All Slaves</span>
          </Button>
          <Button
            onClick={() => setIsAddNodeOpen(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-orange-600/20"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span>Add Slave Node</span>
          </Button>
        </div>
      </div>

      {/* Cluster Nodes Grid & Table */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl space-y-4 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-white">Active Slave DNS Nodes</h3>
            <p className="text-xs text-zinc-400">All zones added to this master server replicate to these secondary servers automatically</p>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-semibold uppercase">
                <th className="py-3 px-4">Node Name</th>
                <th className="py-3 px-4">Slave IP Address</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Synchronized</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 font-medium">
                    No remote slave DNS nodes connected. Click "Add Slave Node" above.
                  </td>
                </tr>
              ) : (
                nodes.map((n) => (
                  <tr key={n.id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-orange-400" />
                      <span>{n.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-cyan-400">{n.ip}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold text-[10px]">
                        {n.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono">{n.last_sync}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        onClick={() => handleDeleteNode(n.id)}
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

      {/* Cloudflare Anycast DNS Integration */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cloudflare DNS API v4 Integration</h3>
            <p className="text-xs text-zinc-400">Synchronize records directly to Cloudflare Anycast DNS</p>
          </div>
        </div>

        <form onSubmit={handleSaveCF} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Cloudflare API Token (Bearer)</label>
              <Input
                type="password"
                value={settings.cloudflare_api_token}
                onChange={(e) => setSettings({ ...settings, cloudflare_api_token: e.target.value })}
                placeholder="Bearer Token"
                className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Cloudflare Zone ID</label>
              <Input
                value={settings.cloudflare_zone_id}
                onChange={(e) => setSettings({ ...settings, cloudflare_zone_id: e.target.value })}
                placeholder="Zone ID"
                className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
              />
            </div>
          </div>

          <Button type="submit" disabled={isSavingCF} className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-6 rounded-xl">
            {isSavingCF ? 'Saving...' : 'Save Cloudflare API Credentials'}
          </Button>
        </form>
      </Card>

      {/* Modal: Add Slave Node */}
      <Dialog open={isAddNodeOpen} onOpenChange={setIsAddNodeOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-orange-400" />
              <span>Connect Remote Slave DNS Node</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddNode} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Node Identifier / Name</label>
              <Input
                value={nodeData.name}
                onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
                placeholder="e.g. Slave DNS 2 (London)"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Slave Server Public IP</label>
              <Input
                value={nodeData.ip}
                onChange={(e) => setNodeData({ ...nodeData, ip: e.target.value })}
                placeholder="e.g. 198.51.100.25"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Cluster Secret / TSIG Key</label>
              <Input
                type="password"
                value={nodeData.secret_key}
                onChange={(e) => setNodeData({ ...nodeData, secret_key: e.target.value })}
                placeholder="Authentication Token"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddNodeOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-5 rounded-xl">Add Node</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
