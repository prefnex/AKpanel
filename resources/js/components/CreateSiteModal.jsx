import React from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';

export default function CreateSiteModal({ 
  isOpen, 
  onClose, 
  templates, 
  formData, 
  setFormData, 
  onSubmit, 
  loading,
  onTemplateSelect 
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#121215] rounded-3xl max-w-2xl w-full p-6 border border-zinc-800 shadow-2xl text-white">
        
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-zinc-800">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Deploy Website from Preset</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-3 space-y-4 text-xs">
          {/* Domain */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Domain Name</label>
            <Input 
              type="text" 
              required 
              placeholder="my-domain.com"
              value={formData.domain}
              onChange={(e) => setFormData({...formData, domain: e.target.value})}
              className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-500 font-mono"
            />
          </div>

          {/* Web Server Engine */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Web Server Engine</label>
            <div className="grid grid-cols-3 gap-2.5">
              <button 
                type="button" 
                onClick={() => setFormData({...formData, server_engine: 'nginx'})}
                className={`p-3 rounded-2xl border text-left transition ${
                  formData.server_engine === 'nginx' 
                    ? 'border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500/40' 
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-bold text-xs">⚡ Pure Nginx</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">FastCGI Socket</div>
              </button>

              <button 
                type="button" 
                onClick={() => setFormData({...formData, server_engine: 'apache'})}
                className={`p-3 rounded-2xl border text-left transition ${
                  formData.server_engine === 'apache' 
                    ? 'border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500/40' 
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-bold text-xs">🔴 Apache Backend</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Nginx Front + Full .htaccess</div>
              </button>

              <button 
                type="button" 
                onClick={() => setFormData({...formData, server_engine: 'hybrid'})}
                className={`p-3 rounded-2xl border text-left transition ${
                  formData.server_engine === 'hybrid' 
                    ? 'border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500/40' 
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-bold text-xs">🚀 Hybrid Engine</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Nginx + Apache</div>
              </button>
            </div>
          </div>

          {/* 10 Ready Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Choose Framework Preset</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
              {templates.map(tpl => (
                <button 
                  type="button" 
                  key={tpl.id}
                  onClick={() => onTemplateSelect(tpl)}
                  className={`p-2.5 rounded-xl border text-left transition relative ${
                    formData.template_id === tpl.id 
                      ? 'border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500/40' 
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {formData.template_id === tpl.id && (
                    <Check className="w-3.5 h-3.5 text-violet-400 absolute top-2 right-2" />
                  )}
                  <div className="text-xs font-bold truncate pr-3">{tpl.name}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">{tpl.category}</div>
                </button>
              ))}
            </div>
          </div>

          {/* PHP Version via shadcn Select */}
          {formData.site_type === 'php' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">PHP Version</label>
              <Select 
                value={formData.php_version}
                onValueChange={(val) => setFormData({...formData, php_version: val})}
              >
                <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800 rounded-xl text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-xs">
                  <SelectItem value="8.2">PHP 8.2 (Recommended)</SelectItem>
                  <SelectItem value="8.3">PHP 8.3 (Latest)</SelectItem>
                  <SelectItem value="8.1">PHP 8.1</SelectItem>
                  <SelectItem value="8.0">PHP 8.0</SelectItem>
                  <SelectItem value="7.4">PHP 7.4 (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button 
              type="button" 
              variant="outline"
              onClick={onClose} 
              className="rounded-xl border-zinc-800 text-zinc-300 text-xs"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow-md"
            >
              {loading ? 'Deploying...' : 'Deploy Website'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
