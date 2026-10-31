import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Plus, PanelLeft, Brain, CheckCircle2, Code2, Network, Search } from 'lucide-react';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Loader from '../../components/Loader.jsx';
import { getErrorMessage } from '../../api/client.js';
import { sendMessage, sendFeedback, listSessions, getSession, deleteSession, reviewPractice } from '../../api/chat.js';
import { setHandoff, clearHandoff } from '../../lib/handoff.js';
import MessageBubble from './MessageBubble.jsx';
import MemoriesUsedPanel from './MemoriesUsedPanel.jsx';
import ChatHistoryPanel from './ChatHistoryPanel.jsx';
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

// Rebuild a saved chat message (from the database) as a message for the list.
const fromSaved = (m) => {
  if (m.role === 'user') return { id: uid(), role: 'user', content: m.content };
  const meta = m.meta || {};
  return {
    id: uid(),
    role: 'assistant',
    messageId: m.id,
    content: m.content,
    topic: m.topic,
    style: m.style,
    styleReason: meta.styleReason,
    ladderStep: meta.ladderStep,
    degraded: Boolean(m.degraded),
    ladder: meta.ladder || { tried: [], exhausted: false },
    exhausted: Boolean(meta.ladder?.exhausted),
    stylePlan: meta.stylePlan || [],
    memoriesUsed: m.memoriesUsed || [],
    understanding: meta.understanding || null,
    judgement: meta.judgement || null,
    levelChange: meta.levelChange || 0,
    awaitingAnswer: Boolean(meta.awaitingAnswer),
    // The review of an editor attempt has no "I understood" buttons
    feedback: m.feedback || (meta.practiceAttemptId ? 'done' : null),
  };
};

// Static class names so Tailwind keeps them: chat section + (optional) memory panel
const GRID_COLS = {
  true: 'lg:grid-cols-[minmax(0,1fr)_380px]',
  false: 'lg:grid-cols-[minmax(0,1fr)]',
};

