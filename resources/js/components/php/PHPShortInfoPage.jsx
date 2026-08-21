import React from 'react';
import { Clock, HardDrive, Flame } from 'lucide-react';
import { Card } from '../ui/card';
import { usePHPRuntime } from './PHPRuntimeContext';

export default function PHPShortInfoPage() {
  const { currentDetail } = usePHPRuntime();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-emerald-400" />
          Execution Budget
        </div>
        <div className="text-3xl font-black text-white font-mono mt-3">{currentDetail.max_execution_time || '300'}s</div>
      </Card>
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <HardDrive className="w-4 h-4 text-cyan-400" />
          HTTP Payload Limit
        </div>
        <div className="text-3xl font-black text-white font-mono mt-3">{currentDetail.post_max_size || '128M'}</div>
      </Card>
      <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
          <Flame className="w-4 h-4 text-amber-400" />
          OPcache
        </div>
        <div className="text-3xl font-black text-emerald-400 font-mono mt-3">Active</div>
      </Card>
    </div>
  );
}
