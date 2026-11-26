import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Info, Library, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import TemplatePicker from './TemplatePicker';

export const useVhostLibrary = () =>
  useQuery({ queryKey: ['webservers', 'library'], queryFn: () => api.get('/api/webservers/library').then((r) => r.data || []) });

// Per-domain vhost templates: one application template plus any number of features.
export default function SiteTemplatesDialog({ site, onOpenChange }) {
  const qc = useQueryClient();
  const domain = site?.domain;
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);

  const library = useVhostLibrary();
  const state = useQuery({
    queryKey: ['websites', 'vhost-templates', domain],
    queryFn: () => api.get(`/api/websites/vhost-templates?domain=${encodeURIComponent(domain)}`).then((r) => r.data),
    enabled: !!domain,
  });

  useEffect(() => {
    if (state.data) setSelected(state.data.selected || []);
    setPreview(null);
  }, [state.data]);


  const done = (res) => {
    toast.success(res?.message || 'Vhost templates updated');
    qc.invalidateQueries({ queryKey: ['websites'] });
    qc.invalidateQueries({ queryKey: ['webservers'] });
    onOpenChange(false);
  };
  const save = useMutation({
    mutationFn: () => api.post('/api/websites/vhost-templates', { domain, templates: selected }),
    onSuccess: done,
    onError: (err) => toast.error(err.message, { duration: 12000 }),
  });
  const reset = useMutation({
    mutationFn: () => api.post('/api/websites/vhost-templates', { domain, use_default: true }),
    onSuccess: done,
    onError: (err) => toast.error(err.message, { duration: 12000 }),
  });
  const previewM = useMutation({
    mutationFn: () => api.post('/api/websites/vhost-preview', { domain, templates: selected }).then((r) => r.data),
    onSuccess: setPreview,
    onError: (err) => toast.error(err.message),
  });

  const busy = save.isPending || reset.isPending;

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vhost templates · {domain}</DialogTitle>
          <DialogDescription>
            Added to the generated nginx and Apache config. The result is tested before it goes live, and the previous config comes back if the test fails.
          </DialogDescription>
        </DialogHeader>

        {library.isLoading || state.isLoading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-48 w-full" /></div>
        ) : (
          <div className="min-w-0 space-y-5">
            <TemplatePicker library={library.data || []} value={selected} onChange={setSelected} disabled={busy} />

            {state.data?.missing?.length > 0 && (
              <p className="text-xs text-warning">Not in the library any more: {state.data.missing.join(', ')}. Apply to drop them.</p>
            )}
            {state.data?.is_default && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Following the server default from Main Conf. Applying a choice here makes it this domain's own.
              </p>
            )}

            {preview && (
              <Tabs defaultValue={preview.nginx ? 'nginx' : 'apache'} className="min-w-0">
                <TabsList>
                  <TabsTrigger value="nginx" disabled={!preview.nginx}>Nginx</TabsTrigger>
                  <TabsTrigger value="apache" disabled={!preview.apache}>Apache</TabsTrigger>
                </TabsList>
                {preview.notes?.length > 0 && <p className="mt-2 text-xs text-warning">{preview.notes.join(' · ')}</p>}
                <TabsContent value="nginx"><pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">{preview.nginx}</pre></TabsContent>
                <TabsContent value="apache"><pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">{preview.apache}</pre></TabsContent>
              </Tabs>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => reset.mutate()} disabled={busy || state.data?.is_default}>
              {reset.isPending && <Loader2 className="animate-spin" />}Use default
            </Button>
            <Button variant="outline" onClick={() => previewM.mutate()} disabled={previewM.isPending || !state.data}>
              {previewM.isPending ? <Loader2 className="animate-spin" /> : <Eye />}Preview
            </Button>
            <Button variant="ghost" asChild><Link to="/webservers/templates"><Library />Library</Link></Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={busy || !state.data}>
              {save.isPending && <Loader2 className="animate-spin" />}Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
