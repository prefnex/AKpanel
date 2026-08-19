import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  Trash2, 
  ExternalLink, 
  ShieldCheck, 
  Key, 
  RefreshCw, 
  Search, 
  Check, 
  Copy,
  Lock,
  Globe,
  Smartphone,
  Server,
  Settings,
  Download
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/ui/select';

export default function ClientEmailsPage({ showToast }) {
  const [emails, setEmails] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeMailbox, setActiveMailbox] = useState(null);

  // Form State
  const [emailUser, setEmailUser] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [password, setPassword] = useState('');
  const [quota, setQuota] = useState(1024);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
      const res = await fetch('/api/client/emails', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setEmails(json.data || []);
      }
    } catch (e) {
      showToast('Network error loading mailboxes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWebsites = async () => {
    try {
      const token = localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
      const res = await fetch('/api/client/websites', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setWebsites(list);
        if (list.length > 0) setSelectedDomain(list[0].domain);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchEmails();
    fetchWebsites();
  }, []);

  const handleCreateEmail = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
      const res = await fetch('/api/client/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email_user: emailUser,
          domain: selectedDomain,
          password,
          quota_mb: parseInt(quota, 10)
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create email');

      showToast('Mailbox created successfully!');
      setIsAddOpen(false);
      setEmailUser('');
      setPassword('');
      fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteEmail = async (email) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      const token = localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
      const res = await fetch(`/api/client/emails?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast('Mailbox deleted');
      fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenConfig = (mailbox) => {
    setActiveMailbox(mailbox);
    setIsConfigOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Business Email Accounts</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Create POP3/IMAP mailboxes with DKIM, SPF, and Webmail client integration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`http://${window.location.hostname}:2087/webmail`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-bold h-10 px-4 rounded-xl transition"
          >
            <Mail className="w-4 h-4 text-purple-400" />
            <span>Open Webmail</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-purple-600/20 gap-1.5"
            disabled={websites.length === 0}
          >
            <Plus className="w-4 h-4" />
            <span>Create Email</span>
          </Button>
        </div>
      </div>

      {/* Mailbox Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {emails.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-zinc-500 text-xs bg-zinc-900/40 border border-zinc-800 rounded-2xl">
            No email accounts configured yet. Click "Create Email" to add a mailbox!
          </div>
        ) : (
          emails.map((m) => (
            <Card key={m.email} className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl hover:border-purple-500/40 transition group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-purple-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm font-mono">{m.email}</span>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      Quota: <code className="text-purple-400">{m.used_mb || 1} MB / {m.quota_mb || 1024} MB</code>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>DKIM/SPF</span>
                  </Badge>

                  <button
                    onClick={() => handleDeleteEmail(m.email)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition"
                    title="Delete Mailbox"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => handleOpenConfig(m)}
                  className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1.5 transition"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mail Client Setup</span>
                </button>
                <a
                  href={`http://${window.location.hostname}:2087/webmail`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-400 hover:underline text-[11px] font-semibold flex items-center gap-1"
                >
                  <span>Launch Webmail</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Mail Client Manual Settings Guide */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-lg rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Mail Client Manual Settings</span>
            </DialogTitle>
          </DialogHeader>

          {activeMailbox && (
            <div className="space-y-4 text-xs pt-2">
              <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl font-mono">
                <span className="text-zinc-500 text-[11px] block">Mailbox Account</span>
                <span className="text-white font-bold text-sm">{activeMailbox.email}</span>
              </div>

              {/* Secure SSL/TLS (Recommended) */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Secure SSL/TLS Settings (Recommended)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300 font-mono pt-1">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Username</span>
                    <strong className="text-white">{activeMailbox.email}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Password</span>
                    <strong className="text-white">[Mailbox Password]</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Incoming Server (IMAP)</span>
                    <span className="text-emerald-300">mail.{activeMailbox.domain}</span> : <strong>Port 993 (SSL/TLS)</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Incoming Server (POP3)</span>
                    <span className="text-emerald-300">mail.{activeMailbox.domain}</span> : <strong>Port 995 (SSL/TLS)</strong>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="text-zinc-500 block text-[10px]">Outgoing Server (SMTP)</span>
                    <span className="text-emerald-300">mail.{activeMailbox.domain}</span> : <strong>Port 465 (SSL/TLS)</strong> or <strong>Port 587 (STARTTLS)</strong>
                  </div>
                </div>
              </div>

              {/* Non-SSL Settings */}
              <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1.5 text-[11px] text-zinc-400 font-mono">
                <span className="text-zinc-500 font-bold text-[10px] uppercase">Non-SSL Settings (Not Recommended)</span>
                <div>Incoming (IMAP): <code>mail.{activeMailbox.domain}</code> : <strong>Port 143</strong></div>
                <div>Incoming (POP3): <code>mail.{activeMailbox.domain}</code> : <strong>Port 110</strong></div>
                <div>Outgoing (SMTP): <code>mail.{activeMailbox.domain}</code> : <strong>Port 587 / 25</strong></div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => {
                const text = `Mail Settings for ${activeMailbox?.email}\nUsername: ${activeMailbox?.email}\nIncoming Server: mail.${activeMailbox?.domain} (IMAP: 993 SSL, POP3: 995 SSL)\nOutgoing Server: mail.${activeMailbox?.domain} (SMTP: 465 SSL / 587 TLS)`;
                navigator.clipboard.writeText(text);
                showToast('Configuration copied to clipboard!');
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Settings</span>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsConfigOpen(false)} className="rounded-xl text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Create Email */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-purple-400" />
              <span>Create Mailbox Account</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateEmail} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Username</label>
                <Input
                  value={emailUser}
                  onChange={(e) => setEmailUser(e.target.value)}
                  placeholder="e.g. info or contact"
                  className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain</label>
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-xs rounded-xl h-10 text-white font-mono">
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl shadow-2xl">
                    {websites.map((w) => (
                      <SelectItem key={w.domain} value={w.domain} className="text-xs font-mono">
                        @{w.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Strong mailbox password"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Storage Quota (MB)</label>
              <Input
                type="number"
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 rounded-xl shadow-lg shadow-purple-600/20">
                Provision Mailbox
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
