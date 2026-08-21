import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Globe, 
  Database, 
  FolderTree, 
  Mail, 
  ShieldCheck, 
  Archive, 
  Plus, 
  ExternalLink, 
  HardDrive, 
  Activity, 
  Cpu, 
  Server, 
  Zap, 
  CheckCircle2, 
  Lock, 
  ArrowUpRight, 
  Sparkles, 
  LayoutGrid, 
  Layers, 
  Terminal, 
  Clock, 
  Settings, 
  Code, 
  FileCode, 
  Key, 
  Search, 
  ChevronRight 
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';

export default function ClientDashboard({ stats, showToast }) {
  const navigate = useNavigate();
  const [dashboardView, setDashboardView] = useState('modern'); // 'modern' | 'classic' | 'dev'
  const [classicSearch, setClassicSearch] = useState('');

  const handleLaunchPhpMyAdmin = async (e) => {
    if (e) e.preventDefault();
    try {
      const currentToken = localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
      const res = await fetch('/api/client/phpmyadmin/sso', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const json = await res.json();
      if (json.status && json.data && (json.data.redirect_url || json.data.url)) {
        window.open(json.data.redirect_url || json.data.url, '_blank');
      } else {
        window.open('/phpmyadmin', '_blank');
      }
    } catch (err) {
      window.open('/phpmyadmin', '_blank');
    }
  };

  const quickActions = [
    { title: 'Add New Domain', desc: 'Host a new website or subdomain', icon: Globe, path: '/websites', color: 'from-emerald-600 to-teal-600' },
    { title: 'MySQL Databases', desc: 'Manage DBs & 1-click phpMyAdmin', icon: Database, path: '/databases', color: 'from-blue-600 to-indigo-600' },
    { title: 'File Manager', desc: 'Jailed explorer & code editor', icon: FolderTree, path: '/files', color: 'from-amber-600 to-orange-600' },
    { title: 'FTP Accounts', desc: 'Chrooted FTP users & credentials', icon: Server, path: '/ftp', color: 'from-cyan-600 to-teal-600' },
    { title: 'Cron Tasks', desc: 'Schedule background automation', icon: Clock, path: '/cron', color: 'from-violet-600 to-purple-600' },
    { title: 'PHP & Environment', desc: 'PHP version & execution limits', icon: Cpu, path: '/php', color: 'from-pink-600 to-rose-600' },
  ];

  const classicCategories = [
    {
      category: 'Files & Code Management',
      items: [
        { name: 'File Manager', desc: 'Manage & edit web documents', icon: FolderTree, path: '/files' },
        { name: 'FTP Accounts', desc: 'Create jailed FTP connections', icon: Server, path: '/ftp' },
        { name: 'Account Backups', desc: 'Download .tar.gz archive', icon: Archive, path: '/backups' },
        { name: 'Disk Usage Analyzer', desc: 'Live directory quota breakdown', icon: HardDrive, path: '/' },
      ]
    },
    {
      category: 'Databases & phpMyAdmin',
      items: [
        { name: 'MySQL Databases', desc: 'Create user databases & users', icon: Database, path: '/databases' },
        { name: 'phpMyAdmin SSO', desc: 'Single-Sign-On database studio', icon: ExternalLink, isPma: true },
      ]
    },
    {
      category: 'Domains & DNS Routing',
      items: [
        { name: 'Domains & Vhosts', desc: 'Host new sites & subdomains', icon: Globe, tab: 'websites' },
        { name: 'DNS Zone Editor', desc: 'Manage A, CNAME, MX records', icon: Layers, tab: 'dns' },
        { name: 'SSL / TLS Certificates', desc: 'AutoSSL free Let\'s Encrypt', icon: ShieldCheck, tab: 'websites' },
      ]
    },
    {
      category: 'Email Services',
      items: [
        { name: 'Business Email Accounts', desc: 'Custom @domain mailboxes', icon: Mail, tab: 'emails' },
        { name: 'Webmail Client', desc: 'Online inbox web interface', icon: ExternalLink, tab: 'emails' },
      ]
    },
    {
      category: 'Advanced & Automation',
      items: [
        { name: 'Cron Jobs Scheduler', desc: 'Automate periodic shell/PHP tasks', icon: Clock, tab: 'cron' },
        { name: 'PHP Runtime Selector', desc: 'PHP 8.1, 8.2, 8.3 & directives', icon: Cpu, tab: 'php' },
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-indigo-950/20 border border-emerald-800/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Welcome, {stats?.username || 'Client'}!
              </h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                {stats?.package_name || 'Standard Hosting'}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Primary Domain: <strong className="text-zinc-200">{stats?.main_domain || 'yourdomain.com'}</strong></span>
              <span>•</span>
              <span>Jailed Path: <code className="text-emerald-400 font-mono font-semibold">{stats?.home_dir || `/home/${stats?.username || 'user'}`}</code></span>
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 self-start md:self-auto">
          <button
            onClick={() => setDashboardView('modern')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              dashboardView === 'modern' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Modern Hub
          </button>
          <button
            onClick={() => setDashboardView('classic')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              dashboardView === 'classic' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Classic Grid
          </button>
          <button
            onClick={() => setDashboardView('dev')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              dashboardView === 'dev' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Dev Console
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MODERN CLOUD HUB VIEW                                                  */}
      {/* ========================================================================= */}
      {dashboardView === 'modern' && (
        <div className="space-y-6">
          {/* Quick Action Tools */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Quick Launch Tools
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <div
                    key={i}
                    onClick={() => navigate(action.path)}
                    className="group relative bg-zinc-950/60 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-emerald-500/40 p-5 rounded-2xl transition-all duration-200 cursor-pointer shadow-lg hover:shadow-emerald-950/30 flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color} text-white shadow-md group-hover:scale-105 transition-transform duration-200`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-100 group-hover:text-emerald-400 transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          {action.desc}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Server Parameters & Connection Hub */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Dedicated Server IP</span>
                <p className="text-sm font-mono font-bold text-emerald-400 mt-1">{stats?.server_ip || '127.0.0.1'}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">A Record Target IP</p>
              </div>
              <Badge className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-[10px]">Online</Badge>
            </div>

            <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Nameservers</span>
                <p className="text-xs font-mono font-bold text-white mt-1">{stats?.nameservers?.[0] || 'ns1.akpanel.local'}</p>
                <p className="text-xs font-mono text-zinc-400">{stats?.nameservers?.[1] || 'ns2.akpanel.local'}</p>
              </div>
              <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-[10px]">BIND9</Badge>
            </div>

            <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Database Studio</span>
                <p className="text-sm font-bold text-white mt-1">phpMyAdmin SSO</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Isolated User: {stats?.username}</p>
              </div>
              <Button size="sm" onClick={handleLaunchPhpMyAdmin} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
                Launch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CLASSIC CWP / CPANEL ICON CATEGORY GRID                                */}
      {/* ========================================================================= */}
      {dashboardView === 'classic' && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
            <Input
              value={classicSearch}
              onChange={(e) => setClassicSearch(e.target.value)}
              placeholder="Search apps, tools, and hosting modules..."
              className="pl-10 bg-zinc-950 border-zinc-800 text-sm h-11 rounded-xl"
            />
          </div>

          <div className="space-y-6">
            {classicCategories.map((cat, idx) => {
              const filteredItems = cat.items.filter(it => 
                it.name.toLowerCase().includes(classicSearch.toLowerCase()) || 
                it.desc.toLowerCase().includes(classicSearch.toLowerCase())
              );
              if (filteredItems.length === 0) return null;

              return (
                <div key={idx} className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                  <div className="bg-zinc-900/60 px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">{cat.category}</h3>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{filteredItems.length} Apps</Badge>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {filteredItems.map((item, itemIdx) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={itemIdx}
                          onClick={() => item.isPma ? handleLaunchPhpMyAdmin() : navigate(item.path)}
                          className="p-3.5 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/50 hover:border-emerald-500/40 rounded-xl transition cursor-pointer flex items-center gap-3 group"
                        >
                          <div className="p-2.5 bg-zinc-800 group-hover:bg-emerald-500/20 text-zinc-300 group-hover:text-emerald-400 rounded-lg transition">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition truncate">{item.name}</h4>
                            <p className="text-[10px] text-zinc-500 truncate">{item.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DEVELOPER & RUNTIME CONSOLE                                            */}
      {/* ========================================================================= */}
      {dashboardView === 'dev' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-emerald-400 font-bold flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Shell & Container Sandbox
                </span>
                <Badge className="bg-emerald-950 text-emerald-400 text-[10px]">Active Jail</Badge>
              </div>
              <div className="space-y-2 text-zinc-300">
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Username</span>
                  <span className="text-white font-bold">{stats?.username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Home Directory</span>
                  <span className="text-emerald-400">{stats?.home_dir || `/home/${stats?.username}`}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Web Document Root</span>
                  <span className="text-cyan-400">{stats?.home_dir || `/home/${stats?.username}`}/public_html</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">MySQL Database Prefix</span>
                  <span className="text-amber-400">{stats?.username}_[dbname]</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Active PHP Runtime</span>
                  <span className="text-purple-400">PHP 8.2 FPM (FastCGI)</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-cyan-400 font-bold flex items-center gap-2">
                  <Code className="w-4 h-4" /> Quick Curl & Deployment Snippets
                </span>
                <Badge variant="outline" className="text-zinc-500 border-zinc-800 text-[10px]">API Ready</Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">Upload via FTP (cURL)</span>
                  <div className="p-2.5 bg-zinc-900 rounded-lg text-[11px] text-zinc-300 overflow-x-auto">
                    curl -T index.html ftp://{stats?.server_ip || '127.0.0.1'}/public_html/ -u {stats?.username}:password
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">Trigger Cron Manually</span>
                  <div className="p-2.5 bg-zinc-900 rounded-lg text-[11px] text-zinc-300 overflow-x-auto">
                    php {stats?.home_dir || `/home/${stats?.username}`}/public_html/cron.php
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
