import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import PageHeader from '@/components/app/PageHeader';
import EmptyState from '@/components/app/EmptyState';
import { api } from '@/lib/api';
import { usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled, VersionPicker } from './PHPShared';

// phpinfo() of the selected version (CLI build), searchable and grouped by module.
export default function PHPInfoPage() {
  const { installed, versionsQuery, selectedVer } = usePHPRuntime();
  const [filter, setFilter] = useState('');
  const q = useQuery({
    queryKey: ['php', 'info', selectedVer],
    queryFn: () => api.get(`/api/php/info?version=${selectedVer}`).then((r) => r.data || []),
    enabled: !!selectedVer,
    staleTime: 60_000,
  });

  const sections = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (q.data || []).map((s) => {
      const rows = Object.entries(s.directives || {}).sort(([a], [b]) => a.localeCompare(b));
      const match = !f || s.title.toLowerCase().includes(f);
      return { title: s.title, rows: match ? rows : rows.filter(([k, v]) => k.toLowerCase().includes(f) || String(v).toLowerCase().includes(f)) };
    }).filter((s) => s.rows.length > 0);
  }, [q.data, filter]);

  if (installed.length === 0 && !versionsQuery.isLoading) {
    return <div className="space-y-6"><PageHeader title="phpinfo()" /><NoPHPInstalled /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="phpinfo()"
        description="Build options, loaded modules and their settings for the selected version. Read from the CLI build; FPM-only values can differ (see php.ini settings)."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={q.isFetching ? 'animate-spin' : ''} />Refresh
            </Button>
            <VersionPicker />
          </>
        }
      />
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter modules and directives…" className="pl-8" />
      </div>

      {q.isLoading ? <Skeleton className="h-96" /> : q.isError ? (
        <Card className="p-6 text-sm text-destructive">{q.error.message}</Card>
      ) : sections.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" description={`No module or directive contains "${filter}".`} />
      ) : (
        <Card className="px-4">
          <Accordion type="multiple" defaultValue={filter ? sections.map((s) => s.title) : [sections[0]?.title]} key={filter ? 'f' : 'n'}>
            {sections.map((s) => (
              <AccordionItem key={s.title} value={s.title}>
                <AccordionTrigger className="py-3 hover:no-underline">
                  <span className="flex items-center gap-2 font-mono text-sm">{s.title}<Badge variant="muted" className="tabular">{s.rows.length}</Badge></span>
                </AccordionTrigger>
                <AccordionContent>
                  <dl className="divide-y rounded-md border">
                    {s.rows.map(([k, v]) => (
                      <div key={k} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
                        <dt className="break-all font-mono text-muted-foreground">{k}</dt>
                        <dd className="break-all font-mono">{v === '' ? <span className="text-muted-foreground">no value</span> : v}</dd>
                      </div>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      )}
    </div>
  );
}
