import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, DownloadCloud, Server } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useWebServerModes } from '@/hooks/useWebServerModes';
import { api } from '@/lib/api';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPDefaultPage() {
  const {
    phpDetails, selectedVer, setSelectedVer, navigate,
    handleSetDefaultFPM, settingDefaultFPM,
  } = usePHPRuntime();

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="PHP FPM selector"
        goal="Choose which PHP-FPM version new websites use when they did not pick one. There are two defaults: one for sites whose PHP runs under Nginx (the cards below — also the CLI and panel tools default) and one for sites whose PHP runs under Apache. An account's own version always wins."
      />
      <BackendDefaults />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {phpDetails.map(ver => (
          <Card
            key={ver.version}
            onClick={() => {
              if (ver.is_installed) setSelectedVer(ver.version);
              else navigate(`/php/install/${ver.version}`);
            }}
            className={`bg-[#121215] border rounded-3xl p-5 cursor-pointer ${
              ver.is_default_fpm
                ? 'border-indigo-500/80 bg-indigo-950/10 ring-2 ring-indigo-500/30'
                : ver.version === selectedVer
                  ? 'border-zinc-600'
                  : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-white font-mono">PHP {ver.version}</span>
              {ver.is_default_fpm ? (
                <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[10px]">Default FPM</Badge>
              ) : ver.is_installed ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Installed</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px]">Not Installed</Badge>
              )}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span className="text-zinc-500">Socket:</span>
                <span className="font-mono text-zinc-200 truncate ml-2">{ver.socket_path || `/run/php/php${ver.version}-fpm.sock`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">FPM:</span>
                <span className={ver.is_fpm_running ? 'text-emerald-400' : 'text-zinc-500'}>
                  {ver.is_fpm_running ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-zinc-800/80 flex justify-end">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (ver.is_installed) handleSetDefaultFPM(ver.version);
                  else navigate(`/php/install/${ver.version}`);
                }}
                disabled={settingDefaultFPM && selectedVer === ver.version}
                className={`rounded-xl text-xs font-bold gap-1.5 ${
                  ver.is_default_fpm
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : ver.is_installed
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {ver.is_installed ? (
                  <>
                    {ver.is_default_fpm ? <CheckCircle2 className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                    {ver.is_default_fpm ? 'Active FPM' : 'Set as default FPM'}
                  </>
                ) : (
                  <><DownloadCloud className="w-3 h-3" />Install</>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// The default for Apache-run sites, next to the Nginx default the cards below set.
function BackendDefaults() {
  const qc = useQueryClient();
  const modes = useWebServerModes();
  const d = modes.data;
  const save = useMutation({
    mutationFn: (v) => api.post('/api/webservers/php-defaults', { default_apache_php: v }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Saved');
      qc.invalidateQueries({ queryKey: ['webservers'] });
    },
    onError: (err) => toast.error(err.message),
  });
  if (!d) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="text-sm">
        <p className="font-medium">Default for sites run by Apache</p>
        <p className="text-xs text-muted-foreground">
          Nginx-run sites: PHP {d.default_nginx_php}. Both can also be set on the{' '}
          <Link to="/webservers/select" className="underline underline-offset-2">web server mode</Link> page.
        </p>
      </div>
      <Select value={d.default_apache_php} onValueChange={(v) => save.mutate(v)} disabled={save.isPending}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(d.installed_php || []).map((v) => <SelectItem key={v} value={v}>PHP {v}</SelectItem>)}
        </SelectContent>
      </Select>
    </Card>
  );
}
