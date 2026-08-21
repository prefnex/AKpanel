import React, { useEffect } from 'react';
import { Search, RotateCw } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPInfoPage() {
  const { selectedVer, phpInfoSections, infoFilter, setInfoFilter, fetchPHPInfo } = usePHPRuntime();

  useEffect(() => { fetchPHPInfo(selectedVer); }, [selectedVer]);

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="phpinfo()"
        goal="Inspect compiled modules, INI paths, and environment for the selected PHP version — same data a site would see under that FPM pool."
      />
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
          <Input
            type="text"
            placeholder="Search phpinfo..."
            value={infoFilter}
            onChange={(e) => setInfoFilter(e.target.value)}
            className="bg-zinc-900 border-zinc-800 rounded-2xl pl-9 text-xs font-mono"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchPHPInfo(selectedVer)} className="rounded-2xl border-zinc-800 text-xs gap-1.5">
          <RotateCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {phpInfoSections.map((sec, idx) => {
          const matched = Object.entries(sec.directives || {}).filter(([k, v]) =>
            k.toLowerCase().includes(infoFilter.toLowerCase()) || String(v).toLowerCase().includes(infoFilter.toLowerCase())
          );
          if (matched.length === 0) return null;
          return (
            <Card key={idx} className="bg-[#121215] border-zinc-800/80 rounded-2xl overflow-hidden">
              <div className="p-3.5 bg-zinc-900/80 border-b border-zinc-800/80 font-bold text-xs text-white uppercase font-mono">{sec.title}</div>
              <table className="w-full text-left text-xs text-zinc-300">
                <tbody className="divide-y divide-zinc-800/50 font-mono">
                  {matched.map(([k, v]) => (
                    <tr key={k} className="hover:bg-zinc-900/30">
                      <td className="py-2.5 px-4 font-semibold text-zinc-400 w-1/3">{k}</td>
                      <td className="py-2.5 px-4 text-white break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
