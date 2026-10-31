import React from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '../api/client.js';

// `error` can be a string, an Error, or an axios error. The text comes from
// error.response.data.error.message when the API sent one.
export default function ErrorBanner({ error, onDismiss, onRetry, className = '' }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : getErrorMessage(error);

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300 ${className}`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-xs font-semibold text-white underline underline-offset-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
