import React from 'react';
import { 
  Cpu, 
  HardDrive, 
  Database, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  RotateCw, 
  Layers,
  ArrowUpRight
} from 'lucide-react';

export default function TelemetryCards({ stats, onOpenModal }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* Card 1: Server Compute (My Balance Style) */}
      <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-medium">
              <Cpu className="w-4 h-4 text-zinc-500" />
              <span>CPU Compute Core</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>4 Cores</span>
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {stats ? `${stats.cpu_usage}%` : '25.6%'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 truncate">
              {stats ? stats.cpu_model : 'Intel(R) Core(TM) i5 @ 3.20GHz'}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center gap-2">
          <button 
            onClick={onOpenModal} 
            className="flex-1 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
          >
            <span>+ Deploy Site</span>
          </button>
          <button 
            className="flex-1 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 transition flex items-center justify-center gap-1"
          >
            <span>Telemetry</span>
          </button>
        </div>
      </div>

      {/* Card 2: Memory RAM (Net Profit Style) */}
      <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-medium">
              <HardDrive className="w-4 h-4 text-zinc-500" />
              <span>Memory (RAM)</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {stats ? `${(stats.mem_used_mb / 1024).toFixed(1)} GB` : '11.9 GB'}
            </div>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>{stats ? `${stats.mem_usage_pct}% of ${(stats.mem_total_mb / 1024).toFixed(1)} GB` : '75.1% of 15.9 GB'}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
            <span>Buffer Free</span>
            <span className="font-mono text-zinc-300">{stats ? `${(stats.mem_free_mb / 1024).toFixed(1)} GB` : '3.9 GB'}</span>
          </div>
          <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-cyan-400 h-1.5 rounded-full" 
              style={{ width: `${stats ? stats.mem_usage_pct : 75}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 3: Storage Volume (Expenses Style) */}
      <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-medium">
              <Database className="w-4 h-4 text-zinc-500" />
              <span>Storage Volume</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {stats ? `${stats.disk_used_gb} GB` : '174.5 GB'}
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1 font-medium">
              <span>{stats ? `${stats.disk_usage_pct}% of ${stats.disk_total_gb} GB` : '86.1% of 202.7 GB'}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/60">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
            <span>Free Storage</span>
            <span className="font-mono text-zinc-300">{stats ? `${stats.disk_free_gb} GB` : '28.1 GB'}</span>
          </div>
          <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-400 h-1.5 rounded-full" 
              style={{ width: `${stats ? stats.disk_usage_pct : 86}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 4: Web Engines & Status (Pending Invoices Style with Sparkline Bars) */}
      <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-medium">
              <Activity className="w-4 h-4 text-zinc-500" />
              <span>Web Services</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              5 Running
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              100% OK
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Nginx • Apache • Varnish • PHP
            </p>
          </div>
        </div>

        {/* Mini Sparkline Equalizer Bars */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-end justify-between h-7 gap-1">
          {[40, 65, 80, 45, 90, 70, 85, 60, 95, 75, 50, 85, 65, 100, 80, 55, 90, 70].map((h, i) => (
            <div 
              key={i} 
              className="flex-1 bg-zinc-700 hover:bg-violet-400 rounded-xs transition-all duration-300"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
