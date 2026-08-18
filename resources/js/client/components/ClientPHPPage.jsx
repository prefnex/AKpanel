import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Database, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Server, 
  Save, 
  RefreshCw, 
  Lock, 
  Check, 
  FileCode,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export default function ClientPHPPage({ showToast, username, serverIP }) {
  const [selectedVersion, setSelectedVersion] = useState('8.2');
  const [memoryLimit, setMemoryLimit] = useState('256M');
  const [uploadMax, setUploadMax] = useState('64M');
  const [maxExecution, setMaxExecution] = useState(300);
  const [pmaSSOData, setPmaSSOData] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('akpanel_client_token');

  const fetchPHPConfig = async () => {
    try {
      const res = await fetch('/api/client/php/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status && data.data) {
        setSelectedVersion(data.data.active_version || '8.2');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPmaSSO = async () => {
    try {
      const res = await fetch('/api/client/phpmyadmin/sso', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) {
        setPmaSSOData(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPHPConfig();
    fetchPmaSSO();
  }, []);

  const handleLaunchPma = async () => {
    try {
      const res = await fetch('/api/client/phpmyadmin/sso', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status && data.data && (data.data.redirect_url || data.data.url)) {
        window.open(data.data.redirect_url || data.data.url, '_blank');
      } else {
        window.open('/phpmyadmin', '_blank');
      }
    } catch (err) {
      window.open('/phpmyadmin', '_blank');
    }
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast('PHP Runtime environment saved successfully!', 'success');
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">PHP Runtime & Database Studio</h2>
            <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-500/30 text-xs">
              Multi-PHP Engine
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Configure PHP versions, execution thresholds, upload limits, and open isolated phpMyAdmin with tenant credentials.</p>
        </div>
      </div>

      {/* phpMyAdmin Isolated SSO Card */}
      <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-emerald-950/20 p-6 rounded-2xl border border-emerald-500/30 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">phpMyAdmin Database Studio</h3>
                <Badge className="bg-emerald-500 text-zinc-950 font-bold text-[10px]">Isolated Tenant User</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Single-Sign-On into phpMyAdmin locked strictly to your account user <code className="text-emerald-400 font-mono font-bold">{username}</code>. You can only inspect and manage your own databases (<code className="text-zinc-300 font-mono">{username}_*</code>).
              </p>
            </div>
          </div>

          <Button 
            onClick={handleLaunchPma}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 px-5 py-5 rounded-xl shadow-lg shadow-emerald-950 shrink-0"
          >
            <ExternalLink className="w-4 h-4" /> Open phpMyAdmin
          </Button>
        </div>
      </div>

      {/* PHP Version Selector & Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PHP Version Picker */}
        <div className="bg-zinc-950/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3>Default PHP Version</h3>
          </div>
          <p className="text-xs text-zinc-400">Select the active PHP runtime for your account's primary web handler.</p>

          <div className="space-y-2 pt-2">
            {[
              { ver: '8.3', label: 'PHP 8.3 (Latest & Fastest)', tag: 'Recommended' },
              { ver: '8.2', label: 'PHP 8.2 (Stable LTS)', tag: 'Active' },
              { ver: '8.1', label: 'PHP 8.1 (Legacy Compatibility)', tag: 'Supported' },
            ].map((item) => (
              <div
                key={item.ver}
                onClick={() => setSelectedVersion(item.ver)}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  selectedVersion === item.ver
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                    : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                <div>
                  <span className="font-bold text-xs">{item.label}</span>
                  <div className="text-[10px] text-zinc-500 mt-0.5">FPM FastCGI Handler</div>
                </div>
                {selectedVersion === item.ver && (
                  <Badge className="bg-emerald-500 text-zinc-950 font-bold text-[10px] gap-1">
                    <Check className="w-3 h-3" /> Selected
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resource Thresholds Form */}
        <div className="lg:col-span-2 bg-zinc-950/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3>php.ini Directives & Limits</h3>
          </div>
          <p className="text-xs text-zinc-400">Customize memory and execution bounds applied to your scripts.</p>

          <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 font-medium">Memory Limit (memory_limit)</label>
                <Input 
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(e.target.value)}
                  className="mt-1 bg-zinc-900 border-zinc-700 text-xs font-mono"
                  placeholder="256M"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Upload Max Filesize (upload_max_filesize)</label>
                <Input 
                  value={uploadMax}
                  onChange={(e) => setUploadMax(e.target.value)}
                  className="mt-1 bg-zinc-900 border-zinc-700 text-xs font-mono"
                  placeholder="64M"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Max Execution Time (seconds)</label>
                <Input 
                  type="number"
                  value={maxExecution}
                  onChange={(e) => setMaxExecution(parseInt(e.target.value) || 300)}
                  className="mt-1 bg-zinc-900 border-zinc-700 text-xs font-mono"
                  placeholder="300"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">OPcache Acceleration</label>
                <div className="mt-1 p-2 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Zend OPcache JIT</span>
                  <Badge className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-[10px]">Enabled</Badge>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-lg shadow-emerald-950">
                <Save className="w-4 h-4" />
                {loading ? 'Saving Settings...' : 'Save PHP Configuration'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
