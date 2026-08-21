import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPExtensionsPage() {
  const {
    searchQuery, setSearchQuery, categories, activeCategory, setActiveCategory,
    filteredExtensions, setPreviewItem, selectedVer,
  } = usePHPRuntime();

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="Extensions"
        goal="Enable or install PHP modules (mysqli, gd, intl, redis, …) for the selected version. Changes apply after FPM restart."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
          <Input
            type="text"
            placeholder="Search extensions..."
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
              className={`px-3 py-1.5 rounded-xl font-semibold ${
                activeCategory === cat ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-zinc-900/60 text-zinc-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[550px] overflow-y-auto p-1">
        {filteredExtensions.map(ext => (
          <div key={ext.name} className="p-3.5 rounded-2xl bg-[#121215] border border-zinc-800/80 flex items-center justify-between">
            <div className="pr-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-white font-mono">{ext.name}</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-zinc-800 text-zinc-400">{ext.category}</Badge>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{ext.description}</p>
            </div>
            <Button
              size="sm"
              onClick={() => setPreviewItem({ type: 'extension', name: ext.name, version: selectedVer })}
              className={`h-7 px-3 rounded-xl text-xs shrink-0 font-bold ${
                ext.is_installed ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'bg-white hover:bg-zinc-200 text-black'
              }`}
            >
              {ext.is_installed ? 'Active' : 'Install'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
