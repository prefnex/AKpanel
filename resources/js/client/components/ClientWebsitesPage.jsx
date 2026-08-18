import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  ExternalLink, 
  ShieldCheck, 
  Folder, 
  Cpu, 
  Lock, 
  RefreshCw,
  Search,
  CheckCircle2
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

export default function ClientWebsitesPage({ showToast, onNavigateFiles }) {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newPHP, setNewPHP] = useState('8.2');
  const [search, setSearch] = useState('');

  const fetchWebsites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client/websites');
      if (res.ok) {
        const json = await res.json();
        setWebsites(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, []);

  const handleCreateWebsite = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/client/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain.trim(),
          php_version: newPHP,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setIsAddOpen(false);
      setNewDomain('');
      fetchWebsites();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDeleteWebsite = async (domain) => {
    if (!confirm(`Are you sure you want to delete website '${domain}'? This will remove its web server configuration and website files.`)) return;
    try {
      const res = await fetch('/api/client/websites/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      fetchWebsites();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const filtered = websites.filter(w => w.domain.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Websites & Hosted Domains</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Manage virtual hosts, PHP runtimes, and document root directories.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-emerald-600/20 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Website</span>
        </Button>
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <Input
            placeholder="Filter domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-950 border-zinc-800 text-xs h-10 rounded-xl font-mono"
          />
        </div>
        <Button onClick={fetchWebsites} variant="outline" size="sm" className="border-zinc-800 text-zinc-400 text-xs h-10 rounded-xl">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-zinc-500 text-xs bg-zinc-900/40 border border-zinc-800 rounded-2xl">
            No hosted websites found. Click "Add New Website" to host your first domain!
          </div>
        ) : (
          filtered.map((site) => (
            <Card key={site.domain} className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl hover:border-emerald-500/40 transition group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <a
                      href={`http://${site.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-white hover:text-emerald-400 transition text-sm flex items-center gap-1.5 font-mono"
                    >
                      <span>{site.domain}</span>
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    </a>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Folder className="w-3 h-3 text-zinc-500" />
                      <code className="text-[10px] text-zinc-400">{site.document_root}</code>
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleDeleteWebsite(site.domain)}
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
                  title="Delete Website"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] font-mono font-bold">
                    PHP {site.php_version || '8.2'}
                  </Badge>
                  {site.ssl_enabled ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>SSL Active</span>
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-800 text-zinc-400 text-[10px]">
                      No SSL
                    </Badge>
                  )}
                </div>

                {onNavigateFiles && (
                  <Button
                    onClick={() => onNavigateFiles(site.domain)}
                    size="sm"
                    variant="outline"
                    className="border-zinc-800 text-zinc-300 hover:text-white text-xs h-7 px-2.5 rounded-lg gap-1"
                  >
                    <Folder className="w-3 h-3 text-amber-400" />
                    <span>File Manager</span>
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Add Website */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>Add New Website / Domain</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateWebsite} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain Name</label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. clientdomain.com or blog.mywebsite.com"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 block">PHP Runtime Version</label>
              <Select value={newPHP} onValueChange={setNewPHP}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-mono">
                  <SelectValue placeholder="PHP Version" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                  <SelectItem value="8.3" className="text-xs font-mono">PHP 8.3 (Latest Fast-FPM)</SelectItem>
                  <SelectItem value="8.2" className="text-xs font-mono font-bold text-emerald-400">PHP 8.2 (Recommended)</SelectItem>
                  <SelectItem value="8.1" className="text-xs font-mono">PHP 8.1 (Legacy Compatibility)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 rounded-xl shadow-lg shadow-emerald-600/20">
                Provision Domain
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
