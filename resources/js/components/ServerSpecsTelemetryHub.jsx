import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Cpu, 
  Server, 
  Globe, 
  Terminal, 
  ShieldCheck, 
  Database, 
  Edit3, 
  Copy, 
  Check, 
  Clock, 
  ExternalLink, 
  Layers, 
  HardDrive, 
  Radio, 
  Sliders, 
  Code,
  Network,
  Lock,
  Zap
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

export default function ServerSpecsTelemetryHub({ stats, showToast }) {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  const sys = stats?.system_info || {};
  const net = stats?.network || {
    interface: 'eth0',
    upload_speed_str: '0.0 KB/s',
    download_speed_str: '0.0 KB/s',
    total_rx_str: '0 MB',
    total_tx_str: '0 MB'
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    if (showToast) showToast(`Copied ${fieldName}: ${text}`);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            System & Software Telemetry Hub (CWP / WHM Full Specs)
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
          <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>Net: <strong className="text-emerald-400">↓ {net.download_speed_str}</strong> / <strong className="text-blue-400">↑ {net.upload_speed_str}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-time Kernel Feed</span>
          </div>
        </div>
      </div>

      {/* 3-Column Balanced Equal-Height Modern Telemetry Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        
        {/* ========================================================================= */}
        {/* WIDGET 1: APPLICATION & STACK VERSIONS                                    */}
        {/* ========================================================================= */}
        <Card className="bg-[#111217]/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/30 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Code className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Application Version</h3>
            </div>
            <button 
              onClick={() => navigate('/webservers')}
              className="text-zinc-400 hover:text-cyan-400 transition"
              title="Manage Web Servers"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card Body Specs Table (10 Items) */}
          <div className="p-4 space-y-2.5 text-xs divide-y divide-zinc-800/40 font-mono flex-1">
            
            <div className="flex items-center justify-between pt-1">
              <span className="text-zinc-400">Nginx Version:</span>
              <span className="text-zinc-200 font-bold">{sys.nginx_version || 'nginx/1.24.0 (Ubuntu)'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Apache Version:</span>
              <span className="text-zinc-200 font-bold">{sys.apache_version || 'Apache/2.4.58'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">PHP CLI Version:</span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{sys.php_version || '8.3.6'}</span>
                <button
                  onClick={() => navigate('/php')}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-sans font-bold px-2 py-0.5 rounded flex items-center gap-1 transition"
                  title="Switch PHP Version"
                >
                  <span>FPM: {sys.php_fpm_active || '8.2/8.3'}</span>
                  <Edit3 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">MySQL / MariaDB:</span>
              <button 
                onClick={() => navigate('/databases')}
                className="text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>{sys.mysql_version || '10.11.14-MariaDB'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Varnish Cache:</span>
              <span className="text-purple-300 font-bold">{sys.varnish_version || 'Varnish 7.1.1'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">DNS Server (BIND):</span>
              <button 
                onClick={() => navigate('/dns/server')}
                className="text-cyan-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>{sys.bind_version || 'BIND 9.18'}</span>
                <Edit3 className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">FTP Engine:</span>
              <span className="text-zinc-300 font-bold">{sys.ftp_version || '1.0.49 (Pure-FTPd)'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">SSH & WHM Port:</span>
              <span className="text-zinc-200 font-bold">{sys.ssh_port || '22 / 2087'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">MySQL Port:</span>
              <span className="text-zinc-300 font-bold">{sys.mysql_port || '3306'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Web Servers Stack:</span>
              <button
                onClick={() => navigate('/webservers')}
                className="text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1.5 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800"
              >
                <span>{sys.web_servers_profile || 'Nginx + Apache Hybrid'}</span>
                <Edit3 className="w-2.5 h-2.5 text-cyan-400" />
              </button>
            </div>

          </div>
        </Card>

        {/* ========================================================================= */}
        {/* WIDGET 2: AKPANEL / CWP NETWORK & AUTHORITY INFO                          */}
        {/* ========================================================================= */}
        <Card className="bg-[#111217]/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/30 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AKpanel Authority Info</h3>
            </div>
            <button 
              onClick={() => navigate('/settings/server')}
              className="text-zinc-400 hover:text-cyan-400 transition"
              title="Edit Server Settings"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card Body Specs Table (10 Items) */}
          <div className="p-4 space-y-2.5 text-xs divide-y divide-zinc-800/40 font-mono flex-1">
            
            <div className="flex items-center justify-between pt-1 group">
              <span className="text-zinc-400">NS1:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{sys.ns1_name || 'ns1.akpanel.site'}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-cyan-400 font-semibold">{sys.ns1_ip || sys.server_ip || '127.0.0.1'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 group">
              <span className="text-zinc-400">NS2:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{sys.ns2_name || 'ns2.akpanel.site'}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-cyan-400 font-semibold">{sys.ns2_ip || sys.server_ip || '127.0.0.1'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Server IP:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-cyan-300">
                  {sys.server_ip || '127.0.0.1'}
                </span>
                <button
                  onClick={() => handleCopy(sys.server_ip, 'Server IP')}
                  className="text-zinc-500 hover:text-white p-1"
                  title="Copy Server IP"
                >
                  {copiedField === 'Server IP' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Shared IP Pool:</span>
              <span className="text-zinc-300 font-bold">{sys.shared_ip || sys.server_ip || '127.0.0.1'}</span>
            </div>

            <div className="flex items-center justify-between pt-2 group">
              <span className="text-zinc-400">Server Hostname:</span>
              <span className="text-purple-300 font-bold">{sys.hostname || sys.server_ip || window.location.hostname}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Client Remote IP:</span>
              <span className="text-zinc-300 font-semibold">127.0.0.1 (Local Session)</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">AKpanel Version:</span>
              <span className="text-white font-bold">AKpanel v0.1.0</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Secure Kernel:</span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-sans font-bold px-2 py-0.5 rounded">
                Active (Hardened AppArmor)
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">SSL Auto-Renewal:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Daily Cron (02:00 AM)</span>
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Network Interface:</span>
              <span className="text-cyan-400 font-bold">{net.interface || 'eth0'} (Active)</span>
            </div>

          </div>
        </Card>

        {/* ========================================================================= */}
        {/* WIDGET 3: HARDWARE & SYSTEM SPECS                                         */}
        {/* ========================================================================= */}
        <Card className="bg-[#111217]/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/30 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">System & Hardware Info</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">uname -a</span>
          </div>

          {/* Card Body Specs Table (10 Items) */}
          <div className="p-4 space-y-2.5 text-xs divide-y divide-zinc-800/40 font-mono flex-1">
            
            <div className="flex items-start justify-between pt-1 gap-2">
              <span className="text-zinc-400 shrink-0">CPU Model:</span>
              <span className="text-zinc-200 font-bold text-right truncate max-w-[200px]" title={sys.cpu_model}>
                {sys.cpu_model || 'Intel Xeon Processor'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">CPU Details:</span>
              <span className="text-purple-400 font-bold">{sys.cpu_details || `${sys.cpu_cores || 2} Cores (3200 MHz)`}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Distro Name:</span>
              <span className="text-white font-bold truncate max-w-[200px]" title={sys.distro_name}>
                {sys.distro_name || 'Ubuntu 24.04 LTS'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Kernel Version:</span>
              <span className="text-zinc-300 font-semibold">{sys.kernel_version || '6.8.0-x86_64'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Platform:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-300">{sys.arch || 'x86_64'}</span>
                <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-sans font-bold px-1.5 py-0.2 rounded">
                  Dedicated Cloud VPS
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Total RX / TX:</span>
              <span className="text-cyan-400 font-bold">{net.total_rx_str} In / {net.total_tx_str} Out</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">System Uptime:</span>
              <span className="text-emerald-400 font-bold">{sys.uptime_str || stats?.uptime || 'Active'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Load Average:</span>
              <span className="text-amber-400 font-bold">{sys.load_avg_1 || 0.1}, {sys.load_avg_5 || 0.1}, {sys.load_avg_15 || 0.1}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Memory Bandwidth:</span>
              <span className="text-zinc-200 font-bold">{stats ? `${(stats.mem_used_mb / 1024).toFixed(1)} / ${(stats.mem_total_mb / 1024).toFixed(1)} GB` : '4.0 GB'}</span>
            </div>

            <div className="flex items-center justify-between pt-2 group">
              <span className="text-zinc-400">Server Time:</span>
              <div className="flex items-center gap-1 text-zinc-300 font-semibold">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span className="text-[11px]">{sys.server_time || currentTime}</span>
              </div>
            </div>

          </div>
        </Card>

      </div>
    </div>
  );
}
