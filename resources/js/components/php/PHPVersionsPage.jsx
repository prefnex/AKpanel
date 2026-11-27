import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu, DownloadCloud, Layers, MoreHorizontal, RefreshCw, Server, SlidersHorizontal, Terminal, Trash2,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/app/PageHeader';
import StatCard from '@/components/app/StatCard';
import StatusBadge from '@/components/app/StatusBadge';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { api } from '@/lib/api';
import { fpmStatus, usePHPRuntime } from './PHPRuntimeContext';

// Every PHP branch the panel knows: what is installed, what this OS can install, and the
// actions for each (defaults, settings, removal).
export default function PHPVersionsPage() {
  const { versionsQuery, all, installed, cli, serverDefault, refresh, startUninstall } = usePHPRuntime();
  const [removing, setRemoving] = useState(null);

  const running = installed.filter((v) => v.is_fpm_running).length;
  const loading = versionsQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PHP versions"
        description="Install several PHP branches side by side. Each website or hosting account picks one; the server default is used when they do not."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={versionsQuery.isFetching}>
            <RefreshCw className={versionsQuery.isFetching ? 'animate-spin' : ''} />Refresh
          </Button>
        }
      />

      <motion.div {...staggerContainer()} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Installed" value={installed.length} icon={Layers} loading={loading} hint={installed.map((v) => v.version).join(' · ') || '—'} />
        <StatCard label="FPM running" value={running} suffix={`/ ${installed.length}`} icon={Server} loading={loading} tone={running < installed.length ? 'warning' : 'success'} />
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Server default</p>
          <p className="mt-2 text-2xl font-semibold">{serverDefault ? `PHP ${serverDefault}` : '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">New sites and accounts</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">System CLI</p>
          <p className="mt-2 text-2xl font-semibold">{cli.default_version ? `PHP ${cli.default_version}` : '—'}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{cli.binary_path || '/usr/bin/php'}</p>
        </Card>
      </motion.div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <motion.div {...staggerContainer(0.03)} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {all.map((v) => (
            <VersionCard
              key={v.version}
              v={v}
              isDefault={v.version === serverDefault}
              isCLI={v.version === cli.default_version}
              onRemove={() => setRemoving(v.version)}
            />
          ))}
        </motion.div>
      )}

      <RemoveDialog
        version={removing}
        onClose={() => setRemoving(null)}
        onConfirm={async () => { const v = removing; setRemoving(null); await startUninstall(v); }}
      />
    </div>
  );
}

function VersionCard({ v, isDefault, isCLI, onRemove }) {
  const loaded = (v.extensions || []).filter((e) => e.is_installed).length;
  const notInRepos = !v.is_installed && v.is_available === false;
  return (
    <motion.div variants={staggerItem}>
      <Card className={`flex h-full flex-col p-4 ${notInRepos ? 'opacity-60' : ''} ${isDefault ? 'border-primary/50' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-semibold">PHP {v.version}</span>
              {isDefault && <Badge variant="info">Default</Badge>}
              {isCLI && <Badge variant="muted"><Terminal className="h-3 w-3" />CLI</Badge>}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {v.is_installed ? (v.cli_version || `php${v.version}`) : notInRepos ? 'No packages for this OS release' : 'Available to install'}
            </p>
          </div>
          {v.is_installed ? <StatusBadge status={fpmStatus(v)} className="shrink-0" /> : (
            <Badge variant={notInRepos ? 'warning' : 'muted'}>{notInRepos ? 'Not in repos' : 'Not installed'}</Badge>
          )}
        </div>

        {v.is_installed && (
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Memory</dt><dd className="font-mono">{v.memory_limit || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Upload</dt><dd className="font-mono">{v.upload_max_filesize || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Modules</dt><dd className="font-mono">{loaded}</dd></div>
          </dl>
        )}

        <div className="mt-auto flex items-center justify-end gap-2 pt-4">
          {v.is_installed ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/php/ini?v=${v.version}`}><SlidersHorizontal />Settings</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`More for PHP ${v.version}`}><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><Link to={`/php/fpm?v=${v.version}`}><Cpu />FPM pool & service</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to={`/php/extensions?v=${v.version}`}><Layers />Extensions</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to={`/php/install/${v.version}`}><DownloadCloud />Add packages</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={isDefault} onSelect={onRemove}>
                    <Trash2 />Remove PHP {v.version}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" asChild={!notInRepos} disabled={notInRepos}>
              {notInRepos ? <span><DownloadCloud />Install</span> : <Link to={`/php/install/${v.version}`}><DownloadCloud />Install</Link>}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function RemoveDialog({ version, onClose, onConfirm }) {
  const [typed, setTyped] = useState('');
  const usage = useQuery({
    queryKey: ['php', 'usage', version],
    queryFn: () => api.get(`/api/php/usage?version=${version}`).then((r) => r.data),
    enabled: !!version,
  });
  const u = usage.data || {};
  const users = [...(u.websites || []), ...(u.accounts || [])];
  const inUse = users.length > 0;
  const word = `php${version}`;
  return (
    <AlertDialog open={!!version} onOpenChange={(o) => { setTyped(''); if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove PHP {version}?</AlertDialogTitle>
          <AlertDialogDescription>
            {usage.isLoading && 'Checking what still uses this version…'}
            {!usage.isLoading && inUse && `Still used by ${u.websites?.length || 0} website(s) and ${u.accounts?.length || 0} account(s). Move them to another version first.`}
            {!usage.isLoading && !inUse && `Purges every php${version}-* package, its php.ini files and the FPM service. Nothing uses this version right now.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {inUse && (
          <div className="flex flex-wrap gap-1.5">
            {users.slice(0, 12).map((n) => <Badge key={n} variant="muted" className="font-mono">{n}</Badge>)}
            {users.length > 12 && <Badge variant="muted">+{users.length - 12}</Badge>}
          </div>
        )}
        {!usage.isLoading && !inUse && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Type <span className="font-mono font-medium text-foreground">{word}</span> to continue.</p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{inUse ? 'Close' : 'Cancel'}</AlertDialogCancel>
          {!inUse && (
            <AlertDialogAction
              disabled={usage.isLoading || typed !== word}
              onClick={onConfirm}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Remove
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
