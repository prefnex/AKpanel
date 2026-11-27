import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, FileCode2, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import PageHeader from '@/components/app/PageHeader';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled, SettingRow, VersionPicker } from './PHPShared';

const CUSTOM = '__custom__';
const GROUP_ORDER = ['Resources', 'Uploads', 'Errors', 'Behaviour', 'OPcache'];

function sizeBytes(v) {
  const m = String(v || '').trim().toUpperCase().match(/^(-?\d+)([KMG]?)$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  if (n === -1) return Infinity;
  return n * ({ K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2]] || 1);
}

function prettyOption(def, o) {
  if (def.kind === 'size' && o === '-1') return 'Unlimited (-1)';
  if (def.kind === 'int' && o === '0' && def.unit === 's' && def.key !== 'opcache.revalidate_freq') return 'No limit (0)';
  if (def.kind === 'int' && o === '-1') return 'Same as execution time (-1)';
  if (def.unit === 's' && Number(o) >= 3600) return `${Number(o) / 3600} h`;
  return def.unit ? `${o} ${def.unit}` : o;
}

// PresetSelect: preset values in a Select, with a "Custom…" entry that turns into an input.
function PresetSelect({ def, value, onChange }) {
  const options = def.options || [];
  const isPreset = options.includes(value);
  const [custom, setCustom] = useState(!isPreset && value !== '');
  useEffect(() => { if (options.includes(value)) setCustom(false); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (custom) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" placeholder={def.kind === 'size' ? 'e.g. 384M' : 'number'} autoFocus />
        <Button variant="ghost" size="sm" onClick={() => { setCustom(false); onChange(options[0]); }}>Presets</Button>
      </div>
    );
  }
  return (
    <Select value={isPreset ? value : ''} onValueChange={(v) => (v === CUSTOM ? setCustom(true) : onChange(v))}>
      <SelectTrigger className="font-mono"><SelectValue placeholder={value || 'Choose…'} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o} className="font-mono">{prettyOption(def, o)}</SelectItem>)}
        <SelectItem value={CUSTOM}>Custom value…</SelectItem>
      </SelectContent>
    </Select>
  );
}

let zonesCache;
function timezones() {
  if (!zonesCache) {
    try {
      zonesCache = Intl.supportedValuesOf('timeZone');
    } catch {
      zonesCache = ['UTC', 'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York'];
    }
    if (!zonesCache.includes('UTC')) zonesCache = ['UTC', ...zonesCache];
  }
  return zonesCache;
}

function TimezonePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-mono font-normal">
          <span className="truncate">{value || 'Not set (UTC)'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search timezone…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {timezones().map((tz) => (
              <CommandItem key={tz} value={tz} onSelect={() => { onChange(tz); setOpen(false); }} className="font-mono text-xs">
                <Check className={cn('h-3.5 w-3.5', tz === value ? 'opacity-100' : 'opacity-0')} />{tz}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Control({ def, value, onChange }) {
  if (def.kind === 'bool') {
    return (
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground sm:justify-start">
        <Switch id={`ini-${def.key}`} checked={value === '1'} onCheckedChange={(c) => onChange(c ? '1' : '0')} />
        {value === '1' ? 'On' : 'Off'}
      </div>
    );
  }
  if (def.kind === 'timezone') return <TimezonePicker value={value} onChange={onChange} />;
  if (def.kind === 'choice') {
    const opts = def.options.includes(value) || !value ? def.options : [value, ...def.options];
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Choose…" /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o} className="font-mono text-xs">{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return <PresetSelect def={def} value={value} onChange={onChange} />;
}

export default function PHPIniPage() {
  const { installed, selectedVer, refresh } = usePHPRuntime();
  const qc = useQueryClient();
  const [alsoCLI, setAlsoCLI] = useState(false);

  const q = useQuery({
    queryKey: ['php', 'ini', selectedVer],
    queryFn: () => api.get(`/api/php/ini?version=${selectedVer}&sapi=fpm`).then((r) => r.data),
    enabled: !!selectedVer,
  });
  const defs = q.data || [];
  const original = useMemo(() => Object.fromEntries(defs.map((d) => [d.key, d.value ?? ''])), [defs]);
  const [values, setValues] = useState({});
  useEffect(() => setValues(original), [original]);

  const changed = Object.keys(values).filter((k) => values[k] !== original[k]);
  const uploadTooBig = sizeBytes(values.upload_max_filesize) > sizeBytes(values.post_max_size);
  const memTooSmall = sizeBytes(values.post_max_size) > sizeBytes(values.memory_limit) && sizeBytes(values.memory_limit) !== Infinity;

  const save = useMutation({
    mutationFn: () => api.post('/api/php/ini', {
      version: selectedVer,
      targets: alsoCLI ? ['fpm', 'cli'] : ['fpm'],
      settings: Object.fromEntries(changed.map((k) => [k, values[k]])),
    }),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ['php', 'ini', selectedVer] });
      refresh();
    },
    onError: (e) => toast.error(e.message, { duration: 12000 }),
  });

  if (installed.length === 0 && !q.isLoading) {
    return <div className="space-y-6"><PageHeader title="php.ini settings" /><NoPHPInstalled /></div>;
  }

  const groups = GROUP_ORDER.map((g) => [g, defs.filter((d) => d.group === g)]).filter(([, list]) => list.length);
  const set = (k) => (v) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="php.ini settings"
        description="Common limits and switches for websites on the selected PHP version. Values shown are what PHP-FPM actually runs with."
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to={`/php/ini-raw?v=${selectedVer}`}><FileCode2 />Raw editor</Link></Button>
            <VersionPicker />
          </>
        }
      />

      {q.isLoading ? <Skeleton className="h-[480px]" /> : q.isError ? (
        <Card className="p-6 text-sm text-destructive">{q.error.message}</Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(([group, list]) => (
            <Card key={group}>
              <CardHeader className="pb-0"><CardTitle className="text-base">{group}</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {list.map((d) => (
                  <SettingRow
                    key={d.key}
                    label={<>{d.label} <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{d.key}</span></>}
                    help={d.help}
                    htmlFor={`ini-${d.key}`}
                    warning={
                      (d.key === 'upload_max_filesize' && uploadTooBig && 'Larger than post_max_size — uploads this big will fail.')
                      || (d.key === 'post_max_size' && memTooSmall && 'Bigger than memory_limit; large posts may run out of memory.')
                      || (values[d.key] !== original[d.key] && 'Changed') || undefined
                    }
                  >
                    <Control def={d} value={values[d.key] ?? ''} onChange={set(d.key)} />
                  </SettingRow>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {changed.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <Card className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-lg">
            <div className="text-sm">
              <span className="font-medium">{changed.length} unsaved change{changed.length > 1 ? 's' : ''}</span>
              <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={alsoCLI} onCheckedChange={setAlsoCLI} className="scale-90" />
                Also apply to the CLI php.ini (cron, Composer)
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setValues(original)} disabled={save.isPending}><RotateCcw />Discard</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || uploadTooBig}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save & reload FPM
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
