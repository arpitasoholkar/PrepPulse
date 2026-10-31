import React from 'react';
import { X } from 'lucide-react';
import { useActivity } from '../../context/ActivityContext.jsx';
import BadgeIcon from './BadgeIcon.jsx';

// "Badge unlocked" pop-ups, bottom right.
export default function BadgeToaster() {
  const { toasts, dismissToast } = useActivity();
  if (!toasts.length) return null;
  return (
    <div className="fixed z-[70] right-4 bottom-24 lg:bottom-6 flex flex-col gap-3 w-[min(22rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      {toasts.map((b) => (
        <div key={b.toastId} className="flex items-center gap-3 rounded-3xl bg-[#1f1f38] text-white p-3.5 pr-4 shadow-2xl border border-white/10">
          <BadgeIcon icon={b.icon} tier={b.tier} size="w-12 h-12" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#d9f26e]">Badge unlocked</p>
            <p className="text-sm font-bold truncate">{b.name}</p>
            <p className="text-xs text-white/60 truncate">{b.description}</p>
          </div>
          <button type="button" onClick={() => dismissToast(b.toastId)} aria-label="Dismiss" className="text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
