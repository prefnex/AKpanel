import React from 'react';
import { DownloadCloud, ShieldCheck, Video, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/app/PageHeader';
import { usePHPRuntime } from './PHPRuntimeContext';
import { VersionPicker } from './PHPShared';

const ADDONS = [
  {
    id: 'ffmpeg', type: 'ffmpeg', icon: Video, title: 'FFmpeg', tag: 'System',
    text: 'Video/audio encoding binaries used by media plugins and transcoding scripts. Installed once for the whole server.',
    perVersion: false,
  },
  {
    id: 'ioncube', type: 'addon', icon: ShieldCheck, title: 'IonCube Loader', tag: 'Loader',
    text: 'Runs IonCube-encoded applications such as WHMCS. Downloaded from ioncube.com and loaded before OPcache.',
    perVersion: true,
  },
  {
    id: 'swoole', type: 'addon', icon: Zap, title: 'Swoole', tag: 'PECL',
    text: 'Coroutine runtime for Laravel Octane and long-running PHP servers.',
    perVersion: true,
  },
];

export default function PHPAddonsPage() {
  const { selectedVer, current, startInstall } = usePHPRuntime();
  const loaded = new Set((current?.extensions || []).filter((e) => e.is_installed).map((e) => e.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add-ons"
        description="Extra tools sites often need next to PHP. Per-version add-ons install for the version selected on the right."
        actions={<VersionPicker />}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {ADDONS.map((a) => {
          const isOn = a.id === 'swoole' && loaded.has('swoole');
          return (
            <Card key={a.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold"><a.icon className="h-4 w-4" />{a.title}</span>
                <Badge variant="muted">{a.tag}</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{a.text}</p>
              <Button
                className="mt-4"
                variant={isOn ? 'outline' : 'default'}
                disabled={isOn || (a.perVersion && !selectedVer)}
                onClick={() => startInstall({ type: a.type, version: a.perVersion ? selectedVer : '', name: a.id })}
              >
                <DownloadCloud />{isOn ? 'Installed' : a.perVersion ? `Install for PHP ${selectedVer}` : 'Install'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
