import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ChevronRight, FileCode2, FilePlus2, Folder, FolderUp, Link2, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/app/PageHeader';
import SegmentedControl from '@/components/app/SegmentedControl';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const q = (o) => new URLSearchParams(o).toString();

// Conf editor: the real nginx / Apache / Varnish / PHP-FPM directories. Every save is tested
// with the daemon's own checker and rolled back if it fails.
export default function ConfEditorPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const roots = useQuery({ queryKey: ['conf', 'roots'], queryFn: () => api.get('/api/webservers/conf/roots').then((r) => r.data || []) });
  const root = params.get('root') || roots.data?.[0]?.id || '';
  const dir = params.get('dir') || '';
  const file = params.get('file') || '';
  const go = (next) => setParams(Object.fromEntries(Object.entries({ root, dir, file, ...next }).filter(([, v]) => v)));

  const [text, setText] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testOut, setTestOut] = useState(null);

  const listing = useQuery({
    queryKey: ['conf', 'list', root, dir],
    queryFn: () => api.get(`/api/webservers/conf/list?${q({ root, dir })}`).then((r) => r.data),
    enabled: !!root,
  });
  const content = useQuery({
    queryKey: ['conf', 'file', root, file],
    queryFn: () => api.get(`/api/webservers/conf/file?${q({ root, path: file })}`).then((r) => r.data),
    enabled: !!root && !!file,
    retry: false,
  });
  useEffect(() => { setText(content.data?.content ?? ''); }, [content.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['conf'] });
  const save = useMutation({
    mutationFn: () => api.post('/api/webservers/conf/file', { root, path: file, content: text }),
    onSuccess: (res) => { toast.success(res?.message || 'Saved'); refresh(); },
    onError: (err) => toast.error(err.message, { duration: 15000 }),
  });
  const remove = useMutation({
    mutationFn: () => api.post('/api/webservers/conf/delete', { root, path: file }),
    onSuccess: (res) => { toast.success(res?.message || 'Deleted'); go({ file: '' }); refresh(); },
    onError: (err) => toast.error(err.message, { duration: 15000 }),
  });
  const test = useMutation({
    mutationFn: () => api.post('/api/webservers/conf/test', { root }),
    onSuccess: (res) => setTestOut({ ok: true, text: res?.output || res?.message }),
    onError: (err) => setTestOut({ ok: false, text: err.body?.output || err.message }),
  });

  const crumbs = dir ? dir.split('/') : [];
  const rootInfo = roots.data?.find((r) => r.id === root);
  const dirty = content.data && text !== content.data.content;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conf editor"
        description="The web servers' own configuration folders. Saving tests the daemon (nginx -t, apachectl configtest, varnishd -C, php-fpm -t) and reloads it; a failing test puts the previous file back."
        actions={
          <Button variant="outline" size="sm" onClick={() => test.mutate()} disabled={!root || test.isPending}>
            {test.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}Test {rootInfo?.title || ''}
          </Button>
        }
      />

      {roots.data && (
        <SegmentedControl value={root} onChange={(r) => { setTestOut(null); setParams({ root: r }); }} options={roots.data.map((r) => ({ value: r.id, label: r.title }))} className="flex-wrap" />
      )}

      {testOut && (
        <pre className={cn('max-h-48 overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-xs', testOut.ok ? 'border-success/30 bg-success/10' : 'border-destructive/30 bg-destructive/10')}>{testOut.text}</pre>
      )}

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardContent className="space-y-2 p-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1 px-1 font-mono text-xs text-muted-foreground">
              <button type="button" className="hover:text-foreground" onClick={() => go({ dir: '', file: '' })}>{rootInfo?.path || '/'}</button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button type="button" className="hover:text-foreground" onClick={() => go({ dir: crumbs.slice(0, i + 1).join('/'), file: '' })}>{c}</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              {dir && <Button variant="ghost" size="sm" onClick={() => go({ dir: crumbs.slice(0, -1).join('/'), file: '' })}><FolderUp />Up</Button>}
              <Button variant="ghost" size="sm" onClick={() => setCreating(true)}><FilePlus2 />New file</Button>
            </div>
            <div className="max-h-[34rem] space-y-0.5 overflow-y-auto">
              {listing.isLoading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
              {listing.data?.entries?.map((e) => (
                <button
                  key={e.path}
                  type="button"
                  onClick={() => (e.dir ? go({ dir: e.path, file: '' }) : go({ file: e.path }))}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', file === e.path ? 'bg-muted font-medium' : 'hover:bg-muted/50')}
                  title={e.link ? `→ ${e.link}` : e.path}
                >
                  {e.dir ? <Folder className="h-3.5 w-3.5 shrink-0 text-primary" /> : <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.link && <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Symbolic link" />}
                  {e.managed && <Badge variant="muted" className="px-1 text-[10px]">AKpanel</Badge>}
                </button>
              ))}
              {listing.data && !listing.data.entries.length && <p className="px-2 py-4 text-xs text-muted-foreground">Empty folder.</p>}
              {listing.isError && <p className="px-2 py-4 text-xs text-destructive">{listing.error.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="space-y-3 p-4">
            {!file ? (
              <p className="py-24 text-center text-sm text-muted-foreground">Pick a file on the left.</p>
            ) : content.isError ? (
              <p className="py-24 text-center text-sm text-destructive">{content.error.message}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-sm" title={content.data?.abs}>{content.data?.abs || file}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleting(true)} disabled={remove.isPending}><Trash2 />Delete</Button>
                    <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                      {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save & test
                    </Button>
                  </div>
                </div>
                {content.data?.managed && (
                  <p className="flex items-start gap-1.5 rounded-md border border-warning/25 bg-warning/10 p-2 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    AKpanel writes this file and rewrites it on the next rebuild. For lasting changes use the domain's custom directives, the vhost templates or the base templates.
                  </p>
                )}
                {content.isLoading ? <Skeleton className="h-[30rem] w-full" /> : (
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} wrap="off"
                    className="min-h-[30rem] overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed" aria-label="File content" />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <NewFileDialog open={creating} onOpenChange={setCreating} root={root} dir={dir} onCreated={(path) => { refresh(); go({ file: path }); }} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${file}?`}
        description="The daemon is tested after the delete; if it fails, the file comes back."
        actionLabel="Delete file"
        onConfirm={() => { setDeleting(false); remove.mutate(); }}
      />
    </div>
  );
}

function NewFileDialog({ open, onOpenChange, root, dir, onCreated }) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const path = [dir, name.trim()].filter(Boolean).join('/');
  const create = useMutation({
    mutationFn: () => api.post('/api/webservers/conf/file', { root, path, content: body, create: true }),
    onSuccess: (res) => { toast.success(res?.message || 'Created'); onOpenChange(false); setName(''); setBody(''); onCreated(path); },
    onError: (err) => toast.error(err.message, { duration: 15000 }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New file in /{dir}</DialogTitle>
          <DialogDescription>It is tested with the daemon's checker before it is kept.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-settings.conf" className="font-mono" aria-label="File name" autoFocus />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} wrap="off" placeholder="# directives…"
            className="min-h-48 overflow-x-auto whitespace-pre font-mono text-xs" aria-label="File content" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}Create & test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
