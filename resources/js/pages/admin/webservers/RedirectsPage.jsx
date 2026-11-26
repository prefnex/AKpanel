import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/app/PageHeader';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import { api } from '@/lib/api';

// System redirects: short paths every domain answers (example.com/cpanel → client panel …).
export default function RedirectsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['webservers', 'redirects'], queryFn: () => api.get('/api/webservers/redirects') });
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState([]);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!q.data?.data) return;
    setEnabled(q.data.data.enabled);
    setRules(q.data.data.rules || []);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body) => api.post('/api/webservers/redirects', body),
    onSuccess: (res) => { toast.success(res?.message || 'Saved'); qc.invalidateQueries({ queryKey: ['webservers', 'redirects'] }); },
    onError: (err) => toast.error(err.message, { duration: 12000 }),
  });

  const set = (i, k, v) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const dirty = q.data?.data && JSON.stringify({ enabled, rules }) !== JSON.stringify({ enabled: q.data.data.enabled, rules: q.data.data.rules || [] });

  return (
    <div className="space-y-6">
      <PageHeader
        title="System redirects"
        description="Short paths that work on every domain, e.g. example.com/cpanel opens the client panel. {host} is replaced by the domain the visitor used."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setResetting(true)}><RotateCcw />Reset to default</Button>
            <Button size="sm" onClick={() => save.mutate({ enabled, rules })} disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save & apply
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="space-y-4 p-4">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Redirects are {enabled ? 'on' : 'off'} for every domain
          </label>
          {q.isLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Path</TableHead>
                    <TableHead>Redirects to</TableHead>
                    <TableHead className="w-40">Type</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={r.path} onChange={(e) => set(i, 'path', e.target.value)} className="h-8 font-mono text-xs" aria-label="Path" disabled={!enabled} /></TableCell>
                      <TableCell><Input value={r.target} onChange={(e) => set(i, 'target', e.target.value)} className="h-8 min-w-64 font-mono text-xs" aria-label="Target" disabled={!enabled} /></TableCell>
                      <TableCell>
                        <Select value={String(r.code)} onValueChange={(v) => set(i, 'code', Number(v))} disabled={!enabled}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="301">301 permanent</SelectItem>
                            <SelectItem value="302">302 temporary</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.path}`} disabled={!enabled}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setRules((rs) => [...rs, { path: '/', target: 'https://{host}:2083/', code: 301 }])} disabled={!enabled}><Plus />Add redirect</Button>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset to the default redirects?"
        description="/cpanel, /controlpanel, /whm, /akpanel, /webmail, /roundcube and /phpmyadmin come back; your own rules are removed."
        actionLabel="Reset"
        onConfirm={() => { setResetting(false); save.mutate(q.data.defaults); }}
      />
    </div>
  );
}
