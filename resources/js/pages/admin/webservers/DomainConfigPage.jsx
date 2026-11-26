import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileCode2, Layers, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/app/PageHeader';
import EmptyState from '@/components/app/EmptyState';
import { describeStack } from '@/hooks/useWebServerModes';
import SiteStackDialog from '@/pages/admin/websites/SiteStackDialog';
import SiteTemplatesDialog from '@/pages/admin/websites/SiteTemplatesDialog';
import { api } from '@/lib/api';

// Per-domain vhost view: generated files (read-only, rebuilt from templates) and the custom
// include files AKpanel keeps across rebuilds.
export default function DomainConfigPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const domain = params.get('domain') || '';
  const [nginxCustom, setNginxCustom] = useState('');
  const [apacheCustom, setApacheCustom] = useState('');
  const [stackOpen, setStackOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const sites = useQuery({ queryKey: ['websites'], queryFn: () => api.get('/api/websites').then((r) => r.data || []) });
  const vhost = useQuery({
    queryKey: ['webservers', 'domain-vhost', domain],
    queryFn: () => api.get(`/api/webservers/domain-vhost?domain=${encodeURIComponent(domain)}`).then((r) => r.data),
    enabled: !!domain,
  });

  useEffect(() => {
    if (!vhost.data) return;
    setNginxCustom(vhost.data.nginx_custom || '');
    setApacheCustom(vhost.data.apache_custom || '');
  }, [vhost.data]);

  const save = useMutation({
    mutationFn: () => api.post('/api/webservers/domain-vhost', { domain, nginx_custom: nginxCustom, apache_custom: apacheCustom }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Saved');
      qc.invalidateQueries({ queryKey: ['webservers', 'domain-vhost', domain] });
    },
    onError: (err) => toast.error(err.message),
  });

  const site = (sites.data || []).find((s) => s.domain === domain);
  const v = vhost.data;
  const dirty = v && (nginxCustom !== (v.nginx_custom || '') || apacheCustom !== (v.apache_custom || ''));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domain config"
        description="Generated vhosts are rebuilt from templates on every change. Put your own directives in the custom include files: they are tested before they go live and kept across rebuilds."
        actions={
          <Select value={domain} onValueChange={(d) => setParams({ domain: d })}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Choose a domain" /></SelectTrigger>
            <SelectContent>
              {(sites.data || []).map((s) => <SelectItem key={s.domain} value={s.domain}>{s.domain}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {!domain ? (
        <EmptyState icon={Layers} title="Pick a domain" description="Choose a domain to see its generated vhosts and custom directives." />
      ) : (
        <>
          {site && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Running now:</span>
                  <Badge variant="info">{describeStack(site.stack?.effective)}</Badge>
                  <span className="text-muted-foreground">Owner:</span>
                  <span>{v?.user || site.owner_username}</span>
                  {v?.has_ssl ? <Badge variant="success">SSL</Badge> : <Badge variant="muted">Self-signed</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}><FileCode2 />Vhost templates{site.vhost_templates?.length ? ` (${site.vhost_templates.length})` : ''}…</Button>
                  <Button variant="outline" size="sm" onClick={() => setStackOpen(true)}><Layers />Web stack…</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom directives</CardTitle>
              <CardDescription>Included inside the domain's server block / VirtualHost.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="nginx-custom" className="flex flex-col gap-1">Nginx<span className="truncate font-mono text-xs font-normal text-muted-foreground" title={v?.nginx_custom_path}>{v?.nginx_custom_path}</span></Label>
                <Textarea id="nginx-custom" value={nginxCustom} onChange={(e) => setNginxCustom(e.target.value)} className="min-h-40 font-mono text-xs" spellCheck={false} />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="apache-custom" className="flex flex-col gap-1">Apache<span className="truncate font-mono text-xs font-normal text-muted-foreground" title={v?.apache_custom_path}>{v?.apache_custom_path}</span></Label>
                <Textarea id="apache-custom" value={apacheCustom} onChange={(e) => setApacheCustom(e.target.value)} className="min-h-40 font-mono text-xs" spellCheck={false} />
              </div>
              <div className="flex justify-end lg:col-span-2">
                <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                  {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Test & apply
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated vhosts</CardTitle>
              <CardDescription>Read-only. Change them through the web stack, the templates, or the custom directives above.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="nginx">
                <TabsList>
                  <TabsTrigger value="nginx" disabled={!v?.nginx_conf}>Nginx</TabsTrigger>
                  <TabsTrigger value="apache" disabled={!v?.apache_conf}>Apache</TabsTrigger>
                </TabsList>
                <TabsContent value="nginx">
                  <pre className="max-h-[32rem] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">{v?.nginx_conf || 'Not used in this mode.'}</pre>
                </TabsContent>
                <TabsContent value="apache">
                  <pre className="max-h-[32rem] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">{v?.apache_conf || 'Not used for this domain.'}</pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      <SiteTemplatesDialog
        site={templatesOpen ? site : null}
        onOpenChange={(open) => {
          setTemplatesOpen(open);
          if (!open) qc.invalidateQueries({ queryKey: ['webservers', 'domain-vhost', domain] });
        }}
      />
      <SiteStackDialog
        site={stackOpen ? site : null}
        onOpenChange={(open) => {
          setStackOpen(open);
          if (!open) qc.invalidateQueries({ queryKey: ['webservers', 'domain-vhost', domain] });
        }}
      />
    </div>
  );
}
