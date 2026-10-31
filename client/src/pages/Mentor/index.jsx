import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, RefreshCw, CheckCircle2, Code2, Network, Search } from 'lucide-react';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Loader from '../../components/Loader.jsx';
import { getErrorMessage } from '../../api/client.js';
import { sendMessage, sendFeedback } from '../../api/chat.js';
import MessageBubble from './MessageBubble.jsx';
import MemoriesUsedPanel from './MemoriesUsedPanel.jsx';
import { MentorOrb } from '../../components/Illustrations.jsx';

const SUGGESTIONS = [
  { text: 'Explain recursion', icon: Code2 },
  { text: 'Teach me DFS', icon: Network },
  { text: 'Explain binary search', icon: Search },
];

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
  ladder: data.ladder || { tried: [], exhausted: false },
  exhausted: Boolean(data.ladder?.exhausted),
  stylePlan: data.stylePlan || [],
  memoriesUsed: data.memoriesUsed || [],
  understanding: data.understanding || null,
  judgement: data.judgement || null,
  levelChange: data.levelChange || 0,
  awaitingAnswer: Boolean(data.awaitingAnswer),
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

  const [skipped, setSkipped] = useState([]);

  const aiMessages = messages.filter((m) => m.role === 'assistant');
  const lastAi = aiMessages[aiMessages.length - 1];

  const busyRef = useRef(false); // blocks double clicks before React re-renders
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

  const addSkipped = useCallback((items) => {
    if (!items || items.length === 0) return;
    const stamp = Date.now();
    setSkipped((prev) => [
      ...items.map((it, i) => ({ key: `skip-${stamp}-${i}`, ...it })),
      ...prev,
    ]);
  }, []);

  const appendMessage = (m) => setMessages((prev) => [...prev, m]);

  // Shared by the feedback buttons and typed feedback ("got it", "I don't understand").
  // `target` is the AI message the feedback is about.
  const applyFeedbackResult = (data, target, understood) => {
    if (data.alreadyRecorded) {
      setToast({ text: 'Already recorded. Nothing new was saved.' });
    }
    if (target) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === target.id
            ? {
                ...m,
                feedback: understood ? 'understood' : 'not_understood',
                // Newest ladder carries worked/failed outcomes for every style.
                ladder: data.ladder?.tried?.length ? data.ladder : m.ladder,
              }
            : m
        )
      );
    }
    if (!data.alreadyRecorded) {
      addSaved(data.memoriesSaved, 'saved');
      addSaved(data.memoriesUpdated, 'updated');
    }
    addSkipped(data.memoriesSkipped);

    if (understood) {
      if (!data.alreadyRecorded) {
        const first = data.memoriesSaved?.[0];
        setToast({
          text: first ? `Saved to memory: ${first.content}` : 'Marked as understood.',
        });
      }
      // Short "try a question" nudge. Never add an empty bubble.
      if (data.reply && data.reply.trim()) appendMessage(toAiMessage(data, 'done'));
    } else if (data.reply && data.reply.trim()) {
      const ai = toAiMessage(data);
      appendMessage(ai);
      setSelectedId(ai.id);
    }
  };

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading || busyRef.current) return;

    busyRef.current = true;
    setInput('');
    setError(null);
    appendMessage({ id: uid(), role: 'user', content });
    setLoading(true);

    try {
      const res = await sendMessage({ sessionId, message: content });
      const data = res.data;

      if (data.feedbackApplied === 'understood' || data.feedbackApplied === 'not_understood') {
        // Typed feedback: same handling as a button click, on the previous reply.
        applyFeedbackResult(data, lastAi, data.feedbackApplied === 'understood');
      } else {
        const ai = toAiMessage(data);
        appendMessage(ai);
        setSelectedId(ai.id);
        addSaved(data.memoriesSaved, 'saved');
        addSkipped(data.memoriesSkipped);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      busyRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFeedback = async (message, understood) => {
    if (loading || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setLoading(true);

    try {
      const res = await sendFeedback({
        sessionId,
        messageId: message.messageId,
        understood,
      });
      applyFeedbackResult(res.data, message, understood);
    } catch (err) {
      setError(errorText(err));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setSessionId(uid());
    setMessages([]);
    setSaved([]);
    setSkipped([]);
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
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-5 lg:h-[calc(100vh-10.5rem)] lg:overflow-hidden">
        {/* Chat column */}
        <section className="glass rounded-[28px] flex flex-col min-h-[75vh] lg:min-h-0 min-w-0 overflow-hidden">
          <header className="flex items-center gap-3 px-6 py-4 border-b border-[#ececf2]">
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
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-[#ececf2] bg-white text-ink shadow-sm hover:bg-[#f6f5fa] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New session
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4" aria-live="polite">
            {messages.length === 0 && !loading && (
              <div className="max-w-xl mx-auto mt-4 text-center">
                <MentorOrb className="w-52 h-40 mx-auto mb-3" />
                <h2 className="text-2xl font-extrabold text-white">Hi {firstName}, what shall we learn today?</h2>
                <p className="text-base text-slate-400 mt-1">
                  The mentor adapts to what it remembers about you. The panel on the right shows exactly which
                  memories it used.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {SUGGESTIONS.map(({ text, icon: Icon }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => handleSend(text)}
                      className="chip-soft px-5 py-2.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7652C8]"
                    >
                      <Icon className="w-4 h-4" />
                      {text}
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
                onAskLine={() => inputRef.current?.focus()}
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

          <div className="px-6 pb-4 pt-3 border-t border-[#ececf2]">
            <div className="flex items-center gap-3">
              <label htmlFor="mentor-input" className="sr-only">
                Message the mentor
              </label>
              <textarea
                id="mentor-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder={
                  lastAi?.awaitingAnswer
                    ? 'Type your answer to the question above, or ask something else'
                    : 'Ask the mentor, for example: Explain recursion'
                }
                className="flex-1 resize-none rounded-full border border-[#ececf2] bg-white px-6 py-3 text-base text-ink shadow-sm placeholder:text-ink-soft focus:outline-none focus:border-[#7652C8] focus:ring-2 focus:ring-[#7652C8]/30 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-2 h-12 px-6 btn-pill text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7652C8] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">Enter to send, Shift+Enter for a new line.</p>
          </div>
        </section>

        {/* Memories used panel */}
        <div className="glass relative rounded-[28px] min-h-[40vh] lg:min-h-0 overflow-hidden">
        <MemoriesUsedPanel
          used={shownAi?.memoriesUsed || []}
          saved={saved}
          skipped={skipped}
          plan={shownAi?.stylePlan || []}
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
