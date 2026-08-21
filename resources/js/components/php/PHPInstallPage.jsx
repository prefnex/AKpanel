import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { usePHPRuntime } from './PHPRuntimeContext';

export default function PHPInstallPage() {
  const { version } = useParams();
  const { selectedVer, installPkgs, setInstallPkgs, handleStartLiveInstall, navigate } = usePHPRuntime();
  const ver = version || selectedVer;

  return (
    <Card className="bg-[#121215] border-zinc-800 rounded-3xl p-6">
      <h3 className="text-lg font-bold text-white">Install PHP {ver}</h3>
      <p className="text-xs text-zinc-400 mt-1">Choose packages, then install. CLI and FPM can be toggled independently.</p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {installPkgs.map(pkg => (
          <label
            key={pkg.id}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 cursor-pointer ${
              pkg.on ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-900/50'
            }`}
          >
            <input
              type="checkbox"
              checked={pkg.on}
              onChange={() => setInstallPkgs(prev => prev.map(p => p.id === pkg.id ? { ...p, on: !p.on } : p))}
            />
            <div>
              <div className="text-sm text-white font-semibold">{pkg.label}</div>
              <div className="text-[10px] font-mono text-zinc-500">php{ver}-{pkg.id}</div>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <Button
          onClick={() => handleStartLiveInstall('version', `PHP ${ver}`, ver)}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-10 px-5"
        >
          Install selected packages
        </Button>
        <Button variant="outline" onClick={() => navigate('/php/cli')} className="rounded-xl border-zinc-700 text-zinc-300 text-xs h-10">
          Cancel
        </Button>
      </div>
    </Card>
  );
}
