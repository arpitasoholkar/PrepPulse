import React from 'react';
import AnimatedLogo from './AnimatedLogo.jsx';

// Loading indicator that plays the animated IntelliPrep logo.
//  - inline (default): the logo mark with an optional label, for in-page loading states
//  - `fullPage`: the full logo with wordmark, centred in the viewport (used for the app splash)
export default function Loader({ label = 'Loading…', fullPage = false, className = '' }) {
  const body = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-slate-300 ${className}`}
    >
      {fullPage && <AnimatedLogo variant="full" className="w-56 sm:w-72" />}
      {label && <span className={`text-sm font-semibold ${fullPage ? '' : 'animate-pulse'}`}>{label}</span>}
    </div>
  );
  return fullPage ? <div className="min-h-screen grid place-items-center app-bg">{body}</div> : body;
}