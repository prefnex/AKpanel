import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/app/PageHeader';
import SegmentedControl from '@/components/app/SegmentedControl';
import { api } from '@/lib/api';
import { usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled, VersionPicker } from './PHPShared';

export default function PHPIniRawPage() {
  const { installed, selectedVer, refresh } = usePHPRuntime();
  const qc = useQueryClient();
  const [sapi, setSapi] = useState('fpm');
  const [text, setText] = useState('');
  const [find, setFind] = useState('');

  const q = useQuery({
    queryKey: ['php', 'raw', selectedVer, sapi],
    queryFn: () => api.get(`/api/php/ini/raw?version=${selectedVer}&sapi=${sapi}`),
    enabled: !!selectedVer,
  });
  const original = q.data?.content ?? '';
  useEffect(() => setText(original), [original]);
  const dirty = text !== original;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => api.post('/api/php/ini/raw', { version: selectedVer, sapi, content: text }),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ['php'] });
      refresh();
    },
    onError: (e) => toast.error(e.message, { duration: 15000 }),
  });

  const jump = (e) => {
    e.preventDefault();
    const ta = document.getElementById('raw-ini');
    if (!ta || !find) return;
    const from = ta.selectionEnd || 0;
    let i = text.toLowerCase().indexOf(find.toLowerCase(), from);
    if (i < 0) i = text.toLowerCase().indexOf(find.toLowerCase());
    if (i < 0) { toast.info(`"${find}" not found`); return; }
    ta.focus();
    ta.setSelectionRange(i, i + find.length);
    const line = text.slice(0, i).split('\n').length;
    ta.scrollTop = Math.max(0, (line - 5) * 18);
  };

  if (installed.length === 0 && !q.isLoading) {
    return <div className="space-y-6"><PageHeader title="php.ini (raw)" /><NoPHPInstalled /></div>;
  }

  const lines = text ? text.split('\n').length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="php.ini (raw)"
        description="The whole file, for directives the settings page does not cover. Saving checks the syntax first and keeps the previous file as php.ini.akpanel.bak."
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to={`/php/ini?v=${selectedVer}`}><SlidersHorizontal />Settings</Link></Button>
            <VersionPicker />
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-3">
            <SegmentedControl
              value={sapi}
              onChange={(v) => {
                if (dirty && !window.confirm('Discard unsaved changes?')) return;
                setSapi(v);
              }}
              options={[{ value: 'fpm', label: 'Websites (FPM)' }, { value: 'cli', label: 'Command line (CLI)' }]}
            />
            <span className="hidden font-mono text-xs text-muted-foreground md:inline">{q.data?.path}</span>
            {dirty && <Badge variant="warning">Unsaved</Badge>}
          </div>
          <form onSubmit={jump} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find (Enter = next)" className="h-8 w-56 pl-8 text-xs" />
          </form>
        </div>
        {q.isLoading ? <Skeleton className="m-3 h-[560px]" /> : (
          <textarea
            id="raw-ini"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="block h-[60vh] min-h-[420px] w-full resize-y bg-background p-4 font-mono text-xs leading-[18px] focus:outline-none"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground tabular">{lines.toLocaleString()} lines</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setText(original)} disabled={!dirty || save.isPending}><RotateCcw />Discard</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save {sapi === 'fpm' ? '& reload FPM' : ''}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
