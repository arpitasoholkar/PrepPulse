import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Code2, Brain, UserRound, ArrowUpRight, Flame } from 'lucide-react';
import { useActivity } from '../context/ActivityContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/mentor', label: 'Mentor', icon: MessageSquareText },
  { to: '/practice', label: 'Practice', icon: Code2 },
  { to: '/vault', label: 'Memory Vault', icon: Brain },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

// Waveform mark inside a round badge, like the logo in the reference.
function Logo() {
  const bars = [8, 14, 22, 14, 18, 10];
  return (
    <Link to="/" aria-label="IntelliPrep home" className="flex items-center gap-3 px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9f26e] rounded-full">
      <span className="grid place-items-center w-11 h-11 rounded-full bg-white">
        <svg width="26" height="24" viewBox="0 0 26 24" fill="none" aria-hidden="true">
          {bars.map((h, i) => (
            <rect key={i} x={2 + i * 4} y={12 - h / 2} width="2.4" height={h} rx="1.2" fill={i % 2 ? '#7c5cff' : '#1f1f38'} />
          ))}
        </svg>
      </span>
      <span className="text-[26px] font-extrabold tracking-tight text-white">IntelliPrep</span>
    </Link>
  );
}

// Lime card at the bottom of the sidebar (the "download app" card in the reference).
function StreakCard() {
  const { summary } = useActivity();
  const streak = summary?.streak?.current ?? 0;
  const doneToday = summary?.streak?.activeToday;
  return (
    <div className="relative mt-auto rounded-[28px] bg-[#d9f26e] p-5 pt-10 text-[#1f1f38]">
      <Link
        to="/practice"
        aria-label="Practice now"
        className="absolute top-0 left-1/2 -translate-x-1/2 grid place-items-center w-12 h-12 rounded-full bg-white text-[#1f1f38] ring-8 ring-[#1f1f38] translate-y-[-50%] focus:outline-none focus-visible:ring-[#7c5cff]"
      >
        <ArrowUpRight className="w-5 h-5" />
      </Link>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-11 h-11 rounded-2xl bg-white/70">
          <Flame className="w-6 h-6 text-[#e0622d]" />
        </span>
        <div className="leading-tight">
          <p className="text-3xl font-extrabold">{streak}<span className="text-base font-bold ml-1">day{streak === 1 ? '' : 's'}</span></p>
          <p className="text-xs font-semibold text-[#1f1f38]/70">learning streak</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-snug">
        {doneToday ? 'Streak secured for today. Nice work.' : 'Solve a question or ask the mentor to keep it alive.'}
      </p>
    </div>
  );
}

export default function Navbar() {
  return (
    <>
      {/* Desktop: dark sidebar */}
      <aside className="hidden lg:flex flex-col w-[17rem] xl:w-[18rem] shrink-0 lg:sticky lg:top-6 h-[calc(100vh-3rem)] rounded-[36px] bg-[#1f1f38] p-5 xl:p-6 text-white">
        <Logo />

        <nav aria-label="Main" className="mt-6 flex flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `side-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9f26e] ${isActive ? 'side-link-active' : ''}`
              }
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <StreakCard />
      </aside>

      {/* Mobile: floating dark bar */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-3 inset-x-3 z-40 flex items-center justify-around rounded-full bg-[#1f1f38] px-2 py-2 shadow-2xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} aria-label={label} title={label}>
            {({ isActive }) => (
              <span className={`grid place-items-center w-12 h-12 rounded-full transition ${isActive ? 'bg-[#d9f26e] text-[#1f1f38]' : 'text-white/80 hover:bg-white/10'}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
