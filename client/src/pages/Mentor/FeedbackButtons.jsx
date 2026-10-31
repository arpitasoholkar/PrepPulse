import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

export default function FeedbackButtons({ disabled, onUnderstood, onNotUnderstood }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onUnderstood}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        I understood
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onNotUnderstood}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
        I didn't understand
      </button>
    </div>
  );
}
