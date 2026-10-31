import React from 'react';
import { getStyleBadge } from '../../components/memoryStyles.js';

// Chips such as: Theory ✗  Simple ✗  Worked example (current)
// outcome is "pending", "failed" or "worked" (see the v2 API contract).
const OUTCOME = {
  failed: { mark: '✗', cls: 'border-rose-400/40 bg-rose-400/10 text-rose-300', word: 'did not work' },
  worked: { mark: '✓', cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', word: 'worked' },
  pending: { mark: '', cls: 'border-violet-400/60 bg-violet-400/20 text-violet-100 ring-1 ring-violet-400/40', word: 'current' },
};

export default function LadderRow({ tried, reason }) {
  if (!Array.isArray(tried) || tried.length === 0) return null;
  return (
    <div className="mb-3" aria-label="Teaching styles tried in this ladder">
      <ul className="flex flex-wrap items-center gap-1.5">
        {tried.map((t, i) => {
          const o = OUTCOME[t.outcome] || OUTCOME.pending;
          return (
            <li
              key={`${t.style}-${i}`}
              title={`${getStyleBadge(t.style).label} ${o.word}`}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${o.cls}`}
            >
              {getStyleBadge(t.style).label}
              {o.mark && <span aria-hidden="true">{o.mark}</span>}
              <span className="sr-only">{o.word}</span>
            </li>
          );
        })}
      </ul>
      {reason && <p className="mt-2 text-sm text-violet-200/90">{reason}</p>}
    </div>
  );
}
