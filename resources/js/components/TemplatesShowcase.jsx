import React from 'react';
import { ArrowUpRight, Sparkles, Layers } from 'lucide-react';

export default function TemplatesShowcase({ templates, onSelectTemplate }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <span>10 Ready Framework Presets</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Pre-configured VirtualHost templates for Nginx, Apache, and Varnish.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(tpl => (
          <div 
            key={tpl.id} 
            className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-5 hover:border-violet-500/60 transition group flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
                  {tpl.category}
                </span>
                <span className="text-xs font-semibold text-violet-400">{tpl.default_type.toUpperCase()}</span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition">{tpl.name}</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{tpl.description}</p>
            </div>

            <div className="mt-5 pt-4 border-t border-zinc-800/60">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tpl.features.slice(0, 2).map((f, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800/80">
                    {f}
                  </span>
                ))}
              </div>
              <button 
                onClick={() => onSelectTemplate(tpl)} 
                className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-white hover:text-black text-zinc-200 border border-zinc-800 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Deploy This Preset</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
