import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Globe, 
  Copy, 
  Check, 
  RefreshCw, 
  Pencil,
  Lock
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/ui/select';

export default function ClientDNSPage({ showToast }) {
  const [zones, setZones] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  const [newRecord, setNewRecord] = useState({
    name: '@',
    type: 'A',
    value: '',
    ttl: 14400,
    priority: 10,
  });

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client/dns/zones');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setZones(list);
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

  useEffect(() => {
    fetchZones();
  }, []);

  const currentZone = zones.find(z => z.domain === selectedDomain);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (showToast) showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!selectedDomain) return;
    const payload = {
      domain: selectedDomain,
      name: newRecord.name,
      type: newRecord.type,
      value: newRecord.value,
      ttl: parseInt(newRecord.ttl, 10) || 14400,
      priority: parseInt(newRecord.priority, 10) || 10,
    };
    try {
      const url = editIndex === null ? '/api/client/dns/record' : '/api/client/dns/record/update';
      const body = editIndex === null ? payload : { ...payload, index: editIndex };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      if (showToast) showToast(json.message);
      setIsAddRecordOpen(false);
      setEditIndex(null);
      fetchZones();
      setNewRecord({ name: '@', type: 'A', value: '', ttl: 14400, priority: 10 });
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDeleteRecord = async (index) => {
    if (!confirm('Delete this DNS record?')) return;
    try {
      const res = await fetch('/api/client/dns/record/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, index }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      fetchZones();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">DNS Zone Records Editor</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Manage DNS records (A, CNAME, MX, TXT, SPF) for your hosted domains.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {zones.length > 0 && (
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 w-52 font-mono text-white">
                <SelectValue placeholder="Select Domain" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                {zones.map((z) => (
                  <SelectItem key={z.domain} value={z.domain} className="text-xs font-mono">
                    {z.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={() => setIsAddRecordOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-cyan-600/20 gap-1.5"
            disabled={!selectedDomain}
          >
            <Plus className="w-4 h-4" />
            <span>Add Record</span>
          </Button>
        </div>
      </div>

      {/* DNS Records Table */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white text-xs font-mono">{selectedDomain || 'No domain selected'}</span>
            {currentZone && (
              <Badge className="bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                {currentZone.records?.length || 0} Records
              </Badge>
            )}
          </div>
          <Button onClick={fetchZones} variant="ghost" size="sm" className="text-zinc-400 text-xs h-8 px-2.5">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-semibold uppercase">
                <th className="py-3 px-4">Name / Host</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Record Value / Target</th>
                <th className="py-3 px-4">TTL</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              {(!currentZone || !currentZone.records || currentZone.records.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs font-medium">
                    No DNS records configured for this domain.
                  </td>
                </tr>
              ) : (
                currentZone.records.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/30 transition group">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {r.name}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className="font-mono text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                        {r.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-300 max-w-md truncate">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{r.value}</span>
                        <button
                          onClick={() => handleCopy(r.value, `dns_${idx}`)}
                          className="text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition p-1"
                        >
                          {copiedKey === `dns_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{r.ttl}s</td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{r.priority || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      {['SOA', 'NS'].includes(String(r.type || '').toUpperCase()) ? (
                        <span title="Protected record" className="inline-flex text-zinc-600 p-1.5">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <div className="inline-flex gap-1">
                          <Button
                            onClick={() => {
                              setEditIndex(idx);
                              setNewRecord({
                                name: r.name || '@',
                                type: r.type || 'A',
                                value: r.value || '',
                                ttl: r.ttl || 14400,
                                priority: r.priority || 10,
                              });
                              setIsAddRecordOpen(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-zinc-500 hover:text-cyan-400 p-1.5 h-auto rounded-lg"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteRecord(idx)}
                            variant="ghost"
                            size="sm"
                            className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Add DNS Record */}
      <Dialog open={isAddRecordOpen} onOpenChange={(open) => {
        setIsAddRecordOpen(open);
        if (!open) {
          setEditIndex(null);
          setNewRecord({ name: '@', type: 'A', value: '', ttl: 14400, priority: 10 });
        }
      }}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              {editIndex === null ? <Plus className="w-5 h-5 text-cyan-400" /> : <Pencil className="w-5 h-5 text-cyan-400" />}
              <span>{editIndex === null ? 'Add' : 'Edit'} DNS Record ({selectedDomain})</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddRecord} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="A" className="font-mono text-xs text-blue-400 font-bold">A (IPv4)</SelectItem>
                    <SelectItem value="AAAA" className="font-mono text-xs text-indigo-400 font-bold">AAAA (IPv6)</SelectItem>
                    <SelectItem value="CNAME" className="font-mono text-xs text-cyan-400 font-bold">CNAME (Alias)</SelectItem>
                    <SelectItem value="MX" className="font-mono text-xs text-amber-400 font-bold">MX (Mail Server)</SelectItem>
                    <SelectItem value="TXT" className="font-mono text-xs text-emerald-400 font-bold">TXT (SPF/DKIM)</SelectItem>
                    <SelectItem value="NS" className="font-mono text-xs text-purple-400 font-bold">NS (Nameserver)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">TTL</label>
                <Select 
                  value={String(newRecord.ttl)} 
                  onValueChange={(val) => setNewRecord({ ...newRecord, ttl: parseInt(val) })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-mono">
                    <SelectValue placeholder="TTL" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                    <SelectItem value="300" className="text-xs font-mono">300s (5 min)</SelectItem>
                    <SelectItem value="3600" className="text-xs font-mono">3600s (1 hr)</SelectItem>
                    <SelectItem value="14400" className="text-xs font-mono">14400s (4 hrs)</SelectItem>
                    <SelectItem value="86400" className="text-xs font-mono">86400s (1 day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRecord.type === 'MX' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 block">Priority</label>
                  <Input
                    type="number"
                    value={newRecord.priority}
                    onChange={(e) => setNewRecord({ ...newRecord, priority: parseInt(e.target.value) || 10 })}
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddRecordOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 rounded-xl">
                {editIndex === null ? 'Add Record' : 'Save Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
