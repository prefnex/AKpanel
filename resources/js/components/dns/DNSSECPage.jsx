import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  RotateCw 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export default function DNSSECPage({ showToast }) {
  const [zones, setZones] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [dnssecSummary, setDnssecSummary] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/dns/zones');
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setZones(list);
        if (list.length > 0 && !selectedDomain) {
          setSelectedDomain(list[0].domain);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDNSSEC = async (domain) => {
    if (!domain) return;
    try {
      const res = await fetch(`/api/dns/dnssec?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const json = await res.json();
        setDnssecSummary(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      fetchDNSSEC(selectedDomain);
    }
  }, [selectedDomain]);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleToggle = async (enable) => {
    if (!selectedDomain) return;
    setIsToggling(true);
    try {
      const res = await fetch('/api/dns/dnssec/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: selectedDomain, enable }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      showToast(json.message);
      fetchDNSSEC(selectedDomain);
      fetchZones();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-cyan-950/20 border border-emerald-900/30 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">DNSSEC Cryptographic Signing</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                ECDSA P-256 (Alg 13)
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Cryptographically protect hosted DNS zones against cache poisoning, spoofing, and man-in-the-middle attacks.
            </p>
          </div>
        </div>

        {/* Domain Selector Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 font-medium">Select Domain:</span>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-emerald-500"
          >
            {zones.map((z) => (
              <option key={z.domain} value={z.domain}>
                {z.domain} {z.dnssec_enabled ? '🛡️ (Signed)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Zone Cryptographic Status</h3>
                <p className="text-xs text-zinc-400">{selectedDomain}</p>
              </div>
            </div>

            <Button
              onClick={() => handleToggle(!dnssecSummary?.enabled)}
              disabled={isToggling}
              className={dnssecSummary?.enabled ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 px-4 rounded-xl' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 rounded-xl'}
            >
              {dnssecSummary?.enabled ? 'Disable DNSSEC' : 'Sign & Enable DNSSEC'}
            </Button>
          </div>

          {dnssecSummary && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Key Tag:</span>
                <span className="font-bold text-cyan-400">{dnssecSummary.key_tag}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Algorithm:</span>
                <span className="text-zinc-200">{dnssecSummary.algorithm}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Digest Type:</span>
                <span className="text-zinc-200">{dnssecSummary.digest_type}</span>
              </div>
              <div>
                <div className="text-zinc-400 mb-1">Delegation Signer (DS Record) for Domain Registrar:</div>
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-400 break-all text-[11px] flex justify-between items-center">
                  <span>{dnssecSummary.ds_record}</span>
                  <button onClick={() => handleCopy(dnssecSummary.ds_record, 'ds_key')} className="p-1 text-zinc-400 hover:text-white">
                    {copiedKey === 'ds_key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Server-Wide Protection Metrics */}
        <Card className="bg-zinc-900/60 border-zinc-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-4">
          <h3 className="text-base font-bold text-white">DNS Security & Attack Mitigation</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Open Resolver Lockdown</div>
                <div className="text-[11px] text-zinc-400">Recursion denied to external clients</div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASS</Badge>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Response Rate Limiting (RRL)</div>
                <div className="text-[11px] text-zinc-400">DDoS Amplification Shield active</div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">ACTIVE</Badge>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Zone Transfer Restrictions</div>
                <div className="text-[11px] text-zinc-400">AXFR/IXFR requests limited to secondary servers</div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">LOCKED</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
