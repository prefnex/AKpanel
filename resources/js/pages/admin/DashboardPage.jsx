import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useMutation } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import {
  Activity, ArrowDownToLine, ArrowUpFromLine, Copy, Cpu, Database, Globe, HardDrive, Mail,
  MemoryStick, MoreHorizontal, Play, RotateCw, Square, Users, Server, Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/app/PageHeader';
import StatCard from '@/components/app/StatCard';
import StatusBadge from '@/components/app/StatusBadge';
import SegmentedControl from '@/components/app/SegmentedControl';
import { useServerStats } from '@/hooks/useStats';
import { api } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion';

const CATEGORY_LABELS = { web: 'Web', php: 'PHP', database: 'Databases', mail: 'Mail', dns: 'DNS', security: 'Security', other: 'Other' };

const usageChart = {
  cpu: { label: 'CPU', color: 'hsl(var(--chart-1))' },
  mem: { label: 'Memory', color: 'hsl(var(--chart-2))' },
};
const netChart = {
  rx: { label: 'Download', color: 'hsl(var(--chart-1))' },
  tx: { label: 'Upload', color: 'hsl(var(--chart-3))' },
};

function ServiceRow({ svc, onAction, busy }) {
  return (
    <motion.li
      layout
      variants={staggerItem}
      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{svc.display_name || svc.name}</span>
          {svc.port && <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{svc.port}</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{svc.description}</p>
      </div>
      <StatusBadge status={svc.is_running ? 'running' : 'stopped'} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Actions for ${svc.name}`}>
            {busy ? <RotateCw className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onAction(svc.name, 'restart')}><RotateCw className="mr-2 h-4 w-4" />Restart</DropdownMenuItem>
          {svc.is_running ? (
            <DropdownMenuItem onSelect={() => onAction(svc.name, 'stop')} className="text-destructive focus:text-destructive">
              <Square className="mr-2 h-4 w-4" />Stop
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onAction(svc.name, 'start')}><Play className="mr-2 h-4 w-4" />Start</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}

export default function DashboardPage({ websitesCount = 0 }) {
  const { data: s, isLoading, history, refetch } = useServerStats();
  const [category, setCategory] = useState('web');

  const stack = s?.installed_stack || [];
  const categories = useMemo(() => {
    const counts = {};
    for (const svc of stack) counts[svc.category] = (counts[svc.category] || 0) + 1;
    return Object.keys(counts).map((c) => ({ value: c, label: CATEGORY_LABELS[c] || c, count: counts[c] }));
  }, [stack]);
  const services = stack.filter((svc) => svc.category === category);
  const down = stack.filter((svc) => svc.installed && svc.in_profile && !svc.is_running);

  const action = useMutation({
    mutationFn: ({ service, op }) => api.post('/api/webservers/service/action', { service, action: op }),
    onSuccess: (res, { service, op }) => {
      toast.success(res?.message || `${service}: ${op} done`);
      refetch();
    },
  });

  const sys = s?.system_info || {};
  const ip = sys.server_ip || s?.server_ip;
  const counters = s?.counters || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={s ? `${s.hostname} · ${sys.distro_name || s.os} · up ${s.uptime}` : 'Loading server information…'}
        actions={
          <>
            {ip && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(ip).then(() => toast.success('Server IP copied'))}
              >
                <Copy />
                <span className="font-mono">{ip}</span>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link to="/users"><Users />New account</Link>
            </Button>
          </>
        }
      />

      {down.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <Activity className="h-4 w-4 text-warning" />
            <span className="font-medium">{down.length} service{down.length > 1 ? 's' : ''} in the active profile {down.length > 1 ? 'are' : 'is'} down:</span>
            <span className="text-muted-foreground">{down.map((d) => d.display_name || d.name).join(', ')}</span>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerContainer()} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="CPU" icon={Cpu} loading={isLoading} value={s?.cpu_usage} decimals={1} suffix="%" percent={s?.cpu_usage}
          hint={s ? `Load ${s.load_avg_1} · ${s.load_avg_5} · ${s.load_avg_15} · ${s.cpu_cores} cores` : undefined} />
        <StatCard label="Memory" icon={MemoryStick} loading={isLoading} value={s?.mem_usage_pct} decimals={1} suffix="%" percent={s?.mem_usage_pct}
          hint={s ? `${(s.mem_used_mb / 1024).toFixed(1)} of ${(s.mem_total_mb / 1024).toFixed(1)} GB` : undefined} />
        <StatCard label="Disk" icon={HardDrive} loading={isLoading} value={s?.disk_usage_pct} decimals={1} suffix="%" percent={s?.disk_usage_pct}
          hint={s ? `${s.disk_used_gb} of ${s.disk_total_gb} GB used` : undefined} />
        <StatCard label="Processes" icon={Activity} loading={isLoading} value={s?.total_processes}
          hint={s?.memory_details ? `Swap ${s.memory_details.swap_pct}% used` : undefined} />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Resource usage</CardTitle>
              <CardDescription>CPU and memory, live</CardDescription>
            </div>
            <Badge variant="muted" className="font-mono">{history.length * 3}s window</Badge>
          </CardHeader>
          <CardContent>
            {history.length < 2 ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ChartContainer config={usageChart} className="h-[220px] w-full">
                <AreaChart data={history} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-mem)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-mem)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={32} fontSize={11} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area dataKey="mem" type="monotone" stroke="var(--color-mem)" fill="url(#fillMem)" strokeWidth={2} isAnimationActive={false} />
                  <Area dataKey="cpu" type="monotone" stroke="var(--color-cpu)" fill="url(#fillCpu)" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Network · {s?.network?.interface || '—'}</CardTitle>
            <CardDescription>Throughput in KB/s</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowDownToLine className="h-3.5 w-3.5" />Download</p>
                <p className="mt-1 text-lg font-semibold tabular">{s?.network?.download_speed_str || '—'}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowUpFromLine className="h-3.5 w-3.5" />Upload</p>
                <p className="mt-1 text-lg font-semibold tabular">{s?.network?.upload_speed_str || '—'}</p>
              </div>
            </div>
            {history.length < 2 ? (
              <Skeleton className="h-[110px] w-full" />
            ) : (
              <ChartContainer config={netChart} className="h-[110px] w-full">
                <AreaChart data={history} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area dataKey="rx" type="monotone" stroke="var(--color-rx)" fill="var(--color-rx)" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
                  <Area dataKey="tx" type="monotone" stroke="var(--color-tx)" fill="var(--color-tx)" fillOpacity={0.08} strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Services</CardTitle>
              <CardDescription>{stack.filter((x) => x.is_running).length} of {stack.length} running</CardDescription>
            </div>
            {categories.length > 0 && <SegmentedControl value={category} onChange={setCategory} options={categories} />}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <motion.ul key={category} variants={staggerContainer(0.03)} initial="initial" animate="animate" className="space-y-0.5">
                {services.map((svc) => (
                  <ServiceRow
                    key={svc.name}
                    svc={svc}
                    busy={action.isPending && action.variables?.service === svc.name}
                    onAction={(service, op) => action.mutate({ service, op })}
                  />
                ))}
              </motion.ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hosting</CardTitle>
            <CardDescription>Accounts and resources on this server</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: 'Accounts', value: counters.users, icon: Users, to: '/users' },
              { label: 'Websites', value: counters.websites ?? websitesCount, icon: Globe, to: '/websites' },
              { label: 'Databases', value: counters.databases, icon: Database, to: '/databases' },
              { label: 'Mailboxes', value: counters.emails, icon: Mail, to: '/emails/accounts' },
            ].map((x) => (
              <motion.div key={x.label} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link to={x.to} className="block rounded-md border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <x.icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-xl font-semibold tabular">{x.value ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{x.label}</p>
                </Link>
              </motion.div>
            ))}
            <div className="col-span-2 mt-1 space-y-1.5 rounded-md bg-muted/40 p-3 text-xs">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground"><Server className="mr-1 inline h-3 w-3" />CPU</span><span className="truncate text-right">{sys.cpu_model || s?.cpu_model || '—'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Kernel</span><span className="truncate font-mono">{sys.kernel_version || '—'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" />Uptime</span><span>{s?.uptime || '—'}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top processes</CardTitle>
            <CardDescription>By CPU</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Command</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">CPU</TableHead>
                  <TableHead className="pr-6 text-right">Memory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s?.top_processes || []).map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell className="max-w-[220px] truncate pl-6 font-mono text-xs">{p.command}<span className="ml-2 text-muted-foreground">#{p.pid}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.user}</TableCell>
                    <TableCell className="text-right tabular text-xs">{p.cpu}%</TableCell>
                    <TableCell className="pr-6 text-right tabular text-xs">{p.res}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Storage</CardTitle>
            <CardDescription>Mounted filesystems</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(s?.disk_mounts || []).map((m) => (
              <div key={`${m.filesystem}-${m.mounted}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono">{m.mounted}</span>
                  <span className="text-muted-foreground">{m.used} / {m.size}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={m.use_pct >= 90 ? 'h-full bg-destructive' : m.use_pct >= 75 ? 'h-full bg-warning' : 'h-full bg-primary'}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.use_pct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
