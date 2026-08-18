import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Play, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export default function WebTerminal({ showToast }) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([
    { cmd: 'uname -a', out: 'Linux akpanel-vps 6.8.0 #1 SMP Ubuntu x86_64 GNU/Linux', code: 0 },
    { cmd: 'uptime', out: '04:30:00 up 1 day,  6:12,  0 users,  load average: 0.15, 0.08, 0.02', code: 0 },
  ]);
  const [cmdIndex, setCmdIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleRunCommand = async (e) => {
    if (e) e.preventDefault();
    if (!command.trim()) return;

    const currentCmd = command;
    setCommand('');
    setLoading(true);

    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: currentCmd }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setHistory(prev => [...prev, {
          cmd: currentCmd,
          out: json.data.output || '(No output)',
          code: json.data.exit_code,
          duration: json.data.duration_ms,
        }]);
      } else {
        setHistory(prev => [...prev, {
          cmd: currentCmd,
          out: json.message || 'Execution error',
          code: 1,
        }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, {
        cmd: currentCmd,
        out: 'Network / server communication error',
        code: 1,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCommand = (cmd) => {
    setCommand(cmd);
  };

  const handleClear = () => {
    setHistory([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-purple-400" />
            <span>Interactive Web Terminal (SSH / Bash)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Execute native shell commands, check daemons, and manage server processes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="rounded-xl border-zinc-800 bg-zinc-900 text-xs gap-1.5"
          >
            <Trash2 className="w-3 h-3 text-zinc-400" />
            <span>Clear Terminal</span>
          </Button>
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
        <span className="text-zinc-500 text-[11px] font-semibold uppercase mr-1">Quick Runs:</span>
        {['nginx -t', 'service apache2 status', 'free -h', 'df -h', 'ps aux | grep php', 'varnishstat -1'].map(cmd => (
          <button
            key={cmd}
            onClick={() => handleQuickCommand(cmd)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] font-mono transition"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Box */}
      <Card className="bg-[#0c0c0e] border-zinc-800 rounded-3xl p-5 shadow-2xl overflow-hidden font-mono text-xs text-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4 text-[11px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 text-zinc-400">root@akpanel_vps:~#</span>
          </div>
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
            bash session active
          </Badge>
        </div>

        {/* Console Log Stream */}
        <div className="space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar pr-2 select-text">
          {history.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span>root@akpanel:~#</span>
                <span className="text-white">{item.cmd}</span>
                {item.duration !== undefined && (
                  <span className="text-[10px] text-zinc-500 font-normal">({item.duration}ms)</span>
                )}
              </div>
              <pre className={`p-3 rounded-xl whitespace-pre-wrap leading-relaxed text-xs overflow-x-auto ${
                item.code === 0 ? 'bg-zinc-950/80 text-zinc-300 border border-zinc-900' : 'bg-rose-950/30 text-rose-300 border border-rose-900/40'
              }`}>
                {item.out}
              </pre>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Input Prompt */}
        <form onSubmit={handleRunCommand} className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center gap-2">
          <span className="text-emerald-400 font-bold shrink-0">root@akpanel:~#</span>
          <input 
            type="text" 
            autoFocus
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Type bash command here (e.g. systemctl status nginx)..."
            className="flex-1 bg-transparent border-none text-white focus:outline-none text-xs font-mono placeholder-zinc-600"
          />
          <Button 
            type="submit" 
            size="sm"
            disabled={loading}
            className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold gap-1"
          >
            <Play className="w-3 h-3" />
            <span>Run</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}
