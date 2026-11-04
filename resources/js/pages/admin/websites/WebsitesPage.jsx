import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, FolderOpen, Globe, Lock, LockOpen, MoreHorizontal, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/app/PageHeader';
import DataTable from '@/components/app/DataTable';
import StatusBadge from '@/components/app/StatusBadge';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import EmptyState from '@/components/app/EmptyState';
import { api } from '@/lib/api';

const ENGINE_LABEL = { nginx: 'Nginx', apache: 'Apache', hybrid: 'Nginx + Apache' };

export default function WebsitesPage({ onCreate }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const sites = useQuery({ queryKey: ['websites'], queryFn: () => api.get('/api/websites').then((r) => r.data || []) });

  const switchEngine = useMutation({
    mutationFn: ({ domain, engine }) => api.post('/api/websites/switch-engine', { domain, engine }),
    onSuccess: (res) => {
      toast.success(res?.message || 'Web server switched');
      qc.invalidateQueries({ queryKey: ['websites'] });
    },
  });
  const remove = useMutation({
    mutationFn: (domain) => api.post('/api/websites/delete', { domain }),
    onSuccess: (res, domain) => {
      toast.success(res?.message || `${domain} deleted`);
      qc.invalidateQueries({ queryKey: ['websites'] });
    },
  });

  const columns = useMemo(() => [
    {
      accessorKey: 'domain',
      header: 'Domain',
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{s.domain}</span>
                {s.ssl_active ? <Lock className="h-3 w-3 text-success" aria-label="SSL active" /> : <LockOpen className="h-3 w-3 text-muted-foreground" aria-label="No SSL" />}
              </div>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{s.root_path}</p>
            </div>
          </div>
        );
      },
    },
    { accessorKey: 'owner_username', header: 'Owner', cell: ({ getValue }) => <span className="text-sm">{getValue() || 'root'}</span> },
    {
      accessorKey: 'server_engine',
      header: 'Web server',
      cell: ({ row }) => {
        const s = row.original;
        return (
          <Select
            value={s.server_engine}
            onValueChange={(engine) => engine !== s.server_engine && switchEngine.mutate({ domain: s.domain, engine })}
            disabled={switchEngine.isPending && switchEngine.variables?.domain === s.domain}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENGINE_LABEL).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: 'runtime',
      header: 'Runtime',
      accessorFn: (s) => (s.site_type === 'php' ? `PHP ${s.php_version}` : s.site_type === 'proxy' ? `Proxy :${s.proxy_port}` : 'Static'),
      cell: ({ getValue, row }) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="muted" className="font-mono">{getValue()}</Badge>
          {row.original.template_id && row.original.template_id !== 'custom' && (
            <span className="text-xs text-muted-foreground">{row.original.template_id}</span>
          )}
        </div>
      ),
    },
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
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.domain}`} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <a href={`${s.ssl_active ? 'https' : 'http'}://${s.domain}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open site</a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/filemanager', { state: { path: s.root_path } })}>
                  <FolderOpen className="mr-2 h-4 w-4" />Browse files
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/ssl')}><Lock className="mr-2 h-4 w-4" />Manage SSL</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingDelete(s.domain)}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [navigate, switchEngine]);

  const data = sites.data || [];

  return (
    <div>
      <PageHeader
        title="Websites"
        description="Virtual hosts across every account. Switching the web server rebuilds that site's configuration."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => sites.refetch()} disabled={sites.isFetching}>
              <RotateCw className={sites.isFetching ? 'animate-spin' : ''} />Refresh
            </Button>
            <Button size="sm" onClick={() => onCreate()}><Plus />New website</Button>
          </>
        }
      />
      {!sites.isLoading && data.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No websites yet"
          description="Create a site directly, or add an account with a main domain from the Users page."
          action={<Button size="sm" onClick={() => onCreate()}><Plus />New website</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          loading={sites.isLoading}
          getRowId={(r) => r.domain}
          searchPlaceholder="Search domains, owners…"
        />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete}?`}
        description="Removes the vhost, its web server configuration and the document root. This cannot be undone."
        confirmText={pendingDelete || undefined}
        actionLabel="Delete website"
        onConfirm={() => {
          remove.mutate(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
