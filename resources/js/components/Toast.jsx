import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Toast({ toast, message, type }) {
  const msg = toast?.msg || toast?.message || message;
  const kind = toast?.type || type || 'success';
  if (!msg) return null;

  const isError = kind === 'error';

  return (
    <div className={`fixed bottom-6 right-6 z-[80] max-w-md px-4 py-3 rounded-xl border flex items-center gap-3 text-sm shadow-2xl ${
      isError
        ? 'border-rose-500/40 text-rose-100 bg-rose-950/90'
        : 'border-emerald-500/40 text-emerald-100 bg-emerald-950/90'
    }`}>
      {isError ? (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      )}
      <span className="font-medium">{msg}</span>
    </div>
  );
}
