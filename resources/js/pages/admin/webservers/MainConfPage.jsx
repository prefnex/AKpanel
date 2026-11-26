import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Cpu, FileCode2, Hammer, Layers, Loader2, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/app/PageHeader';
import SegmentedControl from '@/components/app/SegmentedControl';
import TemplatePicker from '@/pages/admin/websites/TemplatePicker';
import { useVhostLibrary } from '@/pages/admin/websites/SiteTemplatesDialog';
import { api } from '@/lib/api';

const PM_HELP = {
  ondemand: 'Workers start on the first request and stop after the idle timeout. Lowest memory use; best for many small sites.',
  dynamic: 'Keeps a quarter of the package limit warm and grows up to the limit. Faster first response, more memory.',
  static: 'Always runs the package limit of workers. Most predictable, most memory.',
};

// Main Conf: what domains and accounts get when they have no choice of their own.
export default function MainConfPage() {
  const qc = useQueryClient();
  const library = useVhostLibrary();
  const defaults = useQuery({ queryKey: ['webservers', 'defaults'], queryFn: () => api.get('/api/webservers/defaults').then((r) => r.data) });

  const [all, setAll] = useState([]);
  const [accountOwn, setAccountOwn] = useState(false);
  const [account, setAccount] = useState([]);
  const [fpm, setFpm] = useState({ pm: 'ondemand', idle_timeout: 10, max_requests: 0, request_timeout: 0 });
  const [rebuild, setRebuild] = useState(true);

  useEffect(() => {
    const d = defaults.data;
    if (!d) return;
    setAll(d.vhost_templates || []);
    setAccount(d.account_vhost_templates || []);
    setAccountOwn((d.account_vhost_templates || []).length > 0);
    setFpm({ ...d.fpm });
  }, [defaults.data]);

  const done = (res) => {
    toast.success(res?.message || 'Saved');
    qc.invalidateQueries({ queryKey: ['webservers'] });
    qc.invalidateQueries({ queryKey: ['websites'] });
  };
  const fail = (err) => toast.error(err.message, { duration: 15000 });

  const save = useMutation({
    mutationFn: () => api.post('/api/webservers/defaults', {
      vhost_templates: all,
      account_vhost_templates: accountOwn ? account : [],
      fpm: { ...fpm, idle_timeout: Number(fpm.idle_timeout) || 0, max_requests: Number(fpm.max_requests) || 0, request_timeout: Number(fpm.request_timeout) || 0 },
      rebuild,
    }),
    onSuccess: done,
    onError: fail,
  });
  const rebuildAll = useMutation({ mutationFn: () => api.post('/api/webservers/rebuild', {}), onSuccess: done, onError: fail });
  const rewritePools = useMutation({ mutationFn: () => api.post('/api/webservers/pools/rewrite', {}), onSuccess: done, onError: fail });

  const loading = defaults.isLoading || library.isLoading;
  const setF = (k) => (e) => setFpm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Main config"
        description="Server-wide defaults. Domains and accounts without a choice of their own follow them; a domain's own choice (Websites → Vhost templates) always wins."
        actions={
          <Button variant="outline" size="sm" asChild><Link to="/webservers/select"><Layers />Mode & PHP versions</Link></Button>
        }
      />

      {loading ? <Skeleton className="h-96 w-full" /> : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default vhost templates</CardTitle>
              <CardDescription>Applied to every domain that follows the default.</CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePicker library={library.data || []} value={all} onChange={setAll} idPrefix="def-all" columns="sm:grid-cols-2 xl:grid-cols-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Hosting account domains</CardTitle>
                <CardDescription>Give domains owned by hosting accounts a different default from the server's own sites.</CardDescription>
              </div>
              <Switch checked={accountOwn} onCheckedChange={setAccountOwn} aria-label="Separate default for account domains" />
            </CardHeader>
            {accountOwn && (
              <CardContent>
                <TemplatePicker library={library.data || []} value={account} onChange={setAccount} idPrefix="def-acc" columns="sm:grid-cols-2 xl:grid-cols-3" />
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4" />PHP-FPM pools</CardTitle>
              <CardDescription>
                How each account's pool runs its workers. The number of workers and the memory limit come from the account's package.
                The pool file itself is the <Link to="/webservers/templates" className="underline underline-offset-2">php-fpm/pool.conf.tmpl</Link> base template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <SegmentedControl
                  value={fpm.pm}
                  onChange={(pm) => setFpm((f) => ({ ...f, pm }))}
                  size="md"
                  options={[{ value: 'ondemand', label: 'On demand' }, { value: 'dynamic', label: 'Dynamic' }, { value: 'static', label: 'Static' }]}
                />
                <p className="text-xs text-muted-foreground">{PM_HELP[fpm.pm]}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fpm-idle">Idle timeout (s)</Label>
                  <Input id="fpm-idle" type="number" min={1} value={fpm.idle_timeout} onChange={setF('idle_timeout')} disabled={fpm.pm !== 'ondemand'} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fpm-maxreq">Recycle worker after (requests)</Label>
                  <Input id="fpm-maxreq" type="number" min={0} value={fpm.max_requests} onChange={setF('max_requests')} placeholder="0 = never" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fpm-timeout">Request timeout (s)</Label>
                  <Input id="fpm-timeout" type="number" min={0} value={fpm.request_timeout} onChange={setF('request_timeout')} placeholder="0 = off" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={rebuild} onCheckedChange={setRebuild} />
                <span>
                  Apply to existing domains and pools now
                  <span className="block text-xs text-muted-foreground">Off: only new domains and accounts get the new defaults.</span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => rewritePools.mutate()} disabled={rewritePools.isPending}>
                  {rewritePools.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}Rewrite pools
                </Button>
                <Button variant="outline" onClick={() => rebuildAll.mutate()} disabled={rebuildAll.isPending}>
                  {rebuildAll.isPending ? <Loader2 className="animate-spin" /> : <Hammer />}Rebuild all vhosts
                </Button>
                <Button variant="outline" asChild><Link to="/webservers/templates"><FileCode2 />Templates</Link></Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
