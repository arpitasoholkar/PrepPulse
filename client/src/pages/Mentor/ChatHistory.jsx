import React from 'react';
import { Plus, Trash2, CheckCircle2, Circle, CircleDot, ArrowRight } from 'lucide-react';

const STATUS_ICON = {
  learned: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  learning: <CircleDot className="w-4 h-4 text-amber-300 shrink-0" />,
  not_started: <Circle className="w-4 h-4 text-slate-500 shrink-0" />,
};

const when = (iso) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function ChatHistory({
  sessions, activeId, curriculum, disabled, className = '',
  onSelect, onNew, onDelete, onContinue,
}) {
  return (
    <aside className={`glass rounded-[28px] flex flex-col min-h-0 overflow-hidden ${className}`} aria-label="Chat history">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[#ececf2]">
        <p className="text-base font-bold text-white">Chats</p>
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold border border-[#ececf2] bg-white text-ink hover:bg-[#f6f5fa] disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[8rem]">
        {sessions.length === 0 && (
          <li className="px-3 py-4 text-sm text-slate-500">Your chats will appear here.</li>
        )}
        {sessions.map((s) => (
          <li key={s.sessionId}>
            <div
              className={`group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition ${
                s.sessionId === activeId ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
              onClick={() => !disabled && onSelect(s.sessionId)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{s.title}</p>
                <p className="text-xs text-slate-500 truncate">
                  {when(s.updatedAt)}{s.topic ? ` · ${s.topic}` : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete chat ${s.title}`}
                onClick={(e) => { e.stopPropagation(); onDelete(s.sessionId); }}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {curriculum && (
        <div className="border-t border-[#ececf2] p-4">
          <div className="flex items-center mb-2">
            <p className="text-sm font-bold text-white">Learning path</p>
            <span className="ml-auto text-xs text-slate-500">
              {curriculum.learnedCount}/{curriculum.total} learned
            </span>
          </div>
          <ul className="space-y-1 max-h-44 overflow-y-auto">
            {curriculum.topics.map((t) => (
              <li key={t.topic} className="flex items-center gap-2 text-sm text-slate-300">
                {STATUS_ICON[t.status]}
                <span className={t.topic === curriculum.next ? 'font-bold text-white' : ''}>
                  {t.topic.replace(/-/g, ' ')}
                </span>
                {t.topic === curriculum.next && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-violet-300">next</span>
                )}
              </li>
            ))}
          </ul>
          {curriculum.next && (
            <button
              type="button"
              onClick={onContinue}
              disabled={disabled}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold btn-pill disabled:opacity-50"
            >
              Teach next topic <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
