import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  ArrowLeft, 
  Compass, 
  Layers, 
  FileCode, 
  Users, 
  Globe, 
  Database, 
  Terminal, 
  FolderTree, 
  ShieldAlert,
  Sparkles,
  Server
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const quickLinks = [
    { title: 'DNS Zones Manager', desc: 'All users & root server zones', path: '/dns/zones', icon: Layers, color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'hover:bg-cyan-950/30' },
    { title: 'DNS Zone Templates', desc: 'Manage default & custom templates', path: '/dns/templates', icon: FileCode, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'hover:bg-amber-950/30' },
    { title: 'BIND 9 Engine', desc: 'Server daemon lifecycle & options', path: '/dns/server', icon: Server, color: 'text-violet-400', border: 'border-violet-500/20', bg: 'hover:bg-violet-950/30' },
    { title: 'User Accounts', desc: 'Multi-tenant client accounts', path: '/users', icon: Users, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'hover:bg-emerald-950/30' },
    { title: 'Virtual Hosts', desc: 'Websites, domains & vhosts', path: '/websites', icon: Globe, color: 'text-blue-400', border: 'border-blue-500/20', bg: 'hover:bg-blue-950/30' },
    { title: 'Databases Suite', desc: 'MySQL, PostgreSQL, Redis, Mongo', path: '/databases', icon: Database, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'hover:bg-rose-950/30' },
    { title: 'File Manager', desc: 'Server explorer & code editor', path: '/filemanager', icon: FolderTree, color: 'text-indigo-400', border: 'border-indigo-500/20', bg: 'hover:bg-indigo-950/30' },
    { title: 'Web Terminal', desc: 'Root SSH console & shell', path: '/terminal', icon: Terminal, color: 'text-teal-400', border: 'border-teal-500/20', bg: 'hover:bg-teal-950/30' },
  ];

  return (
    <div className="min-h-[78vh] flex flex-col items-center justify-center p-4 max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      {/* 404 Hero Card */}
      <Card className="w-full bg-gradient-to-b from-zinc-900/90 via-zinc-900/60 to-zinc-950/90 border border-zinc-800/80 p-8 sm:p-12 rounded-3xl shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>HTTP 404 : PAGE NOT FOUND</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-7xl sm:text-9xl font-black tracking-tighter bg-gradient-to-r from-white via-zinc-200 to-zinc-600 bg-clip-text text-transparent drop-shadow-2xl">
              404
            </h1>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Oops! The page you are looking for does not exist.
            </h2>
            <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
              The requested URI <code className="text-cyan-300 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-xs font-mono">{location.pathname}</code> was not found on this server instance. It may have been moved or removed.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <Button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs h-11 px-6 rounded-2xl shadow-xl shadow-cyan-600/20 gap-2 border border-cyan-400/30 transition-all hover:scale-105"
            >
              <Home className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>

            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs h-11 px-5 rounded-2xl gap-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Navigation Hub */}
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Quick Navigation Hub</h3>
          </div>
          <span className="text-xs text-zinc-500">Pick a module to jump right in</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Card
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`p-4 rounded-2xl cursor-pointer transition border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md ${link.bg} hover:border-zinc-700 hover:scale-[1.02] group`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-zinc-950 border ${link.border} flex items-center justify-center ${link.color} shadow-inner`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition truncate">
                      {link.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {link.desc}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
