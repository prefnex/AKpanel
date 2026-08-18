import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadcn-card border flex items-center gap-3 text-sm shadow-2xl animate-fade-in ${
      toast.type === 'error' 
        ? 'border-rose-500/40 text-rose-400 bg-rose-950/60' 
        : 'border-emerald-500/40 text-emerald-400 bg-emerald-950/60'
    }`}>
      {toast.type === 'error' ? (
        <AlertCircle className="w-4 h-4 text-rose-400" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      )}
      <span>{toast.msg}</span>
    </div>
  );
}
