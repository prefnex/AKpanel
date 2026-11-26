import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, FolderOpen, GitBranch, Loader2, Lock, LockOpen, MoreHorizontal, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/app/PageHeader';
import DataTable from '@/components/app/DataTable';
import StatusBadge from '@/components/app/StatusBadge';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import EmptyState from '@/components/app/EmptyState';
import { api } from '@/lib/api';

// Subdomains: sites under another site, owned by the same account and on the same stack.
export default function SubdomainsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const subs = useQuery({ queryKey: ['subdomains'], queryFn: () => api.get('/api/subdomains').then((r) => r.data || []) });
  const remove = useMutation({
    mutationFn: (domain) => api.post('/api/subdomains/delete', { domain }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Deleted');
      qc.invalidateQueries({ queryKey: ['subdomains'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const columns = useMemo(() => [
    {
      accessorKey: 'domain',
      header: 'Subdomain',
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium">{s.domain}</span>
              {s.ssl_active ? <Lock className="h-3 w-3 text-success" aria-label="SSL active" /> : <LockOpen className="h-3 w-3 text-muted-foreground" aria-label="No SSL" />}
            </div>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{s.root_path}</p>
          </div>
        );
      },
    },
    { accessorKey: 'parent', header: 'Domain', cell: ({ getValue }) => <span className="text-sm">{getValue()}</span> },
    { accessorKey: 'owner', header: 'Owner', cell: ({ getValue }) => <span className="text-sm">{getValue()}</span> },
    { accessorKey: 'created_at', header: 'Created', cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{getValue()}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue() || 'active'} /> },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.domain}`}><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <a href={`${s.ssl_active ? 'https' : 'http'}://${s.domain}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open site</a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/filemanager', { state: { path: s.root_path } })}><FolderOpen className="mr-2 h-4 w-4" />Browse files</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate(`/webservers/domain-conf?domain=${encodeURIComponent(s.domain)}`)}><GitBranch className="mr-2 h-4 w-4" />Vhost & stack</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingDelete(s.domain)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [navigate]);

  const data = subs.data || [];
  return (
    <div>
      <PageHeader
        title="Subdomains"
        description="Sites under another domain. Each one belongs to the domain's owner, starts on the same web stack and PHP version, and gets an A record in the domain's DNS zone."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => subs.refetch()} disabled={subs.isFetching}><RotateCw className={subs.isFetching ? 'animate-spin' : ''} />Refresh</Button>
            <Button size="sm" onClick={() => setAdding(true)}><Plus />Add subdomain</Button>
          </>
        }
      />
      {!subs.isLoading && data.length === 0 ? (
        <EmptyState icon={GitBranch} title="No subdomains yet" description="Add blog.example.com, shop.example.com … under any domain on this server."
          action={<Button size="sm" onClick={() => setAdding(true)}><Plus />Add subdomain</Button>} />
      ) : (
        <DataTable columns={columns} data={data} loading={subs.isLoading} getRowId={(r) => r.domain} searchPlaceholder="Search subdomains, domains, owners…" />
      )}
      <AddSubdomainDialog open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete}?`}
        description="Removes the vhost, its DNS record and the panel entry. The files in its folder are kept."
        actionLabel="Delete subdomain"
        onConfirm={() => { remove.mutate(pendingDelete); setPendingDelete(null); }}
      />
    </div>
  );
}

function AddSubdomainDialog({ open, onOpenChange }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [path, setPath] = useState('');
  const [autossl, setAutossl] = useState(true);

  const sites = useQuery({ queryKey: ['websites'], queryFn: () => api.get('/api/websites').then((r) => r.data || []), enabled: open });
  const parentSite = (sites.data || []).find((s) => s.domain === parent);
  const owner = parentSite?.owner_username || 'root';
  const isAccount = owner && owner !== 'root' && owner !== 'admin';
  const fqdn = name && parent ? `${name.toLowerCase()}.${parent}` : '';
  const base = isAccount ? `/home/${owner}/` : '/var/www/sites/';
  const defaultPath = fqdn ? (isAccount ? `domains/${fqdn}/public_html` : `${fqdn}/public`) : '';

  const create = useMutation({
    mutationFn: () => api.post('/api/subdomains', { name: name.trim(), parent, path: path.trim(), autossl }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Subdomain created', { duration: 8000 });
      qc.invalidateQueries({ queryKey: ['subdomains'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
      setName(''); setPath('');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message, { duration: 10000 }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add subdomain</DialogTitle>
          <DialogDescription>It belongs to the domain's owner and starts on the domain's web stack and PHP version.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="blog" className="font-mono" autoFocus />
              <span className="text-muted-foreground">.</span>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger className="w-56" aria-label="Domain"><SelectValue placeholder="Domain" /></SelectTrigger>
                <SelectContent>
                  {(sites.data || []).map((s) => <SelectItem key={s.domain} value={s.domain}>{s.domain}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {fqdn && <p className="text-xs text-muted-foreground">Creates <span className="font-mono text-foreground">{fqdn}</span> for <span className="font-medium text-foreground">{owner}</span>.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-path">Folder</Label>
            <div className="flex items-center rounded-md border bg-muted/40 pl-3 font-mono text-xs text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0">{base}</span>
              <Input id="sub-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder={defaultPath || 'default folder'} className="border-0 bg-transparent pl-0.5 font-mono text-xs shadow-none focus-visible:ring-0" />
            </div>
            <p className="text-xs text-muted-foreground">Leave empty for its own folder. Point it inside the domain's folder (e.g. …/public_html/blog) to share files.</p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>AutoSSL<span className="block text-xs text-muted-foreground">Request a certificate once it is created (the name must already point at this server).</span></span>
            <Switch checked={autossl} onCheckedChange={setAutossl} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !parent || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
