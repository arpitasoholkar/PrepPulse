import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Lightbulb, TrendingUp, TrendingDown, Brain, MessageSquareText } from 'lucide-react';
import { getTypeStyle } from '../../components/memoryStyles.js';

const RESULT_THEME = {
  pass: {
    title: 'All tests passed',
    icon: CheckCircle2,
    box: 'border-emerald-400/30 bg-emerald-400/10',
    text: 'text-emerald-300',
    bar: 'bg-emerald-400',
  },
  fail: {
    title: 'Some tests failed',
    icon: XCircle,
    box: 'border-rose-400/30 bg-rose-400/10',
    text: 'text-rose-300',
    bar: 'bg-rose-400',
  },
  error: {
    title: 'Your code could not run',
    icon: AlertTriangle,
    box: 'border-amber-400/30 bg-amber-400/10',
    text: 'text-amber-300',
    bar: 'bg-amber-400',
  },
};

const humanize = (s) => (s ? s.replace(/_/g, ' ') : '');

function MemoryRow({ memory, tag }) {
  const style = getTypeStyle(memory?.type);
  return (
    <li className={`rounded-xl border border-white/10 border-l-4 ${style.edge} bg-white/[0.04] p-3 memory-new`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.chip}`}>{style.label}</span>
        {memory?.topic && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-300">
            {memory.topic}
          </span>
        )}
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-violet-400/40 bg-violet-400/15 text-violet-200">
          {tag}
        </span>
        {typeof memory?.confidence === 'number' && (
          <span className="ml-auto text-xs text-slate-500 tabular-nums">
            confidence {Math.round(memory.confidence * 100)}%
          </span>
        )}
      </div>
      <p className="text-base font-medium text-slate-100 mt-2 leading-snug">{memory?.content}</p>
    </li>
  );
}

export default function ResultCard({ result, onTryAgain, onAskMentor }) {
  const theme = RESULT_THEME[result.result] || RESULT_THEME.error;
  const Icon = theme.icon;
  const total = result.testsTotal || 0;
  const passed = result.testsPassed || 0;
  const pct = total ? Math.round((passed / total) * 100) : 0;

  const mastery = result.mastery;
  const delta = mastery ? mastery.after - mastery.before : 0;
  const saved = result.memoriesSaved || [];
  const updated = result.memoriesUpdated || [];

  return (
    <section aria-label="Result" className="space-y-4">
      <div className={`rounded-2xl border p-4 ${theme.box}`}>
        <div className="flex items-center gap-2.5">
          <Icon className={`w-5 h-5 ${theme.text}`} />
          <h3 className={`text-base font-bold ${theme.text}`}>{theme.title}</h3>
          {result.errorType && result.errorType !== 'none' && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-200">
              {humanize(result.errorType)}
            </span>
          )}
        </div>

        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-slate-300 mb-1.5">
              <span>Tests passed</span>
              <span className="tabular-nums font-semibold">
                {passed} / {total}
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-white/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Tests passed"
            >
              <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {result.degraded && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          The AI judge was unavailable, so this is a fallback result. Try submitting again.
        </p>
      )}

      {result.explanation && (
        <div>
          <h4 className="text-sm font-bold text-slate-200 mb-1.5">What happened</h4>
          <p className="text-base text-slate-300 leading-relaxed">{result.explanation}</p>
        </div>
      )}

      {result.hint && (
        <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
          <div>
            <h4 className="text-sm font-bold text-slate-200">Hint</h4>
            <p className="text-base text-slate-300 mt-0.5">{result.hint}</p>
          </div>
        </div>
      )}

      {mastery && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span className="font-bold text-slate-200">Mastery in {mastery.topic}</span>
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              {delta > 0 && <TrendingUp className="w-3.5 h-3.5" />}
              {delta < 0 && <TrendingDown className="w-3.5 h-3.5" />}
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-base tabular-nums text-slate-400 w-8">{mastery.before}</span>
            <div className="relative flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/25"
                style={{ width: `${Math.max(0, Math.min(100, mastery.before))}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${delta >= 0 ? 'bg-emerald-400' : 'bg-rose-400'} transition-all duration-700`}
                style={{ width: `${Math.max(0, Math.min(100, mastery.after))}%`, opacity: 0.9 }}
              />
            </div>
            <span className="text-base tabular-nums font-bold text-white w-8 text-right">{mastery.after}</span>
          </div>
        </div>
      )}

      {(saved.length > 0 || updated.length > 0) && (
        <div>
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 mb-2">
            <Brain className="w-3.5 h-3.5 text-violet-300" />
            Memory changes
          </h4>
          <ul className="space-y-2.5">
            {saved.map((m, i) => (
              <MemoryRow key={`s-${m._id || i}`} memory={m} tag="New" />
            ))}
            {updated.map((m, i) => (
              <MemoryRow key={`u-${m._id || i}`} memory={m} tag="Updated" />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onTryAgain}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition"
        >
          Edit and try again
        </button>
        <button
          type="button"
          onClick={onAskMentor}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold border border-violet-400/30 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 transition"
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          Ask the mentor
        </button>
      </div>
    </section>
  );
}
