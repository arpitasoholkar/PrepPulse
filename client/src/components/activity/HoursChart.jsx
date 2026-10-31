import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatMinutes, prettyDate } from '../../lib/format.js';

// Weekly "Hours Activity" bars, Sunday to Saturday. Today is lime.
export default function HoursChart({ week, className = '' }) {
  const days = week?.days || [];
  const todayIdx = Math.max(0, days.findIndex((d) => d.isToday));
  const [hover, setHover] = useState(null);
  const active = hover ?? todayIdx;

  const maxMin = Math.max(0, ...days.map((d) => d.minutes));
  // Grid step in minutes: 30 for light weeks, then whole hours
  const stepMin = maxMin <= 120 ? 30 : Math.ceil(maxMin / 4 / 60) * 60;
  const axisMax = stepMin * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => (i * stepMin) / 60); // hours

  const delta = week?.deltaPct ?? 0;
  const up = delta >= 0;
  const activeDay = days[active];

  return (
    <section className={`glass rounded-[24px] p-5 ${className}`} aria-label="Hours activity">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Hours Activity</h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-[#f1f0f6] text-ink">
              {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </span>
            <span className={`font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>{up ? '+' : ''}{delta}%</span>
            <span className="text-ink-soft whitespace-nowrap">{up ? 'Increase' : 'Decrease'} than last week</span>
          </p>
        </div>
        <span className="rounded-full border border-[#ececf2] bg-white px-4 py-2 text-sm font-semibold text-ink-soft whitespace-nowrap">
          This week · {formatMinutes(week?.totalMinutes || 0)}
        </span>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="relative h-[130px] w-8 shrink-0 text-xs font-semibold text-ink-soft" aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 4) * 100}%` }}>{t}h</span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-x-0 top-0 h-[130px]" aria-hidden="true">
            {ticks.map((t, i) => (
              <div key={t} className="absolute inset-x-0 border-t border-[#ececf2]" style={{ top: `${(i / 4) * 100}%` }} />
            ))}
          </div>

          <div className="relative h-[130px] flex items-end justify-between gap-2 px-1" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => {
              const pct = d.minutes > 0 ? Math.max(3, (d.minutes / axisMax) * 100) : 0;
              const isActive = i === active;
              return (
                <button
                  key={d.day}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d.label}, ${formatMinutes(d.minutes)}`}
                  className="relative flex-1 h-full flex items-end justify-center focus:outline-none group"
                >
                  {isActive && activeDay && (
                    <span className={`pointer-events-none absolute z-10 -translate-y-2 whitespace-nowrap ${i >= days.length - 2 ? 'right-0' : i <= 1 ? 'left-0' : 'left-1/2 -translate-x-1/2'} rounded-xl bg-[#1f1f38] px-3 py-1.5 text-[11px] font-semibold text-[#fff] shadow-lg`}
                      style={{ bottom: `calc(${pct}% + 4px)` }}>
                      <span className="block font-extrabold">{formatMinutes(d.minutes)}</span>
                      <span className="block text-[#fff]/60">{prettyDate(d.day)}</span>
                    </span>
                  )}
                  <span
                    className={`block w-[10px] rounded-full transition-all ${
                      isActive ? 'bg-[#d9f26e]' : d.future ? 'bg-[#ececf2]' : 'bg-[#1f1f38]'
                    } group-focus-visible:ring-2 group-focus-visible:ring-violet-400`}
                    style={{ height: d.minutes > 0 ? `${pct}%` : '6px', opacity: d.minutes > 0 || d.future ? 1 : 0.18 }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-between px-1">
            {days.map((d, i) => (
              <span key={d.day} className={`flex-1 text-center text-sm font-semibold ${i === active ? 'text-ink' : 'text-ink-soft'}`}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
