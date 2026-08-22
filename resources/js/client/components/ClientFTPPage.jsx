import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Plus, 
  Trash2, 
  Key, 
  Folder, 
  ShieldCheck, 
  Copy, 
  Check, 
  RefreshCw, 
  Lock, 
  Terminal, 
  Globe, 
  UserCheck, 
  HelpCircle 
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

export default function ClientFTPPage({ showToast, username, serverIP }) {
  const [ftpUsers, setFTPUsers] = useState([]);
  const [serverInfo, setServerInfo] = useState({ host: serverIP || '', port: 21, tls_enabled: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const [newFTPUser, setNewFTPUser] = useState('');
  const [newFTPPass, setNewFTPPass] = useState('');
  const [newSubDir, setNewSubDir] = useState('/public_html');
  const [newQuotaMB, setNewQuotaMB] = useState(1024);

  const token = localStorage.getItem('akpanel_client_token');

  const fetchFTPUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client/ftp', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) {
        setFTPUsers(data.data || data.ftp_users || []);
        if (data.server) {
          setServerInfo(data.server);
        }
      }
    } catch (err) {
      showToast('Failed to load FTP accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFTPUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newFTPUser || !newFTPPass) {
      showToast('FTP username and password are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/client/ftp/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ftp_user: newFTPUser,
          password: newFTPPass,
          sub_dir: newSubDir,
          quota_mb: parseInt(newQuotaMB) || 1024
        })
      });
      const data = await res.json();
      if (data.status) {
        showToast(data.message || 'FTP account created!', 'success');
        setIsCreateOpen(false);
        setNewFTPUser('');
        setNewFTPPass('');
        fetchFTPUsers();
      } else {
        showToast(data.message || 'Creation failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ftpUser) => {
    if (!confirm(`Are you sure you want to delete FTP user '${ftpUser}'?`)) return;

    try {
      const res = await fetch('/api/client/ftp/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ftp_user: ftpUser })
      });
      const data = await res.json();
      if (data.status) {
        showToast('FTP user deleted', 'success');
        fetchFTPUsers();
      } else {
        showToast(data.message || 'Delete failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const ftpHost = serverInfo.host || serverIP || '127.0.0.1';
  const ftpPort = serverInfo.port || 21;
  const tlsReady = !!serverInfo.tls_enabled;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Connect Info */}
      <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">FTP Accounts & Jailed Access</h2>
            <Badge variant="outline" className={`text-xs ${tlsReady ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-amber-950/40 text-amber-400 border-amber-500/30'}`}>
              {tlsReady ? 'FTPS Enabled' : 'Plain FTP (TLS pending)'}
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Manage chrooted FTP accounts for uploading files via FileZilla, Cyberduck, or WinSCP.</p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-lg shadow-emerald-950">
          <Plus className="w-4 h-4" /> Add FTP Account
        </Button>
      </div>

      {/* Connection Parameter Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">FTP Server Host</span>
            <p className="text-sm font-mono font-bold text-white mt-0.5">{ftpHost}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(ftpHost, 'host')} className="text-zinc-400 hover:text-white">
            {copiedField === 'host' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">FTP Port</span>
            <p className="text-sm font-mono font-bold text-white mt-0.5">{ftpPort}{tlsReady ? ' (FTPS)' : ''}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(String(ftpPort), 'port')} className="text-zinc-400 hover:text-white">
            {copiedField === 'port' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Default User</span>
            <p className="text-sm font-mono font-bold text-emerald-400 mt-0.5">{username || 'admin'}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(username || 'admin', 'user')} className="text-zinc-400 hover:text-white">
            {copiedField === 'user' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Jail Root</span>
            <p className="text-sm font-mono font-bold text-cyan-400 mt-0.5">/home/{username || 'user'}</p>
          </div>
          <Badge className="bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 text-[10px]">Chrooted</Badge>
        </div>
      </div>

      {/* FTP Accounts Table */}
      <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Configured FTP Users</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchFTPUsers} className="text-zinc-400 hover:text-white p-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              <span>Loading accounts...</span>
            </div>
          ) : ftpUsers.filter((u) => !u.is_primary).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <Server className="w-10 h-10 text-zinc-700" />
              <p className="text-sm">No extra FTP sub-accounts yet. Your primary login is listed above.</p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="bg-emerald-600 text-xs text-white mt-1">
                Create First FTP User
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">FTP Login</th>
                  <th className="py-3 px-4">Home Path (Jail)</th>
                  <th className="py-3 px-4">Quota</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {ftpUsers.map((u, i) => (
                  <tr key={i} className="hover:bg-zinc-900/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                      {u.username}
                      {u.is_primary && (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">Primary</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      {u.home_dir || `/home/${username}/public_html`}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {u.quota_mb ? `${u.quota_mb} MB` : 'Unlimited'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-500 text-[11px]">
                      {u.created_at}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!u.is_primary && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDelete(u.username)}
                        className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Server className="w-5 h-5 text-emerald-400" /> Create FTP Account
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-zinc-400 font-medium">Username Suffix</label>
              <div className="flex items-center mt-1">
                <span className="bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-400 border border-r-0 border-zinc-700 rounded-l-lg">
                  {username}_
                </span>
                <Input 
                  value={newFTPUser}
                  onChange={(e) => setNewFTPUser(e.target.value)}
                  placeholder="ftpuser" 
                  className="rounded-l-none bg-zinc-950 border-zinc-700"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">FTP Password</label>
              <Input 
                type="password"
                value={newFTPPass}
                onChange={(e) => setNewFTPPass(e.target.value)}
                placeholder="••••••••••••" 
                className="mt-1 bg-zinc-950 border-zinc-700"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium">Jailed Directory</label>
              <Input 
                value={newSubDir}
                onChange={(e) => setNewSubDir(e.target.value)}
                placeholder="/public_html" 
                className="mt-1 bg-zinc-950 border-zinc-700 font-mono text-xs"
              />
              <p className="text-[11px] text-zinc-500 mt-1">Relative to your home directory (/home/{username})</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                {submitting ? 'Creating…' : 'Create FTP User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
