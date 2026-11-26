import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, Loader2, RotateCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/app/PageHeader';
import LogViewer from '@/components/app/LogViewer';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebServerModes } from '@/hooks/useWebServerModes';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function WebServerModesPage() {
  const qc = useQueryClient();
  const modes = useWebServerModes();
  const data = modes.data;

  const [selected, setSelected] = useState('');
  const [nginxPHP, setNginxPHP] = useState('');
  const [apachePHP, setApachePHP] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => {
    if (!data) return;
    setSelected((s) => s || data.active);
    setNginxPHP((v) => v || data.default_nginx_php);
    setApachePHP((v) => v || data.default_apache_php);
  }, [data]);

  const apply = useMutation({
    mutationFn: () => api.post('/api/webservers/mode', {
      mode: selected,
      default_nginx_php: nginxPHP,
      default_apache_php: apachePHP,
    }),
    onMutate: () => setLog(`Switching to ${selected}…\n`),
    onSuccess: (res) => {
      setLog((res?.data?.log || []).join('\n'));
      toast.success(res?.message || 'Web server mode applied');
      qc.invalidateQueries({ queryKey: ['webservers'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
    },
    onError: (err) => {
      const lines = err?.body?.data?.log || [];
      setLog([...lines, '', `ERROR: ${err.message}`].join('\n'));
      toast.error(err.message);
    },
  });

  const savePHP = useMutation({
    mutationFn: () => api.post('/api/webservers/php-defaults', { default_nginx_php: nginxPHP, default_apache_php: apachePHP }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Default PHP versions saved');
      qc.invalidateQueries({ queryKey: ['webservers'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const modeChanged = data && selected && selected !== data.active;
  const phpChanged = data && (nginxPHP !== data.default_nginx_php || apachePHP !== data.default_apache_php);
  const selectedMode = data?.modes?.find((m) => m.id === selected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Web server mode"
        description="Choose who owns ports 80/443 and what runs PHP. Each domain can then pick its own backend, Apache PHP handler and Varnish cache within what the mode allows."
        actions={
          <Button variant="outline" size="sm" onClick={() => modes.refetch()} disabled={modes.isFetching}>
            <RotateCw className={modes.isFetching ? 'animate-spin' : ''} />Refresh
          </Button>
        }
      />

      <Card>
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 border-b px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <span>Mode</span>
          <span>Ports</span>
          <span>Per-domain options</span>
        </div>
        <div role="radiogroup" aria-label="Web server mode" className="divide-y">
          {modes.isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4"><Skeleton className="h-14 w-full" /></div>
          ))}
          {data?.modes?.map((m) => {
            const active = m.id === data.active;
            const checked = m.id === selected;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={!m.available}
                onClick={() => setSelected(m.id)}
                className={cn(
                  'grid w-full gap-3 px-5 py-4 text-left transition-colors md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-4',
                  checked ? 'bg-primary/5' : 'hover:bg-muted/40',
                  !m.available && 'cursor-not-allowed opacity-60'
                )}
              >
                <div className="flex gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.title}</span>
                      {active && <Badge variant="success">Active</Badge>}
                      {!m.available && <Badge variant="warning">Needs {m.missing?.join(', ')}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    <div className="space-y-0.5 pt-1">
                      {m.flow.map((f) => (
                        <p key={f} className="font-mono text-[11px] text-muted-foreground">{f}</p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pl-7 md:pl-0">
                  {m.ports.map((p) => <p key={p} className="font-mono text-xs">{p}</p>)}
                </div>
                <div className="flex flex-wrap content-start gap-1.5 pl-7 md:pl-0">
                  {m.handlers.map((h) => <Badge key={h} variant="muted" className="font-normal">{h}</Badge>)}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default PHP versions</CardTitle>
          <CardDescription>
            Used for new sites and accounts that did not pick a version. An account's own version always wins.
            {data && !data.cgi_available && ' PHP-CGI (suexec) is not installed, so Apache sites use PHP-FPM.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <PHPSelect id="php-apache" label="Sites run by Apache" value={apachePHP} onChange={setApachePHP} versions={data?.installed_php} />
          <PHPSelect id="php-nginx" label="Sites run by Nginx (also CLI and panel tools)" value={nginxPHP} onChange={setNginxPHP} versions={data?.installed_php} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {phpChanged && !modeChanged && (
          <Button variant="outline" onClick={() => savePHP.mutate()} disabled={savePHP.isPending}>
            {savePHP.isPending && <Loader2 className="animate-spin" />}Save PHP defaults
          </Button>
        )}
        <Button onClick={() => setConfirming(true)} disabled={!data || apply.isPending || !selectedMode?.available}>
          {apply.isPending ? <Loader2 className="animate-spin" /> : <Server />}
          {modeChanged ? 'Save & rebuild configuration' : 'Rebuild configuration'}
        </Button>
      </div>

      {(log || apply.isPending) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {apply.isError && <AlertTriangle className="h-4 w-4 text-destructive" />}
              Rebuild log
            </CardTitle>
          </CardHeader>
          <CardContent><LogViewer text={log} /></CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive={false}
        title={modeChanged ? `Switch to ${selectedMode?.title}?` : 'Rebuild every vhost?'}
        description="Every site and panel vhost is regenerated and tested first. Web server daemons are then restarted, so sites drop connections for a few seconds. If a test or a restart fails, the previous configuration is restored."
        actionLabel={modeChanged ? 'Switch mode' : 'Rebuild'}
        onConfirm={() => {
          setConfirming(false);
          apply.mutate();
        }}
      />
    </div>
  );
}

function PHPSelect({ id, label, value, onChange, versions }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={!versions?.length}>
        <SelectTrigger id={id}><SelectValue placeholder="No PHP installed" /></SelectTrigger>
        <SelectContent>
          {(versions || []).map((v) => <SelectItem key={v} value={v}>PHP {v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
