import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, RefreshCw, CheckCircle2 } from 'lucide-react';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Loader from '../../components/Loader.jsx';
import { getErrorMessage } from '../../api/client.js';
import { sendMessage, sendFeedback } from '../../api/chat.js';
import MessageBubble from './MessageBubble.jsx';
import MemoriesUsedPanel from './MemoriesUsedPanel.jsx';

const SUGGESTIONS = ['Explain recursion', 'Teach me DFS', 'Explain binary search'];

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Turn an API reply (chat or feedback shape) into a message for the list.
const toAiMessage = (data, feedback = null) => ({
  id: uid(),
  role: 'assistant',
  messageId: data.messageId,
  content: data.reply || '',
  topic: data.topic,
  style: data.explanationStyle,
  styleReason: data.styleReason,
  ladderStep: data.ladderStep,
  degraded: Boolean(data.degraded),
  memoriesUsed: data.memoriesUsed || [],
  feedback,
});

const errorText = (err) => getErrorMessage(err);

export default function Mentor() {
  const { user } = useUser() || {};
  const navigate = useNavigate();
  const location = useLocation();

  const [sessionId, setSessionId] = useState(() => uid());
  const [messages, setMessages] = useState([]);
  const [saved, setSaved] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const addSaved = useCallback((memories, kind) => {
    if (!memories || memories.length === 0) return;
    const stamp = Date.now();
    const items = memories.map((memory, i) => ({
      key: `${kind}-${memory._id || i}-${stamp}`,
      memory,
      kind,
    }));
    setSaved((prev) => [...items, ...prev]);
  }, []);

  const appendMessage = (m) => setMessages((prev) => [...prev, m]);

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setInput('');
    setError(null);
    appendMessage({ id: uid(), role: 'user', content });
    setLoading(true);

    try {
      const res = await sendMessage({ sessionId, message: content });
      const ai = toAiMessage(res.data);
      appendMessage(ai);
      setSelectedId(ai.id);
      addSaved(res.data.memoriesSaved, 'saved');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFeedback = async (message, understood) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await sendFeedback({
        sessionId,
        messageId: message.messageId,
        understood,
      });
      const data = res.data;

      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, feedback: understood ? 'understood' : 'not_understood' } : m))
      );
      addSaved(data.memoriesSaved, 'saved');
      addSaved(data.memoriesUpdated, 'updated');

      if (understood) {
        const first = data.memoriesSaved?.[0];
        setToast({
          text: first ? `Saved to memory: ${first.content}` : 'Marked as understood.',
        });
        if (data.reply && data.reply.trim()) {
          // Short "try a question" nudge; no feedback buttons on it.
          appendMessage(toAiMessage(data, 'done'));
        }
      } else if (data.reply && data.reply.trim()) {
        const ai = toAiMessage(data);
        appendMessage(ai);
        setSelectedId(ai.id);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setSessionId(uid());
    setMessages([]);
    setSaved([]);
    setSelectedId(null);
    setError(null);
    setInput('');
    setToast({ text: 'New session started. Your memories are kept.' });
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const firstName = (user?.name || '').trim().split(' ')[0] || 'there';

  const aiMessages = messages.filter((m) => m.role === 'assistant');
  const lastAi = aiMessages[aiMessages.length - 1];
  const shownAi = aiMessages.find((m) => m.id === selectedId) || lastAi;

  // The sidebar "+" button links here with { newSession } state.
  useEffect(() => {
    if (location.state?.newSession) handleNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.newSession]);

  // The header search box links here with { prefill } state.
  useEffect(() => {
    if (location.state?.prefill) {
      setInput(location.state.prefill);
      inputRef.current?.focus();
    }
  }, [location.state?.prefill, location.state?.at]);

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-5 lg:h-[calc(100vh-12.5rem)] lg:overflow-hidden">
        {/* Chat column */}
        <section className="glass rounded-[32px] flex flex-col min-h-[75vh] lg:min-h-0 min-w-0 overflow-hidden">
          <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
            <div className="min-w-0">
              <p className="text-base font-bold text-white">Chat</p>
              <p className="text-sm text-slate-500 truncate">
                Session {sessionId.slice(0, 8)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNewSession}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New session
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4" aria-live="polite">
            {messages.length === 0 && !loading && (
              <div className="max-w-xl mx-auto mt-10 text-center">
                <div className="orb w-28 h-28 mx-auto mb-6" aria-hidden="true" />
                <h2 className="text-2xl font-extrabold text-white">Hi {firstName}, what shall we learn today?</h2>
                <p className="text-base text-slate-400 mt-1">
                  The mentor adapts to what it remembers about you. The panel on the right shows exactly which
                  memories it used.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSend(s)}
                      className="px-5 py-2.5 rounded-full text-base font-bold border border-white/10 bg-white/5 text-slate-200 hover:border-violet-400/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                selected={shownAi?.id === m.id}
                showFeedback={m.role === 'assistant' && m.id === lastAi?.id && m.feedback === null}
                busy={loading}
                onSelect={() => m.role === 'assistant' && setSelectedId(m.id)}
                onUnderstood={() => handleFeedback(m, true)}
                onNotUnderstood={() => handleFeedback(m, false)}
                onGoPractice={() => navigate('/practice')}
              />
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md glass px-4 py-3">
                  <Loader label="The mentor is thinking…" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} className="mx-6 mb-2" />}

          <div className="px-6 pb-5 pt-4 border-t border-white/10">
            <div className="flex items-end gap-2">
              <label htmlFor="mentor-input" className="sr-only">
                Message the mentor
              </label>
              <textarea
                id="mentor-input"
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask the mentor, for example: Explain recursion"
                className="flex-1 resize-none rounded-[28px] border border-white/10 bg-[#3b1d6e]/70 px-5 py-3 text-base text-white placeholder-violet-200/50 focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-300 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-1.5 h-11 px-5 btn-pill text-base shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">Enter to send, Shift+Enter for a new line.</p>
          </div>
        </section>

        {/* Memories used panel */}
        <div className="glass rounded-[32px] min-h-[40vh] lg:min-h-0 overflow-hidden">
        <MemoriesUsedPanel
          used={shownAi?.memoriesUsed || []}
          saved={saved}
          loading={loading}
          replyKey={shownAi?.id || 'none'}
          hasReply={Boolean(shownAi)}
          degraded={shownAi?.degraded}
        />
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 lg:bottom-6 right-6 z-50 max-w-sm flex items-start gap-2 rounded-xl glass-strong px-4 py-3 text-base font-medium text-emerald-200 shadow-2xl"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{toast.text}</span>
        </div>
      )}
    </Layout>
  );
}
