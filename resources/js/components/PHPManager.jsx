import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Layers, 
  Check, 
  RotateCcw, 
  Sliders, 
  Terminal, 
  FileCode, 
  Info, 
  Search, 
  Activity, 
  Zap, 
  Play, 
  Video, 
  ShieldCheck, 
  Sparkles,
  Server,
  PackageCheck,
  RotateCw,
  Save,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Clock,
  ArrowUpRight,
  Flame,
  Wrench,
  DownloadCloud
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Progress } from './ui/progress';

export default function PHPManager({ showToast }) {
  const [activeTab, setActiveTab] = useState('switcher');
  const [phpDetails, setPhpDetails] = useState([]);
  const [selectedVer, setSelectedVer] = useState('');
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // PHP Info state
  const [phpInfoSections, setPhpInfoSections] = useState([]);
  const [infoFilter, setInfoFilter] = useState('');

  // Raw INI state
  const [rawIni, setRawIni] = useState('');
  const [iniLoading, setIniLoading] = useState(false);

  // FPM Pool state
  const [fpmPool, setFpmPool] = useState({
    version: '8.3',
    pm: 'dynamic',
    max_children: '50',
    start_servers: '5',
    min_spare_servers: '5',
    max_spare_servers: '35',
    max_requests: '500',
  });

  // Pre-Install Preview Modal
  const [previewItem, setPreviewItem] = useState(null);

  // Live Real-Time Install Task & Terminal Modal
  const [activeTask, setActiveTask] = useState(null);
  const taskPollRef = useRef(null);
  const logEndRef = useRef(null);

  // Simple INI Form state
  const [iniForm, setIniForm] = useState({
    memory_limit: '512M',
    upload_max_filesize: '128M',
    post_max_size: '128M',
    max_execution_time: '300',
    max_input_vars: '3000',
  });

  const fetchPHPDetails = async () => {
    try {
      const res = await fetch('/api/php/versions');
      if (res.ok) {
        const json = await res.json();
        const versions = json.data || [];
        setPhpDetails(versions);

        // Auto-select real installed default version if not yet set
        if (!selectedVer) {
          const defaultCLI = versions.find(v => v.is_default_cli) || versions.find(v => v.is_installed) || versions[0];
          if (defaultCLI) {
            setSelectedVer(defaultCLI.version);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPHPInfo = async (ver) => {
    if (!ver) return;
    try {
      const res = await fetch(`/api/php/info?version=${ver}`);
      if (res.ok) {
        const json = await res.json();
        setPhpInfoSections(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRawIni = async (ver) => {
    if (!ver) return;
    setIniLoading(true);
    try {
      const res = await fetch(`/api/php/ini/raw?version=${ver}`);
      if (res.ok) {
        const json = await res.json();
        setRawIni(json.content || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIniLoading(false);
    }
  };

  const fetchFpmPool = async (ver) => {
    if (!ver) return;
    try {
      const res = await fetch(`/api/php/fpm/pool?version=${ver}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setFpmPool(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPHPDetails();
  }, []);

  useEffect(() => {
    if (!selectedVer) return;
    const current = phpDetails.find(v => v.version === selectedVer);
    if (current && current.is_installed) {
      setIniForm({
        memory_limit: current.memory_limit || '512M',
        upload_max_filesize: current.upload_max_filesize || '128M',
        post_max_size: current.post_max_size || '128M',
        max_execution_time: current.max_execution_time || '300',
        max_input_vars: current.max_input_vars || '3000',
      });
    }
    if (activeTab === 'info') fetchPHPInfo(selectedVer);
    if (activeTab === 'ini-raw') fetchRawIni(selectedVer);
    if (activeTab === 'fpm') fetchFpmPool(selectedVer);
  }, [selectedVer, activeTab, phpDetails]);

  // Live Task Poller
  const startPollingTask = (taskId) => {
    if (taskPollRef.current) clearInterval(taskPollRef.current);
    taskPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/php/task/status?task_id=${taskId}`);
        if (res.ok) {
          const json = await res.json();
          setActiveTask(json.data);
          logEndRef.current?.scrollIntoView({ behavior: 'smooth' });

          if (json.data.status === 'completed' || json.data.status === 'failed') {
            clearInterval(taskPollRef.current);
            fetchPHPDetails();
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 600);
  };

  const handleStartLiveInstall = async (type, name = '', version = selectedVer) => {
    setPreviewItem(null);
    try {
      const res = await fetch('/api/php/install/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, version }),
      });
      const json = await res.json();
      if (res.ok && json.task_id) {
        setActiveTask({
          id: json.task_id,
          title: json.title,
          status: 'running',
          progress: 15,
          logs: [`🚀 [1/4] Initializing installation task: ${json.title}...`],
        });
        startPollingTask(json.task_id);
      }
    } catch (err) {
      showToast('Failed to start installation task', 'error');
    }
  };

  const handleSaveRawIni = async () => {
    try {
      const res = await fetch('/api/php/ini/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVer, content: rawIni }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveFpmPool = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/php/fpm/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fpmPool, version: selectedVer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSimpleIni = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/php/ini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVer, ...iniForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchPHPDetails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRestartFPM = async () => {
    try {
      const res = await fetch('/api/php/fpm/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchPHPDetails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const currentDetail = phpDetails.find(v => v.version === selectedVer) || { 
    version: selectedVer, 
    is_installed: false, 
    extensions: [] 
  };

  const installedVersions = phpDetails.filter(v => v.is_installed);
  const availableVersions = phpDetails.filter(v => !v.is_installed);

  const categories = ['All', 'Performance', 'Database & Cache', 'Images & Media', 'Core & String', 'Network & Web', 'Archives', 'XML & Formats', 'Math & Security', 'Debugging', 'Concurrency'];

  const filteredExtensions = (currentDetail.extensions || []).filter(ext => {
    const name = ext.name || ext.Name || '';
    const desc = ext.description || ext.Description || '';
    const cat = ext.category || ext.Category || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'All' || cat === activeCategory;
    return matchesSearch && matchesCat;
  });

  const installedCount = (currentDetail.extensions || []).filter(e => e.is_installed).length;

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Real Target Switcher Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121215] border border-zinc-800/90 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">PHP Multi-Runtime Engine</h2>
              <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-mono">
                {installedVersions.length} Installed
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live daemon controller, socket allocator, PECL extension matrix, and real-time installer.
            </p>
          </div>
        </div>

        {/* Real Dynamic Installed PHP Target Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400">Active Target:</span>
            <Select value={selectedVer} onValueChange={setSelectedVer}>
              <SelectTrigger className="w-52 h-10 bg-zinc-900/90 border-zinc-700/80 rounded-2xl text-xs font-bold text-white shadow-inner">
                <SelectValue placeholder="Select PHP..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-xs rounded-2xl shadow-2xl">
                <SelectGroup>
                  <SelectLabel className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1">
                    Installed & Ready
                  </SelectLabel>
                  {installedVersions.map(v => (
                    <SelectItem key={v.version} value={v.version}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="font-bold">🐘 PHP {v.version}</span>
                        {v.is_default_cli && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-mono">CLI Default</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>

                {availableVersions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 border-t border-zinc-800/80 mt-1">
                      Available to Install
                    </SelectLabel>
                    {availableVersions.map(v => (
                      <SelectItem key={v.version} value={v.version} className="text-zinc-400">
                        🐘 PHP {v.version} (Uninstalled)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRestartFPM}
            disabled={!currentDetail.is_installed}
            className="h-10 rounded-2xl border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold gap-1.5 hover:bg-zinc-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart FPM</span>
          </Button>
        </div>
      </div>

      {/* 2. Hero Target Telemetry Strip (Shows Live Specs for Selected PHP) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* Runtime Status */}
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Runtime Status</span>
            <div className="text-sm font-bold text-white font-mono mt-0.5 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${currentDetail.is_installed ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{currentDetail.is_installed ? `PHP ${selectedVer} Active` : `PHP ${selectedVer} Not Installed`}</span>
            </div>
          </div>
          {currentDetail.is_default_cli && (
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px]">CLI Primary</Badge>
          )}
        </div>

        {/* Socket Path */}
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">FastCGI Socket</span>
          <div className="text-xs font-mono font-semibold text-zinc-300 truncate mt-0.5" title={currentDetail.socket_path}>
            {currentDetail.socket_path || `/run/php/php${selectedVer}-fpm.sock`}
          </div>
        </div>

        {/* Memory Cap */}
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">RAM Quota</span>
          <div className="text-sm font-bold text-white font-mono mt-0.5">
            {currentDetail.memory_limit || '512M'}
          </div>
        </div>

        {/* Loaded Extensions */}
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Modules</span>
          <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
            {installedCount} of {(currentDetail.extensions || []).length} Loaded
          </div>
        </div>

      </div>

      {/* 3. Modern Segmented Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900/90 border border-zinc-800/80 p-1 rounded-2xl flex flex-wrap gap-1">
          <TabsTrigger value="switcher" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <PackageCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            Version Switcher
          </TabsTrigger>
          <TabsTrigger value="short-info" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <Activity className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Short Info
          </TabsTrigger>
          <TabsTrigger value="info" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <Info className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            phpinfo()
          </TabsTrigger>
          <TabsTrigger value="addons" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Addons & FFMPEG
          </TabsTrigger>
          <TabsTrigger value="extensions" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <Layers className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
            PECL Matrix (40+)
          </TabsTrigger>
          <TabsTrigger value="simple-editor" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <Sliders className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
            Simple Editor
          </TabsTrigger>
          <TabsTrigger value="ini-raw" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <FileCode className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            php.ini Raw
          </TabsTrigger>
          <TabsTrigger value="fpm" className="rounded-xl text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-semibold">
            <Server className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
            FPM Pool
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Version Switcher */}
        <TabsContent value="switcher" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {phpDetails.map(ver => (
              <Card 
                key={ver.version} 
                onClick={() => setSelectedVer(ver.version)}
                className={`bg-[#121215] border rounded-3xl p-5 relative transition-all duration-200 cursor-pointer shadow-sm ${
                  ver.version === selectedVer 
                    ? 'border-indigo-500/80 bg-indigo-950/10 ring-2 ring-indigo-500/30' 
                    : 'border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-white font-mono">PHP {ver.version}</span>
                    {ver.is_default_cli && (
                      <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 text-[9px] font-mono">
                        CLI Default
                      </Badge>
                    )}
                  </div>
                  {ver.is_installed ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                      ● Installed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px]">
                      Not Installed
                    </Badge>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Socket:</span>
                    <span className="font-mono text-zinc-300 text-[11px] truncate max-w-[150px]">{ver.socket_path}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">RAM Quota:</span>
                    <span className="font-mono text-zinc-200">{ver.memory_limit || '512M'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Upload Cap:</span>
                    <span className="font-mono text-zinc-200">{ver.upload_max_filesize || '128M'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-semibold">
                    {ver.version === selectedVer ? '✓ Currently Selected' : 'Click to Target'}
                  </span>

                  <Button 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewItem({ type: 'version', version: ver.version, name: `PHP ${ver.version}` });
                    }}
                    className={`rounded-xl text-xs font-bold gap-1.5 shadow-sm ${
                      ver.is_installed 
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {ver.is_installed ? <RotateCw className="w-3 h-3" /> : <DownloadCloud className="w-3 h-3" />}
                    <span>{ver.is_installed ? 'Re-Build' : 'Install Live'}</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: PHP Short Info */}
        <TabsContent value="short-info" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Execution Budget</span>
              </div>
              <div className="text-3xl font-black text-white font-mono mt-3">
                {currentDetail.max_execution_time || '300'}s
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Max CPU execution time per web request.</p>
            </Card>

            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>HTTP Payload Limit</span>
              </div>
              <div className="text-3xl font-black text-white font-mono mt-3">
                {currentDetail.post_max_size || '128M'}
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Maximum POST and multipart body size.</p>
            </Card>

            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>OPcache Acceleration</span>
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono mt-3">
                Active
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Pre-compiled opcode in shared memory.</p>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: PHP Info */}
        <TabsContent value="info" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-80">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
              <Input 
                type="text" 
                placeholder="Search phpinfo (e.g. extension_dir, opcache)..." 
                value={infoFilter} 
                onChange={(e) => setInfoFilter(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-2xl pl-9 text-xs font-mono"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchPHPInfo(selectedVer)} className="rounded-2xl border-zinc-800 text-xs gap-1.5">
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh phpinfo()</span>
            </Button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            {phpInfoSections.map((sec, idx) => {
              const matchedEntries = Object.entries(sec.directives || {}).filter(([k, v]) => 
                k.toLowerCase().includes(infoFilter.toLowerCase()) || v.toLowerCase().includes(infoFilter.toLowerCase())
              );
              if (matchedEntries.length === 0) return null;

              return (
                <Card key={idx} className="bg-[#121215] border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-3.5 bg-zinc-900/80 border-b border-zinc-800/80 font-bold text-xs text-white uppercase tracking-wider font-mono">
                    {sec.title}
                  </div>
                  <table className="w-full text-left text-xs text-zinc-300">
                    <tbody className="divide-y divide-zinc-800/50 font-mono">
                      {matchedEntries.map(([k, v]) => (
                        <tr key={k} className="hover:bg-zinc-900/30">
                          <td className="py-2.5 px-4 font-semibold text-zinc-400 w-1/3">{k}</td>
                          <td className="py-2.5 px-4 text-white break-all">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 4: Addons & FFMPEG */}
        <TabsContent value="addons" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* FFMPEG */}
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-rose-400" />
                  <span>FFMPEG Engine</span>
                </span>
                <Badge className="bg-rose-500/10 text-rose-400">Media</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                Video/audio encoding binaries (`ffmpeg`, `ffprobe`, libx264) for WordPress, media uploads & transcoding.
              </p>
              <Button 
                onClick={() => setPreviewItem({ type: 'ffmpeg', name: 'FFMPEG Media Suite', version: selectedVer })}
                className="mt-5 w-full rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Install FFMPEG Live</span>
              </Button>
            </Card>

            {/* IonCube */}
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                  <span>IonCube Loader</span>
                </span>
                <Badge className="bg-blue-500/10 text-blue-400">Security</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                Executes proprietary encoded PHP applications (WHMCS, commercial scripts & plugins).
              </p>
              <Button 
                onClick={() => setPreviewItem({ type: 'addon', name: 'ioncube', version: selectedVer })}
                className="mt-5 w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs gap-1.5"
              >
                <span>Install IonCube</span>
              </Button>
            </Card>

            {/* Swoole */}
            <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Swoole Coroutine</span>
                </span>
                <Badge className="bg-amber-500/10 text-amber-400">Speed</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                Asynchronous event-driven coroutine framework for Laravel Octane and high-traffic APIs.
              </p>
              <Button 
                onClick={() => setPreviewItem({ type: 'addon', name: 'swoole', version: selectedVer })}
                className="mt-5 w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs gap-1.5"
              >
                <span>Install Swoole</span>
              </Button>
            </Card>

          </div>
        </TabsContent>

        {/* Tab 5: PECL Matrix */}
        <TabsContent value="extensions" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
              <Input 
                type="text" 
                placeholder="Search 40+ extensions (redis, opcache, gd)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-2xl pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
              {categories.slice(0, 6).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition text-xs ${
                    activeCategory === cat ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[550px] overflow-y-auto custom-scrollbar p-1">
            {filteredExtensions.map(ext => (
              <div 
                key={ext.name}
                className="p-3.5 rounded-2xl bg-[#121215] border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 transition"
              >
                <div className="pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white font-mono">{ext.name}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-zinc-800 text-zinc-400 font-mono">
                      {ext.category}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{ext.description}</p>
                </div>

                <Button 
                  size="sm"
                  variant={ext.is_installed ? 'outline' : 'default'}
                  onClick={() => setPreviewItem({ type: 'extension', name: ext.name, version: selectedVer })}
                  className={`h-7 px-3 rounded-xl text-xs shrink-0 font-bold ${
                    ext.is_installed 
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                      : 'bg-white hover:bg-zinc-200 text-black'
                  }`}
                >
                  {ext.is_installed ? 'Active' : 'Install'}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 6: Simple Editor */}
        <TabsContent value="simple-editor">
          <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm max-w-2xl">
            <CardHeader className="p-0 pb-5 border-b border-zinc-800/80">
              <CardTitle className="text-base font-bold text-white">PHP {selectedVer} Simple Configurator</CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">Tune execution caps and memory quotas visually.</CardDescription>
            </CardHeader>

            <form onSubmit={handleSaveSimpleIni} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">memory_limit</label>
                  <Input 
                    value={iniForm.memory_limit} 
                    onChange={(e) => setIniForm({...iniForm, memory_limit: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">upload_max_filesize</label>
                  <Input 
                    value={iniForm.upload_max_filesize} 
                    onChange={(e) => setIniForm({...iniForm, upload_max_filesize: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">post_max_size</label>
                  <Input 
                    value={iniForm.post_max_size} 
                    onChange={(e) => setIniForm({...iniForm, post_max_size: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">max_execution_time (sec)</label>
                  <Input 
                    value={iniForm.max_execution_time} 
                    onChange={(e) => setIniForm({...iniForm, max_execution_time: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex justify-end">
                <Button type="submit" className="rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs gap-1.5 shadow-sm">
                  <Save className="w-3.5 h-3.5" />
                  <span>Save INI & Reload FPM</span>
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        {/* Tab 7: Raw php.ini Editor */}
        <TabsContent value="ini-raw" className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">Location: /etc/php/{selectedVer}/fpm/php.ini</span>
            <Button onClick={handleSaveRawIni} className="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 shadow-md">
              <Save className="w-3.5 h-3.5" />
              <span>Save php.ini Raw</span>
            </Button>
          </div>

          <textarea 
            value={rawIni}
            onChange={(e) => setRawIni(e.target.value)}
            className="w-full h-[500px] bg-zinc-950 border border-zinc-800 rounded-3xl p-5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 custom-scrollbar resize-none leading-relaxed"
          />
        </TabsContent>

        {/* Tab 8: FPM Pool Manager */}
        <TabsContent value="fpm">
          <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm max-w-2xl">
            <CardHeader className="p-0 pb-5 border-b border-zinc-800/80">
              <CardTitle className="text-base font-bold text-white">PHP {selectedVer} FPM Pool Configuration</CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">Control worker thread allocation and request timeouts.</CardDescription>
            </CardHeader>

            <form onSubmit={handleSaveFpmPool} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">pm (Process Manager)</label>
                  <Select value={fpmPool.pm} onValueChange={(v) => setFpmPool({...fpmPool, pm: v})}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-xl text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-xs">
                      <SelectItem value="dynamic">dynamic (Recommended)</SelectItem>
                      <SelectItem value="static">static (High Traffic)</SelectItem>
                      <SelectItem value="ondemand">ondemand (Low RAM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">pm.max_children</label>
                  <Input 
                    value={fpmPool.max_children} 
                    onChange={(e) => setFpmPool({...fpmPool, max_children: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">pm.start_servers</label>
                  <Input 
                    value={fpmPool.start_servers} 
                    onChange={(e) => setFpmPool({...fpmPool, start_servers: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1.5">pm.max_requests</label>
                  <Input 
                    value={fpmPool.max_requests} 
                    onChange={(e) => setFpmPool({...fpmPool, max_requests: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex justify-end">
                <Button type="submit" className="rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs gap-1.5 shadow-sm">
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Pool & Restart FPM</span>
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Pre-Installation Inspection Modal */}
      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
          <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Pre-Installation Inspection</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Confirm target package parameters before initiating live installation task.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs mt-3 bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80 font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-400">Package Target:</span>
                <span className="text-white font-bold">{previewItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">PHP Version:</span>
                <span className="text-indigo-400 font-bold">PHP {previewItem.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Socket Endpoint:</span>
                <span className="text-zinc-300">/run/php/php{previewItem.version}-fpm.sock</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Service Reload:</span>
                <span className="text-emerald-400">service php{previewItem.version}-fpm restart</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800 mt-4">
              <Button variant="outline" onClick={() => setPreviewItem(null)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button 
                onClick={() => handleStartLiveInstall(previewItem.type, previewItem.name, previewItem.version)}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Live Terminal Stream</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Live Real-Time Installation Terminal Stream Modal */}
      {activeTask && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0e11] rounded-3xl max-w-3xl w-full p-6 border border-zinc-800 shadow-2xl relative flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{activeTask.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-500 font-mono">Task ID: {activeTask.id}</span>
                    {activeTask.status === 'running' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                </div>
              </div>

              {activeTask.status !== 'running' && (
                <Button size="sm" variant="ghost" onClick={() => setActiveTask(null)} className="rounded-lg">✕</Button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className={activeTask.status === 'completed' ? 'text-emerald-400' : 'text-zinc-300'}>
                  {activeTask.status === 'completed' ? 'Installation Finished Successfully' : 'Executing live APT packages...'}
                </span>
                <span className="font-mono text-zinc-400">{activeTask.progress}%</span>
              </div>
              <Progress value={activeTask.progress} className="h-2 bg-zinc-800" />
            </div>

            {/* Live Terminal Log Stream */}
            <div className="flex-1 mt-4 bg-black rounded-2xl p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-y-auto custom-scrollbar max-h-96 space-y-1 select-text">
              {activeTask.logs.map((log, i) => (
                <div key={i} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800 mt-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                {activeTask.status === 'completed' ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Service Ready
                  </span>
                ) : activeTask.status === 'failed' ? (
                  <span className="text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-4 h-4" /> Installation Error
                  </span>
                ) : (
                  <span>Running daemon in background...</span>
                )}
              </div>

              {activeTask.status !== 'running' && (
                <Button onClick={() => setActiveTask(null)} className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
                  Done
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
