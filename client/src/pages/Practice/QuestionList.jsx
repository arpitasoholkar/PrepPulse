import React from 'react';
import { Sparkles } from 'lucide-react';

const DIFFICULTY = {
  easy: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  medium: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  hard: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
};

export default function QuestionList({ questions, selectedId, onSelect }) {
  return (
    <ul className="space-y-3 min-h-0 lg:overflow-y-auto lg:pr-1" aria-label="Practice questions">
      {questions.map((q) => {
        const active = q.id === selectedId;
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              aria-current={active ? 'true' : undefined}
              className={`w-full text-left rounded-[24px] border px-5 py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                active
                  ? 'border-[#7652C8]/50 bg-white ring-2 ring-[#7652C8]/25 shadow-sm'
                  : 'border-[#ececf2] bg-white/70 hover:bg-white'
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