import React from 'react';
import { Zap, Flame, RefreshCw, Layers } from 'lucide-react';

export default function EngineCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="shadcn-card rounded-xl p-4 border-l-4 border-l-emerald-500">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-white">Nginx Engine</span>
          </div>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">Active</span>
        </div>
        <p className="text-[11px] text-zinc-400">High concurrency static & FastCGI unix sockets.</p>
      </div>

      <div className="shadcn-card rounded-xl p-4 border-l-4 border-l-rose-500">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs font-bold text-white">Apache Engine</span>
          </div>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold">Active</span>
        </div>
        <p className="text-[11px] text-zinc-400">100% .htaccess & mod_rewrite compatibility.</p>
      </div>

      <div className="shadcn-card rounded-xl p-4 border-l-4 border-l-cyan-500">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-white">Hybrid Tri-Mode</span>
          </div>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold">Pro</span>
        </div>
        <p className="text-[11px] text-zinc-400">Nginx static cache + Apache backend on 8081.</p>
      </div>

      <div className="shadcn-card rounded-xl p-4 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white">Varnish Cache</span>
          </div>
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">Turbo</span>
        </div>
        <p className="text-[11px] text-zinc-400">In-memory RAM HTTP accelerator.</p>
      </div>
    </div>
  );
}
