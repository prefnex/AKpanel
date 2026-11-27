import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/app/PageHeader';
import { api } from '@/lib/api';
import { usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled } from './PHPShared';

// Which binary `php` runs for SSH, cron and Composer. Websites are not affected.
export default function PHPCLIPage() {
  const { versionsQuery, installed, cli, refresh } = usePHPRuntime();
  const setCLI = useMutation({
    mutationFn: (version) => api.post('/api/php/cli/default', { version }),
    onSuccess: (r) => { toast.success(r.message); refresh(); },
    onError: (e) => toast.error(e.message, { duration: 10000 }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="CLI version"
        description="Pick which PHP the php command runs — for SSH sessions, cron jobs and Composer. Websites keep their own FPM version."
      />

      <Card>
        <CardContent className="flex items-start gap-3 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted"><Terminal className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm">{cli.version_line || (versionsQuery.isLoading ? 'Loading…' : 'php not found')}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{cli.binary_path || '/usr/bin/php'}</p>
          </div>
        </CardContent>
      </Card>

      {versionsQuery.isLoading ? <Skeleton className="h-40" /> : installed.length === 0 ? <NoPHPInstalled /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {installed.map((v) => {
            const active = v.version === cli.default_version;
            const busy = setCLI.isPending && setCLI.variables === v.version;
            return (
              <Card key={v.version} className={`flex items-center justify-between gap-3 p-4 ${active ? 'border-primary/50' : ''}`}>
                <div className="min-w-0">
                  <p className="font-mono text-lg font-semibold">PHP {v.version}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">/usr/bin/php{v.version}</p>
                </div>
                {active ? (
                  <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Active</Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={setCLI.isPending} onClick={() => setCLI.mutate(v.version)}>
                    {busy && <Loader2 className="animate-spin" />}Use for CLI
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Hosting accounts get their own version in their SSH shell, following their account PHP version. Need another branch? <Link to="/php" className="underline underline-offset-2">Install it</Link>.
      </p>
    </div>
  );
}
