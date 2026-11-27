import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '@/components/app/EmptyState';
import LogViewer from '@/components/app/LogViewer';
import { usePHPRuntime } from './PHPRuntimeContext';

// VersionPicker switches which installed PHP version the current page acts on.
export function VersionPicker({ className = 'w-44' }) {
  const { installed, selectedVer, setSelectedVer, serverDefault } = usePHPRuntime();
  if (installed.length === 0) return null;
  return (
    <Select value={selectedVer} onValueChange={setSelectedVer}>
      <SelectTrigger className={className} aria-label="PHP version">
        <SelectValue placeholder="PHP version" />
      </SelectTrigger>
      <SelectContent>
        {installed.map((v) => (
          <SelectItem key={v.version} value={v.version}>
            PHP {v.version}{v.version === serverDefault ? ' · default' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// NoPHPInstalled is shown by pages that need an installed version when there is none.
export function NoPHPInstalled() {
  return (
    <EmptyState
      icon={AlertCircle}
      title="No PHP version is installed"
      description="Install one first; every other PHP page works on an installed version."
      action={<Button asChild size="sm"><Link to="/php">Go to PHP versions</Link></Button>}
    />
  );
}

// TaskDialog shows the live log of an install/remove task.
export function TaskDialog() {
  const { task, setTask } = usePHPRuntime();
  const running = task?.status === 'running';
  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open && !running) setTask(null); }}>
      <DialogContent className="sm:max-w-2xl" hideClose={running} onInteractOutside={(e) => running && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Terminal className="h-4 w-4" />{task?.title}</DialogTitle>
          <DialogDescription>
            {running ? 'Running on the server — this can take a few minutes. Keep this window open to follow along.' : 'Finished. The log stays here until you close it.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              {running && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Working…</>}
              {task?.status === 'completed' && <><CheckCircle2 className="h-3.5 w-3.5 text-success" />Completed</>}
              {task?.status === 'failed' && <><AlertCircle className="h-3.5 w-3.5 text-destructive" />Failed</>}
            </span>
            <span className="tabular text-muted-foreground">{task?.progress ?? 0}%</span>
          </div>
          <Progress value={task?.progress ?? 0} className="h-1.5" />
        </div>
        <LogViewer text={(task?.logs || []).join('\n')} className="max-h-96 min-h-48" />
        <DialogFooter>
          <Button onClick={() => setTask(null)} disabled={running}>{running ? 'Please wait…' : 'Close'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// SettingRow lays out a label + help on the left and a control on the right.
export function SettingRow({ label, help, htmlFor, children, warning }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
        {warning && <p className="text-xs text-warning">{warning}</p>}
      </div>
      <div className="shrink-0 sm:w-64">{children}</div>
    </div>
  );
}
