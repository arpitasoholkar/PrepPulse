import React from 'react';
import { Sparkles } from 'lucide-react';

const DIFFICULTY = {
  easy: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  medium: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  hard: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
};

export default function QuestionList({ questions, selectedId, onSelect }) {
  return (
    <ul className="space-y-2.5" aria-label="Practice questions">
      {questions.map((q) => {
        const active = q.id === selectedId;
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              aria-current={active ? 'true' : undefined}
              className={`w-full text-left rounded-[28px] border px-5 py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                active
                  ? 'border-violet-300/50 bg-[#4d2784]/70 ring-1 ring-violet-300/30'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{q.title}</span>
                <span
                  className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    DIFFICULTY[q.difficulty] || 'bg-white/10 text-slate-300 border-white/15'
                  }`}
                >
                  {q.difficulty}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-300">
                  {q.topic}
                </span>
              </div>
              {q.recommended && (
                <div className="mt-2.5 rounded-xl border border-violet-400/30 bg-violet-400/10 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                    <Sparkles className="w-3 h-3" />
                    Recommended for you
                  </p>
                  {q.recommendedReason && (
                    <p className="mt-0.5 text-sm text-slate-300 leading-snug">{q.recommendedReason}</p>
                  )}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
