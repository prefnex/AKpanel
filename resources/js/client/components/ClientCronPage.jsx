import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Terminal, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  FileCode, 
  Info,
  Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

export default function ClientCronPage({ showToast, username }) {
  const [crons, setCrons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [schedulePreset, setSchedulePreset] = useState('0 * * * *');
  const [customSchedule, setCustomSchedule] = useState('0 * * * *');
  const [command, setCommand] = useState(`php /home/${username || 'user'}/public_html/cron.php`);
  const [description, setDescription] = useState('Hourly PHP task execution');

  const token = localStorage.getItem('akpanel_client_token');

  const fetchCrons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client/cron', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) {
        setCrons(data.data || data.cron_jobs || []);
      }
    } catch (err) {
      showToast('Failed to load cron jobs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrons();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!customSchedule || !command) {
      showToast('Schedule and command are required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/client/cron/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          schedule: customSchedule,
          command: command,
          description: description
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Cron job scheduled successfully!', 'success');
        setIsCreateOpen(false);
        fetchCrons();
      } else {
        showToast(data.message || 'Creation failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this cron job?')) return;

    try {
      const res = await fetch('/api/client/cron/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Cron job removed', 'success');
        fetchCrons();
      } else {
        showToast(data.message || 'Delete failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch('/api/client/cron/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.status) {
        showToast('Cron status updated', 'success');
        fetchCrons();
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handlePresetChange = (preset) => {
    setSchedulePreset(preset);
    setCustomSchedule(preset);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Cron Jobs & Scheduled Tasks</h2>
            <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-500/30 text-xs">
              Linux Crontab Engine
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Automate routine background commands, PHP scripts, database backups, and maintenance triggers.</p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-lg shadow-emerald-950">
          <Plus className="w-4 h-4" /> Schedule New Task
        </Button>
      </div>

      {/* Crons Table */}
      <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Active User Crons</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchCrons} className="text-zinc-400 hover:text-white p-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              <span>Loading scheduled tasks...</span>
            </div>
          ) : crons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <Clock className="w-10 h-10 text-zinc-700" />
              <p className="text-sm">No scheduled cron jobs found.</p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-emerald-600 text-xs text-white mt-1">
                Schedule First Cron
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Command</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {crons.map((cr, i) => (
                  <tr key={i} className="hover:bg-zinc-900/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {cr.schedule}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300 max-w-xs truncate">
                      {cr.command}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {cr.description || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      {cr.is_enabled ? (
                        <Badge className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-900 text-zinc-500 text-[10px]">Paused</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleToggle(cr.id)}
                          className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                        >
                          {cr.is_enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleDelete(cr.id)}
                          className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-emerald-400" /> Schedule Cron Job
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Common Schedule Presets</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { label: 'Every Minute (* * * * *)', val: '* * * * *' },
                  { label: 'Every 15 Minutes (*/15 * * * *)', val: '*/15 * * * *' },
                  { label: 'Once an Hour (0 * * * *)', val: '0 * * * *' },
                  { label: 'Once a Day (0 0 * * *)', val: '0 0 * * *' },
                  { label: 'Once a Week (0 0 * * 0)', val: '0 0 * * 0' },
                  { label: 'Once a Month (0 0 1 * *)', val: '0 0 1 * *' },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handlePresetChange(p.val)}
                    className={`text-left p-2 rounded-lg text-xs font-mono border transition ${
                      customSchedule === p.val 
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Cron Expression (Minute Hour Day Month DayOfWeek)</label>
              <Input 
                value={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.value)}
                className="mt-1 bg-zinc-950 border-zinc-700 font-mono text-xs"
                placeholder="0 * * * *"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Command to Execute</label>
              <Input 
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="mt-1 bg-zinc-950 border-zinc-700 font-mono text-xs"
                placeholder={`php /home/${username}/public_html/cron.php`}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Description (Optional)</label>
              <Input 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 bg-zinc-950 border-zinc-700 text-xs"
                placeholder="Daily database backup and cleanups"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">Save Cron Job</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
