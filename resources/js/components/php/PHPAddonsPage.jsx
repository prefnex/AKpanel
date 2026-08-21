import React from 'react';
import { Video, ShieldCheck, Zap, Play } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPAddonsPage() {
  const { selectedVer, setPreviewItem } = usePHPRuntime();

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="System addons"
        goal="Install server-side tools sites often need next to PHP: FFMPEG, IonCube, and PECL extras. These are not PHP version switches."
      />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <span className="font-bold text-base text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-rose-400" /> FFMPEG
          </span>
          <Badge className="bg-rose-500/10 text-rose-400">Media</Badge>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Video/audio encoding binaries for WordPress and transcoding.</p>
        <Button
          onClick={() => setPreviewItem({ type: 'ffmpeg', name: 'FFMPEG Media Suite', version: selectedVer })}
          className="mt-5 w-full rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs gap-1.5"
        >
          <Play className="w-3.5 h-3.5" /> Install FFMPEG
        </Button>
      </Card>
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <span className="font-bold text-base text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" /> IonCube Loader
          </span>
          <Badge className="bg-blue-500/10 text-blue-400">Security</Badge>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Runs encoded PHP applications such as WHMCS.</p>
        <Button
          onClick={() => setPreviewItem({ type: 'addon', name: 'ioncube', version: selectedVer })}
          className="mt-5 w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs"
        >
          Install IonCube
        </Button>
      </Card>
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <span className="font-bold text-base text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Swoole
          </span>
          <Badge className="bg-amber-500/10 text-amber-400">Speed</Badge>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Coroutine runtime for Laravel Octane and APIs.</p>
        <Button
          onClick={() => setPreviewItem({ type: 'addon', name: 'swoole', version: selectedVer })}
          className="mt-5 w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold text-xs"
        >
          Install Swoole
        </Button>
      </Card>
    </div>
    </div>
  );
}
