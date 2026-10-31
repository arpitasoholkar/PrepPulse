import React from 'react';

// Plain anchors on purpose: this renders outside the router (see UserContext).
export default function NotFound() {
  return (
    <div className="min-h-screen app-bg skin-light text-ink font-sans grid place-items-center px-6">
      <div className="glass rounded-[36px] p-10 max-w-md text-center shadow-2xl">
        <p className="text-6xl font-black text-white">404</p>
        <h1 className="mt-3 text-xl font-bold text-slate-200">This page doesn’t exist</h1>
        <p className="mt-2 text-sm text-slate-400">The link may be broken or the page may have moved.</p>
        <a href="/" className="btn-pill inline-block mt-6 px-6 py-3 text-sm">
          Back to IntelliPrep
        </a>
      </div>
    </div>
  );
}
