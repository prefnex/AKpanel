import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, Loader2, Puzzle, RefreshCw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/app/PageHeader';
import { api } from '@/lib/api';

const STATUS_KEYS = [
  ['Uptime', 'Uptime (s)'], ['Total Accesses', 'Requests'], ['ReqPerSec', 'Requests/s'], ['BytesPerSec', 'Bytes/s'],
  ['BusyWorkers', 'Busy workers'], ['IdleWorkers', 'Idle workers'], ['ConnsTotal', 'Connections'], ['Load1', 'Load (1m)'],
];

// Web server status: every web daemon's version, listening addresses and processes, and
// Apache's modules and live mod_status.
export default function WebServerStatusPage() {
  const qc = useQueryClient();
  const [modFilter, setModFilter] = useState('');
  const status = useQuery({
    queryKey: ['webservers', 'status-info'],
    queryFn: () => api.get('/api/webservers/status-info').then((r) => r.data),
    refetchInterval: 15000,
  });
  const control = useMutation({
    mutationFn: ({ unit, action }) => api.post('/api/webservers/service/action', { service: unit, action }),
    onSuccess: (res) => { toast.success(res?.message || 'Done'); qc.invalidateQueries({ queryKey: ['webservers', 'status-info'] }); },
    onError: (err) => toast.error(err.message),
  });

  const d = status.data;
  const ap = d?.apache;
  const mods = (ap?.modules || []).filter((m) => !modFilter || m.includes(modFilter.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Web server status"
        description={`Mode ${d?.mode || '…'}. Versions, listening addresses and processes of every web daemon, read live from the server.`}
        actions={<Button variant="outline" size="sm" onClick={() => status.refetch()} disabled={status.isFetching}><RefreshCw className={status.isFetching ? 'animate-spin' : ''} />Refresh</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {status.isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {d?.daemons?.map((x) => (
          <Card key={x.id} className={x.installed ? '' : 'opacity-60'}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{x.title}</p>
                  <p className="truncate text-xs text-muted-foreground" title={x.version}>{x.installed ? x.version || '—' : 'Not installed'}</p>
                </div>
                {x.installed && (x.active ? <Badge variant="success">running</Badge> : <Badge variant="muted">stopped</Badge>)}
              </div>
              {x.installed && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Listening{x.processes ? ` · ${x.processes} process${x.processes > 1 ? 'es' : ''}` : ''}</p>
                    <div className="flex flex-wrap gap-1">
                      {x.listen.length ? x.listen.map((l) => <Badge key={l} variant="muted" className="max-w-full truncate font-mono text-[11px] font-normal">{l}</Badge>)
                        : <span className="text-xs text-muted-foreground">nothing</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {x.active ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => control.mutate({ unit: x.unit, action: 'reload' })} disabled={control.isPending}><RotateCw />Reload</Button>
                        <Button variant="outline" size="sm" onClick={() => control.mutate({ unit: x.unit, action: 'restart' })} disabled={control.isPending}>
                          {control.isPending && control.variables?.unit === x.unit ? <Loader2 className="animate-spin" /> : <RefreshCw />}Restart
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => control.mutate({ unit: x.unit, action: 'start' })} disabled={control.isPending}>Start</Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {ap && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Apache live status</CardTitle>
              <CardDescription>{ap.version} · MPM {ap.mpm || '?'}</CardDescription>
            </CardHeader>
            <CardContent>
              {ap.status ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {STATUS_KEYS.filter(([k]) => ap.status[k] !== undefined).map(([k, label]) => (
                      <div key={k} className="rounded-md border p-2">
                        <dt className="text-[11px] text-muted-foreground">{label}</dt>
                        <dd className="truncate font-mono text-sm">{ap.status[k]}</dd>
                      </div>
                    ))}
                  </dl>
                  {ap.status.Scoreboard && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Scoreboard ( _ waiting · W sending · R reading · K keep-alive · . open slot )</p>
                      <p className="break-all rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">{ap.status.Scoreboard}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">mod_status is not answering on loopback, so live figures are not available.</p>
              )}
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Puzzle className="h-4 w-4" />Apache modules ({ap.modules.length})</CardTitle>
              <CardDescription>Loaded modules (apache2ctl -M).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={modFilter} onChange={(e) => setModFilter(e.target.value)} placeholder="Filter modules…" className="h-8" aria-label="Filter modules" />
              <div className="flex max-h-72 flex-wrap gap-1 overflow-y-auto">
                {mods.map((m) => <Badge key={m} variant="muted" className="font-mono text-[11px] font-normal">{m.replace(/_module$/, '')}</Badge>)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
