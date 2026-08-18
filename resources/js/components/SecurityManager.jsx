import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, ShieldAlert, Plus, RotateCcw, Check, Sparkles, Server } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export default function SecurityManager({ showToast }) {
  const [firewallRules, setFirewallRules] = useState([]);
  const [isFirewallActive, setIsFirewallActive] = useState(true);
  const [isSSLModalOpen, setIsSSLModalOpen] = useState(false);
  const [sslForm, setSslForm] = useState({ domain: '', email: '' });
  const [loading, setLoading] = useState(false);

  const fetchFirewall = async () => {
    try {
      const res = await fetch('/api/security/firewall');
      if (res.ok) {
        const json = await res.json();
        setFirewallRules(json.data || []);
        setIsFirewallActive(json.is_active);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFirewall();
  }, []);

  const handleIssueSSL = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/security/ssl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sslForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      setIsSSLModalOpen(false);
      setSslForm({ domain: '', email: '' });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePort = async (port, currentAction) => {
    const newAllow = (currentAction !== 'ALLOW');
    try {
      const res = await fetch('/api/security/firewall/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, allow: newAllow }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      showToast(json.message);
      fetchFirewall();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>SSL & Security / UFW Firewall Manager</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Issue Let's Encrypt certificates, configure firewall ports, and secure web applications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsSSLModalOpen(true)}
            className="rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold gap-1.5 shadow-sm"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Issue SSL Certificate</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold">UFW Firewall</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">Protected</div>
            <p className="text-[11px] text-zinc-500 mt-1">Default policy: DENY incoming, ALLOW outgoing</p>
          </div>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold">SSL / TLS Engine</span>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">acme.sh</Badge>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">acme.sh Active</div>
            <p className="text-[11px] text-zinc-500 mt-1">Let's Encrypt / ZeroSSL with auto fallback & cron renewal</p>
          </div>
        </Card>

        <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold">Fail2ban Brute Force</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Armed</Badge>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-mono">0 Banned IPs</div>
            <p className="text-[11px] text-zinc-500 mt-1">Monitoring SSH & Web ports</p>
          </div>
        </Card>
      </div>

      {/* Firewall Rules Table */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-white">Firewall Port Rules (UFW)</CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">Control open network ports and protocols.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFirewall} className="rounded-xl border-zinc-800 bg-zinc-900 text-xs gap-1.5">
            <RotateCcw className="w-3 h-3" />
            <span>Refresh</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/60 uppercase text-[10px] text-zinc-400 border-b border-zinc-800/80 font-semibold tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Port & Protocol</th>
                <th className="py-3.5 px-5">Description</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Toggle Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {firewallRules.map(rule => (
                <tr key={rule.port} className="hover:bg-zinc-900/40 transition">
                  <td className="py-4 px-5 font-bold text-white font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Port {rule.port} ({rule.protocol})</span>
                  </td>
                  <td className="py-4 px-5 text-zinc-400">{rule.comment}</td>
                  <td className="py-4 px-5">
                    <Badge variant={rule.action === 'ALLOW' ? 'secondary' : 'destructive'} className={rule.action === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-400' : ''}>
                      {rule.action}
                    </Badge>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <Switch 
                      checked={rule.action === 'ALLOW'}
                      onCheckedChange={() => handleTogglePort(rule.port, rule.action)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SSL Issue Modal */}
      <Dialog open={isSSLModalOpen} onOpenChange={setIsSSLModalOpen}>
        <DialogContent className="bg-[#121215] border-zinc-800 rounded-3xl p-6 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              <span>Issue Let's Encrypt SSL Certificate</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleIssueSSL} className="space-y-4 text-xs mt-3">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Domain Name</label>
              <Input 
                type="text" 
                required 
                placeholder="mycoolsite.com"
                value={sslForm.domain}
                onChange={(e) => setSslForm({...sslForm, domain: e.target.value})}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Admin Email (For Expire Notices)</label>
              <Input 
                type="email" 
                placeholder="admin@mycoolsite.com"
                value={sslForm.email}
                onChange={(e) => setSslForm({...sslForm, email: e.target.value})}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setIsSSLModalOpen(false)} className="rounded-xl border-zinc-800 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs">
                {loading ? 'Requesting Let\'s Encrypt...' : 'Issue SSL Free'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
