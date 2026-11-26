import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Loader2, Lock, Pencil, Plus, Save, Search, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SegmentedControl from '@/components/app/SegmentedControl';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import { useVhostLibrary } from '@/pages/admin/websites/SiteTemplatesDialog';
import { api } from '@/lib/api';

const EMPTY = {
  name: '', title: '', description: '', kind: 'feature', nginx: '', nginx_location: '', apache: '',
  root_suffix: '', http2: false, wildcard: false, timeout: 0, max_body_mb: 0,
};

const FIELDS = ['name', 'title', 'description', 'kind', 'nginx', 'nginx_location', 'apache', 'root_suffix', 'http2', 'wildcard', 'timeout', 'max_body_mb'];
const pick = (t) => Object.fromEntries(FIELDS.map((k) => [k, t?.[k] ?? EMPTY[k]]));

// The named vhost template library (CWP-style): built-ins are locked, custom ones editable.
export default function VhostLibraryPanel() {
  const qc = useQueryClient();
  const library = useVhostLibrary();
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // { tpl, readOnly, isNew }
  const [deleting, setDeleting] = useState(null);

  const remove = useMutation({
    mutationFn: (name) => api.post('/api/webservers/library/delete', { name }),
    onSuccess: (res) => { toast.success(res?.message || 'Deleted'); qc.invalidateQueries({ queryKey: ['webservers', 'library'] }); },
    onError: (err) => toast.error(err.message, { duration: 10000 }),
  });

  const list = useMemo(() => (library.data || []).filter((t) =>
    (kind === 'all' || (kind === 'custom' ? !t.builtin : t.kind === kind)) &&
    (!q || `${t.name} ${t.title} ${t.description}`.toLowerCase().includes(q.toLowerCase()))), [library.data, kind, q]);

  const clone = (t) => setEditing({ tpl: { ...pick(t), name: `${t.name}-custom`, title: `${t.title} (custom)` }, isNew: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={kind}
            onChange={setKind}
            options={[{ value: 'all', label: 'All' }, { value: 'feature', label: 'Features' }, { value: 'app', label: 'Applications' }, { value: 'custom', label: 'Custom' }]}
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="h-9 w-56 pl-8" aria-label="Search templates" />
          </div>
        </div>
        <Button size="sm" onClick={() => setEditing({ tpl: { ...EMPTY }, isNew: true })}><Plus />New template</Button>
      </div>

      {library.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Card key={t.name} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {t.builtin && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Built-in" />}
                      <span className="truncate">{t.title}</span>
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{t.name}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {t.is_default && <Badge variant="success" className="gap-1 font-normal"><Star className="h-3 w-3" />default</Badge>}
                    <Badge variant={t.kind === 'app' ? 'info' : 'muted'} className="font-normal">{t.kind === 'app' ? 'application' : 'feature'}</Badge>
                  </div>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="truncate text-xs text-muted-foreground" title={t.used_by?.join(', ')}>
                    {t.used_by?.length ? `Used by ${t.used_by.length} domain${t.used_by.length > 1 ? 's' : ''}` : 'Not used'}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {t.builtin ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ tpl: pick(t), readOnly: true })}>View</Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ tpl: pick(t) })} aria-label={`Edit ${t.name}`}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`} className="text-destructive"><Trash2 /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => clone(t)} aria-label={`Clone ${t.name}`}><Copy /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!list.length && <p className="text-sm text-muted-foreground">No templates match.</p>}
        </div>
      )}

      <LibraryTemplateDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onClone={(t) => clone(t)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={deleting?.used_by?.length ? `Still used by ${deleting.used_by.join(', ')}: remove it from those domains first.` : 'The template is removed from the library.'}
        actionLabel="Delete template"
        onConfirm={() => { remove.mutate(deleting.name); setDeleting(null); }}
      />
    </div>
  );
}

function LibraryTemplateDialog({ editing, onClose, onClone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const readOnly = !!editing?.readOnly;

  useEffect(() => { if (editing) setForm({ ...EMPTY, ...editing.tpl }); }, [editing]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.post('/api/webservers/library', {
      ...form,
      timeout: Number(form.timeout) || 0,
      max_body_mb: Number(form.max_body_mb) || 0,
      nginx_location: form.kind === 'app' ? form.nginx_location : '',
      root_suffix: form.kind === 'app' ? form.root_suffix : '',
    }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Template saved');
      qc.invalidateQueries({ queryKey: ['webservers', 'library'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
      onClose();
    },
    onError: (err) => toast.error(err.message, { duration: 15000 }),
  });

  const code = (id, label, hint, value, key, rows = 'min-h-28') => (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="flex flex-col gap-0.5">{label}<span className="text-xs font-normal text-muted-foreground">{hint}</span></Label>
      <Textarea id={id} value={value} onChange={(e) => set(key)(e.target.value)} readOnly={readOnly} spellCheck={false} wrap="off"
        className={`${rows} overflow-x-auto whitespace-pre font-mono text-xs`} />
    </div>
  );

  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? form.title : editing?.isNew ? 'New vhost template' : `Edit ${form.name}`}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? 'Built-in templates are locked. Clone one to make your own version.'
              : 'Snippets are Go templates: {{.Domain}}, {{.Root}}, {{.PHPSocket}}, {{.ProxyPort}}, {{.ApachePublic}} … Saving rebuilds every domain that uses it; if one fails the tests, nothing changes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="lib-name">Name</Label>
              <Input id="lib-name" value={form.name} onChange={(e) => set('name')(e.target.value.toLowerCase())} readOnly={readOnly || (!editing?.isNew)} className="font-mono" placeholder="my-template" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-title">Title</Label>
              <Input id="lib-title" value={form.title} onChange={(e) => set('title')(e.target.value)} readOnly={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={form.kind} onValueChange={set('kind')} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature (combine freely)</SelectItem>
                  <SelectItem value="app">Application (one per domain)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lib-desc">Description</Label>
            <Input id="lib-desc" value={form.description} onChange={(e) => set('description')(e.target.value)} readOnly={readOnly} />
          </div>

          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
            <label className="flex items-center justify-between gap-2 text-sm">HTTP/2<Switch checked={!!form.http2} onCheckedChange={set('http2')} disabled={readOnly} /></label>
            <label className="flex items-center justify-between gap-2 text-sm">Wildcard *.domain<Switch checked={!!form.wildcard} onCheckedChange={set('wildcard')} disabled={readOnly} /></label>
            <div className="flex items-center gap-2">
              <Label htmlFor="lib-timeout" className="shrink-0 text-sm font-normal">Timeout (s)</Label>
              <Input id="lib-timeout" type="number" min={0} value={form.timeout || ''} placeholder="300" onChange={(e) => set('timeout')(e.target.value)} readOnly={readOnly} className="h-8" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="lib-body" className="shrink-0 text-sm font-normal">Max body (MB)</Label>
              <Input id="lib-body" type="number" min={0} value={form.max_body_mb || ''} placeholder="128" onChange={(e) => set('max_body_mb')(e.target.value)} readOnly={readOnly} className="h-8" />
            </div>
          </div>

          {code('lib-nginx', 'Nginx', 'Inside the public server block (:80/:443).', form.nginx, 'nginx')}
          {form.kind === 'app' && (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
              {code('lib-loc', 'Nginx location /', 'Replaces the default location / when nginx serves the site itself.', form.nginx_location, 'nginx_location', 'min-h-20')}
              <div className="space-y-1.5">
                <Label htmlFor="lib-root" className="flex flex-col gap-0.5">Root suffix<span className="text-xs font-normal text-muted-foreground">e.g. /public</span></Label>
                <Input id="lib-root" value={form.root_suffix} onChange={(e) => set('root_suffix')(e.target.value)} readOnly={readOnly} className="font-mono" />
              </div>
            </div>
          )}
          {code('lib-apache', 'Apache', 'Inside every VirtualHost of the domain. Wrap client-facing rules in {{if .ApachePublic}} … {{end}}.', form.apache, 'apache')}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {readOnly ? (
            <Button onClick={() => onClone(form)}><Copy />Clone</Button>
          ) : (
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.title}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
