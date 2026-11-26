import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, FileCode2, FolderOpen, Globe, Layers, Lock, LockOpen, MoreHorizontal, Network, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/app/PageHeader';
import DataTable from '@/components/app/DataTable';
import StatusBadge from '@/components/app/StatusBadge';
import ConfirmDialog from '@/components/app/ConfirmDialog';
import EmptyState from '@/components/app/EmptyState';
import { api } from '@/lib/api';
import { describeStack } from '@/hooks/useWebServerModes';
import SiteStackDialog from './SiteStackDialog';
import SiteServicesDialog from './SiteServicesDialog';
import SiteTemplatesDialog, { useVhostLibrary } from './SiteTemplatesDialog';

export default function WebsitesPage({ onCreate }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [stackSite, setStackSite] = useState(null);
  const [servicesSite, setServicesSite] = useState(null);
  const [templatesSite, setTemplatesSite] = useState(null);
  const library = useVhostLibrary();
  const libByName = useMemo(() => Object.fromEntries((library.data || []).map((t) => [t.name, t])), [library.data]);
  const sites = useQuery({ queryKey: ['websites'], queryFn: () => api.get('/api/websites').then((r) => r.data || []) });
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
      id: 'stack',
      header: 'Web stack',
      accessorFn: (s) => describeStack(s.stack?.effective),
      cell: ({ row, getValue }) => {
        const s = row.original;
        const notes = s.stack?.effective?.notes || [];
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setStackSite(s); }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs hover:bg-muted/60"
          >
            {getValue()}
            {notes.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild><AlertTriangle className="h-3.5 w-3.5 text-warning" aria-label="Mode override" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">{notes.join(' · ')}</TooltipContent>
              </Tooltip>
            )}
          </button>
        );
      },
    },
    {
      id: 'services',
      header: 'Subdomains',
      accessorFn: (s) => (s.services || []).join(' '),
      cell: ({ row }) => {
        const s = row.original;
        const list = s.services || [];
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setServicesSite(s); }}
            className="flex max-w-[11rem] flex-wrap gap-1 rounded-md p-0.5 text-left hover:bg-muted/60"
            aria-label={`Service subdomains for ${s.domain}`}
          >
            {list.length ? list.map((x) => <Badge key={x} variant="muted" className="font-normal">{x}</Badge>)
              : <span className="px-1 text-xs text-muted-foreground">None</span>}
          </button>
        );
      },
    },
    {
      id: 'runtime',
      header: 'Runtime',
      accessorFn: (s) => (s.site_type === 'php' ? `PHP ${s.php_version}` : s.site_type === 'proxy' ? `Proxy ${s.proxy_host || ''}:${s.proxy_port}` : 'Static'),
      cell: ({ getValue, row }) => (
        <Badge variant="muted" className="whitespace-nowrap font-mono">{getValue()}</Badge>
      ),
    },
    {
      id: 'templates',
      header: 'Templates',
      accessorFn: (s) => (s.vhost_templates || []).join(' '),
      cell: ({ row }) => {
        const s = row.original;
        const list = s.vhost_templates || [];
        const app = list.find((n) => libByName[n]?.kind === 'app');
        const rest = list.filter((n) => n !== app);
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setTemplatesSite(s); }}
            className="flex max-w-[12rem] flex-wrap items-center gap-1 rounded-md p-0.5 text-left hover:bg-muted/60"
            aria-label={`Vhost templates for ${s.domain}`}
          >
            {app && <Badge variant="info" className="font-normal">{libByName[app]?.title || app}</Badge>}
            {rest.slice(0, 2).map((n) => <Badge key={n} variant="muted" className="font-normal">{n}</Badge>)}
            {rest.length > 2 && <span className="text-xs text-muted-foreground">+{rest.length - 2}</span>}
            {!list.length && <span className="px-1 text-xs text-muted-foreground">None</span>}
          </button>
        );
      },
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
                <DropdownMenuItem onSelect={() => setStackSite(s)}><Layers className="mr-2 h-4 w-4" />Web stack…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setServicesSite(s)}><Network className="mr-2 h-4 w-4" />Service subdomains…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTemplatesSite(s)}><FileCode2 className="mr-2 h-4 w-4" />Vhost templates…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate(`/webservers/domain-conf?domain=${encodeURIComponent(s.domain)}`)}>
                  <Globe className="mr-2 h-4 w-4" />Vhost & custom directives
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
  ], [navigate, libByName]);

  const data = sites.data || [];

  return (
    <div>
      <PageHeader
        title="Websites"
        description="Virtual hosts across every account. Click a web stack to change who runs that site's PHP, the Apache handler or Varnish."
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
      <SiteStackDialog site={stackSite} onOpenChange={(v) => !v && setStackSite(null)} />
      <SiteServicesDialog site={servicesSite} onOpenChange={(v) => !v && setServicesSite(null)} />
      <SiteTemplatesDialog site={templatesSite} onOpenChange={(v) => !v && setTemplatesSite(null)} />
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
