import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPFPMPage() {
  const { selectedVer, fpmPool, setFpmPool, handleSaveFpmPool, fetchFpmPool } = usePHPRuntime();

  useEffect(() => { fetchFpmPool(selectedVer); }, [selectedVer]);

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="FPM pool workers"
        goal="Tune pm mode, max_children, and request limits for the selected PHP-FPM pool. Pick which version is the server default on PHP FPM selector (/php/default)."
      />
    <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm max-w-2xl">
      <CardHeader className="p-0 pb-5 border-b border-zinc-800/80">
        <CardTitle className="text-base font-bold text-white">PHP {selectedVer} FPM Pool</CardTitle>
        <CardDescription className="text-xs text-zinc-400 mt-0.5">Worker allocation and request limits.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSaveFpmPool} className="mt-5 space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">pm</label>
            <Select value={fpmPool.pm} onValueChange={(v) => setFpmPool({ ...fpmPool, pm: v })}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-xl text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-xs">
                <SelectItem value="dynamic">dynamic</SelectItem>
                <SelectItem value="static">static</SelectItem>
                <SelectItem value="ondemand">ondemand</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">pm.max_children</label>
            <Input value={fpmPool.max_children} onChange={(e) => setFpmPool({ ...fpmPool, max_children: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">pm.start_servers</label>
            <Input value={fpmPool.start_servers} onChange={(e) => setFpmPool({ ...fpmPool, start_servers: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">pm.max_requests</label>
            <Input value={fpmPool.max_requests} onChange={(e) => setFpmPool({ ...fpmPool, max_requests: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
        </div>
        <div className="pt-4 border-t border-zinc-800/80 flex justify-end">
          <Button type="submit" className="rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Update Pool & Restart FPM
          </Button>
        </div>
      </form>
    </Card>
    </div>
  );
}
