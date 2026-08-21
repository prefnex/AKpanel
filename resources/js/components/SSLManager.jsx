import React, { useState, useEffect } from 'react';
import {
  Lock, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  Upload,
  RotateCw,
  Zap,
  Clock
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

export default function SSLManager({ showToast }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ domain: '', email: '' });
  const [customForm, setCustomForm] = useState({
    domain: '',
    certificate: '',
    private_key: '',
    ca_bundle: ''
  });

  const [sslTaskId, setSslTaskId] = useState(localStorage.getItem('akpanel_ssl_task') || '');
  const [sslTask, setSslTask] = useState(null);

  const ISSUE_STEPS = [
    { key: 'ValidateDomain', label: 'Validate domain' },
    { key: 'PrepareChallenge', label: 'Prepare HTTP-01' },
    { key: 'IssueCertificate', label: "Let's Encrypt / ZeroSSL" },
    { key: 'InstallCertificate', label: 'Install & reload nginx' },
    { key: 'VerifySSL', label: 'Verify certificate' },
  ];
  const RENEW_ALL_STEPS = [
    { key: 'ScanCertificates', label: 'Scan certificates' },
    { key: 'RunAcmeCron', label: 'acme.sh cron' },
    { key: 'ReloadWebServers', label: 'Reload nginx' },
    { key: 'VerifySSL', label: 'Verify result' },
  ];

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

  useEffect(() => {
    if (!sslTaskId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/ssl/task/status?task_id=${encodeURIComponent(sslTaskId)}`);
        if (!res.ok) return;
        const json = await res.json();
        const task = json.data;
        if (!task || cancelled) return;
        setSslTask(task);
        if (task.status === 'completed' || task.status === 'failed') {
          localStorage.removeItem('akpanel_ssl_task');
          setSslTaskId('');
          fetchCertificates();
          const logs = task.logs || [];
          const joined = logs.join('\n');
          if (task.status === 'failed') {
            showToast((task.error || 'SSL task failed').split('\n')[0], 'error');
          } else if (/self_signed/i.test(joined)) {
            showToast('Finished with a self-signed fallback — public DNS/HTTP-01 is not ready.', 'error');
          } else {
            showToast('Trusted SSL certificate is active');
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sslTaskId]);

  const startSslTask = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);
    if (!json.task_id) throw new Error('No task_id returned');
    localStorage.setItem('akpanel_ssl_task', json.task_id);
    setSslTask({
      id: json.task_id,
      title: json.message,
      status: 'running',
      progress: 5,
      current_step: 'queued',
      logs: ['Task queued — waiting for first stage...'],
    });
    setSslTaskId(json.task_id);
    showToast(json.message || 'SSL task started');
  };

  const handleIssueSSL = async (e) => {
    e.preventDefault();
    try {
      await startSslTask('/api/ssl/issue', issueForm);
      setIsIssueModalOpen(false);
      setIssueForm({ domain: '', email: '' });
    } catch (err) {
      showToast(err.message, 'error');
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

  const handleRenewDomain = async (domain) => {
    try {
      await startSslTask('/api/ssl/renew', { domain });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRenewAll = async () => {
    try {
      await startSslTask('/api/ssl/renew-all', {});
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const resetSslTask = () => {
    localStorage.removeItem('akpanel_ssl_task');
    setSslTaskId('');
    setSslTask(null);
  };

  const taskBusy = sslTask?.status === 'running';
  const steps = (sslTask?.title || '').toLowerCase().includes('all') ? RENEW_ALL_STEPS : ISSUE_STEPS;
  const currentStep = sslTask?.current_step || '';
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  const logs = sslTask?.logs || [];
  const lastLog = logs[logs.length - 1] || '';
  const waitingFor = lastLog.startsWith('Waiting:') ? lastLog.replace(/^Waiting:\s*/, '') : '';
  const failed = sslTask?.status === 'failed';
  const completed = sslTask?.status === 'completed';
  const selfSignedDone = completed && logs.some((l) => /self_signed/i.test(l));

  const filteredCerts = (certs || []).filter(c => 
    (c.domain || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.issuer || '').toLowerCase().includes(search.toLowerCase())
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
            disabled={taskBusy}
            variant="outline" 
            size="sm" 
            className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${taskBusy ? 'animate-spin' : ''}`} />
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

      {sslTask && (
        <Card className={`rounded-2xl p-5 border ${
          failed ? 'bg-red-950/20 border-red-800/70' : selfSignedDone ? 'bg-amber-950/20 border-amber-800/60' : completed ? 'bg-emerald-950/20 border-emerald-800/50' : 'bg-[#121215] border-indigo-800/50'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">{sslTask.title || 'SSL task'}</div>
              <div className={`text-xs mt-1 flex items-center gap-1.5 ${failed ? 'text-red-300' : selfSignedDone ? 'text-amber-300' : completed ? 'text-emerald-300' : 'text-indigo-300'}`}>
                {taskBusy && <Clock className="w-3.5 h-3.5 animate-pulse" />}
                {failed && <AlertTriangle className="w-3.5 h-3.5" />}
                {completed && !failed && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>
                  {failed
                    ? `Failed at ${currentStep || 'unknown step'}`
                    : selfSignedDone
                      ? 'Completed with self-signed fallback (not a trusted CA)'
                      : completed
                        ? 'Completed — trusted certificate is active'
                        : waitingFor
                          ? `Waiting: ${waitingFor}`
                          : `Running: ${currentStep || 'starting'} (${sslTask.progress || 0}%)`}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-zinc-400">{sslTask.progress || 0}%</span>
          </div>

          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all ${failed ? 'bg-red-500' : selfSignedDone ? 'bg-amber-500' : completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${sslTask.progress || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            {steps.map((step, idx) => {
              const done = completed || (currentIdx >= 0 && idx < currentIdx);
              const active = !completed && !failed && (step.key === currentStep || (currentStep === 'queued' && idx === 0));
              return (
                <div
                  key={step.key}
                  className={`rounded-xl border px-2.5 py-2 text-[11px] ${
                    failed && active
                      ? 'border-red-700 bg-red-950/40 text-red-200'
                      : active
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : done
                          ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300'
                          : 'border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="font-bold">{idx + 1}. {step.label}</div>
                  <div className="mt-0.5 text-[10px]">
                    {failed && active ? 'Failed' : active ? 'In progress' : done ? 'Done' : 'Queued'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-black/40 border border-zinc-800 p-3 font-mono text-[10px] text-zinc-400 space-y-0.5">
            {logs.slice(-12).map((line, i) => (
              <div key={i} className={line.startsWith('Failed') ? 'text-red-400' : line.startsWith('Waiting:') ? 'text-indigo-300' : line.startsWith('RESULT') ? 'text-emerald-300' : ''}>
                {line}
              </div>
            ))}
          </div>

          {failed && sslTask.error && (
            <div className="mt-2 text-[11px] text-red-300 font-mono">{sslTask.error}</div>
          )}

          {(completed || failed) && (
            <button type="button" onClick={resetSslTask} className="mt-3 text-[11px] text-zinc-400 hover:text-white underline">
              Dismiss
            </button>
          )}
        </Card>
      )}

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
                      <span>{c.domain === 'server' ? 'server (Hostname SSL :2087/:2083)' : c.domain}</span>
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

                    <td className="py-3.5 px-4 text-right flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={taskBusy}
                        onClick={() => handleRenewDomain(c.domain)}
                        className="rounded-lg border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white text-[11px] h-7 px-2.5 gap-1"
                      >
                        <RotateCw className={`w-3 h-3 text-cyan-400 ${taskBusy ? 'animate-spin' : ''}`} />
                        <span>Renew</span>
                      </Button>
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
                disabled={taskBusy}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5"
              >
                <Zap className={`w-3.5 h-3.5 ${taskBusy ? 'animate-spin' : ''}`} />
                <span>{taskBusy ? 'Issuing...' : 'Issue Certificate'}</span>
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
