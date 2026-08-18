import React from 'react';
import { RotateCw, ExternalLink, Trash2, Globe, Plus, ShieldCheck, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';

export default function WebsitesTable({ websites, onRefresh, onSwitchEngine, onDeleteSite, onOpenModal }) {
  return (
    <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Header */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Managed Virtual Hosts & Domains</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-0.5">Switch web engines dynamically per virtual host.</CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={onRefresh} 
            className="rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 gap-1.5 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          
          <Button 
            size="sm"
            onClick={onOpenModal} 
            className="rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Website</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-900/60 uppercase text-[10px] text-zinc-400 border-b border-zinc-800/80 font-semibold tracking-wider">
            <tr>
              <th className="py-3.5 px-5">Domain & SSL</th>
              <th className="py-3.5 px-5">Server Engine (shadcn Select)</th>
              <th className="py-3.5 px-5">Framework Preset</th>
              <th className="py-3.5 px-5">PHP Runtime</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans">
            {websites.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-14 text-zinc-500">
                  <Globe className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="font-semibold text-zinc-400">No websites configured yet</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Deploy your first site using one of the 10 ready templates!</p>
                </td>
              </tr>
            ) : (
              websites.map(site => (
                <tr key={site.id} className="hover:bg-zinc-900/40 transition">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold text-sm text-white">{site.domain}</div>
                        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>{site.ssl_active ? 'SSL Active (Let\'s Encrypt)' : 'HTTP Standard'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Official shadcn Select with checkmark */}
                  <td className="py-4 px-5 w-60">
                    <Select 
                      value={site.server_engine || 'nginx'} 
                      onValueChange={(val) => onSwitchEngine(site.domain, val)}
                    >
                      <SelectTrigger className="h-8 bg-zinc-900 border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200 text-xs">
                        <SelectItem value="nginx">⚡ Pure Nginx</SelectItem>
                        <SelectItem value="apache">🔴 Pure Apache</SelectItem>
                        <SelectItem value="hybrid">🚀 Hybrid (Nginx+Apache)</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="py-4 px-5">
                    <Badge variant="secondary" className="bg-violet-500/10 text-violet-400 font-mono uppercase font-bold text-[10px]">
                      {site.template_id || 'laravel'}
                    </Badge>
                  </td>

                  <td className="py-4 px-5 text-xs font-mono text-zinc-400">
                    {site.site_type === 'php' ? (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        PHP {site.php_version}
                      </span>
                    ) : 'Static / Proxy'}
                  </td>

                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a 
                        href={`http://${site.domain}:8080`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Visit</span>
                      </a>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => onDeleteSite(site.domain)} 
                        className="rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-400 text-xs gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
