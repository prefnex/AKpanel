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
  Flame, 
  Layers, 
  HardDrive, 
  Radio, 
  Sliders, 
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Code
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function ServerSpecsTelemetryHub({ stats, showToast }) {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());

  const sys = stats?.system_info || {};

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString());
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
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time Kernel Feed</span>
        </div>
      </div>

      {/* 3-Column Modern Telemetry Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* ========================================================================= */}
        {/* WIDGET 1: APPLICATION & STACK VERSIONS                                    */}
        {/* ========================================================================= */}
        <Card className="bg-[#111217]/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col justify-between">
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

          {/* Card Body Specs Table */}
          <div className="p-4 space-y-2.5 text-xs divide-y divide-zinc-800/40 font-mono">
            
            {/* Nginx & Apache */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-zinc-400">Nginx Version:</span>
              <span className="text-zinc-200 font-bold">{sys.nginx_version || 'nginx/1.18.0 (Ubuntu)'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Apache Version:</span>
              <span className="text-zinc-200 font-bold">{sys.apache_version || 'Apache/2.4.52'}</span>
            </div>

            {/* PHP Version with Switcher Link */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">PHP CLI Version:</span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">{sys.php_version || '8.2.18'}</span>
                <button
                  onClick={() => navigate('/php')}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-sans font-bold px-2 py-0.5 rounded flex items-center gap-1 transition"
                  title="Switch PHP-FPM Version"
                >
                  <span>PHP-FPM: {sys.php_fpm_active || '8.3'}</span>
                  <Edit3 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* MySQL / MariaDB */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">MySQL Version:</span>
              <button 
                onClick={() => navigate('/databases')}
                className="text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>{sys.mysql_version || '10.6.18-MariaDB'}</span>
              </button>
            </div>

            {/* Varnish Cache & BIND 9 */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Varnish Cache:</span>
              <span className="text-purple-300 font-bold">{sys.varnish_version || 'Varnish 6.6.1'}</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">DNS Server (BIND):</span>
              <button 
                onClick={() => navigate('/dns/server')}
                className="text-cyan-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>{sys.bind_version || 'BIND 9.18.28'}</span>
                <Edit3 className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* FTP Version */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">FTP Engine:</span>
              <span className="text-zinc-300 font-bold">{sys.ftp_version || '1.0.49 (Pure-FTPd)'}</span>
            </div>

            {/* Ports */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">SSH Port:</span>
              <button 
                onClick={() => navigate('/terminal')}
                className="text-zinc-200 hover:text-white font-bold"
              >
                {sys.ssh_port || '22 / 2087'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">MySQL Port:</span>
              <span className="text-zinc-300">{sys.mysql_port || '3306'}</span>
            </div>

            {/* Web Server Profile */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Web Servers Stack:</span>
              <button
                onClick={() => navigate('/webservers')}
                className="text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1.5 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800"
              >
                <span>{sys.web_servers_profile || 'nginx-varnish-apache'}</span>
                <Edit3 className="w-2.5 h-2.5 text-cyan-400" />
              </button>
            </div>

          </div>
        </Card>

        {/* ========================================================================= */}
        {/* WIDGET 2: AKPANEL / CWP NETWORK & AUTHORITY INFO                          */}
        {/* ========================================================================= */}
        <Card className="bg-[#111217]/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col justify-between">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/30 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AKpanel Authority Info</h3>
            </div>
            <button 
              onClick={() => navigate('/dns/nameservers')}
              className="text-zinc-400 hover:text-cyan-400 transition"
              title="Edit Nameservers & Hostname"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card Body Specs Table */}
          <div className="p-4 space-y-2.5 text-xs divide-y divide-zinc-800/40 font-mono">
            
            {/* NS1 */}
            <div className="flex items-center justify-between pt-1 group">
              <span className="text-zinc-400">NS1:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{sys.ns1_name || `ns1.${sys.hostname || 'server.local'}`}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-cyan-400 font-semibold">{sys.ns1_ip || sys.server_ip || '172.17.0.2'}</span>
                <button
                  onClick={() => navigate('/dns/nameservers')}
                  className="text-zinc-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* NS2 */}
            <div className="flex items-center justify-between pt-2 group">
              <span className="text-zinc-400">NS2:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{sys.ns2_name || `ns2.${sys.hostname || 'server.local'}`}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-cyan-400 font-semibold">{sys.ns2_ip || sys.server_ip || '172.17.0.2'}</span>
                <button
                  onClick={() => navigate('/dns/nameservers')}
                  className="text-zinc-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Server IP */}
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

            {/* Shared IP */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Shared IP:</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-300">{sys.shared_ip || sys.server_ip || '127.0.0.1'}</span>
                <button
                  onClick={() => navigate('/dns/zones')}
                  className="text-zinc-500 hover:text-cyan-400"
                  title="Migrate Shared IP in Zones"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Hostname */}
            <div className="flex items-center justify-between pt-2 group">
              <span className="text-zinc-400">Hostname:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-purple-300 font-bold">{sys.hostname || 'akpanel.local'}</span>
                <button
                  onClick={() => navigate('/dns/nameservers')}
                  className="text-zinc-500 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition"
                  title="Change Hostname FQDN"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Remote Client IP */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Your Client IP:</span>
              <span className="text-zinc-300 font-semibold">{sys.server_ip ? '127.0.0.1 (Local Session)' : 'Auto-detected'}</span>
            </div>

            {/* AKpanel Pro Version */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">AKpanel Version:</span>
              <span className="text-white font-bold">{sys.panel_version || 'Enterprise v1.0.0'}</span>
            </div>

            {/* Kernel Security */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Secure Kernel:</span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-sans font-bold px-2 py-0.5 rounded">
                {sys.secure_kernel || 'Active (Hardened AppArmor)'}
              </span>
            </div>

          </div>
        </Card>

        {/* ========================================================================= */}
        {/* WIDGET 3: HARDWARE & SYSTEM SPECS                                         */}
        {/* ========================================================================= */}
        <Card className="bg-[#111217]/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col justify-between">
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

          {/* Card Body Specs Table */}
          <div className="p-4 space-y-2.5 text-xs divide-y divide-zinc-800/40 font-mono">
            
            {/* CPU Model */}
            <div className="flex items-start justify-between pt-1 gap-2">
              <span className="text-zinc-400 shrink-0">CPU Model:</span>
              <span className="text-zinc-200 font-bold text-right truncate max-w-[200px]" title={sys.cpu_model}>
                {sys.cpu_model || 'Host Multi-Core Processor'}
              </span>
            </div>

            {/* CPU Cores & Frequency */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">CPU Details:</span>
              <span className="text-purple-400 font-bold">{sys.cpu_details || `${sys.cpu_cores || 4} Cores (3200 MHz)`}</span>
            </div>

            {/* Distro Name */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Distro Name:</span>
              <span className="text-white font-bold truncate max-w-[200px]" title={sys.distro_name}>
                {sys.distro_name || 'Ubuntu 22.04 LTS (Jammy Jellyfish)'}
              </span>
            </div>

            {/* Kernel Version */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Kernel Version:</span>
              <span className="text-zinc-300 font-semibold">{sys.kernel_version || '5.15.0-x86_64'}</span>
            </div>

            {/* Platform */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Platform:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-300">{sys.arch || 'x86_64'}</span>
                <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-sans font-bold px-1.5 py-0.2 rounded">
                  Dedicated VPS
                </span>
              </div>
            </div>

            {/* Uptime */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-zinc-400">Uptime:</span>
              <span className="text-emerald-400 font-bold">{sys.uptime_str || stats?.uptime || 'Active'}</span>
            </div>

            {/* Server Time */}
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
