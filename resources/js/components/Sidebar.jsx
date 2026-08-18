import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Cpu,
  Globe,
  Layers,
  Database,
  FolderTree,
  Terminal,
  ShieldCheck,
  Command,
  ChevronDown,
  Wrench,
  Zap,
  PackageCheck,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Sliders,
  FileCode,
  Lock,
  ListTree,
  LayoutGrid,
  Flame,
  Users,
  Package,
  HardDrive,
  Mail
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export default function Sidebar({ collapsed, setCollapsed, websitesCount, stats, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  // By default, all dropdowns start closed as requested
  const [openSections, setOpenSections] = useState({
    server: false,
    users: false,
    dns: false,
    webserver: false,
    php: false,
    domains: false,
    databases: false,
    files: false,
    tools: false,
  });

  const toggleSection = (section) => {
    if (collapsed) setCollapsed(false);
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isNavActive = (targetPath) => path === targetPath;

  return (
    <TooltipProvider delayDuration={150}>
      <aside className={`h-full flex flex-col shrink-0 bg-[#09090b] transition-all duration-300 select-none ${collapsed ? 'w-16' : 'w-60'
        }`}>

        {/* Workspace Brand / Toggle */}
        <div className="h-14 px-3.5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-md shrink-0">
              <Command className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <span className="font-bold text-xs text-zinc-100 tracking-tight block">AKpanel Pro</span>
                <span className="text-[10px] text-zinc-500 font-mono block -mt-0.5">Quad-Engine</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition"
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 p-2 space-y-1.5 overflow-y-auto custom-scrollbar text-xs">

          {/* 1. Server Overview */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Overview
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('server')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-violet-400" />
                  <span className="text-xs">Server</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.server ? 'rotate-180' : ''}`} />
              </button>

              {openSections.server && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-violet-400" />
                    <span>Overview</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers')}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      <ListTree className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Services</span>
                    </div>
                    <span className="text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-400">5 OK</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1.5. User Accounts & Hosting Packages */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/users')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/users') || isNavActive('/packages') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Users className="w-4 h-4 text-blue-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Users & Packages
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('users')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs">User Accounts</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.users ? 'rotate-180' : ''}`} />
              </button>

              {openSections.users && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/users')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/users') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>List Accounts</span>
                  </button>

                  <button
                    onClick={() => navigate('/packages')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/packages') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span>Hosting Packages</span>
                  </button>

                  <button
                    onClick={() => navigate('/users')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Fix Permissions</span>
                  </button>

                  <button
                    onClick={() => navigate('/users')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>User Quotas</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1.6. DNS Server, BIND 9 & Zones Management Dropdown */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/dns/zones')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${path.startsWith('/dns') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Globe className="w-4 h-4 text-cyan-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                DNS Server & Zones
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('dns')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs">DNS Server & Zones</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.dns ? 'rotate-180' : ''}`} />
              </button>

              {openSections.dns && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/dns/zones')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/dns/zones') || isNavActive('/dns') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>DNS Zones List</span>
                  </button>

                  <button
                    onClick={() => navigate('/dns/server')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/dns/server') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <Server className="w-3.5 h-3.5 text-violet-400" />
                    <span>BIND 9 Engine</span>
                  </button>

                  <button
                    onClick={() => navigate('/dns/nameservers')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/dns/nameservers') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Nameservers & Host</span>
                  </button>

                  <button
                    onClick={() => navigate('/dns/templates')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/dns/templates') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Zone Templates</span>
                  </button>

                  <button
                    onClick={() => navigate('/dns/cluster')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/dns/cluster') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-orange-400" />
                    <span>DNS Cluster</span>
                  </button>

                  <button
                    onClick={() => navigate('/dns/security')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/dns/security') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>DNSSEC Manager</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1.65. IP Address & Network Pool Manager */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/ips')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/ips') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                  <Network className="w-4 h-4 text-cyan-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                IP Manager (IPv4/IPv6)
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => navigate('/ips')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition ${isNavActive('/ips') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'}`}
              >
                <Network className="w-4 h-4 text-cyan-400" />
                <span>IP Address Manager</span>
              </button>
            </div>
          )}

          {/* 1.7. Rich Email Services & Roundcube Webmail Dropdown */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/emails')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${path.startsWith('/emails') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Email Services & Webmail
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('email')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span className="text-xs">Email Services</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.email ? 'rotate-180' : ''}`} />
              </button>

              {openSections.email && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200 max-h-64 overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => navigate('/emails')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/emails') || isNavActive('/emails/accounts') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'}`}
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Email Accounts</span>
                  </button>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Aliases & Forwarders</span>
                  </button>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>AutoResponders</span>
                  </button>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mail Routing / MX</span>
                  </button>

                  <a
                    href="/webmail"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Inbox className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Roundcube Webmail</span>
                    </div>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <ListTree className="w-3.5 h-3.5 text-orange-400" />
                    <span>Mail Queue Manager</span>
                  </button>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Server className="w-3.5 h-3.5 text-purple-400" />
                    <span>MailServer Manager</span>
                  </button>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>DKIM & SPF Manager</span>
                  </button>

                  <button
                    onClick={() => navigate('/emails')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    <span>AntiSpam Shield</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. WebServer Settings (Matching CWP Suite Screenshot 3) */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/webservers')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/webservers') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Server className="w-4 h-4 text-emerald-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                WebServer Settings
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('webserver')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs">WebServer Settings</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.webserver ? 'rotate-180' : ''}`} />
              </button>

              {openSections.webserver && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/webservers?tab=select')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Select WebServers</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=main_conf')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>WebServers Main Conf</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=domain_conf')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>WebServers Domain Conf</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=templates')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>WebServers Template Editor</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=conf_editor')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>WebServers Conf Editor</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=apache_status')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Apache Status</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=rebuild')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span>Apache Re-Build</span>
                  </button>

                  <button
                    onClick={() => navigate('/webservers?tab=redirects')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span>Apache Redirects</span>
                  </button>

                  <button
                    onClick={() => navigate('/ssl')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    <span>SSL Certificates</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. PHP Settings */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/php')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/php') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Cpu className="w-4 h-4 text-indigo-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                PHP Suite (7.4-8.4)
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('php')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs">PHP Suite</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.php ? 'rotate-180' : ''}`} />
              </button>

              {openSections.php && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/php')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/php') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <PackageCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Versions</span>
                    </div>
                    <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 text-[9px] px-1 py-0">7.4-8.4</Badge>
                  </button>

                  <button
                    onClick={() => navigate('/php')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                    <span>php.ini & Exts</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. Domains & Virtual Hosts */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/websites')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/websites') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Globe className="w-4 h-4 text-cyan-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Virtual Hosts ({websitesCount})
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('domains')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs">Domains</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.domains ? 'rotate-180' : ''}`} />
              </button>

              {openSections.domains && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/websites')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/websites') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Vhosts List</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400">{websitesCount}</span>
                  </button>

                  <button
                    onClick={() => navigate('/security')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/security') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SSL Certificates</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 5. Databases Dropdown (MySQL, Postgres, MongoDB, Redis) */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/databases/mysql')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/databases') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Database className="w-4 h-4 text-rose-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Databases (MySQL, Postgres, MongoDB, Redis)
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('databases')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-rose-400" />
                  <span className="text-xs">Databases</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.databases ? 'rotate-180' : ''}`} />
              </button>

              {openSections.databases && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/databases/mysql')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${location.pathname === '/databases/mysql' || location.pathname === '/databases' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span>MySQL / Maria</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-cyan-500/30 text-cyan-400">3306</Badge>
                  </button>

                  <button
                    onClick={() => navigate('/databases/postgres')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${location.pathname === '/databases/postgres' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-blue-400" />
                      <span>PostgreSQL</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-400">5432</Badge>
                  </button>

                  <button
                    onClick={() => navigate('/databases/mongodb')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${location.pathname === '/databases/mongodb' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-emerald-400" />
                      <span>MongoDB</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400">27017</Badge>
                  </button>

                  <button
                    onClick={() => navigate('/databases/redis')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${location.pathname === '/databases/redis' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-rose-400" />
                      <span>Redis Cache</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-rose-500/30 text-rose-400">6379</Badge>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6. Files Dropdown (v1 Studio & v2 Full) */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/filemanager')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/filemanager') || isNavActive('/filemanager/v2') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <FolderTree className="w-4 h-4 text-blue-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                File Manager (v1 / v2)
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => toggleSection('files')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <FolderTree className="w-4 h-4 text-blue-400" />
                  <span className="text-xs">File Manager</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${openSections.files ? 'rotate-180' : ''}`} />
              </button>

              {openSections.files && (
                <div className="pl-6 pr-1 space-y-0.5 animate-in fade-in duration-200">
                  <button
                    onClick={() => navigate('/filemanager')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${isNavActive('/filemanager') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                      <span>Manager v1</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400">Studio</Badge>
                  </button>

                  <a
                    href="/filemanager/standalone"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Manager v2</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/40 text-blue-400">Full v2</Badge>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 7. Web Terminal */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/terminal')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/terminal') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                >
                  <Terminal className="w-4 h-4 text-purple-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Web Terminal (SSH)
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => navigate('/terminal')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${isNavActive('/terminal') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>Terminal (SSH)</span>
              </div>
            </button>
          )}

          {/* 8. SSL Certificates */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/ssl')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/ssl') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                  <Lock className="w-4 h-4 text-emerald-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                SSL Certificates
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => navigate('/ssl')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${isNavActive('/ssl') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'}`}
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>SSL Certificates</span>
              </div>
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-emerald-400 border-emerald-500/20">acme.sh</Badge>
            </button>
          )}

          {/* 9. Security & Firewall */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/security')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/security') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Firewall & Security
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => navigate('/security')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${isNavActive('/security') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'}`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Firewall & Security</span>
              </div>
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-cyan-400 border-cyan-500/20">UFW</Badge>
            </button>
          )}

          {/* 10. Server / CWP Settings */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/settings/server')}
                  className={`w-full h-10 rounded-xl flex items-center justify-center transition ${isNavActive('/settings/server') || isNavActive('/settings') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                  <Sliders className="w-4 h-4 text-indigo-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Server Settings & Host SSL
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => navigate('/settings/server')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${isNavActive('/settings/server') || isNavActive('/settings') ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'}`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Server Settings & Host SSL</span>
              </div>
            </button>
          )}

        </div>

        {/* Bottom User Profile Section (Full Height, Nothing Hidden) */}
        <div className="p-2 border-t border-zinc-800/80 bg-[#09090b]">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onLogout}
                  title="Log Out (Terminate Session)"
                  className="w-full h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-zinc-800 text-xs">
                Log Out (Root Authority)
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Avatar className="w-7 h-7 ring-1 ring-blue-500/40">
                  <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-[10px]">
                    RT
                  </AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <span className="font-bold text-xs text-white block truncate">Root Authority</span>
                  <span className="text-[10px] text-zinc-500 font-mono block truncate">root@0.0.0.0:2087</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Log Out (Terminate Session)"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </aside>
    </TooltipProvider>
  );
}
