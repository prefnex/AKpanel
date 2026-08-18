import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Moon, 
  Settings, 
  PanelLeft, 
  Calendar, 
  Plus,
  LogOut,
  ShieldCheck,
  Key,
  User,
  Check,
  AlertCircle,
  Globe
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';

export default function Header({ hostname, onOpenModal, onToggleSidebar, onLogout, showToast }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [passError, setPassError] = useState('');

  const handleLogoutClick = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem('ak_token');
      localStorage.removeItem('ak_user');
      if (onLogout) onLogout();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPassError('Password must be at least 6 characters');
      return;
    }

    setIsSavingPass(true);
    setPassError('');

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      if (showToast) showToast('Root password updated successfully!');
      setIsPassModalOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(err.message);
    } finally {
      setIsSavingPass(false);
    }
  };

  return (
    <>
      <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-[#0c0c0e]/90 backdrop-blur-md shrink-0 select-none relative z-30">
        
        {/* Left: Toggle & Search Bar */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onToggleSidebar}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800/80 transition"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="relative flex items-center w-64 md:w-80">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3" />
            <input 
              type="text" 
              placeholder="Search servers, sites, databases..." 
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-8 pr-12 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
            <span className="absolute right-2.5 px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] font-mono text-zinc-400">
              ⌘K
            </span>
          </div>
        </div>

        {/* Right: Date/Node pill, Alerts, User Profile */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300 font-mono">
            <Calendar className="w-3 h-3 text-zinc-500" />
            <span>{hostname || 'Ubuntu 22.04 LTS (Port: 2087)'}</span>
          </div>

          <Button 
            size="sm"
            onClick={onOpenModal} 
            className="h-8 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Website</span>
          </Button>

          <div className="flex items-center gap-1 pl-2 border-l border-zinc-800">
            <button className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 relative transition">
              <Bell className="w-4 h-4" />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-zinc-950" />
            </button>
          </div>

          {/* Client Portal Port 2083 Link */}
          <a
            href={`http://${window.location.hostname}:2083`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm"
            title="Open Client / Tenant User Portal on Port 2083"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Client Portal</span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[9px] px-1 py-0 font-mono">
              2083
            </Badge>
          </a>

          {/* User Profile Menu */}
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-zinc-900 transition border border-transparent hover:border-zinc-800"
            >
              <Avatar className="w-7 h-7 ring-1 ring-blue-500/40">
                <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-[10px]">
                  RT
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-none flex items-center gap-1">
                  <span>root</span>
                  <Badge className="bg-blue-500/10 border-blue-500/30 text-blue-400 text-[9px] px-1 py-0 font-mono">
                    SUPERUSER
                  </Badge>
                </span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#121215] border border-zinc-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1 animate-in fade-in">
                <div className="p-2 border-b border-zinc-800 text-xs">
                  <span className="font-bold text-white block">Root Authority</span>
                  <span className="text-[11px] text-zinc-500 font-mono">Host: 0.0.0.0:2087</span>
                </div>

                <button
                  onClick={() => { setIsPassModalOpen(true); setIsDropdownOpen(false); }}
                  className="w-full px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 transition"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Change Root Password</span>
                </button>

                <button
                  onClick={handleLogoutClick}
                  className="w-full px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out (Terminate Session)</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </header>

      {/* Change Password Modal */}
      <Dialog open={isPassModalOpen} onOpenChange={setIsPassModalOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 text-white rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Change Root Administrator Password</span>
            </DialogTitle>
          </DialogHeader>

          {passError && (
            <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Current Root Password</label>
              <Input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">New Root Password</label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Confirm New Password</label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-zinc-950 border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPassModalOpen(false)}
                className="rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingPass}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20"
              >
                {isSavingPass ? 'Saving...' : 'Update Root Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
