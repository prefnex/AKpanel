import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileCode2, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/app/PageHeader';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VhostLibraryPanel from './VhostLibraryPanel';

// Vhost templates: the named library chosen per domain, and the base files every config is
// rendered from.
export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vhost templates"
        description="Pick library templates per domain (Websites → Vhost templates, or the Main Conf defaults). The base templates are the files every vhost is rendered from."
      />
      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="base">Base templates</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-4"><VhostLibraryPanel /></TabsContent>
        <TabsContent value="base" className="mt-4"><BaseTemplates /></TabsContent>
      </Tabs>
    </div>
  );
}

// Every web server config AKpanel writes comes from these Go text/template files. Saving an
// edit stores an override in /etc/akpanel/templates and rebuilds every vhost; if the result
// fails nginx -t / apache configtest / varnishd -C the previous version is kept.
function BaseTemplates() {
  const qc = useQueryClient();
  const [sel, setSel] = useState(null);
  const [text, setText] = useState('');
  const [resetting, setResetting] = useState(false);

  const list = useQuery({ queryKey: ['webservers', 'templates'], queryFn: () => api.get('/api/webservers/templates').then((r) => r.data || []) });
  const tpl = useQuery({
    queryKey: ['webservers', 'template', sel?.engine, sel?.name],
    queryFn: () => api.get(`/api/webservers/template?engine=${sel.engine}&filename=${encodeURIComponent(sel.name)}`),
    enabled: !!sel,
  });

  useEffect(() => {
    if (!sel && list.data?.length) setSel(list.data.find((f) => f.name === 'site.conf.tmpl') || list.data[0]);
  }, [list.data, sel]);
  useEffect(() => {
    if (tpl.data) setText(tpl.data.content || '');
  }, [tpl.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['webservers', 'templates'] });
    qc.invalidateQueries({ queryKey: ['webservers', 'template'] });
  };
  const save = useMutation({
    mutationFn: () => api.post('/api/webservers/template', { engine: sel.engine, filename: sel.name, content: text }),
    onSuccess: (res) => { toast.success(res?.message || 'Template saved'); refresh(); },
    onError: (err) => toast.error(err.message, { duration: 12000 }),
  });
  const reset = useMutation({
    mutationFn: () => api.post('/api/webservers/template/reset', { engine: sel.engine, filename: sel.name }),
    onSuccess: (res) => { toast.success(res?.message || 'Template reset'); refresh(); },
    onError: (err) => toast.error(err.message),
  });

  const dirty = tpl.data && text !== tpl.data.content;
  const groups = (list.data || []).reduce((acc, f) => ({ ...acc, [f.engine]: [...(acc[f.engine] || []), f] }), {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Every nginx, Apache and Varnish file AKpanel writes is rendered from these templates. Saving rebuilds all vhosts; if the result fails the syntax tests, the previous version stays.</p>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-4 p-3">
            {Object.entries(groups).map(([engine, files]) => (
              <div key={engine} className="space-y-1">
                <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{engine}</p>
                {files.map((f) => {
                  const active = sel?.engine === f.engine && sel?.name === f.name;
                  return (
                    <button
                      key={f.engine + f.name}
                      type="button"
                      onClick={() => setSel(f)}
                      className={cn('flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm', active ? 'bg-muted font-medium' : 'hover:bg-muted/50')}
                    >
                      <span className="flex min-w-0 items-center gap-2"><FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{f.name}</span></span>
                      {f.overridden && <Badge variant="warning" className="px-1.5 text-[10px]">edited</Badge>}
                    </button>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm">{sel ? `${sel.engine}/${sel.name}` : '…'}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setResetting(true)} disabled={!tpl.data?.overridden || reset.isPending}>
                  <RotateCcw />Reset to default
                </Button>
                <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                  {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save & rebuild
                </Button>
              </div>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              wrap="off"
              className="min-h-[36rem] overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed"
              aria-label="Template source"
            />
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title={`Reset ${sel?.name}?`}
        description="Your edits are removed and every vhost is rebuilt from the shipped template."
        actionLabel="Reset"
        onConfirm={() => { setResetting(false); reset.mutate(); }}
      />
    </div>
  );
}
