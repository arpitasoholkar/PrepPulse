import React from 'react';
import { Route } from 'lucide-react';
import { getStyleBadge } from '../../components/memoryStyles.js';

// Teaching plan from stylePlan: green Use, red Avoid, grey Untried.
// This is the proof that memory changes the mentor's behaviour.
const STATUS = {
  use: { label: 'Use', cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' },
  avoid: { label: 'Avoid', cls: 'border-rose-400/40 bg-rose-400/10 text-rose-300' },
  untried: { label: 'Untried', cls: 'border-white/15 bg-white/5 text-slate-400' },
};
const ORDER = { use: 0, avoid: 1, untried: 2 };

export default function PlanCard({ plan }) {
  const rows = Array.isArray(plan) ? [...plan].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3)) : [];
  return (
    <section aria-label="Teaching plan">
      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 mb-3">
        <Route className="w-4 h-4 text-[#7652C8]" />
        Teaching plan
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No plan yet. Ask the mentor a question and it will show which styles it will use or avoid for you.
        </p>
      ) : (
        <ul className="rounded-2xl border border-white/10 bg-white/[0.04] divide-y divide-white/10">
          {rows.map((r) => {
            const s = STATUS[r.status] || STATUS.untried;
            return (
              <li key={r.style} className="flex items-start gap-3 px-3.5 py-2.5 memory-new">
                <span className={`shrink-0 w-16 text-center text-xs font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>
                  {s.label}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{getStyleBadge(r.style).label}</p>
                  {r.reason && <p className="text-xs text-slate-400 leading-snug">{r.reason}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
