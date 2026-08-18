import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Key, 
  Terminal, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  Eye,
  EyeOff,
  Server
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter root username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();
      if (!res.ok || !json.status) {
        throw new Error(json.message || 'Invalid root credentials');
      }

      // Save token to localStorage
      if (json.token) {
        localStorage.setItem('ak_token', json.token);
      }
      if (json.user) {
        localStorage.setItem('ak_user', JSON.stringify(json.user));
      }

      onLoginSuccess(json.user, json.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
      />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 border border-blue-400/30 mb-2">
            <ShieldCheck className="w-8 h-8 text-white animate-pulse" />
          </div>
          
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>AKpanel</span>
            <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-bold tracking-wider">
              Root Authority
            </span>
          </h1>

          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            High-Security Server Management Console • Port: 2087
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-[#121215]/90 backdrop-blur-xl border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Status Indicator */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Daemon Online</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 text-zinc-400">
              Ubuntu 22.04 LTS
            </Badge>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>Root Username</span>
                <span className="text-[10px] text-zinc-500 font-mono">root / admin</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="root"
                  required
                  className="pl-10 h-11 bg-zinc-950/80 border-zinc-800 focus:border-blue-500 rounded-2xl text-sm font-mono text-white placeholder:text-zinc-600 transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span>Root Password</span>
                <span className="text-[10px] text-zinc-500 font-mono">Server Passphrase</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="pl-10 pr-10 h-11 bg-zinc-950/80 border-zinc-800 focus:border-blue-500 rounded-2xl text-sm font-mono text-white placeholder:text-zinc-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 gap-2 transition active:scale-[0.98] mt-2"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Verifying Root Authority...</span>
                </>
              ) : (
                <>
                  <span>Authenticate & Enter Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 text-center">
            <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Protected by HMAC-SHA256 Encrypted Session Token</span>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-zinc-600 text-xs font-mono space-y-1">
          <p>© 2026 AKpanel Linux Authority. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
