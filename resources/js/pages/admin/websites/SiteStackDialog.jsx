import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SegmentedControl from '@/components/app/SegmentedControl';
import { BACKEND_LABEL, HANDLER_LABEL, describeStack, useWebServerModes } from '@/hooks/useWebServerModes';
import { api } from '@/lib/api';

// Per-domain web stack: backend (within the mode), Apache PHP handler and Varnish.
export default function SiteStackDialog({ site, onOpenChange }) {
  const qc = useQueryClient();
  const modes = useWebServerModes();
  const mode = modes.data?.modes?.find((m) => m.id === modes.data?.active);
  const req = site?.stack?.requested || {};

  const [backend, setBackend] = useState('default');
  const [handler, setHandler] = useState('fpm');
  const [varnish, setVarnish] = useState('');
  const [siteType, setSiteType] = useState('php');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState(3000);

  useEffect(() => {
    if (!site) return;
    setBackend(req.backend || 'default');
    setHandler(req.php_handler || 'fpm');
    setVarnish(req.varnish || '');
    setSiteType(site.site_type || 'php');
    setProxyHost(site.proxy_host || '');
    setProxyPort(site.proxy_port || 3000);
  }, [site]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => api.post('/api/websites/stack', {
      domain: site.domain,
      backend: backend === 'default' ? '' : backend,
      php_handler: handler,
      varnish,
      site_type: siteType,
      proxy_host: siteType === 'proxy' ? proxyHost.trim() : '',
      proxy_port: siteType === 'proxy' ? Number(proxyPort) || 0 : 0,
    }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Web stack updated');
      qc.invalidateQueries({ queryKey: ['websites'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const isPHP = siteType === 'php';
  const allowed = mode?.backends || [];
  const effectiveBackend = backend === 'default' ? mode && (allowed.includes('apache') ? 'apache' : 'nginx') : backend;
  const showHandler = isPHP && effectiveBackend === 'apache';
  const varnishDefault = mode?.varnish_default ? 'on' : 'off';

  return (
    <Dialog open={!!site} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Web stack · {site?.domain}</DialogTitle>
          <DialogDescription>
            Server mode: <span className="font-medium text-foreground">{mode?.title || '…'}</span>. Running now: {describeStack(site?.stack?.effective)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="flex flex-col items-start gap-2">
            <Label>Site type</Label>
            <SegmentedControl
              value={siteType}
              onChange={setSiteType}
              options={[{ value: 'php', label: 'PHP' }, { value: 'static', label: 'Static' }, { value: 'proxy', label: 'Reverse proxy' }]}
            />
          </div>

          {siteType === 'proxy' && (
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stack-proxy-host">Upstream host</Label>
                <Input id="stack-proxy-host" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} placeholder="127.0.0.1" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stack-proxy-port">Port</Label>
                <Input id="stack-proxy-port" type="number" min={1} max={65535} value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} className="font-mono" />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">Node.js, Python, Go or any HTTP app, local or on another server (IP address or host name). WebSockets are passed through.</p>
            </div>
          )}

          {isPHP ? (
            <div className="space-y-2">
              <Label htmlFor="stack-backend">Runs PHP</Label>
              <Select value={backend} onValueChange={setBackend}>
                <SelectTrigger id="stack-backend"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Mode default ({BACKEND_LABEL[allowed.includes('apache') ? 'apache' : 'nginx']})</SelectItem>
                  {['apache', 'nginx'].map((b) => (
                    <SelectItem key={b} value={b} disabled={!allowed.includes(b)}>
                      {BACKEND_LABEL[b]}{b === 'apache' ? ' (.htaccess)' : ' + PHP-FPM'}{!allowed.includes(b) ? ' — not in this mode' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {siteType === 'proxy' ? 'Proxy' : 'Static'} sites are served by the front web server directly.
            </p>
          )}

          {showHandler && (
            <div className="flex flex-col items-start gap-2">
              <Label>Apache PHP handler</Label>
              <SegmentedControl
                value={handler}
                onChange={setHandler}
                options={[
                  { value: 'fpm', label: HANDLER_LABEL.fpm },
                  { value: 'cgi', label: HANDLER_LABEL.cgi },
                ]}
              />
              {handler === 'cgi' && !modes.data?.cgi_available && (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />php-cgi / mod_fcgid / suexec are not installed; the site keeps PHP-FPM until they are.
                </p>
              )}
            </div>
          )}

          {mode?.has_varnish && siteType !== 'proxy' && (
            <div className="flex flex-col items-start gap-2">
              <Label>Varnish cache</Label>
              <SegmentedControl
                value={varnish}
                onChange={setVarnish}
                options={[
                  { value: '', label: `Mode default (${varnishDefault})` },
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                ]}
              />
            </div>
          )}

          {site?.stack?.effective?.notes?.length > 0 && (
            <div className="rounded-md border border-warning/25 bg-warning/10 p-3 text-xs text-warning">
              {site.stack.effective.notes.map((n) => <p key={n}>{n}</p>)}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            The choice is stored even when a mode does not allow it, and comes back when you switch to a mode that does.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
