import React from 'react';
import { Terminal, CheckCircle2, DownloadCloud } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { usePHPRuntime } from './PHPRuntimeContext';

export default function PHPCLIPage() {
  const {
    phpDetails, cliOverview, selectedVer, setSelectedVer, currentDetail,
    handleSetDefaultCLI, settingDefaultCLI, navigate,
  } = usePHPRuntime();

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-indigo-950/40 to-[#121215] border-indigo-900/40 rounded-3xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              System PHP CLI
            </div>
            <div className="text-sm font-mono text-white mt-2">{cliOverview.version_line || 'Loading...'}</div>
            <div className="text-[11px] text-zinc-500 mt-1 font-mono">
              Binary: {cliOverview.binary_path || '/usr/bin/php'}
              {cliOverview.default_version && (
                <span className="ml-2 text-indigo-400">• Default: PHP {cliOverview.default_version}</span>
              )}
            </div>
          </div>
          {currentDetail.is_installed && !currentDetail.is_default_cli && (
            <Button
              onClick={() => handleSetDefaultCLI(selectedVer)}
              disabled={settingDefaultCLI}
              className="rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-2 h-10 px-5"
            >
              <CheckCircle2 className={`w-4 h-4 ${settingDefaultCLI ? 'animate-spin' : ''}`} />
              Set PHP {selectedVer} as System CLI
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl font-black text-white font-mono">PHP {ver.version}</span>
              {ver.is_installed ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Installed</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px]">Not Installed</Badge>
              )}
            </div>
            {ver.is_installed ? (
              <div className="mt-3 space-y-1.5 text-[11px] text-zinc-500">
                <div className="font-mono text-zinc-400 truncate">{ver.cli_version || `php${ver.version} ready`}</div>
                <div className="flex justify-between">
                  <span>FPM</span>
                  <span className={ver.is_fpm_running ? 'text-emerald-400' : 'text-zinc-500'}>
                    {ver.is_fpm_running ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 mt-3">Click Install to add CLI + FPM.</p>
            )}
            <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (ver.is_installed) handleSetDefaultCLI(ver.version);
                  else navigate(`/php/install/${ver.version}`);
                }}
                className={`rounded-xl text-[10px] font-bold h-8 ${
                  ver.is_installed ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {ver.is_installed ? (ver.is_default_cli ? 'CLI Active' : 'Use as CLI') : (
                  <><DownloadCloud className="w-3 h-3 mr-1 inline" />Install</>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
