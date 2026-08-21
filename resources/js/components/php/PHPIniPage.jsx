import React from 'react';
import { Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { usePHPRuntime } from './PHPRuntimeContext';

export default function PHPIniPage() {
  const { selectedVer, iniForm, setIniForm, handleSaveSimpleIni } = usePHPRuntime();

  return (
    <Card className="bg-[#121215] border-zinc-800/80 rounded-3xl p-6 shadow-sm max-w-2xl">
      <CardHeader className="p-0 pb-5 border-b border-zinc-800/80">
        <CardTitle className="text-base font-bold text-white">PHP {selectedVer} php.ini</CardTitle>
        <CardDescription className="text-xs text-zinc-400 mt-0.5">Memory, upload, and execution limits.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSaveSimpleIni} className="mt-5 space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">memory_limit</label>
            <Input value={iniForm.memory_limit} onChange={(e) => setIniForm({ ...iniForm, memory_limit: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">upload_max_filesize</label>
            <Input value={iniForm.upload_max_filesize} onChange={(e) => setIniForm({ ...iniForm, upload_max_filesize: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">post_max_size</label>
            <Input value={iniForm.post_max_size} onChange={(e) => setIniForm({ ...iniForm, post_max_size: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
          <div>
            <label className="block text-zinc-300 font-semibold mb-1.5">max_execution_time</label>
            <Input value={iniForm.max_execution_time} onChange={(e) => setIniForm({ ...iniForm, max_execution_time: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-mono text-white" />
          </div>
        </div>
        <div className="pt-4 border-t border-zinc-800/80 flex justify-end">
          <Button type="submit" className="rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Save INI & Reload FPM
          </Button>
        </div>
      </form>
    </Card>
  );
}
