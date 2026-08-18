import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Key, 
  RefreshCw, 
  Lock, 
  Search, 
  Check, 
  Copy,
  Users
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

export default function ClientDatabasesPage({ showToast, username }) {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [dbSuffix, setDbSuffix] = useState('');
  const [dbUserSuffix, setDbUserSuffix] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const fetchDatabases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client/databases');
      if (res.ok) {
        const json = await res.json();
        setDatabases(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (showToast) showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setDbPassword(pass);
  };

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/client/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database_name: dbSuffix.trim(),
          database_user: dbUserSuffix.trim() || dbSuffix.trim(),
          password: dbPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      setIsAddOpen(false);
      setDbSuffix('');
      setDbUserSuffix('');
      setDbPassword('');
      fetchDatabases();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDeleteDatabase = async (dbName) => {
    if (!confirm(`Are you sure you want to completely DROP database '${dbName}'? ALL DATA WILL BE LOST!`)) return;
    try {
      const res = await fetch('/api/client/databases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database_name: dbName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast(json.message);
      fetchDatabases();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const filtered = databases.filter(d => d.database_name.toLowerCase().includes(search.toLowerCase()));

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">MySQL Databases & Users</h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Create isolated MariaDB databases, manage DB users, and launch phpMyAdmin with 1-click SSO.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleLaunchPhpMyAdmin}
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs h-10 px-4 rounded-xl transition"
          >
            <Database className="w-4 h-4" />
            <span>Launch phpMyAdmin</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </Button>

          <Button
            onClick={() => {
              handleGeneratePassword();
              setIsAddOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-blue-600/20 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Database</span>
          </Button>
        </div>
      </div>

      {/* Databases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-zinc-500 text-xs bg-zinc-900/40 border border-zinc-800 rounded-2xl">
            No MySQL databases found. Click "Create Database" to provision one!
          </div>
        ) : (
          filtered.map((db) => (
            <Card key={db.database_name} className="bg-zinc-900/60 border-zinc-800/80 p-5 rounded-2xl backdrop-blur-xl hover:border-blue-500/40 transition group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm font-mono">{db.database_name}</span>
                      <button
                        onClick={() => handleCopy(db.database_name, `db_${db.database_name}`)}
                        className="text-zinc-500 hover:text-zinc-300 p-0.5"
                      >
                        {copiedKey === `db_${db.database_name}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3 h-3 text-zinc-500" />
                      <span>User: <code className="text-zinc-300">{db.database_user || `${username}_user`}</code></span>
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleDeleteDatabase(db.database_name)}
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:text-rose-400 p-1.5 h-auto rounded-lg"
                  title="Drop Database"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Badge className="bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                    {db.charset || 'utf8mb4'}
                  </Badge>
                  <span className="text-[10px] font-mono text-zinc-500">Host: 127.0.0.1</span>
                </div>
                <button
                  onClick={handleLaunchPhpMyAdmin}
                  className="text-amber-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage in phpMyAdmin</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Create Database */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#0f1015] border-zinc-800 text-white max-w-md rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Plus className="w-5 h-5 text-blue-400" />
              <span>Create New MySQL Database & User</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateDatabase} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Database Name</label>
              <div className="flex items-center">
                <span className="bg-zinc-900 border border-r-0 border-zinc-800 text-zinc-400 text-xs px-3 h-10 flex items-center rounded-l-xl font-mono">
                  {username}_
                </span>
                <Input
                  value={dbSuffix}
                  onChange={(e) => setDbSuffix(e.target.value)}
                  placeholder="dbname"
                  className="bg-zinc-950 border-zinc-800 text-xs rounded-l-none rounded-r-xl font-mono h-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Database User (Optional Suffix)</label>
              <div className="flex items-center">
                <span className="bg-zinc-900 border border-r-0 border-zinc-800 text-zinc-400 text-xs px-3 h-10 flex items-center rounded-l-xl font-mono">
                  {username}_
                </span>
                <Input
                  value={dbUserSuffix}
                  onChange={(e) => setDbUserSuffix(e.target.value)}
                  placeholder="user (defaults to dbname)"
                  className="bg-zinc-950 border-zinc-800 text-xs rounded-l-none rounded-r-xl font-mono h-10"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-300 block">Password</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-blue-400 hover:underline font-semibold"
                >
                  Generate Strong
                </button>
              </div>
              <Input
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                placeholder="Database Password"
                className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono h-10"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 rounded-xl shadow-lg shadow-blue-600/20">
                Provision Database
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
