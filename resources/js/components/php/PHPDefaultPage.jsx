import React from 'react';
import { RotateCw, DownloadCloud } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPDefaultPage() {
  const { phpDetails, selectedVer, setSelectedVer, setPreviewItem, navigate } = usePHPRuntime();

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="Default version"
        goal="Choose the PHP version assigned to new websites and the system fallback FPM socket when a site has no per-user pool."
      />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {phpDetails.map(ver => (
        <Card
          key={ver.version}
          onClick={() => {
            if (ver.is_installed) setSelectedVer(ver.version);
            else navigate(`/php/install/${ver.version}`);
          }}
          className={`bg-[#121215] border rounded-3xl p-5 cursor-pointer ${
            ver.version === selectedVer
              ? 'border-indigo-500/80 bg-indigo-950/10 ring-2 ring-indigo-500/30'
              : 'border-zinc-800/80 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-white font-mono">PHP {ver.version}</span>
            {ver.is_installed ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Installed</Badge>
            ) : (
              <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px]">Not Installed</Badge>
            )}
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span className="text-zinc-500">RAM:</span>
              <span className="font-mono text-zinc-200">{ver.memory_limit || '512M'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Upload:</span>
              <span className="font-mono text-zinc-200">{ver.upload_max_filesize || '128M'}</span>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-zinc-800/80 flex justify-end">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewItem({ type: 'version', version: ver.version, name: `PHP ${ver.version}` });
              }}
              className={`rounded-xl text-xs font-bold gap-1.5 ${
                ver.is_installed ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {ver.is_installed ? <RotateCw className="w-3 h-3" /> : <DownloadCloud className="w-3 h-3" />}
              {ver.is_installed ? 'Re-Build' : 'Install'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
    </div>
  );
}
