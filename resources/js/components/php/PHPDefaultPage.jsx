import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/app/PageHeader';
import { useWebServerModes } from '@/hooks/useWebServerModes';
import { api } from '@/lib/api';
import { usePHPRuntime } from './PHPRuntimeContext';
import { NoPHPInstalled } from './PHPShared';

// Server defaults: the PHP version new websites and accounts get when they do not choose.
export default function PHPDefaultPage() {
  const qc = useQueryClient();
  const { versionsQuery, installed, serverDefault, refresh } = usePHPRuntime();
  const modes = useWebServerModes();
  const d = modes.data;

  const done = (r) => {
    toast.success(r?.message || 'Saved');
    refresh();
    qc.invalidateQueries({ queryKey: ['webservers'] });
  };
  const fail = (e) => toast.error(e.message, { duration: 10000 });

  const setNginx = useMutation({ mutationFn: (v) => api.post('/api/php/fpm/default', { version: v }), onSuccess: done, onError: fail });
  const setApache = useMutation({ mutationFn: (v) => api.post('/api/webservers/php-defaults', { default_apache_php: v }), onSuccess: done, onError: fail });

  if (versionsQuery.isLoading) return <div className="space-y-6"><PageHeader title="Default version" /><Skeleton className="h-64" /></div>;
  if (installed.length === 0) return <div className="space-y-6"><PageHeader title="Default version" /><NoPHPInstalled /></div>;

  const options = installed.map((v) => (
    <SelectItem key={v.version} value={v.version}>PHP {v.version}{v.is_fpm_running ? '' : ' (FPM stopped)'}</SelectItem>
  ));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Default version"
        description="The PHP version new websites and hosting accounts get when they do not choose one. A site's or account's own choice always wins; existing sites are not changed."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sites run by Nginx</CardTitle>
            <CardDescription>Also the version for webmail, phpMyAdmin and the system CLI unless you pinned another one.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Select value={serverDefault} onValueChange={(v) => setNginx.mutate(v)} disabled={setNginx.isPending}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{options}</SelectContent>
            </Select>
            {setNginx.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sites run by Apache</CardTitle>
            <CardDescription>
              Used in the Apache and Nginx+Apache <Link to="/webservers/select" className="underline underline-offset-2">web server modes</Link>. Falls back to the Nginx default.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {modes.isLoading || !d ? <Skeleton className="h-9 w-56" /> : (
              <Select value={d.default_apache_php || serverDefault} onValueChange={(v) => setApache.mutate(v)} disabled={setApache.isPending}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{options}</SelectContent>
              </Select>
            )}
            {setApache.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        To move existing sites, change their PHP version on the <Link to="/websites" className="underline underline-offset-2">Websites</Link> page; for accounts, edit the account or its package.
      </p>
    </div>
  );
}
