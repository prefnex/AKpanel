import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, Play, RefreshCw, RotateCcw, RotateCw, Save, Square, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/app/PageHeader';
import SegmentedControl from '@/components/app/SegmentedControl';
import StatusBadge from '@/components/app/StatusBadge';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import { api } from '@/lib/api';
import { fpmStatus, usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled, SettingRow, VersionPicker } from './PHPShared';

const PM_MODES = [
  { value: 'ondemand', label: 'On demand' },
  { value: 'dynamic', label: 'Dynamic' },
  { value: 'static', label: 'Static' },
];
const PM_HELP = {
  ondemand: 'No idle workers. A worker starts on the first request and exits after the idle timeout. Lowest memory; first hit after idle is a little slower.',
  dynamic: 'Keeps a few spare workers ready and grows up to max children under load. Good balance for busy sites.',
  static: 'Always runs exactly max children workers. Most predictable latency, highest memory use.',
};
const PRESETS = {
  small: { label: 'Small VPS', pm: 'ondemand', max_children: 5, process_idle_timeout: 10, start_servers: 1, min_spare_servers: 1, max_spare_servers: 2, max_requests: 500 },
  balanced: { label: 'Balanced', pm: 'dynamic', max_children: 20, process_idle_timeout: 10, start_servers: 4, min_spare_servers: 2, max_spare_servers: 6, max_requests: 500 },
  busy: { label: 'High traffic', pm: 'dynamic', max_children: 60, process_idle_timeout: 10, start_servers: 10, min_spare_servers: 5, max_spare_servers: 20, max_requests: 1000 },
};
const MB_PER_WORKER = 48; // typical WordPress worker; only used for the estimate

function validate(p) {
  const e = {};
  if (!(p.max_children >= 1)) e.max_children = 'At least 1';
  if (p.pm === 'dynamic') {
    if (!(p.min_spare_servers >= 1)) e.min_spare_servers = 'At least 1';
    if (p.max_spare_servers < p.min_spare_servers) e.max_spare_servers = 'Must be ≥ min spare';
    if (p.max_spare_servers > p.max_children) e.max_spare_servers = 'Must be ≤ max children';
    if (p.start_servers < p.min_spare_servers || p.start_servers > p.max_spare_servers) e.start_servers = 'Between min and max spare';
  }
  if (p.pm === 'ondemand' && !(p.process_idle_timeout >= 1)) e.process_idle_timeout = 'At least 1 second';
  if (p.max_requests < 0) e.max_requests = 'Cannot be negative';
  if (p.request_terminate_timeout < 0) e.request_terminate_timeout = 'Cannot be negative';
  return e;
}

