import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../ui/button';
import { usePHPRuntime } from './PHPRuntimeContext';
import PHPSectionIntro from './PHPSectionIntro';

export default function PHPIniRawPage() {
  const { selectedVer, rawIni, setRawIni, handleSaveRawIni, fetchRawIni } = usePHPRuntime();

  useEffect(() => { fetchRawIni(selectedVer); }, [selectedVer]);

  return (
    <div className="space-y-4">
      <PHPSectionIntro
        title="Raw php.ini"
        goal="Full php.ini for FPM of the selected version. Save writes the file and reloads PHP-FPM."
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-mono">/etc/php/{selectedVer}/fpm/php.ini</span>
        <Button onClick={handleSaveRawIni} className="rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5">
          <Save className="w-3.5 h-3.5" />
          Save php.ini
        </Button>
      </div>
      <textarea
        value={rawIni}
        onChange={(e) => setRawIni(e.target.value)}
        className="w-full h-[500px] bg-zinc-950 border border-zinc-800 rounded-3xl p-5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 resize-none"
      />
    </div>
  );
}
