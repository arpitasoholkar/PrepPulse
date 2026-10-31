import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RotateCcw, RefreshCw } from 'lucide-react';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import { getErrorMessage } from '../../api/client.js';
import { getQuestions, submitSolution } from '../../api/practice.js';
import QuestionList from './QuestionList.jsx';
import ResultCard from './ResultCard.jsx';

const errorText = (err) => getErrorMessage(err);

export default function Practice() {
  const { user } = useUser() || {};
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [codeById, setCodeById] = useState({});
  const [resultById, setResultById] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const resultRef = useRef(null);

  const loadQuestions = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await getQuestions();
      // Recommended questions first, otherwise keep the server order.
      const list = [...(res.data.questions || [])].sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended));
      setQuestions(list);
      setCodeById((prev) => {
        const next = { ...prev };
        list.forEach((q) => {
          if (next[q.id] === undefined) next[q.id] = q.starterCode || '';
        });
        return next;
      });
      setSelectedId((prev) => prev || list[0]?.id || null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadQuestions();
  }, [user, loadQuestions]);

  const question = questions.find((q) => q.id === selectedId) || null;
  const code = question ? codeById[question.id] ?? '' : '';
  const result = question ? resultById[question.id] : null;

  const setCode = (value) => setCodeById((prev) => ({ ...prev, [question.id]: value }));

  const handleReset = () => setCode(question.starterCode || '');

  const handleSubmit = async () => {
    if (!question || submitting) return;
    if (!code.trim()) {
      setError('Write some code before you submit.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitSolution({
        questionId: question.id,
        code,
        language: question.language || 'javascript',
      });
      setResultById((prev) => ({ ...prev, [question.id]: res.data }));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      // Keep focus in the editor and insert two spaces.
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${code.slice(0, start)}  ${code.slice(end)}`;
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
      });
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearResult = () =>
    question && setResultById((prev) => ({ ...prev, [question.id]: undefined }));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {error && (
          <ErrorBanner
            error={error}
            onDismiss={() => setError(null)}
            onRetry={questions.length === 0 && !loadingList ? loadQuestions : undefined}
            className="mb-4"
          />
        )}

        {loadingList ? (
          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4" aria-busy="true">
            <div className="space-y-2.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl glass animate-pulse" />
              ))}
            </div>
            <div className="h-96 rounded-[32px] glass animate-pulse" />
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-[32px] glass p-8 text-center">
            <p className="text-white font-bold">No questions available</p>
            <p className="text-base text-slate-400 mt-1">The server returned an empty list. Try again in a moment.</p>
            <button
              type="button"
              onClick={loadQuestions}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload questions
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 lg:gap-5 items-start">
            <QuestionList
              questions={questions}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setError(null);
              }}
            />

            {question && (
              <div className="glass rounded-[32px] p-5 lg:p-6 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{question.title}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-300">
                    {question.topic}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-white/15 text-slate-400">
                    {question.language || 'javascript'}
                  </span>
                </div>
                <p className="mt-3 text-base text-slate-300 leading-relaxed">{question.prompt}</p>

                <label htmlFor="code-editor" className="sr-only">
                  Your solution
                </label>
                <textarea
                  id="code-editor"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  rows={14}
                  disabled={submitting}
                  className="mt-4 w-full resize-y rounded-3xl border border-white/10 bg-black/30 p-4 font-mono text-[13px] leading-relaxed text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 h-11 px-6 btn-pill text-base shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    <Play className="w-4 h-4" />
                    {submitting ? 'Checking your code…' : 'Submit'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-slate-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset code
                  </button>
                  <span className="text-xs text-slate-600">Ctrl or Cmd + Enter to submit</span>
                </div>

                {result && (
                  <div ref={resultRef} className="mt-6 pt-6 border-t border-white/10 scroll-mt-20">
                    <ResultCard
                      result={result}
                      onTryAgain={clearResult}
                      onAskMentor={() => navigate('/mentor')}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