function NumberField({ id, value, onChange, error, suffix, min = 0, placeholder }) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          value={Number.isFinite(value) ? value : ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          className={`tabular ${suffix ? 'pr-12' : ''} ${error ? 'border-destructive' : ''}`}
          aria-invalid={!!error}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function PHPFPMPage() {
  const { installed, selectedVer, current, serverDefault, refresh } = usePHPRuntime();
  const qc = useQueryClient();

  const pool = useQuery({
    queryKey: ['php', 'pool', selectedVer],
    queryFn: () => api.get(`/api/php/fpm/pool?version=${selectedVer}`),
    enabled: !!selectedVer,
  });
  const [form, setForm] = useState(null);
  useEffect(() => { if (pool.data?.data) setForm(pool.data.data); }, [pool.data]);

  const original = pool.data?.data;
  const dirty = useMemo(() => form && original && JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const errors = form ? validate(form) : {};
  const hasErrors = Object.keys(errors).length > 0;

  const save = useMutation({
    mutationFn: () => api.post('/api/php/fpm/pool', { ...form, version: selectedVer }),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ['php', 'pool', selectedVer] });
      refresh();
    },
    onError: (e) => toast.error(e.message, { duration: 12000 }),
  });

  const service = useMutation({
    mutationFn: (action) => api.post('/api/php/fpm/service', { version: selectedVer, action }),
    onSuccess: (r) => { toast.success(r.message); refresh(); },
    onError: (e) => toast.error(e.message, { duration: 12000 }),
  });
  const [confirmStop, setConfirmStop] = useState(false);

  if (installed.length === 0 && !pool.isLoading) {
    return <div className="space-y-6"><PageHeader title="PHP-FPM" /><NoPHPInstalled /></div>;
  }

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const applyPreset = (key) => {
    const { label, ...p } = PRESETS[key];
    setForm((f) => ({ ...f, ...p }));
    toast.info(`${label} values filled in — review and save`);
  };
  const workers = form ? form.max_children : 0;
  const accountPools = pool.data?.account_pools || [];
  const busy = service.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PHP-FPM"
        description="The FastCGI service that runs PHP for websites: start/stop it and size the shared pool used by the server's own sites."
        actions={<VersionPicker />}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold">php{selectedVer}-fpm</span>
                <StatusBadge status={fpmStatus(current)} />
                {selectedVer === serverDefault && <Badge variant="info">Server default</Badge>}
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {original?.listen || current?.socket_path || '—'}{original?.user ? ` · user ${original.user}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {current?.is_fpm_running ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmStop(true)}><Square />Stop</Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => service.mutate('start')}><Play />Start</Button>
            )}
            <Button variant="outline" size="sm" disabled={busy || !current?.is_fpm_running} onClick={() => service.mutate('reload')}>
              {busy && service.variables === 'reload' ? <Loader2 className="animate-spin" /> : <RotateCw />}Reload
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => service.mutate('restart')}>
              {busy && service.variables === 'restart' ? <Loader2 className="animate-spin" /> : <RefreshCw />}Restart
            </Button>
          </div>
        </CardContent>
      </Card>

      {pool.isLoading || !form ? (
        pool.isError ? <Card className="p-6 text-sm text-destructive">{pool.error.message}</Card> : <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Shared pool (www)</CardTitle>
              <CardDescription>
                <span className="font-mono">/etc/php/{selectedVer}/fpm/pool.d/www.conf</span> — serves sites under /var/www/sites, webmail and phpMyAdmin.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRESETS).map(([k, p]) => (
                <Button key={k} variant="secondary" size="sm" onClick={() => applyPreset(k)}>{p.label}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2 pb-2">
              <SegmentedControl value={form.pm} onChange={set('pm')} options={PM_MODES} size="md" />
              <p className="max-w-2xl text-xs text-muted-foreground">{PM_HELP[form.pm]}</p>
            </div>

            <div className="divide-y">
              <SettingRow label="Max children" htmlFor="pm-max" help="Most PHP requests handled at the same time. More workers need more RAM.">
                <NumberField id="pm-max" min={1} value={form.max_children} onChange={set('max_children')} error={errors.max_children} suffix="workers" />
              </SettingRow>

              {form.pm === 'dynamic' && (
                <>
                  <SettingRow label="Start servers" htmlFor="pm-start" help="Workers started with the service.">
                    <NumberField id="pm-start" min={1} value={form.start_servers} onChange={set('start_servers')} error={errors.start_servers} />
                  </SettingRow>
                  <SettingRow label="Min spare servers" htmlFor="pm-minspare" help="Idle workers kept ready at the least.">
                    <NumberField id="pm-minspare" min={1} value={form.min_spare_servers} onChange={set('min_spare_servers')} error={errors.min_spare_servers} />
                  </SettingRow>
                  <SettingRow label="Max spare servers" htmlFor="pm-maxspare" help="Idle workers above this are stopped.">
                    <NumberField id="pm-maxspare" min={1} value={form.max_spare_servers} onChange={set('max_spare_servers')} error={errors.max_spare_servers} />
                  </SettingRow>
                </>
              )}

              {form.pm === 'ondemand' && (
                <SettingRow label="Idle timeout" htmlFor="pm-idle" help="A worker with no requests for this long exits.">
                  <NumberField id="pm-idle" min={1} value={form.process_idle_timeout} onChange={set('process_idle_timeout')} error={errors.process_idle_timeout} suffix="sec" />
                </SettingRow>
              )}

              <SettingRow label="Recycle worker after" htmlFor="pm-maxreq" help="Restart a worker after this many requests to contain memory leaks. 0 = never.">
                <NumberField id="pm-maxreq" value={form.max_requests} onChange={set('max_requests')} error={errors.max_requests} suffix="req" />
              </SettingRow>
              <SettingRow label="Request timeout" htmlFor="pm-term" help="Kill a request running longer than this. 0 = off (max_execution_time still applies).">
                <NumberField id="pm-term" value={form.request_terminate_timeout} onChange={set('request_terminate_timeout')} error={errors.request_terminate_timeout} suffix="sec" />
              </SettingRow>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Peak memory ≈ <span className="font-medium text-foreground tabular">{Number.isFinite(workers) ? (workers * MB_PER_WORKER).toLocaleString() : '—'} MB</span>{' '}
                ({workers || 0} workers × ~{MB_PER_WORKER} MB; real use depends on the site).
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setForm(original)} disabled={!dirty || save.isPending}><RotateCcw />Reset</Button>
                <Button onClick={() => save.mutate()} disabled={!dirty || hasErrors || save.isPending}>
                  {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save & restart FPM
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Account pools</CardTitle>
            <CardDescription>One pool per hosting account on PHP {selectedVer}. Generated from Main config and each account's package, so they are read-only here.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild><Link to="/webservers/main-conf">Main config</Link></Button>
        </CardHeader>
        <CardContent>
          {accountPools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hosting account runs on PHP {selectedVer}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Max children</TableHead><TableHead className="text-right">Memory limit</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {accountPools.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-mono">{p.name}</TableCell>
                    <TableCell>{p.pm || '—'}</TableCell>
                    <TableCell className="text-right tabular">{p.max_children || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{p.memory_limit || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={`Stop php${selectedVer}-fpm?`}
        description={`Every website on PHP ${selectedVer} returns 502 until it is started again.`}
        actionLabel="Stop FPM"
        onConfirm={() => service.mutate('stop')}
      />
    </div>
  );
}
