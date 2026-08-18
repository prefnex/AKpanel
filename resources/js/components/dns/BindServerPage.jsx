import React, { useState, useEffect } from 'react';
import { 
  Server, 
  RefreshCcw, 
  RotateCw, 
  Zap, 
  CheckCircle2, 
  Terminal, 
  SlidersHorizontal, 
  Cpu, 
  Layers, 
  ShieldCheck,
  Play,
  Square,
  Flame,
  Save
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

export default function BindServerPage({ showToast }) {
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
  const [isRebuilding, setIsRebuilding] = useState(false);

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

  useEffect(() => {
    fetchDaemonStatus();
    fetchBindOptions();
    fetchBindLogs();
  }, []);

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

  const handleRebuildAllZones = async () => {
    if (!confirm('Rebuild all BIND 9 zone files from database and reload the daemon?')) return;
    setIsRebuilding(true);
    try {
      const res = await fetch('/api/dns/server/rebuild', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchDaemonStatus();
      fetchBindLogs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsRebuilding(false);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-purple-950/20 border border-violet-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 border border-violet-400/30">
            <Server className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">BIND 9 DNS Server Engine</h1>
              <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/30 text-xs font-semibold px-2.5 py-0.5">
                Port 53 TCP/UDP
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                Root WHM Daemon Control
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Direct daemon lifecycle operations, named.conf.options editor, cache flushing, and live query stream.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleRebuildAllZones}
            disabled={isRebuilding}
            variant="outline"
            className="border-zinc-800 bg-zinc-900/80 hover:bg-violet-950/30 hover:text-violet-300 text-zinc-300 gap-2 h-10 px-4 rounded-xl text-xs"
          >
            <Flame className="w-4 h-4 text-violet-400" />
            <span>{isRebuilding ? 'Rebuilding Zones...' : 'Rebuild All Zones'}</span>
          </Button>
        </div>
      </div>

      {/* Daemon Status & Instant Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Cpu className="w-5 h-5" />
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
              <span className="font-bold text-white font-mono">{daemonStatus?.zone_count || 0} Zones</span>
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
            <SlidersHorizontal className="w-5 h-5 text-violet-400" />
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
              className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-violet-600/20"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              <span>{isSavingOptions ? 'Applying to named.conf.options...' : 'Save & Reload BIND 9 Configuration'}</span>
            </Button>
          </form>
        </Card>
      </div>

      {/* Live Query & System Event Logs Stream */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-violet-400" />
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
  );
}
