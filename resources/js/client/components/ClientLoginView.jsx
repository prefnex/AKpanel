import React, { useState } from 'react';
import { 
  Globe, 
  Lock, 
  User, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck,
  Server,
  ExternalLink
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export default function ClientLoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      localStorage.setItem('ak_client_token', data.token);
      localStorage.setItem('akpanel_client_token', data.token);
      localStorage.setItem('ak_client_user', JSON.stringify(data.user));
      localStorage.setItem('akpanel_client_user', JSON.stringify(data.user));
      if (onLoginSuccess) {
        onLoginSuccess(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (user, pass) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-[#07080b] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-600/30 border border-emerald-400/30 mb-2">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>AKpanel</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-bold px-2 py-0.5">
              Client Portal
            </Badge>
          </h1>
          <p className="text-zinc-400 text-xs">
            Enter your credentials to manage your hosted websites and services.
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-zinc-950/80 border-zinc-800/80 p-6 rounded-3xl backdrop-blur-2xl shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">Account Username or Domain</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <Input
                  type="text"
                  placeholder="e.g. client1 or admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 bg-zinc-900/90 border-zinc-800 text-xs h-10 rounded-xl text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-zinc-900/90 border-zinc-800 text-xs h-10 rounded-xl text-white font-mono"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs h-11 rounded-xl shadow-lg shadow-emerald-600/20 transition gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Client Panel'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </Card>

        {/* Link to Root WHM */}
        <div className="text-center">
          <a
            href={`http://${window.location.hostname}:2087`}
            className="text-xs text-zinc-400 hover:text-purple-400 transition inline-flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Are you a Server Administrator? Switch to WHM Root (Port 2087)</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
}
