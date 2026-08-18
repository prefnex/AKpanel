import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Globe, 
  Database, 
  FolderTree, 
  Mail, 
  ShieldCheck, 
  Archive, 
  Key, 
  Cpu, 
  Layers, 
  ExternalLink,
  Zap,
  HardDrive,
  Activity,
  Sparkles,
  Server,
  Clock
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export default function ClientSidebar({ stats }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { id: 'dashboard', path: '/', altPath: '/dashboard', label: 'Dashboard & Stats', icon: LayoutDashboard, badge: 'Live' },
    { id: 'websites', path: '/websites', label: 'Websites & Domains', icon: Globe, count: stats?.domains_used },
    { id: 'dns', path: '/dns', label: 'DNS Zone Records', icon: Zap },
    { id: 'databases', path: '/databases', label: 'MySQL Databases', icon: Database, count: stats?.databases_used },
    { id: 'files', path: '/files', altPath: '/filemanager', label: 'File Explorer v2', icon: FolderTree, badge: 'Jail' },
    { id: 'ftp', path: '/ftp', label: 'FTP Accounts', icon: Server, count: stats?.ftp_used },
    { id: 'emails', path: '/emails', label: 'Email Accounts', icon: Mail, count: stats?.emails_used },
    { id: 'cron', path: '/cron', label: 'Cron Tasks', icon: Clock },
    { id: 'php', path: '/php', label: 'PHP & phpMyAdmin', icon: Cpu },
    { id: 'backups', path: '/backups', label: 'Backups & Restore', icon: Archive },
  ];

  const diskUsed = stats?.disk_used_mb || 0;
  const diskQuota = stats?.disk_quota_mb || 10000;
  const diskPct = Math.min(100, Math.round((diskUsed / diskQuota) * 100)) || 1;

  const bwUsed = stats?.bandwidth_used_mb || 0;
  const bwLimit = stats?.bandwidth_limit_mb || 100000;
  const bwPct = Math.min(100, Math.round((bwUsed / bwLimit) * 100)) || 1;

  return (
    <aside className="w-64 bg-zinc-950/90 border-r border-zinc-800/80 flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 select-none overflow-y-auto">
      {/* Navigation List */}
      <div className="p-4 space-y-6">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400 px-3 tracking-wider">
            Hosting Management
          </span>
          <div className="space-y-1 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path || (item.altPath && currentPath === item.altPath) || (item.id === 'dashboard' && currentPath === '/');
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition group ${
                    isActive
                      ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'text-zinc-400 border-zinc-700'}`}>
                      {item.badge}
                    </Badge>
                  )}
                  {item.count !== undefined && (
                    <span className="text-[11px] font-mono text-zinc-400 group-hover:text-zinc-300">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Resource Meters */}
        <div className="p-3.5 bg-zinc-900/50 rounded-2xl border border-zinc-800/80 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Disk Quota
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">{diskPct}%</span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
              style={{ width: `${diskPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>{diskUsed} MB</span>
            <span>{diskQuota} MB</span>
          </div>

          <div className="border-t border-zinc-800/80 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-400" /> Bandwidth
              </span>
              <span className="text-[11px] font-mono text-teal-400 font-bold">{bwPct}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${bwPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1">
              <span>{bwUsed} MB</span>
              <span>{Math.round(bwLimit / 1024)} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Container Jailed
          </span>
          <span className="font-mono text-zinc-400">v2.4 LTS</span>
        </div>
      </div>
    </aside>
  );
}
