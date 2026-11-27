import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DownloadCloud, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import PageHeader from '@/components/app/PageHeader';
import SegmentedControl from '@/components/app/SegmentedControl';
import EmptyState from '@/components/app/EmptyState';
import { api } from '@/lib/api';
import { usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled, VersionPicker } from './PHPShared';

// An extension is in one of three states:
//   loaded + has ini  → can be switched off (phpdismod)
//   loaded, no ini    → compiled in, always on
//   not loaded + ini  → installed but disabled (phpenmod)
//   not loaded, none  → package must be installed first
function stateOf(ext) {
  if (ext.is_installed && !ext.has_ini) return 'builtin';
  if (ext.is_installed) return 'on';
  if (ext.has_ini) return 'off';
  return 'missing';
}

export default function PHPExtensionsPage() {
  const { installed, versionsQuery, current, selectedVer, refresh, startInstall } = usePHPRuntime();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [show, setShow] = useState('all');
  const [pending, setPending] = useState(null);

  const toggle = useMutation({
    mutationFn: ({ name, enabled }) => api.post('/api/php/extension/state', { version: selectedVer, extension: name, enabled }),
    onMutate: ({ name }) => setPending(name),
    onSuccess: (r) => { toast.success(r.message); refresh(); },
    onError: (e) => toast.error(e.message, { duration: 10000 }),
    onSettled: () => setPending(null),
  });

  const exts = current?.extensions || [];
  const categories = useMemo(() => [...new Set(exts.map((e) => e.category))].sort(), [exts]);
  const counts = useMemo(() => ({
    all: exts.length,
    on: exts.filter((e) => e.is_installed).length,
    off: exts.filter((e) => !e.is_installed).length,
  }), [exts]);

  const list = exts.filter((e) => {
    const q = query.trim().toLowerCase();
    if (q && !e.name.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q)) return false;
    if (category !== 'all' && e.category !== category) return false;
    if (show === 'on' && !e.is_installed) return false;
    if (show === 'off' && e.is_installed) return false;
    return true;
  });

  if (installed.length === 0 && !versionsQuery.isLoading) {
    return <div className="space-y-6"><PageHeader title="Extensions" /><NoPHPInstalled /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extensions"
        description="Switch PHP modules on or off for the selected version, or install the ones that are missing. FPM reloads after each change."
        actions={<VersionPicker />}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search extensions…" className="pl-8" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <SegmentedControl
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'on', label: 'Enabled', count: counts.on },
            { value: 'off', label: 'Not enabled', count: counts.off },
          ]}
        />
      </div>

      {versionsQuery.isLoading ? <Skeleton className="h-96" /> : list.length === 0 ? (
        <EmptyState icon={Search} title="No extensions match" description="Try another search or category." />
      ) : (
        <Card className="divide-y">
          {list.map((ext) => {
            const st = stateOf(ext);
            const busy = pending === ext.name;
            return (
              <div key={ext.name} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{ext.name}</span>
                    <Badge variant="muted" className="text-[10px]">{ext.category}</Badge>
                    {st === 'builtin' && <Badge variant="secondary" className="text-[10px]"><Lock className="h-3 w-3" />built in</Badge>}
                    {st === 'missing' && <Badge variant="outline" className="text-[10px]">not installed</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{ext.description}</p>
                </div>
                <div className="shrink-0">
                  {st === 'missing' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startInstall({ type: 'extension', version: selectedVer, name: ext.package_name })}
                    >
                      <DownloadCloud />Install
                    </Button>
                  ) : st === 'builtin' ? (
                    <Tooltip>
                      <TooltipTrigger asChild><span><Switch checked disabled aria-label={`${ext.name} is built in`} /></span></TooltipTrigger>
                      <TooltipContent>Compiled into PHP {selectedVer}; always on.</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Switch
                      checked={st === 'on'}
                      disabled={busy || toggle.isPending}
                      onCheckedChange={(c) => toggle.mutate({ name: ext.name, enabled: c })}
                      aria-label={`${st === 'on' ? 'Disable' : 'Enable'} ${ext.name}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
