import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import FeedbackButtons from './FeedbackButtons.jsx';
import { getStyleBadge } from '../../components/memoryStyles.js';

const markdownComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="text-base font-bold text-white mt-4 mb-2">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-bold text-white mt-4 mb-2">{children}</h3>,
  h3: ({ children }) => <h4 className="text-base font-bold text-white mt-3 mb-1.5">{children}</h4>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-violet-300 underline underline-offset-2">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3.5 text-sm leading-relaxed font-mono text-slate-200 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-slate-200">
      {children}
    </pre>
  ),
  code: ({ className, children }) => (
    <code className={`${className || ''} rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-violet-200`}>
      {children}
    </code>
  ),
};

export default function MessageBubble({
  message,
  selected,
  showFeedback,
  busy,
  onSelect,
  onUnderstood,
  onNotUnderstood,
  onGoPractice,
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[24px] rounded-br-md bg-gradient-to-br from-[#7652C8] to-[#5B3E9E] text-white px-4 py-2.5 text-base font-medium whitespace-pre-wrap shadow-lg shadow-[#7652C8]/30">
          {message.content}
        </div>
      </div>
    );
  }

  const badge = getStyleBadge(message.style);

  return (
    <div className="flex justify-start">
      <div
        onClick={onSelect}
        className={`max-w-[94%] w-full rounded-[24px] rounded-bl-md glass px-5 py-4 cursor-pointer transition ${
          selected ? '!border-violet-400/60 ring-1 ring-violet-400/30' : 'hover:!border-white/20'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.chip}`}>
            {badge.label}
          </span>
          {message.topic && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-300">
              {message.topic}
            </span>
          )}
          {typeof message.ladderStep === 'number' && message.ladderStep > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 text-slate-400">
              Attempt {message.ladderStep + 1}
            </span>
          )}
          {message.degraded && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Fallback reply
            </span>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {message.memoriesUsed.length} {message.memoriesUsed.length === 1 ? 'memory' : 'memories'} used
          </span>
        </div>

        {message.styleReason && <p className="text-sm italic text-slate-400 mb-3">{message.styleReason}</p>}

        <div className="text-base text-slate-200">
          <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
        </div>

        {showFeedback && (
          <div onClick={(e) => e.stopPropagation()}>
            <FeedbackButtons disabled={busy} onUnderstood={onUnderstood} onNotUnderstood={onNotUnderstood} />
          </div>
        )}

        {message.feedback === 'understood' && (
          <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-emerald-300">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marked as understood
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGoPractice();
              }}
              className="inline-flex items-center gap-1 font-semibold text-violet-300 hover:text-violet-200 underline underline-offset-2"
            >
              Try a practice question
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {message.feedback === 'not_understood' && (
          <p className="mt-4 text-sm text-slate-500">You asked for another explanation. See the reply below.</p>
        )}
      </div>
    </div>
  );
}
