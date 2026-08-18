import React, { useState } from 'react';
import { 
  Archive, 
  Download, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  HardDrive, 
  Database, 
  Folder 
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export default function ClientBackupsPage({ showToast, stats }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [latestArchive, setLatestArchive] = useState(null);

  const handleGenerateBackup = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/client/backups/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setLatestArchive(json.file_name);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Account Backups & Restore</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Full cPanel-compatible archive generator (Web files + MySQL database dumps).
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerateBackup}
          disabled={isGenerating}
          className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg shadow-rose-600/20 gap-1.5"
        >
          <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? 'Archiving Account...' : 'Generate Full Backup (.tar.gz)'}</span>
        </Button>
      </div>

      {/* Backup Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-3">
            <Folder className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white block">Website Public Files</span>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            All virtual host directories, PHP scripts, WordPress installations, and uploads in <code>/var/www/sites/{stats?.username}</code>.
          </p>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-blue-400 mb-3">
            <Database className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white block">MySQL Databases Dumps</span>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            Automatic SQL dumps of all databases belonging to your account prefix (<code>{stats?.username}_*</code>).
          </p>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-amber-400 mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white block">DNS & Mail Records</span>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            Authoritative BIND zone files, SPF, and DKIM signature configuration keys.
          </p>
        </Card>
      </div>

      {latestArchive && (
        <Card className="bg-emerald-950/20 border-emerald-500/40 p-5 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white font-mono">{latestArchive}</span>
              <p className="text-[11px] text-emerald-400 mt-0.5">Archive compiled successfully and ready for download.</p>
            </div>
          </div>

          <Button
            onClick={() => {
              if (showToast) showToast('Backup download started!');
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 rounded-xl gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Backup</span>
          </Button>
        </Card>
      )}
    </div>
  );
}
