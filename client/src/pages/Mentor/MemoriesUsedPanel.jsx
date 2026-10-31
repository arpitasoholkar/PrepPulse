import React from 'react';
import { Brain, Bookmark, Pencil } from 'lucide-react';
import { Sparkle, Leaves } from '../../components/Illustrations.jsx';
import { getTypeStyle } from '../../components/memoryStyles.js';

function ConfidenceBar({ value, barClass }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
  return (
    <div className="flex items-center gap-2 mt-2.5">
      <div
        className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Confidence"
      >
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400 w-9 text-right">{pct}%</span>
    </div>
  );
}

function MemoryCard({ memory, why, score, tag, animate }) {
  const style = getTypeStyle(memory?.type);
  return (
    <li
      className={`rounded-2xl border border-white/10 border-l-4 ${style.edge} bg-white/[0.04] p-3.5 ${
        animate ? 'memory-new' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.chip}`}>
          {style.label}
        </span>
        {memory?.topic && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-300">
            {memory.topic === '*' ? 'all topics' : memory.topic}
          </span>
        )}
        {memory?.status === 'corrected' && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-indigo-400/30 bg-indigo-400/10 text-indigo-300">
            Corrected by you
          </span>
        )}
        {tag && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-violet-400/40 bg-violet-400/15 text-violet-200">
            {tag}
          </span>
        )}
        {typeof score === 'number' && (
          <span className="ml-auto text-xs text-slate-500 tabular-nums">score {score.toFixed(1)}</span>
        )}
      </div>

      <p className="text-base font-medium text-slate-100 mt-2.5 leading-snug">{memory?.content}</p>

      <ConfidenceBar value={memory?.confidence} barClass={style.bar} />

      {why && (
        <p className="text-sm text-slate-400 mt-2.5 leading-snug">
          <span className="text-slate-500">Why chosen: </span>
          {why}
        </p>
      )}
    </li>
  );
}

export default function MemoriesUsedPanel({ used, saved, loading, replyKey, hasReply, degraded }) {
  return (
    <aside aria-label="Memories used" className="relative flex flex-col min-h-0 h-full">
      <Leaves className="pointer-events-none absolute -right-6 bottom-0 w-44 h-60 opacity-80" />
      <div className="relative px-5 py-4 border-b border-[#ececf2] flex items-center gap-2.5">
        <span className="bubble w-9 h-9">
          <Brain className="w-4 h-4" />
        </span>
        <h2 className="text-base font-bold text-white">Memories used</h2>
        {loading && <span className="ml-auto text-xs text-slate-500">Updating…</span>}
      </div>

      <div className="relative flex-1 overflow-y-auto p-5 space-y-7">
        <section aria-label="Memories used for this reply">
          {used.length > 0 ? (
            <>
              <p className="text-sm text-slate-400 mb-3">
                The mentor retrieved {used.length} stored {used.length === 1 ? 'record' : 'records'} before writing
                this reply.
              </p>
              <ul className="space-y-3">
                {used.map((item, i) => (
                  <MemoryCard
                    key={`${replyKey}-${item.memory?._id || i}`}
                    memory={item.memory}
                    why={item.why}
                    score={item.score}
                    animate
                  />
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-[#F28A52]/25 bg-[#fde3d6]/60 p-4 text-base text-ink">
              <Sparkle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
              {hasReply ? (
                <>
                  <p className="text-slate-200 font-semibold">No stored memory matched this reply.</p>
                  <p className="mt-1 text-sm">
                    {degraded
                      ? 'The AI was unavailable, so this was a fallback reply.'
                      : 'Give feedback or submit practice code and the mentor will start remembering.'}
                  </p>
                </>
              ) : (
                'No memories used yet. Ask the mentor something.'
              )}
              </div>
            </div>
          )}
        </section>

        <section aria-label="Saved just now">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 mb-3">
            <Bookmark className="w-4 h-4 text-[#7652C8] fill-[#7652C8]/20" />
            Saved just now
          </h3>
          {saved.length > 0 ? (
            <ul className="space-y-3">
              {saved.map((item) => (
                <MemoryCard
                  key={item.key}
                  memory={item.memory}
                  tag={item.kind === 'updated' ? 'Updated' : 'New'}
                  animate
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft flex items-start gap-2">
              <Pencil className="w-4 h-4 mt-0.5 shrink-0" />
              New memories from this session appear here, for example after you click "I understood".
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
