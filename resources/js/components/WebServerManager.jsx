import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Play, 
  Square, 
  RotateCw, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  FileCode, 
  HelpCircle,
  Zap,
  Flame
} from 'lucide-react';

export default function WebServerManager({ showToast }) {
  const [profiles, setProfiles] = useState([]);
  const [services, setServices] = useState([]);
  const [activeProfile, setActiveProfile] = useState('');
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState({ engine: 'nginx', file: 'php.conf.tmpl' });
  const [templateContent, setTemplateContent] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/webservers/profiles');
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data || []);
        const active = json.data.find(p => p.is_active);
        if (active) setActiveProfile(active.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/webservers/services');
      if (res.ok) {
        const json = await res.json();
        setServices(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplateFiles = async () => {
    try {
      const res = await fetch('/api/webservers/templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchServices();
    fetchTemplateFiles();
    const interval = setInterval(fetchServices, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchProfile = async (profileId) => {
    setLoading(true);
    try {
      const res = await fetch('/api/webservers/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchProfiles();
      fetchServices();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceAction = async (serviceName, action) => {
    try {
      const res = await fetch('/api/webservers/service/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceName, action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchServices();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openTemplateEditor = async (engine, file) => {
    setSelectedTemplate({ engine, file });
    try {
      const res = await fetch(`/api/webservers/template?engine=${engine}&filename=${file}`);
      if (res.ok) {
        const json = await res.json();
        setTemplateContent(json.content);
        setIsEditorOpen(true);
      }
    } catch (err) {
      showToast('Failed to load template', 'error');
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const res = await fetch('/api/webservers/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          engine: selectedTemplate.engine, 
          filename: selectedTemplate.file, 
          content: templateContent 
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsEditorOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-violet-400" />
          <span>Web Server Management & Profiles</span>
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Select the global server orchestration profile and control service lifecycles.
        </p>
      </div>

      {/* 5 Global Server Profiles */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Global WebServer Profile (Main Mode)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(p => (
            <div 
              key={p.id} 
              className={`shadcn-card rounded-xl p-5 border transition flex flex-col justify-between ${
                p.is_active 
                  ? 'border-violet-500 bg-violet-950/20 ring-1 ring-violet-500/50' 
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    p.is_active ? 'bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {p.badge}
                  </span>
                  {p.is_active && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active Profile</span>
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-white">{p.name}</h4>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{p.description}</p>
                <div className="mt-3 p-2 rounded bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 font-mono">
                  {p.architecture}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80">
                <p className="text-[11px] text-zinc-500 mb-3"><strong className="text-zinc-400">Best for:</strong> {p.best_for}</p>
                {!p.is_active ? (
                  <button 
                    disabled={loading}
                    onClick={() => handleSwitchProfile(p.id)}
                    className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-violet-600 text-zinc-200 hover:text-white text-xs font-semibold transition"
                  >
                    Switch to this Profile
                  </button>
                ) : (
                  <div className="text-center py-2 text-xs font-bold text-violet-400 bg-violet-500/10 rounded-lg">
                    ✓ Currently Orchestrating Traffic
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Services Lifecycle Controller */}
      <div className="shadcn-card rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Live Web Services Controller</h3>
            <p className="text-xs text-zinc-400">Control daemon processes in real-time.</p>
          </div>
          <button onClick={fetchServices} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>
        </div>

        <div className="divide-y divide-zinc-800/60">
          {services.map(s => (
            <div key={s.name} className="p-4 px-6 flex items-center justify-between hover:bg-zinc-900/30 transition">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${s.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <div>
                  <div className="font-semibold text-sm text-white">{s.display_name}</div>
                  <div className="text-xs text-zinc-500 font-mono">Port/Socket: {s.port}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  s.is_running ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {s.is_running ? 'Running' : 'Stopped'}
                </span>

                <button 
                  onClick={() => handleServiceAction(s.name, 'restart')}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium flex items-center gap-1"
                >
                  <RotateCw className="w-3 h-3 text-cyan-400" />
                  <span>Restart</span>
                </button>

                <button 
                  onClick={() => handleServiceAction(s.name, 'reload')}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3 text-amber-400" />
                  <span>Reload</span>
                </button>

                {s.is_running ? (
                  <button 
                    onClick={() => handleServiceAction(s.name, 'stop')}
                    className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Square className="w-3 h-3" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleServiceAction(s.name, 'start')}
                    className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Start</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Caching & Workload Performance Matrix */}
      <div className="shadcn-card rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>Workload Performance & Caching Strategy Matrix</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
            <h4 className="font-bold text-amber-400 text-sm">📰 High-Traffic Content & Media Sites (Articles, Blogs, News)</h4>
            <p className="text-zinc-400">
              High Read-to-Write ratio. Recommended: <strong>Nginx + Varnish + Apache / PHP-FPM</strong>.
            </p>
            <ul className="text-zinc-400 space-y-1">
              <li>✓ Varnish serves cached HTML in RAM in &lt;3 milliseconds.</li>
              <li>✓ Server can handle 10,000+ req/sec on modest VPS hardware.</li>
              <li>✓ Zero load on MySQL and PHP-FPM for cached article views.</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2">
            <h4 className="font-bold text-emerald-400 text-sm">🛒 Dynamic Applications (WooCommerce, Cart, Dashboards, APIs)</h4>
            <p className="text-zinc-400">
              Frequent dynamic writes and session tracking. Recommended: <strong>Hybrid (Nginx + Apache)</strong> or <strong>Pure Nginx + PHP-FPM</strong>.
            </p>
            <ul className="text-zinc-400 space-y-1">
              <li>✓ Nginx streams heavy media assets (images, fonts, scripts) with 30-day client caching.</li>
              <li>✓ Dynamic requests reach PHP-FPM / Apache instantly without stale cache risk.</li>
              <li>✓ FastCGI unix sockets eliminate TCP network loopback latency.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Vhost Template Editor */}
      <div className="shadcn-card rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>VirtualHost Configuration Templates</span>
            </h3>
            <p className="text-xs text-zinc-400">Customize default vhost generation templates for all engines.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(templates).map(([engine, files]) => (
            <div key={engine} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="font-bold text-xs uppercase text-violet-400 mb-2">{engine} Templates</div>
              <div className="space-y-1">
                {files.map(f => (
                  <button 
                    key={f}
                    onClick={() => openTemplateEditor(engine, f)}
                    className="w-full text-left px-2 py-1 rounded text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center justify-between font-mono"
                  >
                    <span className="truncate">{f}</span>
                    <span className="text-[10px] text-zinc-500">Edit</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="shadcn-card rounded-2xl max-w-3xl w-full p-6 border border-zinc-700 shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">Edit Template: {selectedTemplate.engine}/{selectedTemplate.file}</h3>
                <p className="text-xs text-zinc-400">Variables available: {'{{.Domain}}'}, {'{{.RootPath}}'}, {'{{.PHPVersion}}'}</p>
              </div>
              <button onClick={() => setIsEditorOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 mt-4">
              <textarea 
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                className="w-full h-80 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-violet-500 custom-scrollbar resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 mt-4">
              <button onClick={() => setIsEditorOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={handleSaveTemplate} className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold">Save Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
