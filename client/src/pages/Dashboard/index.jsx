import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { getDashboardData } from '../../api/dashboard.js';
import {
  Brain,
  Award,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Code,
  Clock,
  ArrowUpRight,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

/**
 * Lightweight SVG Sparkline component for rendering recent score trends (last 10 scores)
 */
function Sparkline({ scores = [], color = '#10b981', width = 120, height = 32 }) {
  if (!scores || scores.length === 0) {
    return <span className="text-[10px] text-slate-500 italic">No trend data yet</span>;
  }

  // If single score, display steady line
  const normalized = scores.length === 1 ? [scores[0], scores[0]] : scores;
  const minScore = 0;
  const maxScore = 100;
  const padding = 4;

  const points = normalized.map((score, index) => {
    const x = padding + (index / (normalized.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((score - minScore) / (maxScore - minScore)) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');
  const firstScore = normalized[0];
  const lastScore = normalized[normalized.length - 1];
  const isUp = lastScore >= firstScore;
  const strokeColor = isUp ? '#10b981' : '#f43f5e'; // emerald or rose

  // Closed area polygon for soft gradient fill
  const firstPointX = padding;
  const lastPointX = width - padding;
  const areaPoints = `${polylinePoints} ${lastPointX},${height} ${firstPointX},${height}`;

  return (
    <div className="flex items-center space-x-2">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`grad-${firstScore}-${lastScore}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill underneath */}
        <polygon points={areaPoints} fill={`url(#grad-${firstScore}-${lastScore})`} />

        {/* Trend Polyline */}
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />

        {/* Data points */}
        {normalized.map((score, index) => {
          const x = padding + (index / (normalized.length - 1)) * (width - 2 * padding);
          const y = height - padding - ((score - minScore) / (maxScore - minScore)) * (height - 2 * padding);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={index === normalized.length - 1 ? 3 : 2}
              fill={index === normalized.length - 1 ? strokeColor : '#94a3b8'}
            >
              <title>{`Attempt score: ${score}`}</title>
            </circle>
          );
        })}
      </svg>

      <span className={`text-[10px] font-semibold flex items-center ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
        {lastScore}
      </span>
    </div>
  );
}

function getMasteryTier(score) {
  if (score < 40) {
    return {
      label: 'Weak',
      badge: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
      bar: 'bg-gradient-to-r from-rose-600 to-rose-500',
      text: 'text-rose-400'
    };
  }
  if (score < 70) {
    return {
      label: 'Learning',
      badge: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
      bar: 'bg-gradient-to-r from-amber-600 to-amber-500',
      text: 'text-amber-400'
    };
  }
  return {
    label: 'Strong',
    badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
    bar: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    text: 'text-emerald-400'
  };
}

function formatDate(dateString) {
  if (!dateString) return 'Not yet practiced';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDashboardData();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.response?.data?.error?.message || 'Failed to load dashboard aggregates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const masteryList = data?.mastery || [];
  const strengths = data?.strengths || [];
  const weaknesses = data?.weaknesses || [];
  const recentMistakes = data?.recentMistakes || [];
  const recentAttempts = data?.recentAttempts || [];
  const stats = data?.stats || { totalAttempts: 0, passRate: 0, activeMemories: 0 };

  const passRatePercentage = Math.round(
    stats.passRate > 1 ? stats.passRate : stats.passRate * 100
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Dashboard Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-950/60 border border-indigo-800/80 rounded-xl text-indigo-400">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Learning Analytics & Mastery
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Person B
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Real-time cognitive progress, topic mastery ladders, error patterns, and memory vault metrics.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
            <Link
              to="/vault"
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
            >
              <span>Open Vault</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
            <p className="text-sm">Calculating mastery metrics & aggregate data...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-950/30 border border-rose-800/80 rounded-xl text-rose-300 flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold text-sm">Failed to load dashboard data</p>
              <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. Overall Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Active Memories */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Active Vault Memories
                  </span>
                  <div className="p-2 bg-indigo-950/60 rounded-lg text-indigo-400 border border-indigo-800/60">
                    <Brain className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-white">{stats.activeMemories}</span>
                  <span className="text-xs text-indigo-300 font-medium">persisted traits</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Strengths, preferences & mistakes tailoring your AI mentor.
                </p>
                <div className="mt-3 pt-3 border-t border-slate-800/60">
                  <Link to="/vault" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                    Manage Memory Vault <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Pass Rate */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Practice Pass Rate
                  </span>
                  <div className="p-2 bg-emerald-950/60 rounded-lg text-emerald-400 border border-emerald-800/60">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-white">{passRatePercentage}%</span>
                  <span className={`text-xs font-semibold ${passRatePercentage >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {passRatePercentage >= 70 ? 'Optimal' : 'Needs practice'}
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, passRatePercentage))}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Calculated across verified test-suite submissions.
                </p>
              </div>

              {/* Total Practice Attempts */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Total Coding Attempts
                  </span>
                  <div className="p-2 bg-cyan-950/60 rounded-lg text-cyan-400 border border-cyan-800/60">
                    <Code className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-white">{stats.totalAttempts}</span>
                  <span className="text-xs text-cyan-300 font-medium">submissions</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Tracked challenge questions across 10 DSA topics.
                </p>
                <div className="mt-3 pt-3 border-t border-slate-800/60">
                  <Link to="/practice" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1">
                    Solve more problems <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. Topic Mastery Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Topic Mastery Breakdown
                  </h2>
                  <p className="text-xs text-slate-400">
                    Evaluated scores (0–100) with score trend history across the last 10 attempts per topic.
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Weak (&lt;40)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Learning (40-69)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Strong (≥70)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {masteryList.map(item => {
                  const score = item.score ?? item.masteryScore ?? 0;
                  const tier = getMasteryTier(score);
                  const trendScores = item.trend || item.history || [];

                  return (
                    <div
                      key={item.topic}
                      className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm capitalize text-white">
                            {item.topic}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tier.badge}`}>
                            {tier.label}
                          </span>
                        </div>
                        <span className="text-base font-bold text-white">
                          {score} <span className="text-xs font-normal text-slate-500">/ 100</span>
                        </span>
                      </div>

                      {/* Colored Progress Bar */}
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full transition-all duration-500 ${tier.bar}`}
                          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                        ></div>
                      </div>

                      {/* Sparkline & Metadata row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-0.5">Attempt Trend</span>
                          <Sparkline scores={trendScores} />
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">
                            Attempts: <strong className="text-slate-300">{item.attempts || 0}</strong>
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {formatDate(item.lastPracticed)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Strengths, Weaknesses & Recent Mistakes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Strengths & Concept Understood */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Verified Strengths</h3>
                      <span className="text-[11px] text-slate-400">Mastered algorithms & concepts</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {strengths.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {strengths.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-6 text-center">
                      No verified strengths yet. Solve practice problems with clean pass test cases.
                    </p>
                  ) : (
                    strengths.map(st => (
                      <div
                        key={st._id}
                        className="p-3 bg-slate-950/60 rounded-xl border border-emerald-900/30 hover:border-emerald-800/60 transition"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                            {st.topic}
                          </span>
                          <span className="text-[11px] font-medium text-emerald-400">
                            {Math.round((st.confidence ?? 0.8) * 100)}% conf
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed">
                          {st.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Active Weaknesses */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-rose-950 text-rose-400 border border-rose-800">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Active Weaknesses</h3>
                      <span className="text-[11px] text-slate-400">Targeted review areas</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                    {weaknesses.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {weaknesses.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-6 text-center">
                      No active weaknesses flagged. Great work!
                    </p>
                  ) : (
                    weaknesses.map(wk => (
                      <div
                        key={wk._id}
                        className="p-3 bg-slate-950/60 rounded-xl border border-rose-900/30 hover:border-rose-800/60 transition"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/60">
                            {wk.topic}
                          </span>
                          <span className="text-[11px] font-medium text-rose-400">
                            {Math.round((wk.confidence ?? 0.7) * 100)}% conf
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed">
                          {wk.content}
                        </p>
                        {wk.meta?.errorType && (
                          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                            <span>Primary error:</span>
                            <code className="text-rose-300 bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-900">
                              {wk.meta.errorType}
                            </code>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Mistakes (Last 5) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-amber-950 text-amber-400 border border-amber-800">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Recent Mistakes</h3>
                      <span className="text-[11px] text-slate-400">Last 5 active recurring bugs</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                    {recentMistakes.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {recentMistakes.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-6 text-center">
                      No recent mistakes recorded.
                    </p>
                  ) : (
                    recentMistakes.map(mk => (
                      <div
                        key={mk._id}
                        className="p-3 bg-slate-950/60 rounded-xl border border-amber-900/30 hover:border-amber-800/60 transition"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60">
                            {mk.topic}
                          </span>
                          {mk.meta?.errorType && (
                            <span className="text-[10px] text-amber-400 font-mono">
                              {mk.meta.errorType}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed">
                          {mk.content}
                        </p>
                        {mk.evidence?.[0] && (
                          <p className="mt-1.5 text-[11px] text-slate-400 italic bg-slate-900/60 p-1.5 rounded border border-slate-800">
                            "{mk.evidence[0].text}"
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 4. Recent Coding Attempts Activity Feed */}
            {recentAttempts.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Code className="w-5 h-5 text-cyan-400" />
                      Recent Practice Attempts
                    </h2>
                    <p className="text-xs text-slate-400">
                      Audit log of submitted solutions and test cases.
                    </p>
                  </div>
                  <Link to="/practice" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                    Go to Practice <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Question</th>
                        <th className="py-2.5 px-3">Topic</th>
                        <th className="py-2.5 px-3">Result</th>
                        <th className="py-2.5 px-3">Tests</th>
                        <th className="py-2.5 px-3">Diagnosis</th>
                        <th className="py-2.5 px-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {recentAttempts.map((attempt) => (
                        <tr key={attempt._id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3 font-semibold text-white font-mono text-[11px]">
                            {attempt.questionId}
                          </td>
                          <td className="py-3 px-3 capitalize">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                              {attempt.topic}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {attempt.result === 'pass' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800">
                                <XCircle className="w-3 h-3" /> FAIL
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {attempt.testsPassed ?? 0} / {attempt.testsTotal ?? 0}
                          </td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                            {attempt.errorType && attempt.errorType !== 'none' ? (
                              <span className="text-amber-300 font-mono text-[11px]">
                                {attempt.errorType}
                              </span>
                            ) : (
                              <span className="text-slate-500">None</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 text-[11px]">
                            {formatDate(attempt.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
