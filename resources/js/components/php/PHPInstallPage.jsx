import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, DownloadCloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/app/PageHeader';
import SegmentedControl from '@/components/app/SegmentedControl';
import EmptyState from '@/components/app/EmptyState';
import { api } from '@/lib/api';
import { usePHPRuntime } from './PHPRuntimeContext';

const LABELS = {
  cli: ['CLI binary', 'php on the command line, cron and Composer'],
  fpm: ['PHP-FPM', 'Runs PHP for websites'],
  cgi: ['PHP-CGI', 'Apache "CGI / suexec" handler'],
  common: ['Common modules', 'ctype, fileinfo, sockets, exif…'],
  mysql: ['MySQL / MariaDB', 'mysqli + pdo_mysql'],
  curl: ['cURL', 'HTTP client'],
  mbstring: ['mbstring', 'UTF-8 / Arabic strings'],
  xml: ['XML', 'DOM, SimpleXML, XSL'],
  zip: ['Zip', 'ZipArchive'],
  gd: ['GD', 'Image resize & thumbnails'],
  intl: ['Intl', 'ICU formatting & locales'],
  bcmath: ['BCMath', 'Arbitrary precision math'],
  sqlite3: ['SQLite', 'pdo_sqlite'],
  opcache: ['OPcache', 'Bytecode cache (built-in on PHP 8.5+)'],
  soap: ['SOAP', 'SOAP client/server'],
  redis: ['Redis', 'Cache & sessions'],
  imagick: ['Imagick', 'ImageMagick bindings'],
  imap: ['IMAP', 'Mailbox access (gone from core since 8.4)'],
  pgsql: ['PostgreSQL', 'pgsql + pdo_pgsql'],
  gmp: ['GMP', 'Big integers'],
  memcached: ['Memcached', 'Memcached client'],
  apcu: ['APCu', 'User data cache'],
  xdebug: ['Xdebug', 'Debugger — not for production'],
};

const REQUIRED = ['cli', 'fpm', 'common'];
const PRESETS = {
  minimal: ['cli', 'fpm', 'cgi', 'common', 'mysql', 'curl', 'mbstring', 'xml', 'zip', 'opcache'],
  wordpress: ['cli', 'fpm', 'cgi', 'common', 'mysql', 'curl', 'mbstring', 'xml', 'zip', 'gd', 'intl', 'imagick', 'opcache', 'redis', 'bcmath'],
  laravel: ['cli', 'fpm', 'cgi', 'common', 'mysql', 'curl', 'mbstring', 'xml', 'zip', 'gd', 'intl', 'bcmath', 'sqlite3', 'opcache', 'redis', 'pgsql'],
};

export default function PHPInstallPage() {
  const { version } = useParams();
  const { all, startInstall } = usePHPRuntime();
  const row = all.find((v) => v.version === version);
  const [preset, setPreset] = useState('wordpress');
  const [picked, setPicked] = useState(new Set(PRESETS.wordpress));
  const [busy, setBusy] = useState(false);

  const pkgs = useQuery({
    queryKey: ['php', 'packages', version],
    queryFn: () => api.get(`/api/php/packages?version=${version}`).then((r) => r.data),
  });
  const options = pkgs.data || [];
  const available = useMemo(() => new Set(options.filter((o) => o.available).map((o) => o.id)), [options]);
  const anyAvailable = available.has('fpm') || available.has('cli');

  useEffect(() => {
    if (preset !== 'custom') setPicked(new Set(PRESETS[preset]));
  }, [preset]);

  const toggle = (id) => {
    if (REQUIRED.includes(id)) return;
    setPreset('custom');
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selected = [...picked].filter((id) => available.has(id));
  const install = async () => {
    setBusy(true);
    await startInstall({ type: 'version', version, packages: selected });
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={row?.is_installed ? `Add packages to PHP ${version}` : `Install PHP ${version}`}
        description="Pick the modules to install. Packages this server's OS release does not carry are greyed out and skipped."
        actions={<Button variant="outline" size="sm" asChild><Link to="/php"><ArrowLeft />All versions</Link></Button>}
      />

      {pkgs.isLoading ? <Skeleton className="h-96" /> : !anyAvailable ? (
        <EmptyState
          icon={DownloadCloud}
          title={`PHP ${version} is not available here`}
          description="Neither the ondrej/php repository nor the OS archive has packages for this version on this release. Pick another version."
          action={<Button asChild size="sm" variant="outline"><Link to="/php">Back to versions</Link></Button>}
        />
      ) : (
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Packages</CardTitle>
              <CardDescription>Start from a set, then adjust. CLI, FPM and the common modules are always installed.</CardDescription>
            </div>
            <SegmentedControl
              value={preset}
              onChange={setPreset}
              options={[
                { value: 'minimal', label: 'Minimal' },
                { value: 'wordpress', label: 'WordPress' },
                { value: 'laravel', label: 'Laravel' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((o) => {
                const [label, hint] = LABELS[o.id] || [o.id, ''];
                const on = picked.has(o.id) && o.available;
                const req = REQUIRED.includes(o.id);
                return (
                  <label
                    key={o.id}
                    htmlFor={`pkg-${o.id}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${on ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50'} ${!o.available ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <Checkbox id={`pkg-${o.id}`} checked={on} disabled={!o.available || req} onCheckedChange={() => toggle(o.id)} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {label}
                        {req && <Badge variant="muted" className="px-1.5 py-0 text-[10px]">required</Badge>}
                        {!o.available && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">not available</Badge>}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{o.package}</span>
                      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">{selected.length} package(s) will be installed with apt.</p>
              <Button onClick={install} disabled={busy || selected.length === 0}>
                {busy ? <Loader2 className="animate-spin" /> : <DownloadCloud />}
                {row?.is_installed ? 'Install selected' : `Install PHP ${version}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
