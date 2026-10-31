import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActivitySummary } from '../../api/activity.js';
import { useActivity } from '../../context/ActivityContext.jsx';
import { formatMinutes } from '../../lib/format.js';

const pad = (n) => String(n).padStart(2, '0');
const monthKeyOf = (y, m) => `${y}-${pad(m + 1)}`; // m is 0 based

// Month calendar. Today is lime, days you learned on are lavender.
export default function ActivityCalendar({ className = '' }) {
  const { summary } = useActivity();
  const todayKey = summary?.today || new Date().toLocaleDateString('en-CA');
  const currentMonth = todayKey.slice(0, 7);

  const [month, setMonth] = useState(currentMonth);
  const [fetched, setFetched] = useState({}); // month -> days[]

  useEffect(() => {
    if (month === summary?.month?.month || fetched[month]) return undefined;
    let cancelled = false;
    getActivitySummary(month)
      .then((res) => { if (!cancelled) setFetched((f) => ({ ...f, [month]: res.data.month.days })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [month, summary, fetched]);

  const dayData = useMemo(() => {
    const list = month === summary?.month?.month ? summary.month.days : fetched[month] || [];
    return new Map(list.map((d) => [d.day, d]));
  }, [month, summary, fetched]);

  const [y, mo] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = first.getUTCDay();
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const prevDim = new Date(Date.UTC(y, mo - 1, 0)).getUTCDate();

  const cells = [];
  for (let i = lead - 1; i >= 0; i--) cells.push({ n: prevDim - i, other: true });
  for (let d = 1; d <= dim; d++) cells.push({ n: d, key: `${month}-${pad(d)}` });
  while (cells.length % 7) cells.push({ n: cells.length - lead - dim + 1, other: true });

  const go = (delta) => {
    const dt = new Date(Date.UTC(y, mo - 1 + delta, 1));
    setMonth(monthKeyOf(dt.getUTCFullYear(), dt.getUTCMonth()));
  };

  const list = [...dayData.values()];
  const activeDays = list.filter((d) => d.active).length;
  const minutes = list.reduce((s, d) => s + d.minutes, 0);
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <section className={`glass rounded-[24px] p-4 ${className}`} aria-label="Activity calendar">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} aria-label="Previous month"
          className="grid place-items-center w-9 h-9 rounded-xl border border-[#ececf2] bg-white hover:bg-[#f6f5fa] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <button type="button" onClick={() => go(1)} disabled={month >= currentMonth} aria-label="Next month"
          className="grid place-items-center w-9 h-9 rounded-xl border border-[#ececf2] bg-white hover:bg-[#f6f5fa] text-ink disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 rounded-2xl bg-[#f1f0f6] py-2 text-center text-xs font-extrabold text-ink">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
        {cells.map((c, i) => {
          if (c.other) return <span key={i} className="py-1 text-sm text-[#c4c4d2]">{c.n}</span>;
          const info = dayData.get(c.key);
          const isToday = c.key === todayKey;
          const active = info?.active;
          const future = c.key > todayKey;
          const label = info ? `${formatMinutes(info.minutes)}, ${info.attempts} attempts, ${info.chats} chats` : undefined;
          return (
            <span key={i} className="grid place-items-center py-0.5">
              <span
                title={label}
                className={`grid place-items-center w-8 h-8 rounded-full text-sm ${
                  isToday ? 'bg-[#F28A52] font-extrabold text-ink'
                    : active ? 'bg-[#EAE1F7] font-bold text-[#5B3E9E]'
                      : future ? 'text-[#c4c4d2]' : 'text-ink'
                }`}
              >
                {c.n}
              </span>
            </span>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#ececf2] pt-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#EAE1F7]" />{activeDays} active {activeDays === 1 ? 'day' : 'days'}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#F28A52]" />Today</span>
        <span className="font-semibold text-ink">{formatMinutes(minutes)}</span>
      </div>
    </section>
  );
}
