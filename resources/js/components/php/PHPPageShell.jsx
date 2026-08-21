import React from 'react';
import {
  Cpu, RotateCcw, Terminal, CheckCircle2, AlertCircle, Sparkles, Play,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '../ui/select';
import { usePHPRuntime } from './PHPRuntimeContext';

export default function PHPPageShell() {
  const {
    selectedVer, setSelectedVer, currentDetail, installedVersions, availableVersions,
    installedCount, handleRestartFPM, previewItem, setPreviewItem,
    handleStartLiveInstall, activeTask, setActiveTask, logEndRef,
  } = usePHPRuntime();

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121215] border border-zinc-800/90 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">PHP CLI & Runtime Manager</h2>
              <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-mono">
                {installedVersions.length} Installed
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              PHP CLI selector, FPM selector, default version, extensions, and php.ini — each as its own page.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400">Active Target:</span>
            <Select value={selectedVer} onValueChange={setSelectedVer}>
              <SelectTrigger className="w-52 h-10 bg-zinc-900/90 border-zinc-700/80 rounded-2xl text-xs font-bold text-white shadow-inner">
                <SelectValue placeholder="Select PHP..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-xs rounded-2xl shadow-2xl">
                <SelectGroup>
                  <SelectLabel className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1">
                    Installed & Ready
                  </SelectLabel>
                  {installedVersions.map(v => (
                    <SelectItem key={v.version} value={v.version}>
                      <span className="font-bold">PHP {v.version}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                {availableVersions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 border-t border-zinc-800/80 mt-1">
                      Available to Install
                    </SelectLabel>
                    {availableVersions.map(v => (
                      <SelectItem key={v.version} value={v.version} className="text-zinc-400">
                        PHP {v.version} (Uninstalled)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRestartFPM}
            disabled={!currentDetail.is_installed}
            className="h-10 rounded-2xl border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold gap-1.5 hover:bg-zinc-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart FPM
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Runtime Status</span>
            <div className="text-sm font-bold text-white font-mono mt-0.5 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${currentDetail.is_installed ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span>{currentDetail.is_installed ? `PHP ${selectedVer} Active` : `PHP ${selectedVer} Not Installed`}</span>
            </div>
          </div>
        </div>
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">FastCGI Socket</span>
          <div className="text-xs font-mono font-semibold text-zinc-300 truncate mt-0.5">
            {currentDetail.socket_path || `/run/php/php${selectedVer}-fpm.sock`}
          </div>
        </div>
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">RAM Quota</span>
          <div className="text-sm font-bold text-white font-mono mt-0.5">{currentDetail.memory_limit || '512M'}</div>
        </div>
        <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Modules</span>
          <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
            {installedCount} of {(currentDetail.extensions || []).length} Loaded
          </div>
        </div>
      </div>

      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
          <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Pre-Installation Inspection
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Confirm target package before live installation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-xs mt-3 bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800/80 font-mono">
              <div className="flex justify-between"><span className="text-zinc-400">Package:</span><span className="text-white font-bold">{previewItem.name}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">PHP:</span><span className="text-indigo-400 font-bold">PHP {previewItem.version}</span></div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800 mt-4">
              <Button variant="outline" onClick={() => setPreviewItem(null)} className="rounded-xl border-zinc-800 text-xs">Cancel</Button>
              <Button
                onClick={() => handleStartLiveInstall(previewItem.type, previewItem.name, previewItem.version)}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Start Live Install
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeTask && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0e11] rounded-3xl max-w-3xl w-full p-6 border border-zinc-800 shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{activeTask.title}</h3>
                  <span className="text-[11px] text-zinc-500 font-mono">Task ID: {activeTask.id}</span>
                </div>
              </div>
              {activeTask.status !== 'running' && (
                <Button size="sm" variant="ghost" onClick={() => setActiveTask(null)} className="rounded-lg">✕</Button>
              )}
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className={activeTask.status === 'completed' ? 'text-emerald-400' : 'text-zinc-300'}>
                  {activeTask.status === 'completed' ? 'Finished' : 'Installing...'}
                </span>
                <span className="font-mono text-zinc-400">{activeTask.progress}%</span>
              </div>
              <Progress value={activeTask.progress} className="h-2 bg-zinc-800" />
            </div>
            <div className="flex-1 mt-4 bg-black rounded-2xl p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-y-auto max-h-96 space-y-1">
              {(activeTask.logs || []).map((log, i) => (
                <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
              ))}
              <div ref={logEndRef} />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800 mt-4">
              {activeTask.status === 'completed' ? (
                <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold"><CheckCircle2 className="w-4 h-4" /> Ready</span>
              ) : activeTask.status === 'failed' ? (
                <span className="text-rose-400 flex items-center gap-1 text-xs font-semibold"><AlertCircle className="w-4 h-4" /> Error</span>
              ) : (
                <span className="text-xs text-zinc-400">Running...</span>
              )}
              {activeTask.status !== 'running' && (
                <Button onClick={() => setActiveTask(null)} className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">Done</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
