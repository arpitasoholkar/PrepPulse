import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeSlowRequests } from '../api/client.js';

// Shows while any API request has been pending for a few seconds (Render free-tier cold start).
export default function ColdStartBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => subscribeSlowRequests(setSlow), []);
  if (!slow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 rounded-full glass-strong px-4 py-2 text-sm font-semibold text-slate-100 shadow-2xl"
    >
      <Loader2 className="w-4 h-4 animate-spin text-violet-300" aria-hidden="true" />
      Waking up the server, 20 seconds...
    </div>
  );
}
