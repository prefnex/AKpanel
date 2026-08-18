import React from 'react';
import { 
  Globe, 
  User, 
  LogOut, 
  ShieldCheck, 
  ExternalLink, 
  HardDrive, 
  Cpu, 
  Bell,
  Sparkles,
  Server,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export default function ClientHeader({ user, stats, onLogout }) {
  const isRootAdmin = user?.role === 'root_admin' || user?.username === 'root' || user?.username === 'admin';

  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Brand & Portal Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white tracking-tight text-sm">AKpanel</span>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-1.5 py-0">
                CLIENT PORTAL
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              Port 2083 • {stats?.hostname || 'server.local'}
            </p>
          </div>
        </div>

        {/* Server IP Badge */}
        {stats?.server_ip && (
          <div className="hidden md:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg text-xs font-mono text-zinc-300">
            <Server className="w-3 h-3 text-emerald-400" />
            <span>Shared IP: <strong>{stats.server_ip}</strong></span>
          </div>
        )}
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center gap-3">
        {/* Switch to Root WHM Panel (If Admin) */}
        {isRootAdmin && (
          <a
            href={`http://${window.location.hostname}:2087`}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-800/50 hover:bg-purple-900/50 px-3 py-1.5 rounded-xl transition"
            title="Switch to WHM Root Administration Console (Port 2087)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Switch to WHM (Root)</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}

        {/* User Badge */}
        <div className="flex items-center gap-2.5 bg-zinc-900/90 border border-zinc-800/80 px-3 py-1.5 rounded-xl">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase shadow-sm">
            {user?.username?.charAt(0) || 'U'}
          </div>
          <div className="text-left hidden xs:block">
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>{user?.username || 'Client User'}</span>
              <Badge className="bg-zinc-800 text-zinc-300 text-[9px] px-1 py-0 border-0">
                {stats?.package_name || 'Hosting Plan'}
              </Badge>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">
              {user?.main_domain || user?.email || 'mywebsite.com'}
            </div>
          </div>
        </div>

        {/* Logout */}
        <Button
          onClick={onLogout}
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 h-9 px-2.5 rounded-xl text-xs gap-1.5 transition"
          title="Sign out of Client Panel"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
