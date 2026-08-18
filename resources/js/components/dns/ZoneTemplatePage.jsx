import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FileCode, 
  Plus, 
  Trash2, 
  Save, 
  Sparkles, 
  Info, 
  Check, 
  Copy, 
  Star, 
  StarOff, 
  CopyCheck, 
  Layers 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

export default function ZoneTemplatePage({ showToast }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');

  // New Template Form
  const [newTplName, setNewTplName] = useState('');
  const [newTplDesc, setNewTplDesc] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dns/templates');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setTemplates(list);
        if (list.length > 0) {
          const current = selectedTemplateId 
            ? list.find(t => t.id === selectedTemplateId) || list[0]
            : list.find(t => t.is_default) || list[0];
          setSelectedTemplateId(current.id);
          setActiveTemplate(current);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplateId(tpl.id);
    setActiveTemplate({ ...tpl });
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/dns/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTemplate),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      const res = await fetch('/api/dns/template/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Are you sure you want to delete this DNS zone template?')) return;
    try {
      const res = await fetch('/api/dns/template/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const defaultContent = activeTemplate?.content || `; ====================================================================
; Custom DNS Zone Template
; Variables: %domain%, %ip%, %ns1%, %ns2%, %dns-email%, %serial%
; ====================================================================
$TTL 14400
@ IN SOA %ns1%. %dns-email%. (
    %serial%
    3600
    1800
    604800
    86400
)

@ IN NS %ns1%.
@ IN NS %ns2%.
@ IN A %ip%
www IN CNAME %domain%.
mail IN A %ip%
@ IN MX 10 mail.%domain%.
@ IN TXT "v=spf1 +a +mx +ip4:%ip% ~all"
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@%domain%"
@ IN CAA 0 issue "letsencrypt.org"
`;

      const newTpl = {
        name: newTplName,
        description: newTplDesc,
        content: defaultContent,
        is_default: false,
      };

      const res = await fetch('/api/dns/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTpl),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsCreateOpen(false);
      setNewTplName('');
      setNewTplDesc('');
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const copyToken = (tok) => {
    navigator.clipboard.writeText(tok);
    setCopiedToken(tok);
    showToast(`Token ${tok} copied!`);
    setTimeout(() => setCopiedToken(''), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-yellow-950/20 border border-amber-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/30">
            <FileCode className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">DNS Zone Templates Manager</h1>
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs font-semibold px-2.5 py-0.5">
                Root WHM Template Engine
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                {templates.length} Templates Configured
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Create, customize, and maintain DNS master templates applied when new client accounts or domains are provisioned.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-amber-600/20 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </Button>
      </div>

      {/* Placeholders Quick Reference Bar */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 p-4 rounded-xl space-y-2">
        <div className="text-xs font-bold text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span>Dynamic Zone Variables (Click token to copy into editor):</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {[
            { token: '%domain%', desc: 'Domain Name (e.g. client.com)' },
            { token: '%ip%', desc: 'Client/Server IPv4' },
            { token: '%ns1%', desc: 'Primary NS1' },
            { token: '%ns2%', desc: 'Secondary NS2' },
            { token: '%dns-email%', desc: 'SOA Admin Email' },
            { token: '%serial%', desc: 'Timestamp Serial' },
          ].map((t) => (
            <button
              key={t.token}
              onClick={() => copyToken(t.token)}
              className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded-lg text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5"
            >
              <span>{t.token}</span>
              <span className="text-[10px] text-zinc-500 font-sans">({t.desc})</span>
              {copiedToken === t.token ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-600" />}
            </button>
          ))}
        </div>
      </Card>

      {/* Main Grid: Template List on Left, Editor on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Template Cards List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Available Templates ({templates.length})
          </div>
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              onClick={() => handleSelectTemplate(tpl)}
              className={`p-4 rounded-xl cursor-pointer transition border backdrop-blur-md ${
                selectedTemplateId === tpl.id
                  ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-xs">{tpl.name}</span>
                {tpl.is_default && (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 mb-3">
                {tpl.description || 'Custom DNS Zone structure.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                {!tpl.is_default ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(tpl.id);
                    }}
                    className="text-zinc-400 hover:text-amber-400 flex items-center gap-1 font-medium"
                  >
                    <Star className="w-3 h-3" />
                    <span>Set Default</span>
                  </button>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1 font-bold">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>Active Default</span>
                  </span>
                )}

                {templates.length > 1 && !tpl.is_default && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(tpl.id);
                    }}
                    className="text-zinc-500 hover:text-rose-400 p-1"
                    title="Delete Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Right Column: Template Monaco Editor */}
        <div className="lg:col-span-2">
          {activeTemplate ? (
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div className="space-y-1 flex-1">
                  <Input
                    value={activeTemplate.name}
                    onChange={(e) => setActiveTemplate({ ...activeTemplate, name: e.target.value })}
                    placeholder="Template Name"
                    className="bg-zinc-950 border-zinc-800 font-bold text-sm text-white h-9 rounded-xl max-w-sm"
                  />
                  <Input
                    value={activeTemplate.description}
                    onChange={(e) => setActiveTemplate({ ...activeTemplate, description: e.target.value })}
                    placeholder="Template Description"
                    className="bg-zinc-950 border-zinc-800 text-xs text-zinc-400 h-8 rounded-xl"
                  />
                </div>

                <Button
                  onClick={handleSaveTemplate}
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-lg shadow-amber-600/20"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
                </Button>
              </div>

              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                <Editor
                  height="450px"
                  language="ini"
                  theme="vs-dark"
                  value={activeTemplate.content}
                  onChange={(val) => setActiveTemplate({ ...activeTemplate, content: val || '' })}
                  options={{
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                  }}
                />
              </div>
            </Card>
          ) : (
            <Card className="bg-zinc-900/60 border-zinc-800/80 p-12 text-center text-zinc-500 rounded-2xl">
              Select or create a template to start editing.
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Create Template */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Create New DNS Zone Template</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTemplate} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Template Name</label>
              <Input
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                placeholder="e.g. Node.js & Reverse Proxy Template"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Description</label>
              <Input
                value={newTplDesc}
                onChange={(e) => setNewTplDesc(e.target.value)}
                placeholder="Brief explanation of when to apply this template"
                className="bg-zinc-900 border-zinc-800 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-5 rounded-xl">Create Template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
