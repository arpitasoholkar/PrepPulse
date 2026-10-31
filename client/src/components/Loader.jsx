import React from 'react';
import { Loader2 } from 'lucide-react';

// Spinner with an optional label. `fullPage` centres it in the viewport.
export default function Loader({ label = 'Loading…', fullPage = false, className = '' }) {
  const body = (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 text-slate-300 ${className}`}>
      <Loader2 className="w-5 h-5 animate-spin text-violet-300" aria-hidden="true" />
      {label && <span className="text-sm font-semibold">{label}</span>}
    </div>
  );
  return fullPage ? <div className="min-h-screen grid place-items-center app-bg">{body}</div> : body;
}
