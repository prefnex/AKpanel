import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Terminal, 
  Server, 
  ShieldCheck, 
  Radio, 
  Check, 
  Copy, 
  HelpCircle, 
  Save, 
  RotateCw 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

export default function NameserversPage({ showToast }) {
  const [settings, setSettings] = useState({
    server_hostname: '',
    primary_ns: 'ns1.akpanel.local',
    secondary_ns: 'ns2.akpanel.local',
    primary_ip: '',
    secondary_ip: '',
    default_ttl: 14400,
  });
  const [glueRecords, setGlueRecords] = useState([]);
  const [serverIP, setServerIP] = useState('127.0.0.1');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUpdatingHostname, setIsUpdatingHostname] = useState(false);
  const [hostnameInput, setHostnameInput] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  // Diagnostics (dig / nslookup) State
  const [diagDomain, setDiagDomain] = useState('google.com');
  const [diagType, setDiagType] = useState('A');
  const [diagServer, setDiagServer] = useState('127.0.0.1');
  const [diagOutput, setDiagOutput] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dns/settings');
      if (res.ok) {
        const json = await res.json();
        if (json.settings) {
          setSettings(json.settings);
          setHostnameInput(json.settings.server_hostname || '');
        }
        if (json.glue_records) setGlueRecords(json.glue_records);
        if (json.server_ip) {
          setServerIP(json.server_ip);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleUpdateHostname = async (e) => {
    e.preventDefault();
    setIsUpdatingHostname(true);
    try {
      const res = await fetch('/api/dns/hostname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: hostnameInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsUpdatingHostname(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/dns/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRunDiagnose = async (e) => {
    e.preventDefault();
    if (!diagDomain) return;
    setIsDiagnosing(true);
    try {
      const res = await fetch('/api/dns/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: diagDomain,
          record_type: diagType,
          server: diagServer,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      setDiagOutput(json.data || 'No response returned from DNS query.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/40 via-blue-950/30 to-cyan-950/20 border border-indigo-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
            <Sliders className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">Edit Nameservers IPs & Hostname</h1>
              <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 text-xs font-semibold px-2.5 py-0.5">
                Root NS1 / NS2 IPs
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                Glue Records Ready
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Configure master FQDN server hostname, custom nameservers, glue IP mappings, and live dig resolution diagnostics.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Hostname & Nameservers */}
        <div className="space-y-6">
          {/* Hostname Card */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Root Server Hostname (FQDN)</h3>
                <p className="text-xs text-zinc-400">Updates /etc/hostname, /etc/hosts, and applies via hostnamectl</p>
              </div>
            </div>

            <form onSubmit={handleUpdateHostname} className="flex gap-2">
              <Input
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                placeholder="e.g. srv1.yourdomain.com"
                className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                required
              />
              <Button type="submit" disabled={isUpdatingHostname} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-4 rounded-xl">
                {isUpdatingHostname ? 'Setting...' : 'Set Hostname'}
              </Button>
            </form>
          </Card>

          {/* Nameservers IPs Form */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Master Nameservers & IPs</h3>
                <p className="text-xs text-zinc-400">Default NS records assigned to all hosted domains on this server</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Primary NS1</label>
                  <Input
                    value={settings.primary_ns}
                    onChange={(e) => setSettings({ ...settings, primary_ns: e.target.value })}
                    placeholder="ns1.yourdomain.com"
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">NS1 IP Address</label>
                  <Input
                    value={settings.primary_ip}
                    onChange={(e) => setSettings({ ...settings, primary_ip: e.target.value })}
                    placeholder={serverIP}
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Secondary NS2</label>
                  <Input
                    value={settings.secondary_ns}
                    onChange={(e) => setSettings({ ...settings, secondary_ns: e.target.value })}
                    placeholder="ns2.yourdomain.com"
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">NS2 IP Address</label>
                  <Input
                    value={settings.secondary_ip}
                    onChange={(e) => setSettings({ ...settings, secondary_ip: e.target.value })}
                    placeholder={serverIP}
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Default Zone TTL (Seconds)</label>
                <Input
                  type="number"
                  value={settings.default_ttl}
                  onChange={(e) => setSettings({ ...settings, default_ttl: parseInt(e.target.value) || 14400 })}
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs rounded-xl max-w-xs"
                />
              </div>

              <Button type="submit" disabled={isSavingSettings} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs w-full rounded-xl h-10 shadow-lg shadow-indigo-600/20">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                <span>{isSavingSettings ? 'Saving...' : 'Save Master Nameservers'}</span>
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Glue Records & Diagnostics */}
        <div className="space-y-6">
          {/* Glue Records Checklist */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Glue Records Checklist</h3>
                <p className="text-xs text-zinc-400">Register these at your domain registrar (Namecheap, GoDaddy, OVH)</p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden font-mono text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                    <th className="py-2.5 px-3">Nameserver</th>
                    <th className="py-2.5 px-3">Target IP</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  {glueRecords.map((g, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-bold text-indigo-400">{g.nameserver}</td>
                      <td className="py-2.5 px-3">{g.ip_address}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-sans font-bold">
                          Configured
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4 space-y-2 text-xs text-blue-200">
              <div className="font-bold flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                <span>Registrar Setup Guide:</span>
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-zinc-300 text-[11px] leading-relaxed">
                <li>Log in to your Domain Registrar (Namecheap, GoDaddy, Cloudflare, etc.).</li>
                <li>Go to <strong>"Advanced DNS / Personal Nameservers / Glue Records"</strong>.</li>
                <li>Add <strong>{settings.primary_ns}</strong> pointing to <code>{settings.primary_ip || serverIP}</code>.</li>
                <li>Add <strong>{settings.secondary_ns}</strong> pointing to <code>{settings.secondary_ip || serverIP}</code>.</li>
              </ol>
            </div>
          </Card>

          {/* Live dig Query Tool */}
          <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              <span>Live DNS Query Diagnostics Tool (dig)</span>
            </h3>

            <form onSubmit={handleRunDiagnose} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Domain</label>
                  <Input
                    value={diagDomain}
                    onChange={(e) => setDiagDomain(e.target.value)}
                    placeholder="e.g. google.com"
                    className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Type</label>
                  <select
                    value={diagType}
                    onChange={(e) => setDiagType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono"
                  >
                    <option value="A">A</option>
                    <option value="AAAA">AAAA</option>
                    <option value="MX">MX</option>
                    <option value="TXT">TXT</option>
                    <option value="NS">NS</option>
                    <option value="SOA">SOA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Nameserver</label>
                <Input
                  value={diagServer}
                  onChange={(e) => setDiagServer(e.target.value)}
                  placeholder="127.0.0.1 or 8.8.8.8"
                  className="bg-zinc-950 border-zinc-800 text-xs rounded-xl font-mono"
                />
              </div>

              <Button type="submit" disabled={isDiagnosing} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs w-full rounded-xl h-10">
                {isDiagnosing ? 'Querying...' : 'Execute dig Query'}
              </Button>
            </form>

            {diagOutput && (
              <div className="bg-black/90 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-cyan-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {diagOutput}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