const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 1024;

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

  // Chat history (everything is stored in the database; this is just the list)
  // Layout toggles only (no effect on chat, memory or teaching logic). Remembered per browser.
  // History sidebar: open by default on desktop (a drawer, closed, on phones). Memory panel: closed by default.
  const [historyOpen, setHistoryOpen] = useState(() => isDesktop());
  const [rightOpen, setRightOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const aiMessages = messages.filter((m) => m.role === 'assistant');
  const lastAi = aiMessages[aiMessages.length - 1];

  const busyRef = useRef(false); // blocks double clicks before React re-renders
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const reviewedRef = useRef(null); // stops the same editor attempt being reviewed twice

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

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await listSessions();
      setHistory(res.data?.sessions || []);
    } catch (err) {
      // the list is a convenience; the chat itself still works
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) refreshHistory();
  };

  const toggleRightPanel = () => {
    const next = !rightOpen;
    setRightOpen(next);
  };

  // On phones the sidebar is a drawer: close it after choosing something. On desktop it stays put.
  const closeDrawerOnPhone = () => {
    if (!isDesktop()) setHistoryOpen(false);
  };

  const handleOpenChat = async (id) => {
    if (loading || busyRef.current) return;
    if (id === sessionId) {
      closeDrawerOnPhone();
      return;
    }
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await getSession(id);
      const restored = (res.data?.messages || []).map(fromSaved);
      setSessionId(id);
      setMessages(restored);
      setSaved([]);
      setSkipped([]);
      const lastReply = [...restored].reverse().find((m) => m.role === 'assistant');
      setSelectedId(lastReply?.id || null);
      setInput('');
      closeDrawerOnPhone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleDeleteChat = async (chat) => {
    if (loading || busyRef.current) return;
    if (!window.confirm(`Delete "${chat.title}"? This cannot be undone.`)) return;
    try {
      await deleteSession(chat.sessionId);
      setHistory((prev) => prev.filter((c) => c.sessionId !== chat.sessionId));
      if (chat.sessionId === sessionId) handleNewSession(true);
    } catch (err) {
      setError(errorText(err));
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
      refreshHistory(); // the chat is saved server-side after every message
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

  const handleNewSession = (silent = false) => {
    setSessionId(uid());
    setMessages([]);
    setSaved([]);
    setSkipped([]);
    setSelectedId(null);
    setError(null);
    setInput('');
    closeDrawerOnPhone();
    if (silent !== true) setToast({ text: 'New chat started. Your old chats are in the sidebar.' });
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

  // Opening the Mentor always starts a fresh chat (see sessionId above); load the saved list in the background.
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // The sidebar "+" button links here with { newSession } state.
  useEffect(() => {
    if (location.state?.newSession) handleNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.newSession]);

  // Coming back from the code editor: reopen the SAME chat, then the mentor reviews the attempt.
  useEffect(() => {
    const { resumeSession, reviewAttemptId } = location.state || {};
    if (!reviewAttemptId || reviewedRef.current === reviewAttemptId) return;
    reviewedRef.current = reviewAttemptId;

    (async () => {
      busyRef.current = true;
      setLoading(true);
      setError(null);
      let target = sessionId;
      try {
        if (resumeSession) {
          try {
            const res = await getSession(resumeSession);
            setSessionId(resumeSession);
            setMessages((res.data?.messages || []).map(fromSaved));
            setSaved([]);
            setSkipped([]);
            target = resumeSession;
          } catch (err) {
            // That chat is gone (deleted): fall through and review in a fresh chat.
          }
        }
        const res = await reviewPractice({ sessionId: target, attemptId: reviewAttemptId });
        const ai = toAiMessage({ ...res.data, ladder: null }, 'done');
        if (!res.data.alreadyRecorded) {
          appendMessage(ai);
          setSelectedId(ai.id);
        }
        refreshHistory();
      } catch (err) {
        setError(errorText(err));
      } finally {
        clearHandoff();
        busyRef.current = false;
        setLoading(false);
        // Drop the router state so a refresh does not run this again.
        navigate(location.pathname, { replace: true, state: null });
        inputRef.current?.focus();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.reviewAttemptId, location.state?.at]);

  // Always remember which chat is open, so coming back from the editor lands in THIS chat
  // however the student left (the mentor's button, the navbar, the browser back button).
  useEffect(() => {
    if (messages.length > 0) setHandoff({ sessionId, topic: lastAi?.topic || null, pick: false });
    else clearHandoff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messages.length]);

  // The mentor sends the student to the code editor (pick: open a question on this topic).
  const goToEditor = (topic) => {
    setHandoff({ sessionId, topic: topic || lastAi?.topic || null, pick: true });
    navigate('/practice');
  };

  // The header search box links here with { prefill } state.
  useEffect(() => {
    if (location.state?.prefill) {
      setInput(location.state.prefill);
      inputRef.current?.focus();
    }
  }, [location.state?.prefill, location.state?.at]);

  return (
    <Layout>
      <div className={`grid grid-cols-1 gap-4 lg:gap-5 lg:h-[calc(100vh-10.5rem)] lg:overflow-hidden ${GRID_COLS[rightOpen]}`}>
        {/* Chat column */}
        <section className="glass relative rounded-[28px] flex flex-row min-h-[75vh] lg:min-h-0 min-w-0 overflow-hidden">
          {/* Conversation history: part of the chat card (collapsible; an overlay drawer on phones) */}
          <ChatHistoryPanel
            open={historyOpen}
            sessions={history}
            loading={historyLoading}
            activeId={sessionId}
            busy={loading}
            onClose={() => {
              setHistoryOpen(false);
            }}
            onNewChat={() => handleNewSession()}
            onOpen={handleOpenChat}
            onDelete={handleDeleteChat}
          />

          <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <header className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-[#ececf2]">
            {/* Show the header toggle only when the sidebar is closed.
                When the sidebar is open, its own collapse button is visible. */}
            {!historyOpen && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Show chat history"
                aria-pressed={false}
                title="Show chat history"
                className="p-2 rounded-full text-ink-soft hover:bg-[#f6f5fa] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-white truncate">
                {messages.length === 0 ? 'New chat' : history.find((c) => c.sessionId === sessionId)?.title || 'Current chat'}
              </p>
            </div>
            {!historyOpen && (
              <button
                type="button"
                onClick={() => handleNewSession()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold btn-pill focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New chat</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleRightPanel}
              aria-label={rightOpen ? 'Hide memory panel' : 'Show memory panel'}
              aria-pressed={rightOpen}
              title={rightOpen ? 'Hide memory panel' : 'Memory: what the mentor remembers'}
              className={`p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                rightOpen ? 'bg-[#ece5fa] text-[#7652C8]' : 'text-ink-soft hover:bg-[#f6f5fa]'
              }`}
            >
              <Brain className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6" aria-live="polite">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              {messages.length === 0 && !loading && (
                <div className="max-w-xl mx-auto mt-4 text-center">
                  <MentorOrb className="w-52 h-40 mx-auto mb-3" />
                  <h2 className="text-2xl font-extrabold text-white">Hi {firstName}, what shall we learn today?</h2>
                  <p className="text-base text-slate-400 mt-1">
                    The mentor adapts to what it remembers about you. Tap the brain icon at the top right to see
                    exactly which memories it used.
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
                  onGoPractice={() => goToEditor(m.topic)}
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
          </div>

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} className="mx-4 sm:mx-6 mb-2" />}

          <div className="px-4 sm:px-6 pb-4 pt-2">
            <div className="max-w-3xl mx-auto w-full">
              <div className="flex items-end gap-2 rounded-[28px] border border-[#ececf2] bg-white pl-5 pr-2 py-2 shadow-sm focus-within:border-[#7652C8] focus-within:ring-2 focus-within:ring-[#7652C8]/30">
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
                      ? 'Type your answer, or ask something else'
                      : 'Ask the mentor, for example: Explain recursion'
                  }
                  className="flex-1 resize-none bg-transparent py-2.5 text-base text-ink placeholder:text-ink-soft focus:outline-none disabled:opacity-60 max-h-40"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="inline-flex items-center gap-2 h-11 px-5 btn-pill text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7652C8] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
              <p className="mt-1.5 text-xs text-center text-slate-600">Enter to send, Shift+Enter for a new line.</p>
            </div>
          </div>
          </div>
        </section>

        {/* Right: memory / teaching panel. Closed by default; the brain icon opens it. Kept mounted so nothing resets. */}
        <div
          className={`glass relative rounded-[28px] min-h-[40vh] lg:min-h-0 overflow-hidden ${rightOpen ? '' : 'hidden'}`}
        >
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