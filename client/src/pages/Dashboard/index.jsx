import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brackets, Type, Link2, Layers, Hash, ArrowDownWideNarrow, Repeat, GitBranch, Network, Grid3x3,
  ChevronRight, Plus, Flame, TrendingUp, TrendingDown, Check, X as XIcon, AlertTriangle,
} from 'lucide-react';
import Layout from '../../components/Layout.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Loader from '../../components/Loader.jsx';
import HoursChart from '../../components/activity/HoursChart.jsx';
import ActivityCalendar from '../../components/activity/ActivityCalendar.jsx';
import BadgeIcon from '../../components/activity/BadgeIcon.jsx';
import { useActivity } from '../../context/ActivityContext.jsx';
import { getDashboardData } from '../../api/dashboard.js';
import { getErrorMessage } from '../../api/client.js';
import { prettyTopic, prettyQuestion } from '../../lib/format.js';

const TOPIC_ICONS = {
  arrays: Brackets, strings: Type, 'linked-list': Link2, 'stacks-queues': Layers, hashing: Hash,
  sorting: ArrowDownWideNarrow, recursion: Repeat, trees: GitBranch, graphs: Network, dp: Grid3x3,
};
const TILE_COLORS = [
  { bg: '#fde3d6', fg: '#c2562a' },
  { bg: '#eaf6b8', fg: '#5f7a00' },
  { bg: '#EAE1F7', fg: '#5B3E9E' },
  { bg: '#fdeccd', fg: '#a86a00' },
];
const tile = (i) => TILE_COLORS[i % TILE_COLORS.length];

const TIER = (score) => (score < 40
  ? { label: 'Weak', stroke: '#e5484d', pill: 'bg-[#fde3d6] text-[#b4441f]' }
  : score < 70
    ? { label: 'Learning', stroke: '#f0a21a', pill: 'bg-[#fdeccd] text-[#9a6200]' }
    : { label: 'Strong', stroke: '#7aa800', pill: 'bg-[#eaf6b8] text-[#4d6600]' });

function TopicTile({ topic, index, size = 'w-12 h-12' }) {
  const Icon = TOPIC_ICONS[topic] || Brackets;
  const c = tile(index);
  return (
    <span className={`grid place-items-center shrink-0 rounded-full ${size}`} style={{ background: c.bg, color: c.fg }} aria-hidden="true">
      <Icon className="w-5 h-5" />
    </span>
  );
}

function Ring({ value, color, size = 44 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececf2" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-2xl font-extrabold tracking-tight text-ink">{children}</h2>
      {right}
    </div>
  );
}

function formatAttemptDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function formatLast(ts) {
  if (!ts) return 'Not practiced yet';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const { summary } = useActivity();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDashboardData();
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your dashboard.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const mastery = data?.mastery || [];
  const attempts = data?.recentAttempts || [];
  const stats = data?.stats || { totalAttempts: 0, passRate: 0, activeMemories: 0 };

  // Weakest first: that is what to practise next
  const byWeakness = useMemo(() => [...mastery].sort((a, b) => a.score - b.score), [mastery]);
  const next3 = byWeakness.slice(0, 3);
  const rows = showAll ? byWeakness : byWeakness.slice(0, 2);

  const streak = summary?.streak;
  const badges = summary?.badges || [];
  const earnedCount = badges.filter((b) => b.earned).length;
  // Latest earned first, then the ones closest to being earned
  const badgeList = useMemo(() => {
    const earned = badges.filter((b) => b.earned).sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));
    const open = badges.filter((b) => !b.earned).sort((a, b) => b.progress / b.target - a.progress / a.target);
    return [...earned.slice(0, 2), ...open].slice(0, 4);
  }, [badges]);

  const passPct = Math.round(stats.passRate > 1 ? stats.passRate : stats.passRate * 100);

  return (
    <Layout>
      {error && <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} className="mb-4" />}
      {loading && !data ? (
        <Loader label="Loading your dashboard…" className="py-24" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-4">
          {/* ---------- Main column ---------- */}
          <div className="min-w-0 flex flex-col gap-4">
            <section aria-label="Practice next">
              <SectionTitle right={<Link to="/practice" className="text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink">View All</Link>}>
                Practice Next
              </SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {next3.map((m, i) => {
                  const t = TIER(m.score);
                  return (
                    <Link key={m.topic} to="/practice" className="glass rounded-[22px] p-4 block hover:-translate-y-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                      <div className="flex items-center gap-3">
                        <TopicTile topic={m.topic} index={i} />
                        <div className="min-w-0">
                          <p className="font-bold text-ink truncate">{prettyTopic(m.topic)}</p>
                          <p className="text-xs text-ink-soft">{m.attempts} {m.attempts === 1 ? 'attempt' : 'attempts'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xs text-ink-soft">Mastery</p>
                          <p className="text-xl font-extrabold text-ink">{m.score}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-ink-soft">Level</p>
                          <span className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${t.pill}`}>{t.label}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {!next3.length && <p className="text-sm text-ink-soft md:col-span-3">No topics yet. Solve a question to start tracking mastery.</p>}
              </div>
            </section>

            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4">
              <HoursChart week={summary?.week} />

              <section className="glass rounded-[24px] p-5" aria-label="Badges">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-2xl font-extrabold tracking-tight text-ink">Badges</h2>
                  <Link to="/profile" className="rounded-full bg-[#f1f0f6] px-3.5 py-1.5 text-sm font-bold text-ink">{earnedCount}/{badges.length || 12}</Link>
                </div>
                <ul className="flex flex-col gap-3">
                  {badgeList.map((b) => (
                    <li key={b.key}>
                      <Link to="/profile" className="flex items-center gap-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-2xl">
                        <BadgeIcon icon={b.icon} tier={b.tier} earned={b.earned} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink truncate">{b.name}</p>
                          {b.earned ? (
                            <p className="text-xs text-ink-soft truncate">{b.description}</p>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="h-1.5 flex-1 rounded-full bg-[#ececf2] overflow-hidden">
                                <span className="block h-full rounded-full bg-[#7652C8]" style={{ width: `${(b.progress / b.target) * 100}%` }} />
                              </span>
                              <span className="text-[11px] font-semibold text-ink-soft tabular-nums">{b.progress}/{b.target}</span>
                            </div>
                          )}
                        </div>
                        <span className="grid place-items-center w-8 h-8 rounded-full border border-[#ececf2] text-ink group-hover:bg-[#f6f5fa]"><ChevronRight className="w-4 h-4" /></span>
                      </Link>
                    </li>
                  ))}
                  {!badgeList.length && <li className="text-sm text-ink-soft">Badges appear here as you practise.</li>}
                </ul>
              </section>
            </div>

            <section aria-label="Topic mastery">
              <SectionTitle
                right={
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowAll((v) => !v)} className="rounded-full border border-[#ececf2] bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                      {showAll ? 'Weakest first' : `Show all ${byWeakness.length}`}
                    </button>
                    <Link to="/practice" aria-label="Practice" className="grid place-items-center w-9 h-9 rounded-full bg-[#F28A52] text-ink"><Plus className="w-4 h-4" /></Link>
                  </div>
                }
              >
                Topic Mastery
              </SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rows.map((m, i) => {
                  const t = TIER(m.score);
                  const trend = m.trend || [];
                  const up = trend.length > 1 ? trend[trend.length - 1] >= trend[0] : null;
                  return (
                    <div key={m.topic} className="glass rounded-[20px] px-4 py-2.5 flex items-center gap-4">
                      <TopicTile topic={m.topic} index={i} size="w-12 h-12 rounded-2xl" />
                      <div className="min-w-0 flex-1 grid sm:grid-cols-[1.2fr_1fr] items-center gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-ink truncate">{prettyTopic(m.topic)}</p>
                          <p className="text-sm text-ink-soft truncate">{m.attempts} {m.attempts === 1 ? 'attempt' : 'attempts'} · last {formatLast(m.lastPracticed)}</p>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-xs text-ink-soft">Level</p>
                          <p className="font-bold text-ink flex items-center gap-1.5">
                            {t.label}
                            {up !== null && (up ? <TrendingUp className="w-4 h-4 text-emerald-600" aria-label="Improving" /> : <TrendingDown className="w-4 h-4 text-rose-600" aria-label="Dropping" />)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Ring value={m.score} color={t.stroke} />
                        <span className="w-11 text-right text-lg font-extrabold text-ink tabular-nums">{m.score}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ---------- Right column ---------- */}
          <div className="min-w-0 flex flex-col gap-4">
            <section className="relative overflow-hidden rounded-[24px] bg-[#251D35] p-5 text-[#fff]" aria-label="Streak">
              <span className="pointer-events-none absolute -right-8 -top-8 w-40 h-40 rounded-full bg-[#7652C8]/30" aria-hidden="true" />
              <span className="pointer-events-none absolute right-10 bottom-4 w-16 h-16 rounded-full bg-[#F28A52]/20" aria-hidden="true" />
              <div className="relative flex items-center gap-2 text-sm font-semibold text-[#fff]/70">
                <Flame className="w-4 h-4 text-[#ff9b54]" /> Learning streak
              </div>
              <p className="relative mt-2 text-4xl font-extrabold tracking-tight">
                {streak?.current ?? 0}<span className="ml-2 text-xl font-bold text-[#fff]/70">day{(streak?.current ?? 0) === 1 ? '' : 's'}</span>
              </p>
              <p className="relative mt-1 text-sm text-[#fff]/60">
                Longest {streak?.longest ?? 0} · {stats.totalAttempts} attempts · {passPct}% pass rate
              </p>
              <p className="relative mt-3 text-sm text-[#fff]/80 max-w-[16rem]">
                {streak?.activeToday ? 'Today is counted. Come back tomorrow to keep it going.' : 'Solve a question or ask the mentor to count today.'}
              </p>
              <Link to="/practice" className="relative mt-3 inline-block rounded-full bg-[#F28A52] px-5 py-2 text-sm font-extrabold text-[#251D35] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Practice now
              </Link>
            </section>

            <ActivityCalendar />

            <section aria-label="Recent attempts">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Recent Attempts</h2>
                <Link to="/practice" aria-label="New attempt" className="grid place-items-center w-9 h-9 rounded-full bg-[#F28A52] text-ink"><Plus className="w-4 h-4" /></Link>
              </div>
              <div className="flex flex-col gap-2">
                {attempts.slice(0, 2).map((a, i) => {
                  const pass = a.result === 'pass';
                  const err = a.result === 'error';
                  return (
                    <div key={a._id} className="glass rounded-[18px] px-3.5 py-2.5 flex items-center gap-3.5">
                      <span className="grid place-items-center w-11 h-11 rounded-2xl shrink-0" style={{ background: tile(i + 1).bg, color: tile(i + 1).fg }} aria-hidden="true">
                        {pass ? <Check className="w-5 h-5" /> : err ? <AlertTriangle className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink truncate">{prettyQuestion(a.questionId)}</p>
                        <p className="text-xs text-ink-soft">{formatAttemptDate(a.timestamp)} · {a.testsPassed}/{a.testsTotal} tests</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${pass ? 'bg-[#eaf6b8] text-[#4d6600]' : err ? 'bg-[#EAE1F7] text-[#5B3E9E]' : 'bg-[#fde3d6] text-[#b4441f]'}`}>
                        {pass ? 'Passed' : err ? 'Error' : 'Failed'}
                      </span>
                    </div>
                  );
                })}
                {!attempts.length && <p className="glass rounded-[22px] p-4 text-sm text-ink-soft">No attempts yet. Pick a question in Practice.</p>}
              </div>
            </section>
          </div>
        </div>
      )}
    </Layout>
  );
}
