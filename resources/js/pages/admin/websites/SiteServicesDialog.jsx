import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

// Per-domain service subdomains (CWP-style): webmail. mail. cpanel. ftp. Each one gets its own
// vhost on the domain's certificate and is added to the certificate when it is next issued.
export default function SiteServicesDialog({ site, onOpenChange }) {
  const qc = useQueryClient();
  const domain = site?.domain;
  const [enabled, setEnabled] = useState([]);

  const state = useQuery({
    queryKey: ['websites', 'services', domain],
    queryFn: () => api.get(`/api/websites/services?domain=${encodeURIComponent(domain)}`).then((r) => r.data),
    enabled: !!domain,
  });

  useEffect(() => {
    if (state.data) setEnabled(state.data.enabled || []);
  }, [state.data]);

  const onDone = (res) => {
    toast.success(res?.message || 'Service subdomains updated');
    qc.invalidateQueries({ queryKey: ['websites'] });
    onOpenChange(false);
  };
  const save = useMutation({
    mutationFn: () => api.post('/api/websites/services', { domain, services: enabled }),
    onSuccess: onDone,
    onError: (err) => toast.error(err.message, { duration: 10000 }),
  });
  const reset = useMutation({
    mutationFn: () => api.post('/api/websites/services', { domain, use_default: true }),
    onSuccess: onDone,
    onError: (err) => toast.error(err.message, { duration: 10000 }),
  });

  const toggle = (id, on) => setEnabled((cur) => (on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));
  const d = state.data;
  const busy = save.isPending || reset.isPending;

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Service subdomains · {domain}</DialogTitle>
          <DialogDescription>
            Each one gets its own vhost on {domain}'s certificate. When the certificate is issued again, it also covers
            the ones that point at this server.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y rounded-md border">
          {state.isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-3"><Skeleton className="h-9 w-full" /></div>)}
          {d?.available?.map((svc) => {
            const skipped = d.skipped?.[svc.id];
            return (
              <div key={svc.id} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`svc-${svc.id}`} className="font-medium">{svc.title}</Label>
                  <p className="truncate font-mono text-xs text-muted-foreground">{d.hosts?.[svc.id]}</p>
                  <p className="text-xs text-muted-foreground">{skipped || svc.description.replace('<domain>', domain)}</p>
                </div>
                <Switch
                  id={`svc-${svc.id}`}
                  checked={enabled.includes(svc.id)}
                  onCheckedChange={(on) => toggle(svc.id, on)}
                  disabled={!!skipped || busy}
                />
              </div>
            );
          })}
        </div>

        {d?.is_default && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Using the default for this domain. Account domains get all four, sites owned by root get webmail and mail, and
            subdomains of another site get none.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => reset.mutate()} disabled={busy || d?.is_default}>
            {reset.isPending && <Loader2 className="animate-spin" />}Use default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={busy || !d}>
              {save.isPending && <Loader2 className="animate-spin" />}Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
