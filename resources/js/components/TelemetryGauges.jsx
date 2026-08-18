import React from 'react';
import { Cpu, HardDrive, Database, Activity } from 'lucide-react';

export default function TelemetryGauges({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CPU */}
      <div className="shadcn-card rounded-xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <span>CPU Compute</span>
          <span className="p-1.5 rounded-md bg-violet-500/10 text-violet-400">
            <Cpu className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white font-mono">{stats ? `${stats.cpu_usage}%` : '0%'}</span>
          <span className="text-xs text-zinc-500">{stats ? `${stats.cpu_cores} Cores` : ''}</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className="bg-violet-500 h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${stats ? stats.cpu_usage : 0}%` }}
          />
        </div>
      </div>

      {/* RAM */}
      <div className="shadcn-card rounded-xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <span>Memory (RAM)</span>
          <span className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400">
            <HardDrive className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white font-mono">{stats ? `${stats.mem_usage_pct}%` : '0%'}</span>
          <span className="text-xs text-zinc-500">{stats ? `${stats.mem_used_mb}/${stats.mem_total_mb}MB` : ''}</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className="bg-cyan-400 h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${stats ? stats.mem_usage_pct : 0}%` }}
          />
        </div>
      </div>

      {/* Disk Storage */}
      <div className="shadcn-card rounded-xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <span>Disk Volume</span>
          <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
            <Database className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white font-mono">{stats ? `${stats.disk_usage_pct}%` : '0%'}</span>
          <span className="text-xs text-zinc-500">{stats ? `${stats.disk_used_gb}/${stats.disk_total_gb}GB` : ''}</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
          <div 
            className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${stats ? stats.disk_usage_pct : 0}%` }}
          />
        </div>
      </div>

      {/* Load Average */}
      <div className="shadcn-card rounded-xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <span>Load Average</span>
          <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
            <Activity className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white font-mono">{stats ? stats.load_avg_1?.toFixed(2) : '0.00'}</span>
          <span className="text-xs text-zinc-500">1m avg</span>
        </div>
        <div className="flex items-center gap-2 mt-3 text-[11px] text-zinc-400">
          <span>5m: {stats ? stats.load_avg_5?.toFixed(2) : '0'}</span>
          <span>•</span>
          <span>15m: {stats ? stats.load_avg_15?.toFixed(2) : '0'}</span>
        </div>
      </div>
    </div>
  );
}
