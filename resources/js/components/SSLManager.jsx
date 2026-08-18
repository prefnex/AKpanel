import React, { useState, useEffect } from 'react';
import {
  Lock, 
  ShieldCheck, 
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Globe, 
  FileText, 
  Key, 
  ExternalLink, 
  Clock, 
  Zap, 
  Calendar,
  Search,
  Upload,
  RotateCw
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function SSLManager({ showToast }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);

  const [issueForm, setIssueForm] = useState({ domain: '', email: '' });
  const [customForm, setCustomForm] = useState({
    domain: '',
    certificate: '',
    private_key: '',
    ca_bundle: ''
  });

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ssl/certificates');
      if (res.ok) {
        const json = await res.json();
        setCerts(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleIssueSSL = async (e) => {
    e.preventDefault();
    setRenewLoading(true);
    try {
      const res = await fetch('/api/security/ssl/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message || 'SSL Certificate issued successfully');
      setIsIssueModalOpen(false);
      setIssueForm({ domain: '', email: '' });
      fetchCertificates();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRenewLoading(false);
    }
  };

  const handleInstallCustom = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/ssl/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customForm)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      setIsCustomModalOpen(false);
      setCustomForm({ domain: '', certificate: '', private_key: '', ca_bundle: '' });
      fetchCertificates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRenewAll = async () => {
    setRenewLoading(true);
    try {
      const res = await fetch('/api/ssl/renew-all', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast('All SSL certificates checked and renewed successfully');
      fetchCertificates();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRenewLoading(false);
    }
  };

  const filteredCerts = (certs || []).filter(c => 
    c.domain.toLowerCase().includes(search.toLowerCase()) || 
    c.issuer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>SSL / TLS Certificates & Auto-Renewal Center</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Issue Let's Encrypt / ZeroSSL certificates via <code className="text-emerald-400 font-mono">acme.sh</code>, manage custom certificates, and view auto-renewal status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={handleRenewAll}
            disabled={renewLoading}
            variant="outline" 
            size="sm" 
            className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${renewLoading ? 'animate-spin' : ''}`} />
            <span>Renew All via acme.sh</span>
          </Button>

          <Button 
            onClick={() => setIsCustomModalOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Custom SSL</span>
          </Button>

          <Button 
            onClick={() => setIsIssueModalOpen(true)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 shadow-lg shadow-emerald-900/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue SSL Certificate</span>
          </Button>
        </div>
      </div>

      {/* Auto-Renewal Badge Banner */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-white">Automated Background SSL Daemon Active</div>
            <p className="text-[11px] text-zinc-400">
              Certificates nearing expiration (&lt; 30 days) are automatically renewed via daily background cron job.
            </p>
          </div>
        </div>

        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-mono">
          0 2 * * * (Daily 2:00 AM)
        </Badge>
      </Card>

      {/* Search Bar */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <Input 
            type="text"
            placeholder="Search domain certificates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900 border-zinc-800 rounded-xl pl-9 text-xs text-white"
          />
        </div>
      </Card>

      {/* Certificates Table */}
      <Card className="bg-[#121215] border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Domain / Common Name</th>
                <th className="py-3.5 px-4">Issuer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Days Left</th>
                <th className="py-3.5 px-4">Auto-Renew</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-zinc-500 text-xs">
                    No SSL certificates installed. Click "Issue SSL Certificate" to secure your domains.
                  </td>
                </tr>
              ) : (
                filteredCerts.map((c) => (
                  <tr key={c.domain} className="hover:bg-zinc-900/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{c.domain}</span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-300">
                      {c.issuer}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.is_self_signed 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-400 font-mono">
                      {c.expiry_date}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {c.days_left} Days
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enabled</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIssueForm({ domain: c.domain, email: 'admin@' + c.domain });
                          setIsIssueModalOpen(true);
                        }}
                        className="rounded-lg border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white text-[11px] h-7 px-2.5 gap-1"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Reissue</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Issue SSL Modal */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="bg-[#121215] rounded-3xl max-w-md w-full p-6 border border-zinc-800 shadow-2xl text-white">
          <DialogHeader className="pb-3 border-b border-zinc-800">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <span>Issue Let's Encrypt Certificate</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleIssueSSL} className="mt-4 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1.5">Domain Name *</label>
              <Input 
                type="text"
                required
                placeholder="example.com"
                value={issueForm.domain}
                onChange={(e) => setIssueForm({ ...issueForm, domain: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Both domain.com and www.domain.com will be requested.</p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1.5">Notification Email</label>
              <Input 
                type="email"
                placeholder="admin@example.com"
                value={issueForm.email}
                onChange={(e) => setIssueForm({ ...issueForm, email: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 text-white text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div>🛡️ <strong>acme.sh Resilience:</strong></div>
              <div>If DNS is not yet ready, a local self-signed certificate is installed immediately so HTTPS never breaks.</div>
            </div>

            <DialogFooter className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsIssueModalOpen(false)}
                className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={renewLoading}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5"
              >
                <Zap className={`w-3.5 h-3.5 ${renewLoading ? 'animate-spin' : ''}`} />
                <span>{renewLoading ? 'Issuing...' : 'Issue Certificate'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Custom SSL Modal */}
      <Dialog open={isCustomModalOpen} onOpenChange={setIsCustomModalOpen}>
        <DialogContent className="bg-[#121215] rounded-3xl max-w-xl w-full p-6 border border-zinc-800 shadow-2xl text-white">
          <DialogHeader className="pb-3 border-b border-zinc-800">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              <span>Install Custom SSL Certificate</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInstallCustom} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Domain Name *</label>
              <Input 
                type="text"
                required
                placeholder="example.com"
                value={customForm.domain}
                onChange={(e) => setCustomForm({ ...customForm, domain: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-2 font-mono text-white text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Certificate (.crt / .pem) *</label>
              <textarea 
                required
                rows={4}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={customForm.certificate}
                onChange={(e) => setCustomForm({ ...customForm, certificate: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 font-mono text-[11px] text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Private Key (.key) *</label>
              <textarea 
                required
                rows={4}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                value={customForm.private_key}
                onChange={(e) => setCustomForm({ ...customForm, private_key: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 font-mono text-[11px] text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">CA Bundle / Intermediate (Optional)</label>
              <textarea 
                rows={2}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={customForm.ca_bundle}
                onChange={(e) => setCustomForm({ ...customForm, ca_bundle: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 font-mono text-[11px] text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCustomModalOpen(false)}
                className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Install Custom Certificate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
